"""Tests de serve_web.py a nivel de funciones (T4).

Cubren los validadores `_v_*` y regex (id `{0,80}`, pick `{0,39}`),
`_parse_value_tok`, `_display_name`, los appliers de `FIELDS` sobre dicts
temporales, `parse_old_folder`, `reindex()`, `atomic_write*`, los regex de
seguridad (Origin/Host) y el contrato de `make_record` (reutilizado desde
`build_web`). SIN sockets: ningún handler HTTP se instancia.

El import de `serve_web` es sin side effects desde T5 (sin argv, sin
construir el índice de ids al importar).
"""
from pathlib import Path

import pytest

from _scripts import serve_web


# --- contrato sin side effects (T5) -----------------------------------------


def test_import_sin_side_effects():
    """Al importar no debe haber índice construido ni servidor escuchando."""
    assert serve_web.IDS == {}


# --- regex: id y pick ---------------------------------------------------------


def test_id_re_validos():
    assert serve_web.ID_RE.match("cl-p125")
    assert serve_web.ID_RE.match("a")
    assert serve_web.ID_RE.match("a" * 81)          # 1 + {0,80}
    assert serve_web.ID_RE.match("cl-p.1")


def test_id_re_invalidos():
    assert not serve_web.ID_RE.match("")
    assert not serve_web.ID_RE.match("a" * 82)      # excede {0,80}
    assert not serve_web.ID_RE.match("Cl")          # mayúsculas
    assert not serve_web.ID_RE.match("-cl")         # debe empezar alfanumérico
    assert not serve_web.ID_RE.match(".cl")
    assert not serve_web.ID_RE.match("cl/p")        # traversal


def test_pick_re():
    assert serve_web.PICK_RE.match("P-367a")
    assert serve_web.PICK_RE.match("a" * 40)        # 1 + {0,39}
    assert not serve_web.PICK_RE.match("")
    assert not serve_web.PICK_RE.match("a" * 41)    # excede {0,39}
    assert not serve_web.PICK_RE.match(" P")        # espacio inicial
    assert not serve_web.PICK_RE.match("-p")


def test_regex_origen_y_host():
    assert serve_web.ORIGIN_RE.match("http://localhost:8000")
    assert serve_web.ORIGIN_RE.match("https://127.0.0.1")
    assert not serve_web.ORIGIN_RE.match("http://evil.com")
    assert serve_web.HOST_RE.match("localhost:8917")
    assert not serve_web.HOST_RE.match("localhost.evil.com")


# --- validadores _v_* ---------------------------------------------------------


def test_v_str_maxlen():
    v = serve_web._v_str(80)
    assert v("") is True                     # allow_empty por defecto
    assert v("x" * 80) is True
    assert v("x" * 81) is False
    assert v(5) is False


def test_v_str_allow_empty():
    v = serve_web._v_str(80, allow_empty=False)
    assert v("") is False
    assert v("   ") is False
    assert v(" ok ") is True


def test_v_num():
    assert serve_web._v_num(None) is True
    assert serve_web._v_num(0) is True
    assert serve_web._v_num(1000) is True
    assert serve_web._v_num(0.5) is True
    assert serve_web._v_num(10**12 - 1) is True
    assert serve_web._v_num(10**12) is False
    assert serve_web._v_num(-1) is False
    assert serve_web._v_num("10") is False
    assert serve_web._v_num(True) is False    # bool no es número


def test_v_year():
    assert serve_web._v_year(None) is True
    assert serve_web._v_year(1000) is True
    assert serve_web._v_year(2100) is True
    assert serve_web._v_year(1961) is True
    assert serve_web._v_year(999) is False
    assert serve_web._v_year(2101) is False
    assert serve_web._v_year("1961") is False
    assert serve_web._v_year(True) is False


def test_v_url():
    v = serve_web._v_url
    assert v("") is True                     # vacío: para poder borrarla
    assert v("   ") is True
    assert v("http://x") is True
    assert v("https://x") is True
    assert v("ftp://x") is False
    assert v("www.x") is False
    assert v("x" * 301) is False
    assert v(1) is False


def test_v_temas():
    v = serve_web._v_temas
    assert v("") is True
    assert v("tema:mar") is True
    assert v("tema:mar, otro:x") is True
    assert v("a: 1") is True                 # espacios alrededor de :
    assert v("sin dos") is False             # falta el ':'
    assert v("a:1, b") is False              # 2º par sin ':'
    assert v("x" * 501) is False
    assert v(1) is False


def test_v_bool():
    v = serve_web._v_bool
    assert v(True) is True
    assert v(False) is True
    for ok in ("true", "false", "1", "0", "si", "sí", "no", "yes", "TRUE"):
        assert v(ok) is True
    assert v("maybe") is False
    assert v("2") is False
    assert v(1) is False


def test_v_currency_code():
    v = serve_web._v_currency_code
    assert v("CLP") is True
    assert v("clp") is True                  # normaliza a mayúsculas
    assert v("") is True
    assert v("  ") is True
    assert v("ZZ") is False
    assert v(1) is False


def test_validadores_inline_condicion_y_verificado():
    cond = serve_web.FIELDS["condicion"][0]
    assert cond("XF") is True
    assert cond("") is True                  # "" = sin clasificar
    assert cond("NOPE") is False
    assert cond(1) is False
    verif = serve_web.FIELDS["verificado"][0]
    assert verif(True) is True
    assert verif("true") is False            # bool estricto
    assert verif(1) is False


def test_fields_es_un_par_validador_applier():
    for name, (validate, apply_) in serve_web.FIELDS.items():
        assert callable(validate) and callable(apply_), name
    for f in ("pais", "valor", "moneda", "anio", "verificado"):
        assert f in serve_web.FIELDS


# --- _parse_value_tok y _display_name ----------------------------------------


def test_parse_value_tok():
    assert serve_web._parse_value_tok("5") == 5
    assert serve_web._parse_value_tok("100") == 100
    assert serve_web._parse_value_tok("0") == 0
    assert serve_web._parse_value_tok("05") == 0.5      # subunidad
    assert serve_web._parse_value_tok("025") == 0.25
    assert serve_web._parse_value_tok("007") == 0.07


def test_display_name():
    assert serve_web._display_name("chile") == "Chile"
    assert serve_web._display_name("estados unidos") == "Estados Unidos"
    assert serve_web._display_name("isla de man") == "Isla de Man"
    assert serve_web._display_name("la pampa") == "La Pampa"  # conector inicial


# --- appliers de FIELDS sobre dicts temporales ---------------------------------


def _note():
    """Dict de billete mínimo (forma de _json/<route>/<id>.json).

    El id 'zz-p0' no existe en el repo: las fotos por convención
    (_originals/zz-p0/..., _FULL/zz-p0.webp) salen inexistentes.
    """
    return {
        "id": "zz-p0",
        "country_code": "cl",
        "country": {"es": "Chile", "en": "Chile"},
        "denomination": {"value": 1000, "currency": "Escudos", "iso4217": None,
                         "subtype": "", "alternatives": []},
        "notes": {"obs": "", "vigencia": "", "serie": "", "bank": "", "zone": ""},
        "specimens": [{"serial_number": "", "condition": ""}],
        "colnect": {"group": "", "url": ""},
        "signatures": [],
        "themes": [],
        "year": 1961,
        "numista": "",
        "commemorative": False,
        "overprint": False,
        "verificado": False,
    }


def test_set_pais_actualiza_codigo_y_nombre():
    d = _note()
    serve_web._set_pais(d, "Perú")
    assert d["country_code"] == "pe"
    assert d["country"]["es"] == "Perú"


def test_set_pais_desconocido_lanza():
    with pytest.raises(ValueError):
        serve_web._set_pais(_note(), "Atlantida")


def test_applier_colnect_y_numista():
    d = _note()
    serve_web.FIELDS["colnect"][1](d, "https://colnect.com/x")
    serve_web.FIELDS["numista"][1](d, "https://numista.com/y")
    assert d["colnect"]["url"] == "https://colnect.com/x"
    assert d["numista"] == "https://numista.com/y"


def test_applier_valor_y_moneda():
    d = _note()
    serve_web.FIELDS["valor"][1](d, 500)
    serve_web.FIELDS["moneda"][1](d, "  Pesos  ")
    assert d["denomination"]["value"] == 500
    assert d["denomination"]["currency"] == "Pesos"


def test_applier_currency_code_normaliza():
    d = _note()
    serve_web.FIELDS["currency_code"][1](d, "clp")
    assert d["denomination"]["iso4217"] == "CLP"
    serve_web.FIELDS["currency_code"][1](d, "")
    assert d["denomination"]["iso4217"] is None


def test_applier_subunidad_marca_y_elimina():
    d = _note()
    serve_web.FIELDS["subunidad"][1](d, True)
    assert d["denomination"]["subunidad"] is True
    serve_web.FIELDS["subunidad"][1](d, False)
    assert "subunidad" not in d["denomination"]


def test_applier_datos_basicos():
    d = _note()
    serve_web.FIELDS["anio"][1](d, 1950)
    serve_web.FIELDS["verificado"][1](d, True)
    serve_web.FIELDS["conmemorativo"][1](d, True)
    serve_web.FIELDS["remarcado"][1](d, True)
    assert d["year"] == 1950
    assert d["verificado"] is True
    assert d["commemorative"] is True
    assert d["overprint"] is True


def test_applier_notas_de_texto():
    d = _note()
    serve_web.FIELDS["obs"][1](d, "  roto  ")
    serve_web.FIELDS["grupo"][1](d, "P-125")
    serve_web.FIELDS["vigencia"][1](d, "1960-1970")
    serve_web.FIELDS["serie"][1](d, "S")
    serve_web.FIELDS["banco"][1](d, "BCCh")
    serve_web.FIELDS["zona"][1](d, "Z")
    assert d["notes"]["obs"] == "roto"
    assert d["colnect"]["group"] == "P-125"
    assert d["notes"]["vigencia"] == "1960-1970"
    assert d["notes"]["serie"] == "S"
    assert d["notes"]["bank"] == "BCCh"
    assert d["notes"]["zone"] == "Z"


def test_applier_serial_y_condicion():
    d = _note()
    serve_web.FIELDS["serial"][1](d, "  A1B2C3  ")
    serve_web.FIELDS["condicion"][1](d, "XF")
    assert d["specimens"][0]["serial_number"] == "A1B2C3"
    assert d["specimens"][0]["condition"] == "XF"


def test_applier_firmas_split():
    d = _note()
    serve_web.FIELDS["firmas"][1](d, "A. González - B. Pérez")
    assert d["signatures"] == ["A. González", "B. Pérez"]
    serve_web.FIELDS["firmas"][1](d, "   ")
    assert d["signatures"] == []


def test_applier_temas_normaliza():
    d = _note()
    serve_web.FIELDS["temas"][1](d, "tema:mar,  paisaje: costa ")
    assert d["themes"] == ["tema:mar", "paisaje:costa"]
    serve_web.FIELDS["temas"][1](d, "")
    assert d["themes"] == []


def test_applier_subtipo_y_alternativas():
    d = _note()
    serve_web.FIELDS["subtipo"][1](d, "V Cruiser")
    serve_web.FIELDS["alternativas"][1](d, "a · b , c")
    assert d["denomination"]["subtype"] == "V Cruiser"
    assert d["denomination"]["alternatives"] == ["a", "b", "c"]


# --- parse_old_folder ----------------------------------------------------------


def test_parse_old_folder_completo():
    info, err = serve_web.parse_old_folder("Chile_1.Escudos_1961")
    assert err is None
    assert info["abbr"] == "cl"
    assert info["pais_es"] == "Chile"
    assert info["value"] == 1
    assert info["currency"] == "Escudos"
    assert info["year"] == 1961
    assert info["obs"] == ""
    assert info["route"] == "chile"


def test_parse_old_folder_subunidad_y_extras():
    info, err = serve_web.parse_old_folder("Peru_05.Soles_1946.hoja")
    assert err is None
    assert info["abbr"] == "pe"
    assert info["pais_es"] == "Perú"
    assert info["value"] == 0.5
    assert info["currency"] == "Soles"
    assert info["year"] == 1946
    assert info["obs"] == "hoja"
    assert info["route"] == "world"


def test_parse_old_folder_sin_anio():
    info, err = serve_web.parse_old_folder("Chile_1000.Pesos")
    assert err is None
    assert info["value"] == 1000
    assert info["currency"] == "Pesos"
    assert info["year"] is None


def test_parse_old_folder_pais_desconocido():
    info, err = serve_web.parse_old_folder("Foo_1.X_1961")
    assert info is None
    assert "país no reconocido" in err


# --- reindex (T5) ---------------------------------------------------------------


def test_reindex(monkeypatch, tmp_path: Path):
    (tmp_path / "chile").mkdir()
    (tmp_path / "chile" / "cl-p1.json").write_text("{}", encoding="utf-8")
    (tmp_path / "world").mkdir()
    (tmp_path / "world" / "ar-p5.json").write_text("{}", encoding="utf-8")
    monkeypatch.setattr(serve_web, "JSON_DIR", tmp_path)
    monkeypatch.setattr(serve_web, "IDS", {})

    index = serve_web.reindex()

    assert set(index) == {"cl-p1", "ar-p5"}
    assert serve_web.IDS is index    # el global que leen los handlers


# --- atomic_write ---------------------------------------------------------------


def test_atomic_write_text(tmp_path: Path):
    dest = tmp_path / "x.json"
    serve_web.atomic_write(dest, "hola\n")
    assert dest.read_text(encoding="utf-8") == "hola\n"
    assert not list(tmp_path.glob("*.tmp"))


def test_atomic_write_bytes(tmp_path: Path):
    dest = tmp_path / "x.bin"
    serve_web.atomic_write_bytes(dest, b"\x89PNG")
    assert dest.read_bytes() == b"\x89PNG"
    assert not list(tmp_path.glob("*.tmp"))


def test_atomic_write_falla_no_deja_tmp(tmp_path: Path):
    dest = tmp_path / "noexiste" / "x.json"
    with pytest.raises(OSError):
        serve_web.atomic_write(dest, "hola")
    assert not list(tmp_path.glob("**/*.tmp"))


# --- make_record (contrato reutilizado de build_web) -----------------------------


def test_make_record_fixture_completo():
    rec = serve_web.build_web.make_record(_note())
    assert rec["id"] == "zz-p0"
    assert rec["pais"] == "Chile"
    assert rec["denominacion"] == "1.000 Escudos"
    assert rec["anio"] == 1961
    assert rec["flag"].startswith("_flags_svg/")
    # este id no tiene fotos en disco: las rutas salen vacías
    assert rec["thumb_a"] == "" and rec["img_a"] == ""
    assert rec["img_full"] == ""
    assert "chile" in rec["search"]


def test_make_record_exige_specimen():
    """Contrato: sin default de specimens[0] — un JSON así es inválido
    (build() lo omite como json_invalido)."""
    d = _note()
    del d["specimens"]
    with pytest.raises(KeyError):
        serve_web.build_web.make_record(d)
    d2 = _note()
    d2["specimens"] = []
    with pytest.raises(IndexError):
        serve_web.build_web.make_record(d2)
