#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera la imagen consolidada (front + info + bandera + back) de cada billete,
leyendo las rutas definidas en los JSON (specimens[0].images).

Se usa como script ejecutable y tambien como módulo del servidor web (serve_web.py) sirviendo la API
POST /api/generar_full

Replica lo que hacía _append_text.sh, pero manejado por los JSON.

Uso:
    python3 _scripts/generar_imagen.py                 # interactivo
    python3 _scripts/generar_imagen.py --filter chile  # solo ids/carpetas que contengan 'chile'
    python3 _scripts/generar_imagen.py --overwrite-all # no pregunta, sobrescribe
    python3 _scripts/generar_imagen.py --skip-existing # no pregunta, salta existentes

Reglas:
 - Si el destino (_FULL/<id>.webp) ya existe: pregunta sobrescribir / todo / saltar / saltar todo.
 - Verifica que existan bandera, front y back; si falta alguno lo informa y salta.
 - NO borra ninguna imagen. Solo (re)escribe en _FULL/ si corresponde.
 - El destino se escribe como WebP lossy (q80, method=6): nitidez de número de
   serie garantizada y ~53% menos que el JPG anterior (ver requirement.md).
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
JSON_DIR = REPO / "_json"
FLAGS = REPO / "web" / "_flags_svg"

EMAIL = "banknotes.cl@gmail.com"
SIZE_PAIS, SIZE_DENOM, SIZE_FIRMAS, SIZE_EMAIL = 120, 80, 60, 30
FONT = "Verdana"
# El destino _FULL se escribe en WebP lossy: q80 es la calidad mínima con
# números de serie nítidos (comparativa q75-q90, ver requirement.md).
FULL_QUALITY = 80
FULL_WEBP_METHOD = 6

FILTER = None
MODE = None  # None | 'overwrite_all' | 'skip_all'
for i, a in enumerate(sys.argv[1:]):
    if a == "--filter" and i + 2 < len(sys.argv):
        FILTER = sys.argv[i + 2]
    elif a == "--overwrite-all":
        MODE = "overwrite_all"
    elif a == "--skip-existing":
        MODE = "skip_all"


# reusar el índice de banderas de build_web (incluye alias: Rep. Checa,
# Rep. Dominicana, Fiyi, Moldavia, etc.) y las utilidades compartidas
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_web
from util import get_country_by_code, get_country_by_name, currency_name


def flag_for(country_es):
    name = build_web.flag_file_for_note({"country": {"es": country_es}})
    return (FLAGS / name) if name else None


def flag_for_note(d):
    name = build_web.flag_file_for_note(d)
    return (FLAGS / name) if name else None


def mg(*args):
    subprocess.run(["magick", *[str(a) for a in args]], check=True)


def identify(path, fmt):
    out = subprocess.run(["identify", "-ping", "-format", fmt, str(path)],
                         check=True, capture_output=True, text=True)
    return out.stdout.strip()


def compose(d, front, back, flag, dest, tmp):
    """Replica el pipeline de _append_text.sh."""
    T = lambda n: str(tmp / n)
    dn = d["denomination"]
    # país: resolver por country_code (campo canónico); si no, fallback
    # al legacy `country: {es, en}` por compatibilidad.
    c_code = d.get("country_code", "")
    c_info = get_country_by_code(c_code) if c_code else \
             get_country_by_name((d.get("country") or {}).get("es", ""))
    line1 = c_info["name"]["es"] if c_info else \
           (d.get("country") or {}).get("es", "")
    original_currency = dn.get("currency", "")
    catalog_currency = currency_name(dn.get("iso4217"), original_currency,
                                     subunit=dn.get("subunidad"))
    denom = f"{build_web.fmt_valor(dn.get('value'))} {catalog_currency}".strip()
    if original_currency and catalog_currency != original_currency:
        denom += f" [{original_currency}]"
    line2 = f"{denom} - {d.get('year','')}"
    firmas = " - ".join(d.get("signatures") or [])

    mg("-background", "black", "-fill", "white", "-font", FONT,
       "-pointsize", SIZE_PAIS, f"label:{line1}", T("l1.jpg"))
    mg("-background", "black", "-fill", "white", "-font", FONT,
       "-pointsize", SIZE_DENOM, f"label:{line2}", T("l2.jpg"))
    mg("-background", "black", "-fill", "white", "-font", FONT,
       "-pointsize", SIZE_EMAIL, f"label:{EMAIL}", T("l3.jpg"))

    mg("-background", "black", "-gravity", "west", T("l1.jpg"), T("l2.jpg"),
       "-append", T("box.jpg"))
    if firmas:
        mg("-background", "black", "-fill", "white", "-font", FONT,
           "-pointsize", SIZE_FIRMAS, f"label:{firmas}", T("l4.jpg"))
        mg("-background", "black", "-gravity", "west", T("box.jpg"), T("l4.jpg"),
           "-append", T("box.jpg"))

    # fila inferior: pick a la izquierda (alineado con el país) + correo a la derecha
    pick = d.get("pick_number", "")
    if pick:
        mg("-background", "black", "-fill", "white", "-font", FONT,
           "-pointsize", SIZE_EMAIL, f"label:{pick}", T("lpick.jpg"))
        h3 = int(identify(T("l3.jpg"), "%h"))
        w_pick = int(identify(T("lpick.jpg"), "%w"))
        w_mail = int(identify(T("l3.jpg"), "%w"))
        w_box = int(identify(T("box.jpg"), "%w"))
        w_row = max(w_box, w_pick + w_mail + 40)
        mg("-size", f"{w_row}x{h3}", "xc:black",
           T("lpick.jpg"), "-gravity", "west", "-composite",
           T("l3.jpg"), "-gravity", "east", "-composite", T("row.jpg"))
        mg("-background", "black", "-gravity", "west", T("box.jpg"), T("row.jpg"),
           "-append", T("box.jpg"))
    else:
        mg("-background", "black", "-gravity", "east", T("box.jpg"), T("l3.jpg"),
           "-append", T("box.jpg"))

    # bandera al alto del box, con borde y sombra
    h = identify(T("box.jpg"), "%h")
    mg(flag, "-resize", f"{h}x6000", T("flag.jpg"))
    mg(T("flag.jpg"),
       "-bordercolor", "black", "-border", "1",
       "-bordercolor", "white", "-border", "6",
       "-bordercolor", "grey60", "-border", "1",
       "-background", "black", "(", "+clone", "-shadow", "60x4+4+4", ")",
       "+swap", "-background", "none", "-flatten", T("flag.jpg"))

    mg("-background", "black", T("box.jpg"), T("flag.jpg"),
       "-gravity", "east", "-splice", "10x0+0+0", "+append", T("name.jpg"))
    mg(T("name.jpg"), "-gravity", "east", "+repage", "-chop", "10x0+0+0", T("name.jpg"))

    # esquinas redondeadas + borde negro en front y back
    def rounded(src, out):
        w = identify(src, "%w")
        hh = identify(src, "%h")
        # la máscara DEBE ser PNG: JPEG no soporta canal alfa y el DstIn
        # quedaría sin efecto (esquinas cuadradas)
        mg("-size", f"{w}x{hh}", "xc:none",
           "-draw", f"fill white roundrectangle 0,0,{w},{hh},20,20",
           T("mask.png"))
        # composite + aplanado sobre negro EN UN SOLO comando: si se guardara
        # el intermedio con alfa a JPEG, las esquinas se aplanarían a blanco
        mg(src, "-alpha", "Set", T("mask.png"), "-compose", "DstIn",
           "-composite", "-background", "black", "-alpha", "remove", T("r.jpg"))
        mg(T("r.jpg"), "-bordercolor", "black", "-border", "50x50", out)

    rounded(front, T("a.jpg"))
    rounded(back, T("b.jpg"))

    # redimensionar caja de texto al ancho del billete (menos bordes)
    w = int(identify(front, "%w"))
    hh = identify(front, "%h")
    wf = w - 2 * 50
    mg(T("name.jpg"), "-resize", f"{wf}x{hh}", T("nameb.jpg"))

    # apilar: front / info / back
    mg(T("a.jpg"), T("nameb.jpg"), "-background", "black", "-gravity", "south",
       "-append", T("join.jpg"))
    mg(T("join.jpg"), T("b.jpg"), "-background", "black", "-gravity", "south",
       "-append", T("out.jpg"))
    # codificación final en WebP (el formato lo decide la extensión de dest)
    mg(T("out.jpg"), "-resize", "1080x1350",
       "-quality", str(FULL_QUALITY),
       "-define", f"webp:method={FULL_WEBP_METHOD}", dest)


def ask(dest_name):
    global MODE
    while True:
        r = input(f"  '{dest_name}' ya existe. [s]obrescribir / [S]todos / "
                  f"[n]saltar / [N]saltar todos: ").strip()
        if r == "s":
            return True
        if r == "S":
            MODE = "overwrite_all"
            return True
        if r == "n":
            return False
        if r == "N":
            MODE = "skip_all"
            return False


def main():
    global MODE
    files = sorted(JSON_DIR.glob("*/*.json"))
    if FILTER:
        files = [f for f in files if FILTER.lower() in str(f).lower()]

    gen = skip = missing = 0
    for f in files:
        d = json.loads(f.read_text(encoding="utf-8"))
        _id = d["id"]

        # rutas por convención a partir del id
        pfront = REPO / "web" / "_originals" / _id / f"{_id}_A.jpg"
        pback = REPO / "web" / "_originals" / _id / f"{_id}_B.jpg"
        pfull = REPO / "web" / "_FULL" / f"{_id}.webp"
        full = f"web/_FULL/{_id}.webp"
        c_code = d.get("country_code", "")
        c_info = get_country_by_code(c_code) if c_code else get_country_by_name((d.get("country") or {}).get("es", ""))
        country_es = c_info["name"]["es"] if c_info else (d.get("country") or {}).get("es", "")
        flag = flag_for_note(d)

        faltan = []
        if not pfront.exists():
            faltan.append("FRONT")
        if not pback.exists():
            faltan.append("BACK")
        if flag is None:
            faltan.append(f"BANDERA({country_es})")
        elif not flag.exists():
            faltan.append("BANDERA(archivo)")
        if faltan:
            print(f"⚠ {_id} ({country_es}): falta {', '.join(faltan)}")
            missing += 1
            continue

        if pfull.exists():
            if MODE == "skip_all":
                print(f"→ {_id}: existe, saltado")
                skip += 1
                continue
            if MODE != "overwrite_all":
                if not ask(pfull.name):
                    print(f"→ {_id}: saltado")
                    skip += 1
                    continue

        pfull.parent.mkdir(parents=True, exist_ok=True)
        try:
            with tempfile.TemporaryDirectory() as td:
                compose(d, pfront, pback, flag, pfull, Path(td))
            print(f"✓ {_id} → {full}")
            gen += 1
        except subprocess.CalledProcessError as e:
            print(f"✗ {_id}: ERROR magick ({e})")
            missing += 1

    print(f"\nResumen: generadas={gen} saltadas={skip} "
          f"con_faltantes={missing} (de {len(files)} JSON)")


if __name__ == "__main__":
    main()
