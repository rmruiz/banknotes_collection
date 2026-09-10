"""Tests de integración HTTP de serve_web.py (T7): contrato de error
{ok,...} / {ok:false,error} contra un ThreadingHTTPServer real en puerto
efímero (http.client).

Hermetico: el fixture monkeypatchea las rutas de `serve_web` (REPO,
JSON_DIR, WEB, COLLECTION, ORIGINALS, FULL) a un árbol en `tmp_path` y
`reindex()` reconstruye `IDS` sobre él — cero escrituras en la colección
real. El servidor se levanta SIN `main()` (sin el build de arranque):
los handlers se ejercitan directamente sobre el árbol fake.

El id del billete fixture es `zz-p0` (convención T4): garantiza que no
existe en el repo real, por lo que `make_record` no resuelve fotos.
"""
import http.client
import json
import socket
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from _scripts import serve_web
from _scripts.serve_web import Handler

HOST = "127.0.0.1"


def _free_port() -> int:
    s = socket.socket()
    s.bind((HOST, 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _note_doc(nid: str = "zz-p0") -> dict:
    """JSON de billete válido (misma forma que _note() de test_serve_web)."""
    return {
        "id": nid,
        "pick_number": "P-0",
        "country_code": "cl",
        "country": {"es": "Chile", "en": "Chile"},
        "denomination": {"value": 1000, "currency": "Escudos", "iso4217": None,
                         "subtype": "", "alternatives": []},
        "year": 1961,
        "signatures": [],
        "themes": [],
        "colnect": {"url": "", "group": ""},
        "numista": "",
        "commemorative": False,
        "overprint": False,
        "verificado": False,
        "notes": {"serie": "", "bank": "", "zone": "", "vigencia": "", "obs": ""},
        "specimens": [{"serial_number": "", "condition": ""}],
    }


def _countries_doc() -> dict:
    """countries.json de prueba (misma forma que _json/countries.json)."""
    return {
        "cl": {
            "code": "cl", "iso_alpha2": "CL", "iso_numeric": "152",
            "name": {"es": "Chile", "en": "Chile"},
            "vigente": "si", "flag_svg": "cl.svg",
            "folder": "world", "moneda_vigente": "CLP",
        },
        "ae": {
            "code": "ae", "iso_alpha2": "AE", "iso_numeric": "784",
            "name": {"es": "Emiratos Árabes Unidos",
                     "en": "United Arab Emirates"},
            "vigente": "si", "flag_svg": "ae.svg",
            "folder": "world", "moneda_vigente": None,
        },
    }


def _currencies_doc() -> dict:
    """currencies.json de prueba (misma forma que _json/currencies.json)."""
    return {
        "EUR": {
            "codigo": "EUR",
            "iso_4217": {"numerico": "978", "decimales": 2},
            "simbolo": "€",
            "nombres": {"es": "Euro", "en": "Euro", "ar": "يورو"},
            "nombre_corto": {"es": "Euro", "en": "Euro"},
            "tipo": "moneda regional", "estado": "vigente",
            "subunidad": {"nombres": {"es": "céntimo", "en": "cent"},
                          "factor": 100, "codigo": "02"},
            "banco_central": {"nombre": "BCE", "codigo": "ECB"},
            "historia": {"fecha_introduccion": "1999", "fecha_fin": None,
                         "moneda_anterior": "DEM", "moneda_sucesora": None},
            "uso": {"emisor": ["DE", "FR"], "curso_legal": ["DE"],
                    "circulacion": [], "de_facto": []},
            "notas": "zona única",
        },
    }


def _post(port: int, path: str, payload: object = None,
          raw: bytes | None = None,
          headers: dict | None = None) -> tuple[int, dict | None]:
    """POST con Host/Origin de localhost (válidos); devuelve (status, body)."""
    conn = http.client.HTTPConnection(HOST, port, timeout=10)
    try:
        h = {"Host": f"{HOST}:{port}", "Origin": f"http://{HOST}:{port}"}
        if headers:
            h.update(headers)
        data = raw if raw is not None else json.dumps(payload).encode("utf-8")
        conn.request("POST", path, body=data, headers=h)
        r = conn.getresponse()
        body = r.read()
        return r.status, (json.loads(body) if body else None)
    finally:
        conn.close()


@pytest.fixture()
def api(monkeypatch, tmp_path: Path):
    """Servidor real en puerto efímero sirviendo un árbol fake en tmp_path."""
    web = tmp_path / "web"
    (web / "data").mkdir(parents=True)
    (web / "index.html").write_text("<html>ok</html>", encoding="utf-8")
    note = _note_doc()
    rec = serve_web.build_web.make_record(note)
    coll_path = web / "data" / "collection.json"
    coll_path.write_text(
        json.dumps([rec], ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")
    jdir = tmp_path / "_json"
    (jdir / "world").mkdir(parents=True)
    (jdir / "world" / "zz-p0.json").write_text(
        json.dumps(note, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (tmp_path / "_originals").mkdir()
    (tmp_path / "_full").mkdir()

    # datasets de prueba (fuente + copia en web/data, mismo texto)
    cdoc = json.dumps(_countries_doc(), ensure_ascii=False, indent=2) + "\n"
    udoc = json.dumps(_currencies_doc(), ensure_ascii=False, indent=2) + "\n"
    (jdir / "countries.json").write_text(cdoc, encoding="utf-8")
    (jdir / "currencies.json").write_text(udoc, encoding="utf-8")
    (web / "data" / "countries.json").write_text(cdoc, encoding="utf-8")
    (web / "data" / "currencies.json").write_text(udoc, encoding="utf-8")

    monkeypatch.setattr(serve_web, "REPO", tmp_path)
    monkeypatch.setattr(serve_web, "JSON_DIR", jdir)
    monkeypatch.setattr(serve_web, "WEB", web)
    monkeypatch.setattr(serve_web, "COLLECTION", coll_path)
    monkeypatch.setattr(serve_web, "ORIGINALS", tmp_path / "_originals")
    monkeypatch.setattr(serve_web, "FULL", tmp_path / "_full")
    monkeypatch.setattr(serve_web, "IDS", serve_web.reindex())
    monkeypatch.setattr(Handler, "log_message", lambda self, fmt, *a: None)

    port = _free_port()
    server = ThreadingHTTPServer((HOST, port), Handler)
    th = threading.Thread(target=server.serve_forever, daemon=True)
    th.start()
    try:
        yield {"port": port,
               "json_path": jdir / "world" / "zz-p0.json",
               "coll_path": coll_path,
               "countries_src": jdir / "countries.json",
               "countries_dst": web / "data" / "countries.json",
               "currencies_src": jdir / "currencies.json",
               "currencies_dst": web / "data" / "currencies.json"}
    finally:
        server.shutdown()
        server.server_close()
        th.join(timeout=5)


# --- ruta feliz (regresión: el contrato 200 no cambió) ------------------------


def test_update_ok_200_y_persiste_en_fuente_y_collection(api):
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "obs", "value": "nota de test"})
    assert status == 200
    assert body["ok"] is True and body["id"] == "zz-p0"
    # 1) fuente de verdad: el JSON en disco se actualiza
    d = json.loads(api["json_path"].read_text(encoding="utf-8"))
    assert d["notes"]["obs"] == "nota de test"
    # 2) derivado: el registro de collection.json se actualiza
    coll = json.loads(api["coll_path"].read_text(encoding="utf-8"))
    assert coll[0]["obs"] == "nota de test"
    assert "nota de test" in coll[0]["search"]


def test_update_precio_200_y_persiste_en_fuente_y_collection(api):
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "precio", "value": 123.5})
    assert status == 200
    assert body["ok"] is True and body["id"] == "zz-p0"
    assert body["record"]["precio"] == 123.5
    # 1) fuente de verdad: el JSON en disco se actualiza
    d = json.loads(api["json_path"].read_text(encoding="utf-8"))
    assert d["precio"] == 123.5
    # 2) derivado: el registro de collection.json se actualiza
    coll = json.loads(api["coll_path"].read_text(encoding="utf-8"))
    assert coll[0]["precio"] == 123.5
    assert "123.5" in coll[0]["search"]


def test_get_estatico_del_web_fake(api):
    """El directorio de estáticos es el WEB monkeypatcheado (árbol fake)."""
    conn = http.client.HTTPConnection(HOST, api["port"], timeout=10)
    try:
        conn.request("GET", "/index.html")
        r = conn.getresponse()
        assert r.status == 200 and b"<html>ok" in r.read()
    finally:
        conn.close()


# --- T13: smoke de creación (país es/en resuelto desde util) -----------------


def test_new_note_chile_200_y_persiste_en_carpeta_y_collection(api):
    status, body = _post(api["port"], "/api/new_note",
                         {"pais": "Chile", "pick": "P-999"})
    assert status == 200
    assert body["ok"] is True and body["id"] == "cl-p999"
    # la ruta del país (folder 'chile') viene de util.country_route
    jpath = api["json_path"].parent.parent / "chile" / "cl-p999.json"
    assert jpath.exists()
    d = json.loads(jpath.read_text(encoding="utf-8"))
    assert d["country_code"] == "cl"
    coll = json.loads(api["coll_path"].read_text(encoding="utf-8"))
    assert any(r.get("id") == "cl-p999" for r in coll)


def test_new_note_peru_con_acento_200_y_ruta_world(api):
    """El país ES llega acentuado desde el form; el id y la ruta salen de
    country_lookup/country_route (sin acentos, world)."""
    status, body = _post(api["port"], "/api/new_note",
                         {"pais": "Perú", "pick": "P-8"})
    assert status == 200
    assert body["id"] == "pe-p8"
    assert (api["json_path"].parent / "pe-p8.json").exists()


def test_new_note_pais_desconocido_400(api):
    status, body = _post(api["port"], "/api/new_note",
                         {"pais": "Nowheria", "pick": "P-1"})
    assert status == 400
    assert body["ok"] is False and "país no reconocido" in body["error"]


# --- T7: contrato {ok:false,error} -------------------------------------------


def test_campo_no_editable_400(api):
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "nope", "value": 1})
    assert status == 400
    assert body["ok"] is False and "nope" in body["error"]


def test_valor_invalido_400(api):
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "anio", "value": 9999})
    assert status == 400
    assert body["ok"] is False and "anio" in body["error"]


def test_precio_invalido_400(api):
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "precio", "value": -1})
    assert status == 400
    assert body["ok"] is False and "precio" in body["error"]


def test_pais_desconocido_400_via_applier(api):
    """El validador del campo pasa pero el applier lo rechaza (ValueError):
    antes escapaba del handler; ahora el contrato lo convierte en 400."""
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "pais", "value": "Xyz No Existe"})
    assert status == 400
    assert body["ok"] is False and "país no reconocido" in body["error"]


def test_id_desconocido_404(api):
    status, body = _post(api["port"], "/api/update",
                         {"id": "cl-px999", "field": "obs", "value": "x"})
    assert status == 404
    assert body["ok"] is False and "no existe" in body["error"]


def test_endpoint_desconocido_404(api):
    status, body = _post(api["port"], "/api/nope", {"id": "zz-p0"})
    assert status == 404
    assert body["ok"] is False and "desconocido" in body["error"]


def test_body_vacio_400(api):
    status, body = _post(api["port"], "/api/update", raw=b"")
    assert status == 400
    assert body["ok"] is False and "body" in body["error"]


def test_body_grande_400(api):
    big = json.dumps({"id": "zz-p0", "field": "obs", "value": "x" * 5000}).encode()
    assert len(big) > 4096
    status, body = _post(api["port"], "/api/update", raw=big)
    assert status == 400
    assert body["ok"] is False and "grande" in body["error"]


def test_json_invalido_400(api):
    status, body = _post(api["port"], "/api/update", raw=b"{nope")
    assert status == 400
    assert body["ok"] is False and "JSON" in body["error"]


def test_json_no_objeto_400(api):
    """JSON válido pero no un objeto: antes escapaba AttributeError."""
    status, body = _post(api["port"], "/api/update", raw=b"[1, 2]")
    assert status == 400
    assert body["ok"] is False and "objeto" in body["error"]


def test_fuente_json_corrupta_409_y_no_toca_el_archivo(api):
    api["json_path"].write_text("{corrupto", encoding="utf-8")
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "obs", "value": "x"})
    assert status == 409
    assert body["ok"] is False and "corrupto" in body["error"]
    # el archivo corrupto queda intacto (nada se reescribió)
    assert api["json_path"].read_text(encoding="utf-8") == "{corrupto"


def test_collection_corrupta_500_con_hint_de_rebuild(api):
    api["coll_path"].write_text("{nope", encoding="utf-8")
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "obs", "value": "x"})
    assert status == 500
    assert body["ok"] is False and "rebuild" in body["error"]


def test_excepcion_imprevista_500_con_traceback_y_servidor_sigue(api, capsys):
    """JSON sin 'denomination' → KeyError en el applier: el contrato es
    500 {ok:false} + traceback al log, y el servidor sigue sirviendo."""
    d = _note_doc()
    del d["denomination"]
    api["json_path"].write_text(
        json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "valor", "value": 5})
    assert status == 500
    assert body["ok"] is False and body["error"]
    assert "Traceback" in capsys.readouterr().err     # traceback al log (T7)
    # con fuente válida el servidor sigue respondiendo normalmente
    api["json_path"].write_text(
        json.dumps(_note_doc(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    status2, body2 = _post(api["port"], "/api/update",
                           {"id": "zz-p0", "field": "obs", "value": "sigue vivo"})
    assert status2 == 200 and body2["ok"] is True


# --- seguridad: Host/Origin siguen por delante del contrato (regresión) ------


def test_host_mal_403(api):
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "obs", "value": "x"},
                         headers={"Host": "evil.com:80"})
    assert status == 403
    assert body["ok"] is False and "host" in body["error"]


def test_origen_mal_403(api):
    status, body = _post(api["port"], "/api/update",
                         {"id": "zz-p0", "field": "obs", "value": "x"},
                         headers={"Origin": "http://evil.com"})
    assert status == 403
    assert body["ok"] is False and "origen" in body["error"]


# --- T5: POST /api/update_dataset (edición inline de datasets) --------------


def _ds_post(port, dataset, code, field, value):
    return _post(port, "/api/update_dataset",
                 {"dataset": dataset, "code": code, "field": field, "value": value})


def test_update_dataset_pais_200_y_persiste_en_fuente_y_copia(api):
    status, body = _ds_post(api["port"], "countries", "cl", "name.es", "Chile (test)")
    assert status == 200
    assert body["ok"] is True
    assert body["record"]["name"]["es"] == "Chile (test)"
    # fuente de verdad actualizada
    d = json.loads(api["countries_src"].read_text(encoding="utf-8"))
    assert d["cl"]["name"]["es"] == "Chile (test)"
    # la copia en web/data recibe el MISMO texto (sincronía garantizada)
    src_txt = api["countries_src"].read_text(encoding="utf-8")
    dst_txt = api["countries_dst"].read_text(encoding="utf-8")
    assert src_txt == dst_txt
    # formato intacto: indent=2, ensure_ascii=False, newline final
    assert src_txt.endswith("\n") and not src_txt.endswith("\n\n")
    assert json.dumps(d, ensure_ascii=False, indent=2) + "\n" == src_txt
    # orden de claves del registro y del diccionario preservado
    assert list(d.keys()) == ["cl", "ae"]
    assert list(d["cl"].keys()) == ["code", "iso_alpha2", "iso_numeric",
                                    "name", "vigente", "flag_svg", "folder",
                                    "moneda_vigente"]


def test_update_dataset_moneda_valor_null_y_campo_anidado(api):
    # null permitido en str|null
    status, body = _ds_post(api["port"], "currencies", "EUR", "simbolo", None)
    assert status == 200 and body["record"]["simbolo"] is None
    d = json.loads(api["currencies_src"].read_text(encoding="utf-8"))
    assert d["EUR"]["simbolo"] is None
    # campo anidado que no existe todavía: se crea el intermedio
    status, body = _ds_post(api["port"], "currencies", "EUR",
                            "historia.moneda_sucesora", "XXX")
    assert status == 200
    d = json.loads(api["currencies_src"].read_text(encoding="utf-8"))
    assert d["EUR"]["historia"]["moneda_sucesora"] == "XXX"


def test_update_dataset_lista_uso_200(api):
    status, body = _ds_post(api["port"], "currencies", "EUR", "uso.emisor",
                            ["DE", "FR", "IT"])
    assert status == 200
    assert body["record"]["uso"]["emisor"] == ["DE", "FR", "IT"]
    assert api["currencies_src"].read_text(encoding="utf-8") == \
        api["currencies_dst"].read_text(encoding="utf-8")


def test_update_dataset_dataset_invalido_400(api):
    status, body = _ds_post(api["port"], "billetes", "cl", "name.es", "X")
    assert status == 400 and body["ok"] is False
    assert "dataset" in body["error"]


def test_update_dataset_campo_fuera_whitelist_400(api):
    # identidad (la clave) y campos no expuestos por la UI: fuera de whitelist
    for campo in ("code", "codigo", "nombres.fr", "subunidad.codigo"):
        status, body = _ds_post(api["port"], "currencies", "EUR", campo, "X")
        assert status == 400, campo
        assert body["ok"] is False and "campo" in body["error"]


def test_update_dataset_valores_invalidos_400(api):
    # enum vigente solo si/no
    status, body = _ds_post(api["port"], "countries", "cl", "vigente", "quizas")
    assert status == 400 and body["ok"] is False
    # int, no "int como string"
    status, body = _ds_post(api["port"], "currencies", "EUR",
                            "iso_4217.decimales", "2")
    assert status == 400 and body["ok"] is False
    # lista de strings, no string suelto
    status, body = _ds_post(api["port"], "currencies", "EUR", "uso.emisor", "DE")
    assert status == 400 and body["ok"] is False
    # los archivos no deben haberse tocado
    assert json.loads(api["countries_src"].read_text(encoding="utf-8"))["cl"]["vigente"] == "si"


def test_update_dataset_codigo_desconocido_404(api):
    status, body = _ds_post(api["port"], "countries", "xx", "name.es", "X")
    assert status == 404 and body["ok"] is False
    assert "no existe" in body["error"]


def test_update_dataset_codigo_mal_formado_400(api):
    status, body = _ds_post(api["port"], "countries", "../world", "name.es", "X")
    assert status == 400 and body["ok"] is False


def test_update_dataset_corrupto_409(api):
    api["countries_src"].write_text("{no json", encoding="utf-8")
    status, body = _ds_post(api["port"], "countries", "cl", "name.es", "X")
    assert status == 409 and body["ok"] is False
    assert "corrupto" in body["error"]
