#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Construye los artefactos de la web estática (ver plan_web.md):

  1. Consolida _json/**/*.json  ->  web/data/collection.json
     (con campo "search" pre-normalizado: minúsculas y sin acentos)
  2. Genera miniaturas con magick (incremental, en paralelo):
     _originals/<id>/<id>_A.jpg -> web/thumbs/<id>_A.jpg
     _originals/<id>/<id>_B.jpg -> web/thumbs/<id>_B.jpg
     _FULL/<id>.jpg             -> web/thumbs/<id>_F.jpg

Uso:
    python3 _scripts/build_web.py            # incremental
    python3 _scripts/build_web.py --force    # regenera todas las miniaturas
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # _scripts (util)
from util import unaccent, norm_flag   # noqa: E402

REPO = Path(__file__).resolve().parent.parent
JSON_DIR = REPO / "_json"
WEB = REPO / "web"
THUMBS = WEB / "thumbs"
DATA = WEB / "data"
FLAGS = REPO / "_flags"
ORIGINALS = REPO / "_originals"

THUMB_WIDTH = 360   # alcanza para mostrar nítido hasta 3x (132px de alto)
THUMB_QUALITY = 80
WORKERS = 8

FORCE = "--force" in sys.argv


def _atomic_write_text(path, text):
    """Escritura atómica (tmp + os.replace): un GET concurrente del navegador
    nunca lee collection.json / issues.json a medio escribir."""
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


def fmt_valor(v):
    """1000 -> '1.000' | 0.5 -> '0,5' | None -> '' (formato es-CL)."""
    if v is None:
        return ""
    if float(v).is_integer():
        return f"{int(v):,}".replace(",", ".")
    return str(v).replace(".", ",")


def denominacion_full(dn):
    """'Moneda Full' compuesta: Monto + Moneda (ya no se guarda en el JSON)."""
    return f"{fmt_valor(dn.get('value'))} {dn.get('currency', '')}".strip()


def file_sig(path):
    """firma del contenido: mtime en ns + tamaño (dos fotos distintas
    nunca comparten ambas). Base del versionado de URLs y de thumbs."""
    st = path.stat()
    return f"{st.st_mtime_ns}-{st.st_size}"


def file_v(path):
    """versión corta para la URL (?v=...)."""
    return hashlib.md5(file_sig(path).encode()).hexdigest()[:10]


FLAG_INDEX = {norm_flag(fp.stem.replace("FLAG_", "", 1)): fp.name
              for fp in FLAGS.glob("FLAG_*.jpg")}

# país (normalizado) cuyo archivo de bandera usa otro nombre
FLAG_ALIASES = {
    "FIYI": "FIJI",
    "MOLDAVIA": "MOLDOVIA",
    "REPCHECA": "REPUBLICACHECA",
    "REPDOMINICANA": "REPUBLICADOMINICANA",
    "BOSNIAYHERZEGOVINA": "BOZNIAYHERZEGOVINA",  # archivo: FLAG_BOZNIA...
}


def flag_file(country_es):
    key = norm_flag(country_es)
    key = FLAG_ALIASES.get(key, key)
    return FLAG_INDEX.get(key, "")


def natural_pick_key(pick):
    m = re.search(r"(\d+)", pick or "")
    return (int(m.group(1)) if m else 10 ** 9, pick or "")


def sort_key(rec):
    """orden del índice: país (sin acentos) y pick natural."""
    return (unaccent(rec["pais"]).lower(), natural_pick_key(rec["pick"]))


def build_search(*parts):
    txt = " ".join(str(p) for p in parts if p not in (None, "", []))
    txt = unaccent(txt).lower()
    return re.sub(r"\s+", " ", txt).strip()


def make_record(d):
    dn = d["denomination"]
    sp = d["specimens"][0]
    notes = d.get("notes", {})
    _id = d["id"]

    def resolve(rel, thumb_suffix):
        """ruta original + ruta thumb (con ?v=<firma> para invalidar caché
        del navegador cuando la foto cambia), solo si el archivo existe."""
        src = REPO / rel
        if not src.exists():
            return "", ""
        v = file_v(src)
        return f"../{rel}?v={v}", f"thumbs/{_id}_{thumb_suffix}.jpg?v={v}"

    # rutas por convención a partir del id (no se guardan en los JSON)
    img_a, thumb_a = resolve(f"_originals/{_id}/{_id}_A.jpg", "A")
    img_b, thumb_b = resolve(f"_originals/{_id}/{_id}_B.jpg", "B")
    img_f, thumb_f = resolve(f"_FULL/{_id}.jpg", "F")

    firmas = " - ".join(d.get("signatures") or [])
    rec = {
        "id": d["id"],
        "pick": d.get("pick_number", ""),
        "pais": d["country"]["es"],
        "pais_en": d["country"].get("en", ""),
        "valor": dn.get("value"),
        "moneda": dn.get("currency", ""),
        "denominacion": denominacion_full(dn),
        "subtipo": dn.get("subtype", ""),
        "alternativas": " · ".join(dn.get("alternatives") or []),
        "anio": d.get("year"),
        "firmas": firmas,
        "temas": ", ".join(d.get("themes") or []),
        "obs": notes.get("obs", ""),
        "vigencia": notes.get("vigencia", ""),
        "serie": notes.get("serie", ""),
        "banco": notes.get("bank", ""),
        "zona": notes.get("zone", ""),
        "serial": sp.get("serial_number", ""),
        "condicion": sp.get("condition", ""),
        "grupo": d.get("colnect", {}).get("group", ""),
        "colnect": d.get("colnect", {}).get("url", ""),
        "conmemorativo": bool(d.get("commemorative")),
        "remarcado": bool(d.get("overprint")),
        "verificado": bool(d.get("verificado")),
        "flag": (lambda fn: f"../_flags/{fn}?v={file_v(FLAGS / fn)}" if fn else "")(
            flag_file(d["country"]["es"])),
        "thumb_a": thumb_a, "thumb_b": thumb_b, "thumb_f": thumb_f,
        "img_a": img_a, "img_b": img_b, "img_full": img_f,
    }
    rec["search"] = build_search(
        d["id"], rec["pick"], rec["pais"], d["country"].get("en", ""),
        rec["denominacion"], rec["moneda"], rec["valor"], rec["anio"],
        firmas, rec["temas"], rec["obs"], rec["grupo"], dn.get("subtype", ""),
        " ".join(dn.get("alternatives") or []),
        notes.get("vigencia", ""), notes.get("serie", ""),
        notes.get("bank", ""), notes.get("zone", ""),
        sp.get("serial_number", ""), sp.get("condition", ""),
        "conmemorativo" if rec["conmemorativo"] else "",
        "remarcado" if rec["remarcado"] else "",
    )
    return rec


def thumb_jobs(rec, meta, force=False):
    """(src, dest, clave, firma) pendientes para este registro.

    Un thumb está al día si la firma (mtime_ns + tamaño) de su fuente
    coincide con la registrada en thumbs_meta.json — cubre reemplazos,
    renombres e intercambios de archivos aunque conserven su fecha.
    """
    jobs = []
    for img_key, thumb_key in (("img_a", "thumb_a"), ("img_b", "thumb_b"),
                               ("img_full", "thumb_f")):
        rel, th = rec[img_key].split("?", 1)[0], rec[thumb_key].split("?", 1)[0]
        if not rel or not th:
            continue
        src = (WEB / rel).resolve()          # '../_originals/...' relativo a web/
        dest = WEB / th
        sig = file_sig(src)
        if force or not dest.exists() or meta.get(th) != sig:
            jobs.append((src, dest, th, sig))
    return jobs


def make_thumb(job):
    src, dest, key, sig = job
    try:
        subprocess.run(
            ["magick", str(src), "-auto-orient", "-thumbnail", f"{THUMB_WIDTH}x",
             "-quality", str(THUMB_QUALITY), str(dest)],
            check=True, capture_output=True)
        return True, (key, sig)
    except subprocess.CalledProcessError as e:
        return False, f"{dest.name}: {e.stderr.decode()[:120]}"


def build_issues_data(records, meta, force=False, json_malos=None):
    """Detecta inconsistencias -> (issues_dict, jobs_de_miniaturas).
    Las carpetas sin JSON llevan sus propias miniaturas (thumbs/x_<hash>_A.jpg)."""
    from datetime import datetime

    ids = {r["id"] for r in records}
    items = []
    jobs = []
    for sub in sorted(ORIGINALS.iterdir()):
        if not sub.is_dir() or sub.name in ids:
            continue
        item = {
            "carpeta": sub.name,
            "archivos": sorted(p.name for p in sub.glob("*.jpg")),
        }
        h = hashlib.md5(sub.name.encode()).hexdigest()[:12]
        for side in ("A", "B"):
            key_t, key_i = f"thumb_{side.lower()}", f"img_{side.lower()}"
            src = next(iter(sorted(sub.glob(f"*_{side}.jpg"))), None)
            if src is None:
                item[key_t] = item[key_i] = ""
                continue
            th = f"thumbs/x_{h}_{side}.jpg"
            v = file_v(src)
            item[key_t] = f"{th}?v={v}"
            item[key_i] = f"../_originals/{sub.name}/{src.name}?v={v}"
            sig = file_sig(src)
            if force or not (WEB / th).exists() or meta.get(th) != sig:
                jobs.append((src, WEB / th, th, sig))
        items.append(item)

    # billetes sin número de pick (el id quedó como abreviatura-moneda-año)
    picks_malos = [
        [r["id"], r["pais"], r["denominacion"], r["anio"] or ""]
        for r in records if not r["pick"]
    ]

    # picks presentes pero con formato raro (no empiezan con "P-")
    picks_raros = [
        {"pick": r["pick"], "id": r["id"], "pais": r["pais"],
         "denominacion": r["denominacion"], "anio": r["anio"] or "",
         "thumb_a": r["thumb_a"], "img_a": r["img_a"],
         "thumb_b": r["thumb_b"], "img_b": r["img_b"]}
        for r in records if r["pick"] and not r["pick"].startswith("P-")
    ]

    # billetes sin link de Colnect
    sin_colnect = [
        {"id": r["id"], "pick": r["pick"], "pais": r["pais"],
         "denominacion": r["denominacion"], "anio": r["anio"] or "",
         "thumb_a": r["thumb_a"], "img_a": r["img_a"],
         "thumb_b": r["thumb_b"], "img_b": r["img_b"]}
        for r in records if not r["colnect"]
    ]

    def _mini(r):
        return {"id": r["id"], "pick": r["pick"], "pais": r["pais"],
                "denominacion": r["denominacion"], "anio": r["anio"] or "",
                "thumb_a": r["thumb_a"], "img_a": r["img_a"],
                "thumb_b": r["thumb_b"], "img_b": r["img_b"]}

    # billetes a los que falta alguna foto (front o back)
    sin_fotos = [_mini(r) for r in records
                 if not r["thumb_a"] or not r["thumb_b"]]

    # billetes con front y back pero sin imagen Full
    sin_full = [_mini(r) for r in records
                if r["thumb_a"] and r["thumb_b"] and not r["thumb_f"]]

    issues = {
        "generado": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "categorias": [
            {
                "clave": "json_invalidos",
                "titulo": "Archivos JSON inválidos",
                "descripcion": ("Archivos de _json/ que no se pudieron procesar: "
                                "JSON malformado (error de sintaxis) o esquema "
                                "incompleto (falta una clave obligatoria). Estos "
                                "billetes NO aparecen en el índice hasta corregir "
                                "el archivo a mano con un editor de texto y "
                                "presionar «Recargar datos»."),
                "columnas": ["Archivo", "Error"],
                "items": json_malos or [],
            },
            {
                "clave": "carpetas_sin_json",
                "titulo": "Carpetas de fotos sin JSON asociado",
                "descripcion": ("Carpetas dentro de _originals/ cuyo nombre no "
                                "coincide con ningún id de la colección. "
                                "Edita el nombre y guarda: la carpeta y sus "
                                "fotos (_A/_B) se renombran; si el nuevo nombre "
                                "es un id del catálogo, queda vinculada y sale "
                                "de esta lista."),
                "items": items,
            },
            {
                "clave": "picks_sin_formato",
                "titulo": "Billetes sin número de pick válido",
                "descripcion": ("JSON del catálogo sin pick_number: su id quedó "
                                "generado como abreviatura de "
                                "país-moneda-año en vez del pick real. "
                                "Acción: conseguir el pick (Colnect/catálogo), "
                                "corregir el JSON y renombrar id/archivo/carpeta "
                                "de fotos al definitivo."),
                "columnas": ["ID", "País", "Moneda Full", "Año"],
                "items": picks_malos,
            },
            {
                "clave": "picks_formato_raro",
                "titulo": "Picks con formato raro",
                "descripcion": ("Billetes con pick_number que no sigue el "
                                "formato estándar «P-…» (ej: sin prefijo, o "
                                "códigos especiales/fantasía). Corrige el pick "
                                "y guarda: el id, el archivo JSON, la carpeta "
                                "de fotos y la imagen Full se renombran en "
                                "cascada. Si es un código intencional, "
                                "déjalo como está."),
                "items": picks_raros,
            },
            {
                "clave": "sin_colnect",
                "titulo": "Billetes sin link de Colnect",
                "descripcion": ("Billetes del catálogo sin URL de Colnect. "
                                "Busca el billete en colnect.com, pega el link "
                                "y guarda."),
                "items": sin_colnect,
            },
            {
                "clave": "sin_fotos",
                "titulo": "Billetes sin fotos (front o back)",
                "descripcion": ("Billetes del catálogo a los que falta alguna "
                                "foto. Sube el JPG directamente aquí: se guarda "
                                "como _originals/<id>/<id>_A.jpg o _B.jpg."),
                "items": sin_fotos,
            },
            {
                "clave": "sin_full",
                "titulo": "Billetes sin imagen Full",
                "descripcion": ("Tienen front y back pero falta la imagen "
                                "compuesta. Presiona «Generar Full» para "
                                "crearla (frente + info + bandera + reverso)."),
                "items": sin_full,
            },
        ],
    }
    return issues, jobs


def build(force=False, verbose=False):
    """Reconstruye collection.json y las miniaturas. Retorna un resumen."""
    THUMBS.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)

    records = []
    json_malos = []   # [ruta relativa, error] — archivos que no se pudieron procesar
    for f in sorted(JSON_DIR.glob("*/*.json")):
        rel = str(f.relative_to(REPO))
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as e:
            json_malos.append([rel, f"JSON malformado: {e}"])
            continue
        try:
            rec = make_record(d)
            sort_key(rec)   # valida los tipos que usa el ordenamiento
        except Exception as e:  # noqa: BLE001 — un archivo malo no detiene el build
            json_malos.append([rel, f"esquema inválido: {type(e).__name__}: {e}"])
            continue
        records.append(rec)

    records.sort(key=sort_key)

    meta_path = DATA / "thumbs_meta.json"
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        meta = {}

    jobs = [j for r in records for j in thumb_jobs(r, meta, force=force)]
    issues, issue_jobs = build_issues_data(records, meta, force=force,
                                           json_malos=json_malos)
    jobs += issue_jobs
    if verbose:
        print(f"Registros: {len(records)} | miniaturas a generar: {len(jobs)}")

    ok = fail = 0
    errores = []
    if jobs:
        with ThreadPoolExecutor(max_workers=WORKERS) as ex:
            for success, info in ex.map(make_thumb, jobs):
                if success:
                    ok += 1
                    key, sig = info
                    meta[key] = sig
                else:
                    fail += 1
                    errores.append(str(info))
                    if verbose:
                        print(f"  ✗ {info}")
                if verbose and (ok + fail) % 200 == 0:
                    print(f"  … {ok + fail}/{len(jobs)}")
    _atomic_write_text(meta_path, json.dumps(meta, separators=(",", ":")))

    out = DATA / "collection.json"
    _atomic_write_text(
        out, json.dumps(records, ensure_ascii=False, separators=(",", ":")))

    _atomic_write_text(
        DATA / "issues.json",
        json.dumps(issues, ensure_ascii=False, separators=(",", ":")))
    problemas = sum(len(c["items"]) for c in issues["categorias"])

    return {
        "registros": len(records),
        "json_invalidos": len(json_malos),
        "problemas": problemas,
        "con_front": sum(1 for r in records if r["thumb_a"]),
        "con_back": sum(1 for r in records if r["thumb_b"]),
        "con_full": sum(1 for r in records if r["thumb_f"]),
        "thumbs_generadas": ok,
        "thumbs_errores": fail,
        "errores": errores[:10],
        "kb": out.stat().st_size // 1024,
    }


def main():
    res = build(force=FORCE, verbose=True)
    print(f"\ncollection.json: {res['registros']} registros ({res['kb']} KB)")
    print(f"Con front: {res['con_front']} | con back: {res['con_back']} "
          f"| con full: {res['con_full']}")
    print(f"Miniaturas: generadas={res['thumbs_generadas']} "
          f"errores={res['thumbs_errores']}")
    if res["json_invalidos"]:
        print(f"⚠ JSON inválidos (omitidos del índice): {res['json_invalidos']}"
              " — detalle en la página Problemas")


if __name__ == "__main__":
    main()
