#!/usr/bin/env python3
"""Genera un JSON por fila (una fila = un tipo de billete).

Dos modos:
    python3 generate_json.py <carpeta>
        Lee <carpeta>/_source.tsv y escribe <carpeta>/<id>.json

    python3 generate_json.py --master <archivo.tsv>
        Agrupa por país, crea _json/<pais-slug>/_source.tsv y genera los JSON
        de cada país. Usa COUNTRY_MAP para la abreviación del id.

El TSV puede traer distintos encabezados por país; se normalizan con ALIASES.
"""
import csv
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "_scripts"))
from util import unaccent, make_note_id   # convenios compartidos
from country_map import COUNTRY_MAP, COUNTRY_EN

BASE = Path(__file__).parent

# valores en columnas que significan "sin dato"
BLANKS = {"", "--", "no está", "no lo tengo", "n/a", "???", "8.000.000"}

COMMEMORATIVE_HINTS = ("aniversario", "conmemorativo", "fantas")

# encabezado (minúsculas, sin espacios extra) -> campo canónico
ALIASES = {
    "pick": "pick",
    "pais": "pais", "país": "pais",
    "cifra": "cifra",
    "moneda": "moneda",
    "año": "year", "año impresión": "year", "ano": "year", "anio": "year",
    "colnet_url": "url", "colnect_url": "url", "url": "url",
    "colnet_group": "group", "colnect_group": "group", "group": "group",
    "vigencia": "vigencia",
    "subtipo moneda": "subtype", "subtipo": "subtype", "subtype": "subtype",
    "firma1": "firma1", "firma2": "firma2",
    "otra_moneda": "otra_moneda", "otra moneda": "otra_moneda",
    "observaciones": "obs1", "obs": "obs1", "obs1": "obs1", "obs2": "obs2",
}

# homóglifos cirílicos -> latinos (para picks copiados de la web)
HOMO = {
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O",
    "Р": "P", "С": "C", "Т": "T", "Х": "X", "У": "Y",
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
    "к": "k", "в": "b", "м": "m", "т": "t", "н": "n",
}


def delatinize(s):
    return "".join(HOMO.get(ch, ch) for ch in s)


def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", unaccent(name).lower()).strip("-")
    return s or "sin-pais"


def ascii_slug(s):
    """minúsculas sin acentos ni símbolos: 'Kópeks'->'kopeks'"""
    return re.sub(r"[^a-z0-9]", "", unaccent(s).lower())


# carpeta destino según país; el resto va a 'world'
FOLDER_ROUTE = {"chile": "chile", "argentina": "argentina", "estados unidos": "usa"}


def route_folder(pais):
    return FOLDER_ROUTE.get(pais.strip().lower(), "world")


def is_blank(v):
    return v is None or v.strip().lower() in BLANKS


def parse_value(cifra):
    """'1'->1, '1.000'->1000, '1,5'->1.5, '1/2'->0.5, '2 1/2'->2.5,
    'N/A'/'.. MM'->None. Formato es-CL: '.' miles, ',' decimal."""
    c = (cifra or "").strip()
    if is_blank(c):
        return None
    whole = 0
    if " " in c and "/" in c:  # mixto '2 1/2'
        head, c = c.split(" ", 1)
        whole = int(head) if head.isdigit() else 0
    if "/" in c:
        try:
            num, den = c.split("/")
            return round(whole + int(num) / int(den), 4)
        except (ValueError, ZeroDivisionError):
            return None
    if "," in c:  # coma = separador decimal: '1,5', '0,50', '1.234,5'
        entero, _, dec = c.partition(",")
        entero = entero.replace(".", "") or "0"
        if entero.isdigit() and dec.isdigit() and 1 <= len(dec) <= 2:
            return round(int(entero) + int(dec) / 10 ** len(dec), 4)
        return None
    digits = c.replace(".", "")
    return int(digits) if digits.isdigit() else None


def make_id(abbr, pick, fallback_parts, used):
    """id = abbr + '-' + pick(sin '-', minúsculas). Si no hay pick, id temporal."""
    p = (pick or "").strip()
    if not is_blank(p):
        base = make_note_id(abbr, p)
    else:
        parts = [x for x in fallback_parts if x]
        tail = "-".join(parts) if parts else "sinpick"
        base = f"{abbr}-{tail}".lower()
    candidate = base
    n = 2
    while candidate in used:
        candidate = f"{base}-{n}"
        n += 1
    used.add(candidate)
    return candidate


def normalize_row(raw):
    """mapea encabezados variables -> campos canónicos"""
    out = {}
    for k, v in raw.items():
        if k is None:
            continue
        key = ALIASES.get(k.strip().lower())
        if key:
            out[key] = (v or "").strip()
    return out


def build_record(row, abbr, used):
    pick = delatinize(row.get("pick", ""))
    pais = row.get("pais", "")
    cifra = row.get("cifra", "")
    moneda = row.get("moneda", "")
    anio = row.get("year", "")
    url = row.get("url", "")
    group = row.get("group", "")
    vigencia = row.get("vigencia", "")
    subtype = row.get("subtype", "")
    firma1 = row.get("firma1", "")
    firma2 = row.get("firma2", "")
    otra = row.get("otra_moneda", "")
    obs1 = row.get("obs1", "")
    obs2 = row.get("obs2", "")

    currency = "" if is_blank(moneda) else moneda
    value = parse_value(cifra)

    signatures = [s for s in (firma1, firma2) if s]
    alternatives = [otra] if otra else []

    obs = " - ".join(o for o in (obs1, obs2) if o)
    obs = re.sub(r"\s*\n\s*", " - ", obs).strip()
    obs_l = obs.lower()
    overprint = "remarcado" in obs_l

    hay_str = " ".join((group, obs, pick, url)).lower()
    commemorative = any(h in hay_str for h in COMMEMORATIVE_HINTS)

    year = int(anio) if anio.isdigit() else None

    fallback = [ascii_slug(cifra + currency), anio]
    _id = make_id(abbr, pick, fallback, used)

    return _id, {
        "id": _id,
        "pick_number": "" if is_blank(pick) else pick,
        "country": {"en": COUNTRY_EN.get(pais.lower(), pais), "es": pais},
        "denomination": {
            "value": value,
            "currency": currency,
            "subtype": "" if is_blank(subtype) else subtype,
            "alternatives": alternatives,
        },
        "year": year,
        "signatures": signatures,
        "themes": [],
        "colnect": {
            "url": "" if is_blank(url) else url,
            "group": "" if is_blank(group) else group,
        },
        "commemorative": commemorative,
        "overprint": overprint,
        "verificado": False,
        "notes": {
            "serie": "",
            "bank": "",
            "zone": "",
            "vigencia": "" if is_blank(vigencia) else vigencia,
            "obs": obs,
        },
        "specimens": [
            {
                "serial_number": "",
                "condition": "",
            }
        ],
    }


def write_json(folder, _id, rec, force=False):
    """Escribe el JSON. Por defecto NO sobrescribe archivos existentes:
    protege lo curado a mano (themes, verificado, seriales, fotos…).
    Retorna True si escribió, False si lo saltó."""
    dest = folder / f"{_id}.json"
    if dest.exists() and not force:
        return False
    dest.write_text(
        json.dumps(rec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return True


def gen_folder(folder_name, force=False):
    folder = BASE / folder_name
    src = folder / "_source.tsv"
    if not src.exists():
        sys.exit(f"no existe {src}")
    pais_default = folder_name.lower()
    abbr_default = COUNTRY_MAP.get(pais_default, folder_name[:2].lower())
    used, written, skipped, no_pick = set(), 0, 0, []
    with src.open(encoding="utf-8") as f:
        for raw in csv.DictReader(f, delimiter="\t"):
            row = normalize_row(raw)
            abbr = COUNTRY_MAP.get(row.get("pais", "").lower(), abbr_default)
            _id, rec = build_record(row, abbr, used)
            if not write_json(folder, _id, rec, force=force):
                skipped += 1
                continue
            written += 1
            if not rec["pick_number"]:
                no_pick.append(_id)
    print(f"OK: {written} JSON en {folder}")
    if skipped:
        print(f"  saltados (ya existen): {skipped} — usa --force para sobrescribir")
    if no_pick:
        print(f"  sin pick [{len(no_pick)}]: " + ", ".join(no_pick))


def gen_master(master_path, force=False):
    master = Path(master_path)
    if not master.exists():
        sys.exit(f"no existe {master}")
    # agrupar filas por país conservando encabezado
    with master.open(encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        header = reader.fieldnames
        groups = {}
        for raw in reader:
            pais = (raw.get("Pais") or raw.get("País") or "").strip()
            groups.setdefault(pais, []).append(raw)

    # reagrupar por carpeta destino (chile/argentina/usa/world)
    dest_rows = {}
    for pais, rows in groups.items():
        dest_rows.setdefault(route_folder(pais), []).extend(rows)

    total, skipped, unknown = 0, 0, set()
    per_dest = {}
    for dest, rows in dest_rows.items():
        folder = BASE / dest
        folder.mkdir(exist_ok=True)
        # escribir _source.tsv combinado de la carpeta
        with (folder / "_source.tsv").open("w", encoding="utf-8", newline="") as out:
            w = csv.DictWriter(out, fieldnames=header, delimiter="\t")
            w.writeheader()
            w.writerows(rows)
        # generar JSON (id lleva la abreviación del país -> únicos aunque compartan carpeta)
        used, count = set(), 0
        for raw in rows:
            row = normalize_row(raw)
            pais = row.get("pais", "")
            abbr = COUNTRY_MAP.get(pais.lower())
            if abbr is None:
                unknown.add(pais)
                abbr = slugify(pais)[:2]
            _id, rec = build_record(row, abbr, used)
            if not write_json(folder, _id, rec, force=force):
                skipped += 1
                continue
            count += 1
        per_dest[dest] = count
        total += count

    print(f"OK: {total} JSON. Carpetas: " + ", ".join(f"{k}={v}" for k, v in per_dest.items()))
    if skipped:
        print(f"  saltados (ya existen): {skipped} — usa --force para sobrescribir")
    if unknown:
        print(f"  PAÍSES SIN ABREVIACIÓN (usé fallback): {', '.join(sorted(unknown))}")


def main():
    force = "--force" in sys.argv[1:]
    args = [a for a in sys.argv[1:] if a != "--force"]
    uso = "uso: generate_json.py [--force] <carpeta> | [--force] --master <archivo.tsv>"
    if not args:
        sys.exit(uso)
    if args[0] == "--master":
        if len(args) < 2:
            sys.exit(uso)
        gen_master(args[1], force=force)
    else:
        gen_folder(args[0], force=force)


if __name__ == "__main__":
    main()
