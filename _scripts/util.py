#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Utilidades compartidas — convenios centrales del proyecto.

Centraliza lo que antes estaba copiado en varios módulos (build_web,
serve_web, generar_imagen, generate_json, vincular_originales), para que
el convenio de id y la normalización de texto tengan UNA sola definición.
"""
import json
import re
import unicodedata
from pathlib import Path


def unaccent(s):
    """'Perú' -> 'Peru'. NFKD y se descarta lo que no sea ASCII."""
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()


def norm_flag(s):
    """Clave para resolver banderas y comparar países: MAYÚSCULAS, sin
    acentos ni símbolos, ignorando lo que va entre paréntesis.
    'Macao (China)' -> 'MACAO'."""
    s = re.sub(r"\(.*?\)", "", s or "")
    return re.sub(r"[^A-Z0-9]", "", unaccent(s).upper())


def make_note_id(abbr, pick):
    """id canónico del billete = abreviación de país + pick sin separadores,
    en minúsculas. 'ar' + 'P-367a' -> 'ar-p367a'. El id ES el nombre de
    archivo del JSON, la carpeta de fotos y la imagen Full."""
    return f"{abbr}-" + re.sub(r"[-. ]", "", pick or "").lower()


REPO = Path(__file__).resolve().parent.parent
COUNTRIES_FILE = REPO / "_json" / "countries.json"
CURRENCIES_FILE = REPO / "_json" / "currencies.json"


def load_countries():
    """Carga _json/countries.json (fuente única de verdad de países)."""
    if not COUNTRIES_FILE.exists():
        return {}
    with COUNTRIES_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


COUNTRIES = load_countries()

# Índices para búsqueda rápida por nombre en español
COUNTRY_BY_NAME = {}
for code, info in COUNTRIES.items():
    name_es = (info.get("name") or {}).get("es", "")
    if name_es:
        COUNTRY_BY_NAME[name_es.strip().lower()] = info


def get_country_by_code(code):
    """Retorna metadatos del país dado su código (ej. 'cl', 'ar')."""
    if not code:
        return None
    return COUNTRIES.get(str(code).strip().lower())


def get_country_by_name(name_es):
    """Retorna metadatos del país dado su nombre en español."""
    if not name_es:
        return None
    return COUNTRY_BY_NAME.get(str(name_es).strip().lower())


def load_currencies():
    """Carga _json/currencies.json (fuente única de verdad de monedas)."""
    if not CURRENCIES_FILE.exists():
        return {}
    with CURRENCIES_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


CURRENCIES = load_currencies()


def get_currency_by_code(code):
    """Retorna metadatos de la moneda dado su código ISO 4217."""
    if not code:
        return None
    return CURRENCIES.get(str(code).strip().upper())


def currency_name(code, fallback="", language="es"):
    """Nombre corto localizado, con el texto original como fallback."""
    info = get_currency_by_code(code) or {}
    names = info.get("nombre_corto") or info.get("nombres") or {}
    return names.get(language) or names.get("es") or names.get("en") or fallback
