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
               "coll_path": coll_path}
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
