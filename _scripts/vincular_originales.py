#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vincula cada JSON de la colección con su carpeta de _originals (nombre viejo),
la renombra a _originals/<id>/ (con <id>_A.jpg / <id>_B.jpg) y escribe las rutas
en specimens[0].images.{front,back,full} del JSON.

Uso:
    python3 vincular_originales.py            # dry-run: solo reporta, no toca nada
    python3 vincular_originales.py --apply    # renombra carpetas + escribe rutas

El match se hace por: país + año + valor + moneda (+ firmas para desempatar).
Los casos ambiguos / sin match se reportan y NO se tocan.
"""
import csv
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # _scripts (util)
from util import norm_flag as norm   # MAYÚS sin acentos/símbolos, ignora paréntesis

REPO = Path(__file__).resolve().parent.parent
JSON_DIR = REPO / "_json"
ORIG = REPO / "_originals"
FULL_REL = "_FULL"
ORIG_REL = "_originals"

APPLY = "--apply" in sys.argv


def norm_cur(s):
    """moneda normalizada, sin plural es/en simple (Escudos->ESCUDO, Yuanes->YUAN)."""
    n = norm(s)
    for suf in ("ES", "S"):
        if n.endswith(suf) and len(n) > len(suf) + 2:
            return n[: -len(suf)]
    return n


def parse_value(tok):
    """'1000'->1000, '05'->0.5, '025'->0.25, '1'->1"""
    t = tok.strip()
    if not t.isdigit():
        return None
    if t.startswith("0") and len(t) > 1:  # 05 -> 0.5, 025 -> 0.25
        return int(t) / (10 ** (len(t) - 1))
    return int(t)


# ---- cargar JSONs ----
def load_jsons():
    items = []
    for f in sorted(JSON_DIR.glob("*/*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        items.append((f, d))
    return items


# ---- parsear nombre viejo de carpeta ----
VAL_RE = re.compile(r"^(\d+)\.(.+)$")  # '1000.Afghanis' / '05.Escudos'


def parse_token(name):
    parts = name.split("_")
    if len(parts) < 3:
        return None
    country = parts[0]
    value = currency = year = None
    signatures = ""
    for i, p in enumerate(parts[1:], 1):
        m = VAL_RE.match(p)
        if m and value is None:
            value = parse_value(m.group(1))
            currency = m.group(2)
        elif re.fullmatch(r"(19|20)\d{2}", p) and year is None:
            year = int(p)
            # lo que sigue al año: firmas (contiene .-.) o serial
            rest = parts[i + 1:]
            for r in rest:
                if ".-." in r or (not r.isdigit() and any(c.isalpha() for c in r)):
                    signatures = r
                    break
    if value is None or year is None:
        return None
    return {
        "country": norm(country),
        "value": value,
        "currency": norm_cur(currency or ""),
        "year": year,
        "signatures": norm(signatures),
    }


def main():
    jsons = load_jsons()
    # index de JSONs por (país, año)
    bucket = {}
    for f, d in jsons:
        key = (norm(d["country"]["es"]), d.get("year"))
        bucket.setdefault(key, []).append((f, d))

    # carpetas de originales con A y B
    folders = []
    for sub in sorted(ORIG.iterdir()):
        if not sub.is_dir():
            continue
        a = list(sub.glob("*_A.jpg"))
        b = list(sub.glob("*_B.jpg"))
        folders.append((sub, a[0] if a else None, b[0] if b else None))

    matched = {}      # json_path -> (folder, a, b)
    used_folders = set()
    ambiguous = []    # (folder, candidatos)
    no_json = []      # folder sin json
    incomplete = []   # folder sin A o B

    for sub, a, b in folders:
        tok = parse_token(sub.name)
        if tok is None:
            no_json.append((sub, "no parseable"))
            continue
        cands = bucket.get((tok["country"], tok["year"]), [])
        # 1) por valor (prioritario)
        byval = [(f, d) for f, d in cands if d["denomination"]["value"] == tok["value"]]
        pool = byval or cands
        # 2) por moneda dentro del valor
        if len(pool) > 1 and tok["currency"]:
            bycur = [(f, d) for f, d in pool
                     if norm_cur(d["denomination"]["currency"]) == tok["currency"]]
            if bycur:
                pool = bycur
        # 3) desempate por firmas
        if len(pool) > 1 and tok["signatures"]:
            sig = [(f, d) for f, d in pool
                   if norm("".join(d.get("signatures", []))) == tok["signatures"]]
            if len(sig) == 1:
                pool = sig
        if not pool:
            no_json.append((sub, f"sin JSON ({tok['country']} {tok['value']} {tok['year']})"))
        elif len(pool) == 1:
            f, d = pool[0]
            if a is None or b is None:
                incomplete.append((sub, a, b))
            matched[f] = (sub, a, b, d)
        else:
            ambiguous.append((sub, [d["id"] for _, d in pool]))

    # JSONs sin foto
    matched_jsons = set(matched.keys())
    no_photo = [(f, d) for f, d in jsons if f not in matched_jsons]

    # ---- reporte ----
    print(f"JSONs totales:        {len(jsons)}")
    print(f"Carpetas originales:  {len(folders)}")
    print(f"  vinculadas (1:1):   {len(matched)}")
    print(f"  ambiguas:           {len(ambiguous)}")
    print(f"  sin JSON:           {len(no_json)}")
    print(f"JSONs sin foto:       {len(no_photo)}")
    if ambiguous[:15]:
        print("\n-- AMBIGUAS (carpeta -> candidatos) --")
        for sub, ids in ambiguous[:15]:
            print(f"  {sub.name}  ->  {', '.join(ids)}")
    if no_json[:15]:
        print("\n-- CARPETAS SIN JSON (primeras 15) --")
        for sub, why in no_json[:15]:
            print(f"  {sub.name}  ({why})")

    # escribir reporte TSV completo
    rep = JSON_DIR / "_link_report.tsv"
    with rep.open("w", encoding="utf-8", newline="") as out:
        w = csv.writer(out, delimiter="\t")
        w.writerow(["estado", "id_o_carpeta", "detalle"])
        for f, (sub, a, b, d) in matched.items():
            w.writerow(["match", d["id"], sub.name])
        for sub, ids in ambiguous:
            w.writerow(["ambigua", sub.name, ",".join(ids)])
        for sub, why in no_json:
            w.writerow(["sin_json", sub.name, why])
        for f, d in no_photo:
            w.writerow(["sin_foto", d["id"], ""])
    print(f"\nReporte completo: {rep}")

    if not APPLY:
        print("\n(DRY-RUN) nada modificado. Usa --apply para renombrar y escribir rutas.")
        return

    # ---- aplicar ----
    renamed = 0
    for f, (sub, a, b, d) in matched.items():
        if a is None or b is None:
            continue
        _id = d["id"]
        dest = ORIG / _id
        # renombrar carpeta a <id>
        if sub != dest:
            if dest.exists():
                print(f"  ! destino ya existe, salto: {dest.name}")
                continue
            sub.rename(dest)
        # renombrar A/B dentro de la carpeta a <id>_A / <id>_B
        # (las rutas NO se escriben en el JSON: se derivan del id por convención)
        aa = next(dest.glob("*_A.jpg"), None)
        bb = next(dest.glob("*_B.jpg"), None)
        if aa and aa.name != f"{_id}_A.jpg":
            aa.rename(dest / f"{_id}_A.jpg")
        if bb and bb.name != f"{_id}_B.jpg":
            bb.rename(dest / f"{_id}_B.jpg")
        renamed += 1
    print(f"\nAPLICADO: {renamed} carpetas renombradas.")


if __name__ == "__main__":
    main()
