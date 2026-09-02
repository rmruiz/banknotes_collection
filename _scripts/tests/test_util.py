"""Tests de util.py — comportamiento actual (bloquean regresiones; T2).

Los tests de `currency_name`/`get_country_by_code`/`get_country_by_name`
inyectan los fixtures de `_scripts/tests/fixtures/` (mismo esquema que
_json/currencies.json y _json/countries.json) vía monkeypatch de los
globales del módulo, sin tocar los datos reales.
"""
import json
from pathlib import Path

import pytest

from _scripts import util

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _load(name):
    with (FIXTURES / name).open("r", encoding="utf-8") as f:
        return json.load(f)


def _country_index(countries):
    """Reconstruye el índice por nombre igual que util.py lo hace al importar."""
    index = {}
    for _code, info in countries.items():
        name_es = (info.get("name") or {}).get("es", "")
        if name_es:
            index[name_es.strip().lower()] = info
    return index


@pytest.fixture
def currencies():
    return _load("currencies.json")


@pytest.fixture
def countries():
    return _load("countries.json")


@pytest.fixture
def with_fixtures(monkeypatch, currencies, countries):
    """Pon los fixtures como datos visibles para las funciones de util."""
    monkeypatch.setattr(util, "CURRENCIES", currencies)
    monkeypatch.setattr(util, "COUNTRIES", countries)
    monkeypatch.setattr(util, "COUNTRY_BY_NAME", _country_index(countries))
    return True


# --- unaccent ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("Perú", "Peru"),
        ("íñandé", "inande"),
        ("Módulo señor", "Modulo senor"),
        ("Macau", "Macau"),
        ("₵50", "50"),
        ("", ""),
        (None, ""),
    ],
)
def test_unaccent(texto, esperado):
    assert util.unaccent(texto) == esperado


# --- norm_flag --------------------------------------------------------------


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("Macao (China)", "MACAO"),
        ("Rep. Dominicana", "REPDOMINICANA"),
        ("Rep. Checa", "REPCHECA"),
        ("Fiyi", "FIYI"),
        ("São Tomé y Príncipe", "SAOTOMEYPRINCIPE"),
        ("", ""),
        (None, ""),
    ],
)
def test_norm_flag(texto, esperado):
    assert util.norm_flag(texto) == esperado


# --- make_note_id -----------------------------------------------------------


@pytest.mark.parametrize(
    ("abbr", "pick", "esperado"),
    [
        ("ar", "P-367a", "ar-p367a"),
        ("cl", "P 125", "cl-p125"),
        ("us", "P.50", "us-p50"),
        ("bm", "A1", "bm-a1"),
        ("ar", "", "ar-"),
        ("ar", None, "ar-"),
    ],
)
def test_make_note_id(abbr, pick, esperado):
    assert util.make_note_id(abbr, pick) == esperado


# --- is_true ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("valor", "esperado"),
    [
        (True, True),
        (False, False),
        (1, True),
        (0, False),
        (2, True),
        (0.0, False),
        ("true", True),
        ("TRUE", True),
        (" true ", True),
        ("si", True),
        ("sí", True),
        ("SI", True),
        ("yes", True),
        ("verdadero", True),
        ("verdadera", True),
        ("1", True),
        ("false", False),
        ("no", False),
        ("0", False),
        ("", False),
        (None, False),
    ],
)
def test_is_true(valor, esperado):
    assert util.is_true(valor) is esperado


# --- currency_name (fixture) -------------------------------------------------


def test_currency_name_es_y_en(with_fixtures):
    assert util.currency_name("CLP") == "Peso"
    assert util.currency_name("CLP", language="en") == "Peso"
    assert util.currency_name("USD", language="en") == "Dollar"


def test_currency_name_codigo_insensible_a_mayusculas_y_espacios(with_fixtures):
    assert util.currency_name(" usd ") == "Dólar"


def test_currency_name_falta_idioma_caen_a_es(with_fixtures):
    # CHF del fixture no tiene "en" en ningún diccionario de nombres.
    assert util.currency_name("CHF", language="en") == "Franco suizo"


def test_currency_name_codigo_desconocido_con_y_sin_fallback(with_fixtures):
    assert util.currency_name("ZZZ", fallback="Billete") == "Billete"
    assert util.currency_name("ZZZ") == ""


def test_currency_name_subunidad(with_fixtures):
    assert util.currency_name("USD", subunit=True) == "Centavo"
    assert util.currency_name("USD", language="en", subunit=True) == "Cent"


def test_currency_name_subunidad_inexistente_usa_fallback(with_fixtures):
    assert util.currency_name("CHF", subunit=True, fallback="Último") == "Último"
    assert util.currency_name("CLP", subunit=True, fallback="Respaldo") == "Respaldo"


# --- get_country_by_code / get_country_by_name (fixture) ----------------------


def test_get_country_by_code(with_fixtures, countries):
    assert util.get_country_by_code("cl") is countries["cl"]
    assert util.get_country_by_code(" CL ") is countries["cl"]
    assert util.get_country_by_code("ar") is countries["ar"]


def test_get_country_by_code_desconocido_o_vacio(with_fixtures):
    assert util.get_country_by_code("zz") is None
    assert util.get_country_by_code("") is None
    assert util.get_country_by_code(None) is None


def test_get_country_by_name(with_fixtures, countries):
    assert util.get_country_by_name("Chile") is countries["cl"]
    assert util.get_country_by_name(" chile ") is countries["cl"]
    assert util.get_country_by_name("Argentina") is countries["ar"]


def test_get_country_by_name_desconocido_o_vacio(with_fixtures):
    assert util.get_country_by_name("Nowheria") is None
    assert util.get_country_by_name("") is None
    assert util.get_country_by_name(None) is None
