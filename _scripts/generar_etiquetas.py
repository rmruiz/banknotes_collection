#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera hojas CARTA imprimibles con una etiqueta por billete.

Cada etiqueta (por defecto 2,5 x 6 cm, vertical) apila, centrado:
    pick / país (negrita, más grande) / monto+moneda / año / [extra] / bandera
    - Chile: bajo el año, las firmas.
    - USA:   en vez del año, la serie.
Hoja blanca, texto negro, borde negro (guía de corte). Salida: PDF Carta multipágina.

Uso:
    python3 _scripts/generar_etiquetas.py                    # todos -> etiquetas.pdf
    python3 _scripts/generar_etiquetas.py --filter chile     # solo un país (carpeta o nombre)
    python3 _scripts/generar_etiquetas.py --verificados      # solo verificado=true
    python3 _scripts/generar_etiquetas.py --out /ruta/x.pdf --dpi 300

Parametricidad: edita la lista FIELDS (orden, fuente, tamaño, negrita, ¿envuelve?,
condición por billete) para agregar / quitar / reordenar campos sin tocar el dibujo.
"""
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
JSON_DIR = REPO / "_json"
FLAGS = REPO / "_flags"
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_web  # denominacion_full + flag_file (reusa índice de banderas y alias)

# ---------------------------------------------------------------- geometría
FONT = "Verdana"
LABEL_W_CM, LABEL_H_CM = 2.5, 6.0     # tamaño de cada etiqueta
#A4_W_CM, A4_H_CM = 21.0, 29.7
LT_W_CM, LT_H_CM = 21.59, 27.94
COLS, ROWS = 8, 4                     # grilla por hoja (8*4 = 32 etiquetas/hoja)
PAD_PX = 6                            # respiro vertical entre campos
SIDE_PAD_PX = 12                      # margen lateral interno (para el wrap del país)


def cm_to_px(cm, dpi):
    return round(cm / 2.54 * dpi)


# ---------------------------------------------------------------- campos (parametrizable)
def is_usa(r):   return r["pais"] == "Estados Unidos"
def is_chile(r): return r["pais"] == "Chile"

# Cada campo: clave, tamaño de fuente (pt), negrita, wrap (multilínea), getter y
# condición opcional. type "image" = bandera. Reordena / comenta para ajustar.
FIELDS = [
    {"key": "pick",   "size": 30, "bold": False, "wrap": False,
     "get": lambda r: r["pick"]},
    {"key": "pais",   "size": 42, "bold": True,  "wrap": True,
     "get": lambda r: r["pais"]},
    {"key": "monto",  "size": 36, "bold": False, "wrap": False,
     "get": lambda r: r["monto"]},
    {"key": "anio",   "size": 32, "bold": False, "wrap": False,
     "get": lambda r: r["anio"], "when": lambda r: not is_usa(r)},
    {"key": "serie",  "size": 30, "bold": False, "wrap": False,
     "get": lambda r: r["serie"], "when": is_usa},
    {"key": "firmas", "size": 24, "bold": False, "wrap": True,
     "get": lambda r: r["firmas"], "when": is_chile},
    {"key": "flag",   "type": "image", "width_cm": 1.7,
     "get": lambda r: r["flag_path"]},
]


def mg(*args):
    subprocess.run(["magick", *[str(a) for a in args]], check=True,
                   capture_output=True)


def montage(args):
    subprocess.run(["magick", "montage", *[str(a) for a in args]], check=True,
                   capture_output=True)


# ---------------------------------------------------------------- registro
def load_records(filter_str=None, solo_verificados=False):
    recs = []
    for f in sorted(JSON_DIR.glob("*/*.json")):
        if filter_str and filter_str.lower() not in str(f).lower():
            # permite filtrar por carpeta (chile) o por nombre de país
            d0 = json.loads(f.read_text(encoding="utf-8"))
            if filter_str.lower() not in d0["country"]["es"].lower():
                continue
            d = d0
        else:
            d = json.loads(f.read_text(encoding="utf-8"))
        if solo_verificados and not d.get("verificado"):
            continue
        pais = d["country"]["es"]
        flag = build_web.flag_file(pais)
        recs.append({
            "id": d["id"],
            "pick": d.get("pick_number", "") or "",
            "pais": pais,
            "monto": build_web.denominacion_full(d["denomination"]),
            "anio": str(d.get("year") or ""),
            "serie": (d.get("notes") or {}).get("serie", "") or "",
            "firmas": " / ".join(d.get("signatures") or []),
            "flag_path": str(FLAGS / flag) if flag else "",
        })
    recs.sort(key=lambda r: (build_web.unaccent(r["pais"]).lower(),
                             build_web.natural_pick_key(r["pick"])))
    return recs


# ---------------------------------------------------------------- render de una etiqueta
def render_label(rec, dpi, work: Path, idx):
    lw, lh = cm_to_px(LABEL_W_CM, dpi), cm_to_px(LABEL_H_CM, dpi)
    inner_w = lw - 2 * SIDE_PAD_PX
    pieces = []
    for i, fld in enumerate(FIELDS):
        if fld.get("when") and not fld["when"](rec):
            continue
        val = fld["get"](rec)
        if not val:
            continue
        piece = work / f"{idx:04d}_{i}_{fld['key']}.png"
        if fld.get("type") == "image":
            w = cm_to_px(fld["width_cm"], dpi)
            mg(val, "-resize", f"{w}x", "-bordercolor", "black", "-border", "1",
               "-bordercolor", "white", "-border", f"{SIDE_PAD_PX}x{PAD_PX+2}",
               piece)
        else:
            scale = dpi / 300.0                       # tamaños calibrados a 300 DPI
            size = max(6, round(fld["size"] * scale))
            gen = ["-background", "white", "-fill", "black", "-font", FONT,
                   "-pointsize", size, "-gravity", "center"]
            if fld.get("bold"):
                gen += ["-weight", "Bold"]
            if fld.get("wrap"):
                gen += ["-size", f"{inner_w}x", f"caption:{val}"]
            else:
                gen += [f"label:{val}"]
            gen += ["-bordercolor", "white", "-border", f"0x{PAD_PX}", piece]
            mg(*gen)
        pieces.append(piece)

    out = work / f"label_{idx:04d}.png"
    # apila centrado, encuadra a la celda exacta y agrega borde negro de corte
    mg("-background", "white", *pieces, "-gravity", "center", "-append",
       "-background", "white", "-gravity", "center",
       "-extent", f"{lw-2}x{lh-2}",
       "-bordercolor", "black", "-border", "1", out)
    return out


# ---------------------------------------------------------------- hojas + PDF
#def build_pages(labels, dpi, work: Path):
#    lw, lh = cm_to_px(LABEL_W_CM, dpi), cm_to_px(LABEL_H_CM, dpi)
#    aw, ah = cm_to_px(A4_W_CM, dpi), cm_to_px(A4_H_CM, dpi)
def build_pages(labels, dpi, work: Path):
    lw, lh = cm_to_px(LABEL_W_CM, dpi), cm_to_px(LABEL_H_CM, dpi)
    aw, ah = cm_to_px(LT_W_CM, dpi), cm_to_px(LT_H_CM, dpi)
    per_page = COLS * ROWS
    pages = []
    for p, start in enumerate(range(0, len(labels), per_page)):
        chunk = labels[start:start + per_page]
        tile = work / f"tile_{p:03d}.png"
        montage([*chunk, "-tile", f"{COLS}x{ROWS}", "-geometry", "+0+0",
                 "-background", "white", tile])
        page = work / f"page_{p:03d}.png"
        # centra el bloque de etiquetas en una hoja A4 blanca
        mg(tile, "-gravity", "center", "-background", "white",
           "-extent", f"{aw}x{ah}", "-units", "PixelsPerInch", "-density", dpi,
           page)
        pages.append(page)
    return pages


def main():
    ap = argparse.ArgumentParser(description="Etiquetas imprimibles de billetes")
    ap.add_argument("--filter", help="carpeta (chile) o país (Chile) a incluir")
    ap.add_argument("--verificados", action="store_true", help="solo verificado=true")
    ap.add_argument("--out", default=str(REPO / "etiquetas.pdf"), help="PDF de salida")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    if not shutil.which("magick"):
        sys.exit("ERROR: no se encontró 'magick' (ImageMagick) en el PATH.")

    recs = load_records(args.filter, args.verificados)
    if not recs:
        sys.exit("No hay billetes que coincidan con el filtro.")
    sin_flag = [r["id"] for r in recs if not r["flag_path"]]
    if sin_flag:
        print(f"⚠ {len(sin_flag)} sin bandera (se omite ese campo): "
              f"{', '.join(sin_flag[:8])}{' …' if len(sin_flag) > 8 else ''}")

    print(f"Generando {len(recs)} etiquetas @ {args.dpi} DPI "
          f"({COLS}x{ROWS}/hoja)…")
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        # render en paralelo; ex.map preserva el orden de entrada
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            labels = list(ex.map(
                lambda ir: render_label(ir[1], args.dpi, work, ir[0]),
                list(enumerate(recs))))
        pages = build_pages(labels, args.dpi, work)
        print(f"  {len(pages)} hoja(s) A4 → PDF…")
        mg("-density", args.dpi, "-units", "PixelsPerInch", *pages, args.out)
    print(f"✓ {args.out}  ({len(recs)} etiquetas, {len(pages)} hojas)")


if __name__ == "__main__":
    main()
