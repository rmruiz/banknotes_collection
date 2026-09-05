"""Genera fixtures cross-language (T6/A3, T14) para los tests JS
(`node --test`).

Python es la fuente de verdad: `build_web.fmt_valor` (separador de miles),
`util.unaccent` (NFKD), `build_web.denominacion_full` y
`util.currency_name` definen los comportamientos esperados de
`web/lib/format.js` (fmtValor / unaccent / denominationFullDisplay /
currencyDisplay). La salida se commitea en `web/tests/fixtures/fmt.json`
(no se regenera durante el build).

T14 — contrato de display: las secciones `denominacion` y `currency`
llevan el caso (entrada para ambos lados) y el `out` esperado, generado
aquí por Python. El test Python (test_build_web.py) comprueba que Python
sigue produciendo ese `out` (lock del fixture); el test JS
(format.test.js) comprueba que las funciones JS producen el mismo `out`.
El campo `display` de `currency` es la salida esperada de
`format.js:currencyDisplay`, emulada abajo (`_js_currency_display`) — la
emulación existe solo para generar el fixture; la verdad la impone el
test JS contra el código real de format.js.

Uso: python3 _scripts/generar_fixtures.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_ROOT = _HERE.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from _scripts.build_web import denominacion_full, fmt_valor  # noqa: E402
from _scripts.util import currency_name, unaccent  # noqa: E402

VALORES: list[int | float] = [
    0, 1, 5, 0.5, 0.25, 0.05, 100, 999, 1000, 1234, 12345, 123456,
    1000000, 1234567.89,
]
CADENAS: list[str] = [
    "Chile", "Perú", "Estados Unidos", "Isla de Man", "La Pampa",
    "Sí", "No", "número", "condición", "África", "Argentina", "Serbia",
]
OUT = _ROOT / "web" / "tests" / "fixtures" / "fmt.json"
CURRENCIES_REAL = _ROOT / "_json" / "currencies.json"

# Subconjunto del catálogo que entra al fixture: solo los campos que lee
# web/lib/format.js (nombres, nombre_corto, simbolo). Debe ser fiel al
# _json/currencies.json real (los tests Python corren contra el real).
CATALOGO_CODES = ["CLP", "PEN", "JPY"]


def _catalog_fixture() -> dict:
    real = json.loads(CURRENCIES_REAL.read_text(encoding="utf-8"))
    return {
        code: {
            "nombres": real[code]["nombres"],
            "nombre_corto": real[code]["nombre_corto"],
            "simbolo": real[code]["simbolo"],
        }
        for code in CATALOGO_CODES
    }


# Cada caso: dn = entrada de build_web.denominacion_full; rec = entrada de
# format.js:denominationFullDisplay (valor + currency_code + denominacion
# precargado para el camino fallback); lang = idioma del lado JS
# (denominacion_full siempre es "es").
DENOMINACION_CASES: list[dict] = [
    {"dn": {"value": 1000, "currency": "Escudos", "iso4217": "CLP",
            "subunidad": False},
     "rec": {"valor": 1000, "currency_code": "CLP", "denominacion": ""},
     "lang": "es"},
    {"dn": {"value": 1, "currency": "Escudo", "iso4217": "CLP",
            "subunidad": False},
     "rec": {"valor": 1, "currency_code": "CLP", "denominacion": ""},
     "lang": "es"},
    {"dn": {"value": 2.5, "currency": "soles", "iso4217": "PEN",
            "subunidad": False},
     "rec": {"valor": 2.5, "currency_code": "PEN", "denominacion": ""},
     "lang": "es"},
    {"dn": {"value": 500, "currency": "Escudos", "iso4217": "CLP",
            "subunidad": False},
     "rec": {"valor": 500, "currency_code": "CLP", "denominacion": ""},
     "lang": "en"},
    # Código sin catalogar: Python cae al texto libre; JS cae al campo
    # `denominacion` precargado (el que Python habría generado).
    {"dn": {"value": 500, "currency": "Escudos", "iso4217": None,
            "subunidad": False},
     "rec": {"valor": 500, "currency_code": "", "moneda": "Escudos",
             "denominacion": "500 Escudos"},
     "lang": "es"},
]

# Cada caso: code/fallback/lang/subunit = entrada de util.currency_name;
# rec = entrada de format.js:currencyDisplay; out = currency_name (Python,
# fuente de verdad); display = currencyDisplay (emulado).
CURRENCY_CASES: list[dict] = [
    {"code": "CLP", "fallback": "", "lang": "es", "subunit": False,
     "rec": {"currency_code": "CLP", "moneda": ""}},
    {"code": "CLP", "fallback": "", "lang": "en", "subunit": False,
     "rec": {"currency_code": "CLP", "moneda": ""}},
    {"code": "PEN", "fallback": "Sol viejo", "lang": "es", "subunit": False,
     "rec": {"currency_code": "PEN", "moneda": "Sol viejo"}},
    {"code": "CLP", "fallback": "centavos sueltos", "lang": "es",
     "subunit": True,
     "rec": {"currency_code": "CLP", "moneda": "centavos sueltos"}},
    {"code": "ZZZ", "fallback": "Escudos", "lang": "es", "subunit": False,
     "rec": {"currency_code": "ZZZ", "moneda": "Escudos"}},
    {"code": "ZZZ", "fallback": "Escudos", "lang": "en", "subunit": False,
     "rec": {"currency_code": "ZZZ", "moneda": "Escudos",
             "currency_name_en": "Escudos"}},
]


# --- Emulación de las reglas de display de web/lib/format.js (T14) ----------
# Espejo 1:1 de toTitleCase() (regex \w = ASCII en JS) y currencyDisplay().
# Solo se usa para generar el fixture; la verdad la impone el test JS.


def _js_title_case(s: str) -> str:
    s = str(s or "")
    s = re.sub(r"(\s|\(|\[)(\w)",
               lambda m: m.group(1) + m.group(2).upper(), s, flags=re.ASCII)
    s = re.sub(r"^\w", lambda m: m.group(0).upper(), s, flags=re.ASCII)
    return s


def _js_currency_display(rec: dict, lang: str, catalog: dict) -> str:
    code = (rec.get("currency_code") or "").strip().upper()
    info = catalog.get(code)
    key = "en" if lang == "en" else "es"
    name = ""
    if info:
        nombres = info.get("nombres") or {}
        name = nombres.get(key) or nombres.get("es") or nombres.get("en") or ""
    if not name:
        name = (rec.get("currency_name_en") or rec.get("moneda") or "") \
            if lang == "en" else \
            (rec.get("currency_name_es") or rec.get("moneda") or "")
    symbol = (info.get("simbolo") or "") if info else (rec.get("currency_symbol") or "")
    title = _js_title_case(name)
    return f"{title} ({symbol})" if symbol else title


def main() -> int:
    catalog = _catalog_fixture()
    fixture = {
        "valor": [{"v": v, "out": fmt_valor(v)} for v in VALORES],
        "unaccent": [{"s": s, "out": unaccent(s)} for s in CADENAS],
        "catalog": catalog,
        "denominacion": [
            {**case, "out": denominacion_full(case["dn"])}
            for case in DENOMINACION_CASES
        ],
        "currency": [
            {**case,
             "out": currency_name(case["code"], case["fallback"],
                                  case["lang"], subunit=case["subunit"]),
             "display": _js_currency_display(case["rec"], case["lang"],
                                             catalog)}
            for case in CURRENCY_CASES
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(fixture, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    rel = OUT.relative_to(_ROOT)
    print(f"[OK] {rel} ({len(VALORES)} valores, {len(CADENAS)} cadenas, "
          f"{len(DENOMINACION_CASES)} denominacion, {len(CURRENCY_CASES)} currency)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
