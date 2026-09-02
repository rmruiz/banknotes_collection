"""Tests de build_web.py (T3).

Cubre las funciones puras (fmt_valor, denominacion_full, build_search,
natural_pick_key, file_v, thumb_jobs), la función extraída record_to_json
y un build() de integración contra datos de muestra en tests/sample_data/
(billete completo + billete con campos faltantes + JSON malformado +
esquema inválido + carpeta huérfana).
"""
import hashlib
import json
import re
import shutil
from pathlib import Path

import pytest

from _scripts import build_web

SAMPLE = Path(__file__).resolve().parents[2] / "tests" / "sample_data"
SAMPLE_WEB = SAMPLE / "web"
SAMPLE_FLAGS = SAMPLE_WEB / "_flags_svg"
V_TOKEN = r"[0-9a-f]{10}"


def _load_note(rel):
    path = SAMPLE / "_json" / rel
    return json.loads(path.read_text(encoding="utf-8"))


# --- fmt_valor ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("valor", "esperado"),
    [
        (0, "0"),
        (10, "10"),
        (1.5, "1,5"),
        (26.5, "26,5"),
        (300, "300"),
        (1000, "1.000"),
        (10000, "10.000"),
        (1000000, "1.000.000"),
        (50, "50"),
        (1, "1"),
        (0.5, "0,5"),
        (2.25, "2,25"),
        (None, ""),
    ],
)
def test_fmt_valor(valor, esperado):
    assert build_web.fmt_valor(valor) == esperado


# --- denominacion_full -------------------------------------------------------


def test_denominacion_full_plural_y_singular():
    assert build_web.denominacion_full(
        {"value": 1000, "iso4217": "CLP", "currency": "Peso"}) == "1.000 Pesos"
    assert build_web.denominacion_full(
        {"value": 1, "iso4217": "CLP", "currency": "Peso"}) == "1 Peso"


def test_denominacion_full_moneda_desconocida_usa_texto_libre():
    assert build_web.denominacion_full(
        {"value": 100, "iso4217": "", "currency": "Maravedí"}) == "100 Maravedí"


def test_denominacion_full_valor_nulo():
    assert build_web.denominacion_full(
        {"value": None, "iso4217": "CLP", "currency": ""}) == "Pesos"


def test_denominacion_full_subunidad_comportamiento_actual():
    # Comportamiento actual bloqueado (T3): el plural (es_p) de la unidad
    # principal prevalece sobre el nombre de subunidad cuando valor != 1.
    assert build_web.denominacion_full(
        {"value": 50, "iso4217": "CLP", "currency": "", "subunidad": True}) == "50 Pesos"


# --- build_search ------------------------------------------------------------


def test_build_search_normaliza_y_filtro():
    assert build_web.build_search("Chile", "P-125", "1.000 Pesos") == \
        "chile p-125 1.000 pesos"
    assert build_web.build_search(None, "", [], "Santiago") == "santiago"
    assert build_web.build_search() == ""


def test_build_search_comprime_espacios():
    assert build_web.build_search("a", "  b  ") == "a b"


# --- natural_pick_key / sort_key ---------------------------------------------


@pytest.mark.parametrize(
    ("pick", "esperado"),
    [
        ("P-125", (125, "P-125")),
        ("P-9", (9, "P-9")),
        ("X1b2", (1, "X1b2")),
        ("P-2010-s", (2010, "P-2010-s")),
        (None, (10 ** 9, "")),
        ("abc", (10 ** 9, "abc")),
    ],
)
def test_natural_pick_key(pick, esperado):
    assert build_web.natural_pick_key(pick) == esperado


def test_sort_key_orden_natural_de_picks():
    recs = [{"pais": "Chile", "pick": p} for p in ("P-10", "P-2", "")]
    ordenado = sorted(recs, key=build_web.sort_key)
    assert [r["pick"] for r in ordenado] == ["P-2", "P-10", ""]


def test_sort_key_pais_antes_de_pick():
    recs = [
        {"pais": "España", "pick": "P-9"},
        {"pais": "Chile", "pick": "P-20"},
    ]
    ordenado = sorted(recs, key=build_web.sort_key)
    assert [r["pais"] for r in ordenado] == ["Chile", "España"]


# --- file_v ------------------------------------------------------------------


def test_file_v_determinista_y_sensible_a_cambios(tmp_path):
    f = tmp_path / "foto.jpg"
    f.write_bytes(b"x")
    v1 = build_web.file_v(f)
    assert re.fullmatch(rf"{V_TOKEN}", v1)
    assert build_web.file_v(f) == v1
    f.write_bytes(b"yy")   # cambio de tamaño (y de contenido)
    assert build_web.file_v(f) != v1


# --- thumb_jobs (incremental) --------------------------------------------------


def test_thumb_jobs_detecta_pendientes_y_al_dia(tmp_path, monkeypatch):
    monkeypatch.setattr(build_web, "WEB", tmp_path)
    src = tmp_path / "src.jpg"
    src.write_bytes(b"fotos")
    rec = {
        "img_a": "src.jpg?v=1", "thumb_a": "thumbs/t_A.jpg?v=1",
        "img_b": "", "thumb_b": "",
        "img_full": "", "thumb_f": "",
    }
    # sin meta: está pendiente
    jobs = build_web.thumb_jobs(rec, {})
    assert len(jobs) == 1
    assert jobs[0][0] == src.resolve()
    assert jobs[0][2] == "thumbs/t_A.jpg"
    # al día solo si el thumb existe Y la firma del origen coincide con la meta
    dest = tmp_path / "thumbs" / "t_A.jpg"
    dest.parent.mkdir(parents=True)
    dest.write_bytes(b"thumb")
    meta = {"thumbs/t_A.jpg": build_web.file_sig(src)}
    assert build_web.thumb_jobs(rec, meta) == []
    # si el thumb falta, se regenera aunque la firma de la meta cuadre
    dest.unlink()
    assert len(build_web.thumb_jobs(rec, meta)) == 1
    # force: siempre se regenera
    dest.write_bytes(b"thumb")
    assert len(build_web.thumb_jobs(rec, meta, force=True)) == 1


# --- record_to_json ------------------------------------------------------------


def test_record_to_json_billete_completo():
    d = _load_note("chile/cl-p125.json")
    rec = build_web.record_to_json(d, web=SAMPLE_WEB, flags_svg=SAMPLE_FLAGS)

    assert rec["id"] == "cl-p125"
    assert rec["pick"] == "P-125"
    assert rec["country_code"] == "cl"
    assert rec["pais"] == "Chile"
    assert rec["pais_en"] == "Chile"
    assert rec["valor"] == 1000
    assert rec["moneda"] == "Peso"
    assert rec["currency_code"] == "CLP"
    assert rec["currency_name_es"] == "Peso"
    assert rec["currency_name_en"] == "Peso"
    assert rec["currency_symbol"] == "$"
    assert rec["currency_status"] == "circulacion"
    assert rec["denominacion"] == "1.000 Pesos"
    assert rec["subunidad"] is False
    assert rec["subtipo"] == ""
    assert rec["alternativas"] == ""
    assert rec["anio"] == 1961
    assert rec["firmas"] == "R. Tobar"
    assert rec["temas"] == "personaje:eliseo_vidal"
    assert rec["obs"] == "Muestra de test"
    assert rec["vigencia"] == ""
    assert rec["serie"] == ""
    assert rec["banco"] == ""
    assert rec["zona"] == ""
    assert rec["serial"] == "AB123456"
    assert rec["condicion"] == "UNC"
    assert rec["grupo"] == "Aniversarios"
    assert rec["colnect"] == "https://colnect.com/es/banknotes/banknote/1"
    assert rec["numista"] == "https://es.numista.com/1"
    assert rec["conmemorativo"] is False
    assert rec["remarcado"] is False
    assert rec["verificado"] is True

    # flag resuelta contra _flags_svg/ de muestra
    assert re.fullmatch(rf"_flags_svg/cl\.svg\?v={V_TOKEN}", rec["flag"])

    # fotos resueltas por convención; thumb e img comparten la misma versión
    assert re.fullmatch(
        rf"_originals/cl-p125/cl-p125_A\.jpg\?v={V_TOKEN}", rec["img_a"])
    assert re.fullmatch(rf"thumbs/cl-p125_A\.jpg\?v={V_TOKEN}", rec["thumb_a"])
    assert rec["img_a"].rsplit("=", 1)[1] == rec["thumb_a"].rsplit("=", 1)[1]
    assert rec["img_b"] and rec["thumb_b"]
    assert re.fullmatch(rf"_FULL/cl-p125\.webp\?v={V_TOKEN}", rec["img_full"])
    assert re.fullmatch(rf"thumbs/cl-p125_F\.jpg\?v={V_TOKEN}", rec["thumb_f"])

    # campo search: normalizado, sin acentos, con país y monto
    s = rec["search"]
    for trozo in ("chile", "1.000 pesos", "p-125", "1000", "1961", "clp"):
        assert trozo in s
    for a in "áéíóúñÁÉÍÓÚÑ":
        assert a not in s


def test_record_to_json_campos_faltantes():
    d = _load_note("chile/cl-p100.json")
    rec = build_web.record_to_json(d, web=SAMPLE_WEB, flags_svg=SAMPLE_FLAGS)

    assert rec["id"] == "cl-p100"
    assert rec["pick"] == ""
    # país resuelto por nombre (no hay country_code en el JSON)
    assert rec["pais"] == "Chile"
    assert rec["pais_en"] == "Chile"
    assert rec["valor"] is None
    assert rec["anio"] is None
    # moneda libre: sin ISO 4217 se conserva el texto original
    assert rec["currency_code"] == ""
    assert rec["currency_name_es"] == "Maravedí"
    assert rec["currency_name_en"] == "Maravedí"
    assert rec["currency_symbol"] == ""
    assert rec["currency_status"] == ""
    assert rec["denominacion"] == "Maravedí"
    assert rec["moneda"] == "Maravedí"
    assert rec["serial"] == ""
    assert rec["colnect"] == ""
    assert rec["verificado"] is False
    # sin fotos: los seis campos de ruta quedan vacíos
    for key in ("img_a", "img_b", "img_full", "thumb_a", "thumb_b", "thumb_f"):
        assert rec[key] == ""
    # la bandera sí se resuelve por el nombre del país
    assert re.fullmatch(rf"_flags_svg/cl\.svg\?v={V_TOKEN}", rec["flag"])
    assert "maravedi" in rec["search"]


def test_record_to_json_pais_desconocido():
    d = {
        "id": "xx-1",
        "denomination": {"value": 1, "currency": "", "iso4217": "",
                         "subtype": "", "alternatives": []},
        "specimens": [{}],
        "country": {"es": "Nowheria", "en": "Nowheria"},
    }
    rec = build_web.record_to_json(d, web=SAMPLE_WEB, flags_svg=SAMPLE_FLAGS)
    assert rec["pais"] == "Nowheria"
    assert rec["pais_en"] == "Nowheria"
    assert rec["flag"] == ""
    assert "nowheria" in rec["search"]


def test_make_record_es_alias_de_record_to_json():
    d = _load_note("chile/cl-p125.json")
    assert build_web.make_record(d) == build_web.record_to_json(d)


# --- make_thumb ----------------------------------------------------------------


def test_make_thumb_falla_sin_derrumbar(tmp_path):
    job = (tmp_path / "no_existe.jpg", tmp_path / "out.jpg", "k", "sig")
    ok, info = build_web.make_thumb(job)
    assert ok is False
    assert info.startswith("out.jpg")


# --- build() de integración (tests/sample_data) --------------------------------


@pytest.fixture
def sample_build(tmp_path, monkeypatch):
    """Copia tests/sample_data a un tmp y redirige los globales de rutas."""
    root = tmp_path / "repo"
    shutil.copytree(SAMPLE / "_json", root / "_json")
    shutil.copytree(SAMPLE / "web", root / "web")
    monkeypatch.setattr(build_web, "REPO", root)
    monkeypatch.setattr(build_web, "JSON_DIR", root / "_json")
    monkeypatch.setattr(build_web, "WEB", root / "web")
    monkeypatch.setattr(build_web, "THUMBS", root / "web" / "thumbs")
    monkeypatch.setattr(build_web, "DATA", root / "web" / "data")
    monkeypatch.setattr(build_web, "FLAGS_SVG", root / "web" / "_flags_svg")
    monkeypatch.setattr(build_web, "ORIGINALS", root / "web" / "_originals")
    return root


def _data(root, name):
    return json.loads((root / "web" / "data" / name).read_text(encoding="utf-8"))


def test_build_registra_billetes_validos(sample_build):
    res = build_web.build(verbose=False)
    assert res["registros"] == 3
    assert res["json_invalidos"] == 2      # bad.json + cl-xnospec.json
    assert res["con_front"] == 2
    assert res["con_back"] == 2
    assert res["con_full"] == 1
    assert res["kb"] > 0

    records = _data(sample_build, "collection.json")
    # orden: país y pick natural (el pick vacío va al final)
    assert [r["id"] for r in records] == ["ar-p5", "cl-p125", "cl-p100"]

    by_id = {r["id"]: r for r in records}
    r125 = by_id["cl-p125"]
    assert r125["denominacion"] == "1.000 Pesos"
    assert r125["currency_name_en"] == "Peso"
    assert r125["currency_symbol"] == "$"
    assert r125["verificado"] is True
    assert r125["flag"].startswith("_flags_svg/cl.svg?v=")
    assert r125["thumb_a"] and r125["img_a"] and r125["img_full"]
    assert "chile" in r125["search"] and "1.000 pesos" in r125["search"]

    # valor 1 -> singular
    assert by_id["ar-p5"]["denominacion"] == "1 Peso"

    # billete con campos faltantes sigue presente
    r100 = by_id["cl-p100"]
    assert r100["pick"] == ""
    assert r100["pais"] == "Chile"
    assert r100["denominacion"] == "Maravedí"


def test_build_issues_por_categoria(sample_build):
    res = build_web.build(verbose=False)
    issues = _data(sample_build, "issues.json")
    cat = {c["clave"]: c["items"] for c in issues["categorias"]}

    assert len(cat["json_invalidos"]) == 2
    assert len(cat["monedas_sin_vinculo"]) == 1
    assert cat["monedas_sin_vinculo"][0]["id"] == "cl-p100"
    assert len(cat["carpetas_sin_json"]) == 1
    orphan = cat["carpetas_sin_json"][0]
    assert orphan["carpeta"] == "orphan"
    assert orphan["archivos"] == ["random_A.jpg"]
    assert orphan["thumb_a"] and not orphan["thumb_b"]
    assert len(cat["picks_sin_formato"]) == 1
    assert len(cat["picks_formato_raro"]) == 0
    assert len(cat["sin_colnect"]) == 1
    assert len(cat["sin_fotos"]) == 1
    assert len(cat["sin_full"]) == 1
    assert res["problemas"] == sum(len(v) for v in cat.values()) == 8


def test_build_sincroniza_catalogos(sample_build):
    build_web.build(verbose=False)
    data = sample_build / "web" / "data"
    assert (data / "countries.json").read_text(encoding="utf-8") == \
        (SAMPLE / "_json" / "countries.json").read_text(encoding="utf-8")
    assert (data / "currencies.json").read_text(encoding="utf-8") == \
        (SAMPLE / "_json" / "currencies.json").read_text(encoding="utf-8")


def test_build_incremental_no_repite_thumbs(sample_build):
    build_web.build(verbose=False)
    data = sample_build / "web" / "data"
    col1 = (data / "collection.json").read_bytes()
    res2 = build_web.build(verbose=False)
    col2 = (data / "collection.json").read_bytes()
    # doble build byte-estable: determinismo del orden y de los campos
    # (issues.json NO es byte-estable: lleva timestamp "generado")
    assert hashlib.sha256(col1).digest() == hashlib.sha256(col2).digest()
    # segunda pasada: nada pendiente -> no se regenera ningún thumb
    assert res2["thumbs_generadas"] == 0
    # la meta de miniaturas se persiste en web/data/thumbs_meta.json
    meta = json.loads((data / "thumbs_meta.json").read_text(encoding="utf-8"))
    assert isinstance(meta, dict)
    for clave, sig in meta.items():
        assert re.fullmatch(r"\d+-\d+", sig)


def test_build_force_reintenta_todas_las_miniaturas(sample_build):
    res = build_web.build(force=True, verbose=False)
    # 5 fotos de billetes + 1 de la carpeta huérfana = 6 trabajos, haga
    # magick lo que haga (generados o con error, pero nunca omitidos)
    assert res["thumbs_generadas"] + res["thumbs_errores"] == 6

