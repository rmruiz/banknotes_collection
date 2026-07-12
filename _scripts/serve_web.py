#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Servidor local de la web + API mínima de edición.

Uso:
    python3 _scripts/serve_web.py [puerto]     # default 8000
    -> http://localhost:<puerto>/web/

Sirve solo la web y los assets de imágenes (web/, _originals/, _FULL/,
_flags/) y expone:

    POST /api/update       body: {"id": "cl-p125", "field": "anio", "value": 1961}
        Campos permitidos: pais, valor, moneda, denominacion, anio, verificado.
        Actualiza el JSON del billete (fuente de verdad) y regenera su
        registro en web/data/collection.json (incluye search/bandera).
    POST /api/verificado   (compatibilidad) body: {"id": "...", "verificado": true}

Medidas de seguridad:
  - Escucha SOLO en 127.0.0.1 (no accesible desde la red).
  - GET restringido a una whitelist de prefijos (no expone .git/, _json/,
    _scripts/, etc.).
  - POST valida Host (localhost) y exige Origin de localhost — bloquea
    CSRF y DNS-rebinding.
  - El id se valida por regex y contra el índice de JSON existentes
    (imposible tocar rutas arbitrarias / path traversal).
  - Solo campos de la whitelist, con validación de tipo/valor por campo.
  - Body limitado a 4 KB; fotos re-codificadas con magick al subir.
  - Escrituras atómicas (tmp + os.replace) y con lock (una a la vez).
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs

REPO = Path(__file__).resolve().parent.parent
JSON_DIR = REPO / "_json"
COLLECTION = REPO / "web" / "data" / "collection.json"
ORIGINALS = REPO / "_originals"

sys.path.insert(0, str(Path(__file__).resolve().parent))   # _scripts
sys.path.insert(0, str(JSON_DIR))                          # _json
import build_web                    # reusa make_record (search, bandera, thumbs)
import generar_imagen               # reusa compose() y flag_for()
from util import unaccent, make_note_id          # convenios compartidos
from country_map import COUNTRY_EN, COUNTRY_MAP  # país es -> en / -> abreviación
from generate_json import FOLDER_ROUTE           # país -> carpeta _json destino

BIND = "0.0.0.0"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

ID_RE = re.compile(r"^[a-z0-9][a-z0-9.\-]{0,80}$")
ORIGIN_RE = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")
HOST_RE = re.compile(r"^(localhost|127\.0\.0\.1)(:\d+)?$")   # anti DNS-rebinding
# nombre de carpeta bajo _originals: ASCII, sin separadores de ruta, sin punto
# ni espacio inicial/final (evita traversal y nombres problemáticos en Windows)
FOLDER_RE = re.compile(r"^[\w][\w .\-]{0,118}[\w\-]$", re.ASCII)

# prefijos que el servidor está dispuesto a servir por GET (todo lo demás -> 404).
# el frontend vive en /web/ y referencia imágenes en /_originals /_FULL /_flags.
ALLOWED_GET_PREFIXES = ("/web/", "/_originals/", "/_FULL/", "/_flags/")

WRITE_LOCK = threading.Lock()

# índice id -> ruta del JSON (construido al inicio; los ids son estables)
IDS = {f.stem: f for f in JSON_DIR.glob("*/*.json")}


# ---- creación de JSON desde una carpeta con nombre viejo ----

# país sin acentos (como viene en carpetas viejas) -> (clave acentuada, abbr)
COUNTRY_LOOKUP = {unaccent(k).lower(): (k, v) for k, v in COUNTRY_MAP.items()}

_CONNECTORS = {"y", "de", "del", "la", "los", "las"}


def _display_name(key):
    """'estados unidos' -> 'Estados Unidos'; 'isla de man' -> 'Isla de Man'."""
    words = key.split(" ")
    out = [w if (w in _CONNECTORS and i > 0) else w.capitalize()
           for i, w in enumerate(words)]
    return " ".join(out)


VAL_RE = re.compile(r"^(\d+)\.(.+)$")       # '1.Dolar' / '05.Escudos'
YEAR_RE = re.compile(r"(19|20)\d{2}")
PICK_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 .\-]{0,39}$")


def _parse_value_tok(tok):
    if tok.startswith("0") and len(tok) > 1:      # 05 -> 0.5, 025 -> 0.25
        return int(tok) / (10 ** (len(tok) - 1))
    return int(tok)


def parse_old_folder(name):
    """Deriva país/valor/moneda/año/extras desde el nombre viejo de carpeta."""
    parts = name.split("_")
    pais_key = unaccent(parts[0].replace(".", " ")).lower()
    found = COUNTRY_LOOKUP.get(pais_key)
    if not found:
        return None, f"país no reconocido en el nombre: {parts[0]!r}"
    key_es, abbr = found

    value = currency = year = None
    extras = []
    for p in parts[1:]:
        m = VAL_RE.match(p)
        if m and value is None:
            value = _parse_value_tok(m.group(1))
            currency = m.group(2).replace(".", " ")
            continue
        y = YEAR_RE.search(p)
        if y and year is None:
            year = int(y.group(0))
            resto = p.replace(y.group(0), "").strip(". ")
            if resto:
                extras.append(resto.replace(".", " "))
            continue
        if p:
            extras.append(p.replace(".", " "))

    return {
        "abbr": abbr,
        "pais_es": _display_name(key_es),
        "pais_en": COUNTRY_EN.get(key_es, _display_name(key_es)),
        "value": value,
        "currency": currency or "",
        "year": year,
        "obs": " - ".join(extras),
        "route": FOLDER_ROUTE.get(key_es, "world"),
    }, None


# ---- campos editables: validador + aplicador sobre el dict del billete ----

def _set_pais(d, v):
    v = v.strip()
    d["country"]["es"] = v
    en = COUNTRY_EN.get(v.lower())
    if en:
        d["country"]["en"] = en


def _v_str(maxlen, allow_empty=True):
    def check(v):
        return isinstance(v, str) and len(v) <= maxlen and \
               (allow_empty or bool(v.strip()))
    return check


def _v_num(v):
    return v is None or (isinstance(v, (int, float))
                         and not isinstance(v, bool) and 0 <= v < 10 ** 12)


def _v_year(v):
    return v is None or (isinstance(v, int) and not isinstance(v, bool)
                         and 1000 <= v <= 2100)


def _v_url(v):
    """URL http(s) o vacío (para poder borrarla)."""
    return isinstance(v, str) and len(v) <= 300 and \
        (v.strip() == "" or v.strip().startswith(("http://", "https://")))


# escala internacional de condición (IBNS); "" = sin clasificar
CONDICIONES = {"", "UNC", "AU", "XF", "VF", "F", "VG", "G", "Fair", "Poor"}

TEMA_RE = re.compile(r"^[\w\-]+\s*:\s*.+$")


def _v_temas(v):
    """'' o pares 'clave:valor' separados por coma."""
    if not isinstance(v, str) or len(v) > 500:
        return False
    v = v.strip()
    return not v or all(TEMA_RE.match(p.strip()) for p in v.split(","))


def _set_temas(d, v):
    d["themes"] = [re.sub(r"\s*:\s*", ":", p.strip())
                   for p in v.split(",") if p.strip()]


def _set_firmas(d, v):
    d["signatures"] = [s.strip() for s in v.split(" - ") if s.strip()]


FIELDS = {
    "pais": (_v_str(80, allow_empty=False), _set_pais),
    "colnect": (_v_url, lambda d, v: d["colnect"].update(url=v.strip())),
    "numista": (_v_url, lambda d, v: d.update(numista=v.strip())),
    "valor": (_v_num, lambda d, v: d["denomination"].update(value=v)),
    "moneda": (_v_str(80), lambda d, v: d["denomination"].update(currency=v.strip())),
    "anio": (_v_year, lambda d, v: d.update(year=v)),
    "verificado": (lambda v: isinstance(v, bool), lambda d, v: d.update(verificado=v)),
    "conmemorativo": (lambda v: isinstance(v, bool),
                      lambda d, v: d.update(commemorative=v)),
    "remarcado": (lambda v: isinstance(v, bool),
                  lambda d, v: d.update(overprint=v)),
    "obs": (_v_str(300), lambda d, v: d["notes"].update(obs=v.strip())),
    "grupo": (_v_str(200), lambda d, v: d["colnect"].update(group=v.strip())),
    "vigencia": (_v_str(120), lambda d, v: d["notes"].update(vigencia=v.strip())),
    "serie": (_v_str(120), lambda d, v: d["notes"].update(serie=v.strip())),
    "banco": (_v_str(120), lambda d, v: d["notes"].update(bank=v.strip())),
    "zona": (_v_str(120), lambda d, v: d["notes"].update(zone=v.strip())),
    "serial": (_v_str(80),
               lambda d, v: d["specimens"][0].update(serial_number=v.strip())),
    "condicion": (lambda v: isinstance(v, str) and v.strip() in CONDICIONES,
                  lambda d, v: d["specimens"][0].update(condition=v.strip())),
    "firmas": (_v_str(200), _set_firmas),
    "temas": (_v_temas, _set_temas),
    "subtipo": (_v_str(80), lambda d, v: d["denomination"].update(subtype=v.strip())),
    "alternativas": (_v_str(120), lambda d, v: d["denomination"].update(alternatives=[x.strip() for x in v.replace("·", ",").split(",") if x.strip()])),
}


def atomic_write(path: Path, text: str):
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


def atomic_write_bytes(path: Path, data: bytes):
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


def _sanitize_jpeg(data: bytes, work_dir: Path) -> bytes:
    """Re-codifica el JPEG con magick: valida que sea una imagen real y
    elimina cualquier payload adosado (defensa anti-polyglot). Devuelve los
    bytes limpios. Lanza ValueError si no es una imagen decodificable.
    Si magick no está instalado, devuelve los bytes originales (ya validados
    por los bytes mágicos) para no romper la subida."""
    fd_i, tmp_in = tempfile.mkstemp(dir=str(work_dir), suffix=".in")
    fd_o, tmp_out = tempfile.mkstemp(dir=str(work_dir), suffix=".out.jpg")
    os.close(fd_o)
    try:
        with os.fdopen(fd_i, "wb") as fh:
            fh.write(data)
        try:
            subprocess.run(["magick", tmp_in, "-strip", tmp_out],
                           check=True, capture_output=True)
        except FileNotFoundError:
            return data                      # sin magick: se conserva el original
        except subprocess.CalledProcessError:
            raise ValueError("no es una imagen válida")
        return Path(tmp_out).read_bytes()
    finally:
        for t in (tmp_in, tmp_out):
            try:
                os.unlink(t)
            except OSError:
                pass


# prefijos que SÍ pueden cachearse (imágenes pesadas e inmutables)
CACHEABLE_PREFIXES = ("/web/thumbs/", "/_originals/", "/_FULL/", "/_flags/",
                      "/web/pico.min.css")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO), **kwargs)

    def log_message(self, fmt, *args):  # log compacto
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def end_headers(self):
        # evita que el navegador muestre datos viejos (collection.json, app.js…)
        path = self.path.split("?", 1)[0]
        if not path.startswith(CACHEABLE_PREFIXES):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        """Choke point de GET/HEAD: solo sirve la whitelist; el resto -> 404.
        Evita exponer .git/, _json/, _scripts/, TSV fuente, etc."""
        path = unquote(self.path.split("?", 1)[0])
        if path in ("", "/", "/web"):
            self.send_response(302)
            self.send_header("Location", "/web/")
            self.end_headers()
            return None
        if ".." in path or not path.startswith(ALLOWED_GET_PREFIXES):
            self.send_error(404)
            return None
        return super().send_head()

    # ---------- API ----------
    def do_POST(self):
        # anti DNS-rebinding: el Host debe ser localhost (no un dominio del atacante)
        if not HOST_RE.match(self.headers.get("Host") or ""):
            return self._json_error(403, "host no permitido")
        # anti CSRF: exige Origin de localhost (los navegadores lo envían en POST)
        if not ORIGIN_RE.match(self.headers.get("Origin") or ""):
            return self._json_error(403, "origen no permitido")

        # subida de foto: body binario, metadatos en la query string
        parsed = urlparse(self.path)
        if parsed.path == "/api/upload_photo":
            qs = parse_qs(parsed.query)
            return self._handle_upload_photo(qs.get("id", [None])[0],
                                             qs.get("side", [None])[0])

        if self.path == "/api/rebuild":
            return self._handle_rebuild()

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self._json_error(400, "Content-Length inválido")
        if not (0 < length <= 4096):
            return self._json_error(400, "body vacío o demasiado grande")

        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._json_error(400, "JSON inválido")

        if self.path == "/api/rename_folder":
            return self._handle_rename_folder(body.get("carpeta"), body.get("nuevo"))

        if self.path == "/api/create_json":
            return self._handle_create_json(body.get("carpeta"), body.get("pick"))

        if self.path == "/api/new_note":
            return self._handle_new_note(body.get("pais"), body.get("pick"))

        if self.path == "/api/generar_full":
            return self._handle_generar_full(body.get("id"))

        if self.path == "/api/change_pick":
            return self._handle_change_pick(body.get("id"), body.get("pick"))

        if self.path == "/api/update":
            _id, field, value = body.get("id"), body.get("field"), body.get("value")
        elif self.path == "/api/verificado":   # compatibilidad
            _id, field, value = body.get("id"), "verificado", body.get("verificado")
        else:
            return self._json_error(404, "endpoint desconocido")

        self._handle_update(_id, field, value)

    def _handle_rename_folder(self, carpeta, nuevo):
        """Renombra _originals/<carpeta> -> <nuevo> y sus fotos a <nuevo>_A/_B."""
        for v in (carpeta, nuevo):
            if not isinstance(v, str) or not FOLDER_RE.match(v) or ".." in v:
                return self._json_error(400, "nombre de carpeta inválido")
        src, dest = ORIGINALS / carpeta, ORIGINALS / nuevo
        # anti-traversal: ambos deben quedar directamente bajo _originals
        if src.parent != ORIGINALS or dest.parent != ORIGINALS:
            return self._json_error(400, "ruta inválida")
        if not src.is_dir():
            return self._json_error(404, f"no existe la carpeta: {carpeta}")
        if dest.exists():
            return self._json_error(400, f"ya existe una carpeta llamada: {nuevo}")

        try:
            with WRITE_LOCK:
                src.rename(dest)
                renombrados = []
                for side in ("A", "B"):
                    f = next(iter(sorted(dest.glob(f"*_{side}.jpg"))), None)
                    target = dest / f"{nuevo}_{side}.jpg"
                    if f and f != target:
                        f.rename(target)
                        renombrados.append(target.name)
        except OSError as e:
            return self._json_error(500, f"error al renombrar: {e}")

        self._json_ok({"ok": True, "carpeta": nuevo, "archivos": renombrados})
        self.log_message("rename_folder %r -> %r", carpeta, nuevo)

    def _handle_create_json(self, carpeta, pick):
        """Crea el JSON del billete a partir del pick + datos derivados del
        nombre viejo de la carpeta, y renombra la carpeta al nuevo id."""
        if not isinstance(carpeta, str) or not FOLDER_RE.match(carpeta) or ".." in carpeta:
            return self._json_error(400, "nombre de carpeta inválido")
        if not isinstance(pick, str) or not PICK_RE.match(pick.strip()):
            return self._json_error(400, "pick inválido")
        pick = pick.strip()

        src = ORIGINALS / carpeta
        if src.parent != ORIGINALS or not src.is_dir():
            return self._json_error(404, f"no existe la carpeta: {carpeta}")

        info, err = parse_old_folder(carpeta)
        if err:
            return self._json_error(400, err)

        _id = make_note_id(info["abbr"], pick)
        if _id in IDS or (ORIGINALS / _id).exists():
            return self._json_error(400, f"ya existe el id: {_id}")

        d = {
            "id": _id,
            "pick_number": pick,
            "country": {"en": info["pais_en"], "es": info["pais_es"]},
            "denomination": {
                "value": info["value"],
                "currency": info["currency"],
                "subtype": "",
                "alternatives": [],
            },
            "year": info["year"],
            "signatures": [],
            "themes": [],
            "colnect": {"url": "", "group": ""},
            "commemorative": False,
            "overprint": False,
            "verificado": False,
            "notes": {"serie": "", "bank": "", "zone": "",
                      "vigencia": "", "obs": info["obs"]},
            "specimens": [{"serial_number": "", "condition": ""}],
        }

        dest_dir = JSON_DIR / info["route"]
        json_path = dest_dir / f"{_id}.json"
        dest = ORIGINALS / _id
        try:
            with WRITE_LOCK:
                dest_dir.mkdir(parents=True, exist_ok=True)
                atomic_write(json_path,
                             json.dumps(d, ensure_ascii=False, indent=2) + "\n")
                IDS[_id] = json_path
                # renombrar carpeta y fotos al nuevo id
                src.rename(dest)
                for side in ("A", "B"):
                    f = next(iter(sorted(dest.glob(f"*_{side}.jpg"))), None)
                    target = dest / f"{_id}_{side}.jpg"
                    if f and f != target:
                        f.rename(target)
        except OSError as e:
            return self._json_error(500, f"error al crear: {e}")

        self._json_ok({"ok": True, "id": _id, "json": str(json_path.relative_to(REPO)),
                       "pais": info["pais_es"], "carpeta": _id})
        self.log_message("create_json %r pick=%r -> %s", carpeta, pick, _id)

    def _handle_upload_photo(self, _id, side):
        """Guarda un JPG subido como _originals/<id>/<id>_<A|B>.jpg."""
        if not isinstance(_id, str) or not ID_RE.match(_id) or _id not in IDS:
            return self._json_error(400, "id inválido o inexistente")
        if side not in ("A", "B"):
            return self._json_error(400, "side debe ser A o B")
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self._json_error(400, "Content-Length inválido")
        if not (0 < length <= 30 * 1024 * 1024):
            return self._json_error(400, "archivo vacío o mayor a 30 MB")

        data = self.rfile.read(length)
        if data[:3] != b"\xff\xd8\xff":
            return self._json_error(400, "el archivo no es un JPEG válido")

        dest_dir = ORIGINALS / _id
        dest = dest_dir / f"{_id}_{side}.jpg"
        try:
            with WRITE_LOCK:
                dest_dir.mkdir(parents=True, exist_ok=True)
                data = _sanitize_jpeg(data, dest_dir)
                atomic_write_bytes(dest, data)
        except ValueError:
            return self._json_error(400, "el archivo no es una imagen válida")
        except OSError as e:
            return self._json_error(500, f"error al guardar: {e}")

        self._json_ok({"ok": True, "id": _id, "side": side, "bytes": len(data)})
        self.log_message("upload_photo %s_%s (%d KB)", _id, side, len(data) // 1024)

    def _handle_generar_full(self, _id):
        """Compone la imagen Full de un billete (frente+info+bandera+reverso)."""
        if not isinstance(_id, str) or not ID_RE.match(_id):
            return self._json_error(400, "id inválido")
        path = IDS.get(_id)
        if path is None or not path.exists():
            return self._json_error(404, f"id no existe: {_id}")

        d = json.loads(path.read_text(encoding="utf-8"))
        pfront = ORIGINALS / _id / f"{_id}_A.jpg"
        pback = ORIGINALS / _id / f"{_id}_B.jpg"
        if not (pfront.exists() and pback.exists()):
            return self._json_error(400, "faltan fotos front/back")
        flag = generar_imagen.flag_for(d["country"]["es"])
        if flag is None or not flag.exists():
            return self._json_error(400,
                                    f"sin bandera para {d['country']['es']}")

        pfull = REPO / "_FULL" / f"{_id}.jpg"
        try:
            with WRITE_LOCK:
                with tempfile.TemporaryDirectory() as td:
                    generar_imagen.compose(d, pfront, pback, flag, pfull,
                                           Path(td))
        except Exception as e:   # noqa: BLE001 — reportar fallo de magick
            return self._json_error(500, f"error al componer: {e}")

        self._json_ok({"ok": True, "id": _id, "full": f"_FULL/{_id}.jpg"})
        self.log_message("generar_full %s", _id)

    def _handle_new_note(self, pais, pick):
        """Crea un billete nuevo desde cero con país + pick; el resto de los
        campos quedan vacíos para completarlos editando en la tabla."""
        if not isinstance(pick, str) or not PICK_RE.match(pick.strip()):
            return self._json_error(400, "pick inválido")
        if not isinstance(pais, str) or not pais.strip():
            return self._json_error(400, "país requerido")
        pick = pick.strip()

        found = COUNTRY_LOOKUP.get(unaccent(pais.strip()).lower())
        if not found:
            return self._json_error(400, f"país no reconocido: {pais.strip()!r} "
                                         "(agregarlo a _json/country_map.py)")
        key_es, abbr = found

        _id = make_note_id(abbr, pick)
        if _id in IDS:
            return self._json_error(400, f"ya existe el id: {_id}")

        d = {
            "id": _id,
            "pick_number": pick,
            "country": {"en": COUNTRY_EN.get(key_es, _display_name(key_es)),
                        "es": _display_name(key_es)},
            "denomination": {"value": None, "currency": "",
                             "subtype": "", "alternatives": []},
            "year": None,
            "numista": "",
            "signatures": [],
            "themes": [],
            "colnect": {"url": "", "group": ""},
            "commemorative": False,
            "overprint": False,
            "verificado": False,
            "notes": {"serie": "", "bank": "", "zone": "",
                      "vigencia": "", "obs": ""},
            "specimens": [{"serial_number": "", "condition": ""}],
        }

        dest_dir = JSON_DIR / FOLDER_ROUTE.get(key_es, "world")
        json_path = dest_dir / f"{_id}.json"
        try:
            with WRITE_LOCK:
                dest_dir.mkdir(parents=True, exist_ok=True)
                atomic_write(json_path,
                             json.dumps(d, ensure_ascii=False, indent=2) + "\n")
                IDS[_id] = json_path
                # insertar ordenado en collection.json (mismo orden del build)
                rec_new = build_web.make_record(d)
                if COLLECTION.exists():
                    coll = json.loads(COLLECTION.read_text(encoding="utf-8"))
                    sk = build_web.sort_key
                    pos = next((i for i, r in enumerate(coll)
                                if sk(r) > sk(rec_new)), len(coll))
                    coll.insert(pos, rec_new)
                    atomic_write(COLLECTION,
                                 json.dumps(coll, ensure_ascii=False,
                                            separators=(",", ":")))
        except OSError as e:
            return self._json_error(500, f"error al crear: {e}")

        self._json_ok({"ok": True, "id": _id, "record": rec_new,
                       "json": str(json_path.relative_to(REPO))})
        self.log_message("new_note %s (pais=%r pick=%r)", _id, pais, pick)

    def _handle_change_pick(self, _id, pick):
        """Cambia el pick de un billete. El id deriva del pick, así que
        renombra en cascada: JSON, carpeta de fotos y _FULL/<id>.jpg."""
        if not isinstance(_id, str) or not ID_RE.match(_id):
            return self._json_error(400, "id inválido")
        if not isinstance(pick, str) or not PICK_RE.match(pick.strip()):
            return self._json_error(400, "pick inválido")
        pick = pick.strip()

        path = IDS.get(_id)
        if path is None or not path.exists():
            return self._json_error(404, f"id no existe: {_id}")

        abbr = _id.split("-", 1)[0]
        new_id = make_note_id(abbr, pick)
        if new_id != _id and (new_id in IDS or (ORIGINALS / new_id).exists()):
            return self._json_error(400, f"ya existe el id: {new_id}")

        new_path = path.parent / f"{new_id}.json"
        try:
            with WRITE_LOCK:
                d = json.loads(path.read_text(encoding="utf-8"))
                d["id"] = new_id
                d["pick_number"] = pick
                atomic_write(new_path,
                             json.dumps(d, ensure_ascii=False, indent=2) + "\n")
                if new_path != path:
                    path.unlink()
                    del IDS[_id]
                IDS[new_id] = new_path

                if new_id != _id:
                    # carpeta de fotos + archivos internos
                    old_dir = ORIGINALS / _id
                    if old_dir.is_dir():
                        new_dir = ORIGINALS / new_id
                        old_dir.rename(new_dir)
                        for side in ("A", "B"):
                            f = next(iter(sorted(new_dir.glob(f"*_{side}.jpg"))), None)
                            target = new_dir / f"{new_id}_{side}.jpg"
                            if f and f != target:
                                f.rename(target)
                    # imagen consolidada
                    old_full = REPO / "_FULL" / f"{_id}.jpg"
                    if old_full.exists():
                        old_full.rename(REPO / "_FULL" / f"{new_id}.jpg")
        except OSError as e:
            return self._json_error(500, f"error al cambiar pick: {e}")

        self._json_ok({"ok": True, "id": new_id, "pick": pick, "id_anterior": _id})
        self.log_message("change_pick %s -> %s (pick=%r)", _id, new_id, pick)

    def _handle_rebuild(self):
        """Re-escanea disco: regenera collection.json + miniaturas nuevas."""
        try:
            with WRITE_LOCK:
                res = build_web.build()
                # refrescar el índice de ids (por si aparecieron JSON nuevos)
                IDS.clear()
                IDS.update({f.stem: f for f in JSON_DIR.glob("*/*.json")})
        except Exception as e:   # noqa: BLE001 — reportar cualquier fallo al cliente
            return self._json_error(500, f"rebuild falló: {e}")
        res["ok"] = True
        self._json_ok(res)
        self.log_message("rebuild: %s registros, %s thumbs nuevas, %s json inválidos",
                         res["registros"], res["thumbs_generadas"],
                         res.get("json_invalidos", 0))

    def _handle_update(self, _id, field, value):
        if not isinstance(_id, str) or not ID_RE.match(_id):
            return self._json_error(400, "id inválido")
        if field not in FIELDS:
            return self._json_error(400, f"campo no editable: {field}")
        validate, apply_ = FIELDS[field]
        if not validate(value):
            return self._json_error(400, f"valor inválido para {field}")

        path = IDS.get(_id)
        if path is None or not path.exists():
            return self._json_error(404, f"id no existe: {_id}")

        try:
            with WRITE_LOCK:
                # 1) JSON del billete (fuente de verdad)
                d = json.loads(path.read_text(encoding="utf-8"))
                apply_(d, value)
                atomic_write(path, json.dumps(d, ensure_ascii=False, indent=2) + "\n")

                # 2) regenerar el registro completo en collection.json
                #    (search, bandera y país EN quedan consistentes)
                rec_new = build_web.make_record(d)
                if COLLECTION.exists():
                    coll = json.loads(COLLECTION.read_text(encoding="utf-8"))
                    for i, rec in enumerate(coll):
                        if rec.get("id") == _id:
                            coll[i] = rec_new
                            break
                    atomic_write(COLLECTION,
                                 json.dumps(coll, ensure_ascii=False,
                                            separators=(",", ":")))
        except OSError as e:
            return self._json_error(500, f"error de escritura: {e}")

        self._json_ok({"ok": True, "id": _id, "field": field, "record": rec_new})
        self.log_message("update %s.%s -> %r", _id, field, value)

    # ---------- helpers ----------
    def _json_ok(self, obj):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _json_error(self, code, msg):
        data = json.dumps({"ok": False, "error": msg}).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    print(f"Sirviendo {REPO}", flush=True)
    # rebuild al arrancar: así reiniciar el servidor siempre sirve datos frescos
    print("Reconstruyendo datos (collection/issues/miniaturas)…", flush=True)
    res = build_web.build()
    IDS.clear()
    IDS.update({f.stem: f for f in JSON_DIR.glob("*/*.json")})
    print(f"  {res['registros']} billetes | con fotos: {res['con_front']} "
          f"| thumbs nuevas: {res['thumbs_generadas']} "
          f"| problemas: {res['problemas']}")
    if res.get("json_invalidos"):
        print(f"  ⚠ JSON inválidos (omitidos del índice): {res['json_invalidos']}"
              " — ver página Problemas", flush=True)
    print(f"Billetes indexados: {len(IDS)}", flush=True)
    print(f"-> http://localhost:{PORT}/web/   (Ctrl-C para salir)", flush=True)
    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
