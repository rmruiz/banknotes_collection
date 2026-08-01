# -*- coding: utf-8 -*-
"""Manejador centralizado de datos de países.

Carga `_json/countries.json` (la fuente única de verdad) y expone:
- COUNTRIES: dict de código -> objeto metadatos del país.
- COUNTRY_MAP: dict (nombre_es.lower() -> código) para compatibilidad.
- COUNTRY_EN: dict (nombre_es.lower() -> nombre_en) para compatibilidad.
- Helpers para consulta de países.
"""
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
COUNTRIES_FILE = BASE_DIR / "countries.json"


def _load_countries():
    if not COUNTRIES_FILE.exists():
        return {}
    with COUNTRIES_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


COUNTRIES = _load_countries()

# Re-exportar diccionarios de compatibilidad hacia atrás
COUNTRY_MAP = {}
COUNTRY_EN = {}

for code, info in COUNTRIES.items():
    name_es = info["name"]["es"]
    name_es_key = name_es.lower()
    name_en = info["name"]["en"]
    
    COUNTRY_MAP[name_es_key] = code
    COUNTRY_EN[name_es_key] = name_en


def get_country_by_code(code):
    """Retorna los metadatos de un país dado su código de 2/3 letras (ej. 'cl', 'ar', 'bia')."""
    if not code:
        return None
    return COUNTRIES.get(code.lower())


def get_country_by_name(name_es):
    """Retorna los metadatos de un país dado su nombre en español."""
    if not name_es:
        return None
    code = COUNTRY_MAP.get(name_es.strip().lower())
    if code:
        return COUNTRIES.get(code)
    return None


def get_country(query):
    """Busca por código o por nombre en español."""
    if not query:
        return None
    q = query.strip().lower()
    if q in COUNTRIES:
        return COUNTRIES[q]
    if q in COUNTRY_MAP:
        return COUNTRIES[COUNTRY_MAP[q]]
    return None
