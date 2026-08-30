# Flujos de datos

Notación: `{archivo}:{función}` con nombres reales. Diagrama general:

```
 _json/*/*.json ──────────────┐  (fuente de verdad)
 _json/countries.json ────────┤
 _json/currencies.json ───────┤
 web/_originals/…  web/_FULL/…┤        web/_flags/…
        │                     │                │
        │            _scripts/build_web.py:build
        │                     │
        ▼                     ▼
 web/data/collection.json  web/data/issues.json  web/thumbs/*.jpg
 web/data/countries.json   web/data/thumbs_meta.json  web/data/currencies.json
        │                     │
        │  GET (fetch)        │
        ▼                     ▼
 web/app.js (índice)      web/problemas.js
        │                     │
        │  POST /api/*        │  POST /api/*
        ▼                     ▼
 _scripts/serve_web.py:do_POST ──► handlers ──► _json/*/*.json (persistencia)
                                     │
                                     └─► re-escritura de web/data/collection.json
                                         (registro regenerado in-place)
```

## 1. Build (regeneración del índice)

Disparadores: arranque del servidor (`serve_web.py:main`), CLI
(`build_web.py:main`), `POST /api/rebuild` (`serve_web.py:_handle_rebuild`).

Pasos de `_scripts/build_web.py:build`:

1. `JSON_DIR.glob("*/*.json")` → por archivo: `make_record(d)`; si lanza
   excepción, se registra en `json_malos` y el archivo se omite.
2. `records.sort(key=sort_key)` (país → pick natural).
3. Lee `web/data/thumbs_meta.json`; `thumb_jobs(rec, meta, force)` calcula
   thumbs pendientes (fuente falta, dest falta o firma distinta).
4. `build_issues_data(records, meta, force, json_malos)` → dict `issues` +
   jobs de miniaturas de carpetas huérfanas.
5. `make_thumb(job)` en `ThreadPoolExecutor(max_workers=8)` vía `magick
   -auto-orient -thumbnail 360x -quality 80`.
6. Escrituras atómicas (`_atomic_write_text`): `thumbs_meta.json`,
   `collection.json`, copias de `countries.json`/`currencies.json` (si
   existen en `_json/`), `issues.json`.
7. Devuelve resumen `{registros, json_invalidos, problemas, con_front,
   con_back, con_full, thumbs_generadas, thumbs_errores, errores, kb}`.

`make_record` resuelve imágenes por convención con `?v=<firma>` (solo si el
archivo existe) y el registro `search` pre-normalizado.

## 2. Carga e índice en el navegador (catálogo)

- `web/app.js` (DOMContentLoaded): `fetch("data/collection.json",
  {cache:"no-store"})` + `fetch("data/currencies.json")` →
  `state.all`, `state.currencies`.
- Lee `?q=` de la URL, la pone en `#q` y aplica `applyFilter()`.
- `applyFilter()` → `parseQuery(q)` → `state.filtered` → `applySort()` →
  `render()` (página actual, `perPage=25`).
- `web/app.js:loadIssuesBadge`: `fetch("data/issues.json")` → badge con el
  total de problemas en el header.
- `web/problemas.js:load`: `fetch("data/issues.json", {cache:"no-store"})`.
- `web/stats.js:init`: `fetch` de `data/collection.json`,
  `data/countries.json` (fallback `../_json/countries.json`) y
  `data/currencies.json`.

## 3. Edición inline de un campo (modo edición)

Flujo completo de `web/app.js:startEdit` a `_json/`:

1. UI: `web/app.js:startEdit(td, rec)` renderiza un input o select (tipo
   según `EDIT_COLS[td.dataset.col]` → `[field, type]`); Enter (o `change`
   en select) confirma; Escape/blur cancelan.
2. `web/app.js:postUpdate(id, field, value)` → `POST /api/update` con body
   `{id, field, value}`.
3. `serve_web.py:do_POST` valida Host/Origin → dispatch `_handle_update`:
   - `ID_RE` + `id in IDS` + `field in FIELDS` (whitelist de 23 campos, ver
     `web.md`).
   - Ejecuta el validador del campo (`_v_str`, `_v_num`, `_v_year`, `_v_url`,
     `_v_bool`, `_v_temas`, `_v_currency_code`…).
   - `WRITE_LOCK`: carga `_json/<…>/<id>.json`, aplica `apply(d)` (campos
     denominación suben a `d["denomination"][…]`, notas a `d["notes"][…]`,
     bools borran la clave `subunidad` si son false), escribe atómico con
     `indent=2 + "\n"`.
   - `build_web.make_record(d)` regenera el registro y lo sustituye **in-place**
     en `web/data/collection.json` (se preserva el orden global).
4. Respuesta `{ok: true, id, field, record}` →
   `Object.assign(rec, out.record)` (el `record` de vuelta ya trae
   `denominacion`, `search`, etc. recalculados) + `render()`.
- Error: `{ok: false, error}` con estado 400/403/404/500; `postUpdate` lanza
  `new Error(out.error)`, la UI muestra `alert` y `render()` restaura la
  celda.
- Checkboxes (`toggleBool`) van por el mismo camino; hay un endpoint legado
  `POST /api/verificado` que delega en `_handle_update(id, "verificado", …)`.

## 4. Crear billete nuevo

1. `web/app.js:createNewNote(e)` (solo `index-edit.html`, botón del header)
   abre `#new-dialog`; al confirmar: `fetch POST /api/new_note` con
   `{pais, pick}`.
2. `serve_web.py:_handle_new_note`:
   - Busca el país **por nombre**: `COUNTRY_LOOKUP[unaccent(pais.strip())
     .lower()]` (si no existe, 400 pidiendo agregarlo a
     `_json/countries.json`); `pick` pasa `PICK_RE`.
   - `_id = make_note_id(abbr, pick)`; si ya existe en `IDS` → 400.
   - Crea `_json/<folder>/<id>.json` con plantilla mínima (campos vacíos;
     carpeta = `FOLDER_ROUTE.get(key_es, "world")`), lo registra en `IDS`.
   - Regenera el registro con `build_web.make_record` y lo inserta en
     `web/data/collection.json` **ordenado** (primera posición donde
     `sort_key` es mayor; si no hay, al final) y lo escribe atómico
     (JSON compacto `separators=(",", ":")`).
   - Respuesta: `{ok, id, record, json}`.
3. UI (`web/app.js:createNewNote`): inserta `out.record` en `state.all`
   ordenado (mismo criterio país+pick), cierra `#new-dialog`, fija `#q` al
   nuevo id, `applyFilter()` → la fila nueva queda visible para editar inline.

## 5. Subir foto (página de problemas)

1. `web/problemas.js:uploadPhoto(input)` (id y side en `input.dataset`):
   valida en cliente (`image/jpeg` y ≤30 MB) → `POST
   /api/upload_photo?id=<id>&side=<A|B>` con
   el binario en el body.
2. `serve_web.py:_handle_upload_photo`: `ID_RE` + `id in IDS`, `side ∈ {A,B}`,
   `Content-Length` 0 < len ≤ 30 MB, magic bytes JPEG (`FF D8 FF`);
   `_sanitize_jpeg` (re-encode con magick en tmp) y `WRITE_LOCK` +
   `atomic_write_bytes` a `_originals/<id>/<id>_<side>.jpg`.
3. Respuesta `{ok, id, side, bytes}`. El renderer hace `POST /api/rebuild` y
   recarga: la thumb nueva aparece (firma distinta en `thumbs_meta.json`).

## 6. Generar imagen Full

1. `web/problemas.js:generarFull(row, btn)` → `POST /api/generar_full` `{id}`.
2. `serve_web.py:_handle_generar_full`:
   - Calcula `dest = _FULL/<id>.webp`, fotos A/B en `_originals/<id>/`,
     bandera vía `generar_imagen.flag_for_note(d)`.
   - `generar_imagen.compose(d, front, back, flag, dest, tmp)`
     (`_scripts/generar_imagen.py`; front + info + bandera + back); sin
     fotos A y B o sin bandera devuelve 400; fallo de magick → 500.
3. Respuesta `{ok, id, full}` → UI hace `rebuild + load`.

## 7. Cambiar pick (renombrar en cascada)

1. `web/problemas.js:changePick(row, btn)` → `POST /api/change_pick`
   `{id, pick}` (id y pick tomados del `<tr>`/input de la fila).
2. `serve_web.py:_handle_change_pick` (bajo `WRITE_LOCK`):
   - Valida `PICK_RE` + `id in IDS`; `new_id = make_note_id(abbr, new_pick)`
     (error si colisiona).
   - Renombra: JSON (`_json/<…>/<id>.json → <new_id>.json`, actualiza
     `d.id`/`d.pick_number`), carpeta de fotos y archivos internos
     (`<id>_A.jpg → <new_id>_A.jpg`), `_FULL/<id>.webp → <new_id>.webp`.
   - Actualiza `IDS` y regenera el registro (id/pick nuevos) en
     `collection.json` in-place.
3. UI: `rebuild + load`.

## 8. Crear JSON / renombrar carpeta (carpetas huérfanas)

- **Crear JSON**: `web/problemas.js:createJson(row, btn)` →
  `POST /api/create_json` `{carpeta, pick}` (pick tomado del input de la
  fila).
  `serve_web.py:_handle_create_json`: valida nombres (`FOLDER_RE`),
  `parse_old_folder(carpeta)` (heurística: split por `_`; primera parte =
  país vía `COUNTRY_LOOKUP` (sin acentos); extrae valor+moneda con `VAL_RE`,
  año con `YEAR_RE` y el resto pasa a `extras`/obs),
  `_id = make_note_id(abbr, pick)`, escribe el JSON nuevo en
  `_json/<info["route"]>/<id>.json` y renombra carpeta + fotos A/B al id.
- **Renombrar carpeta**: `web/problemas.js:renameFolder(row, btn)` →
  `POST /api/rename_folder` `{carpeta, nuevo}` (nuevo tomado del input de la
  fila).
  `serve_web.py:_handle_rename_folder`: valida ambos nombres, renombra
  `_originals/<carpeta> → <nuevo>` y los archivos `*_A.jpg`/`*_B.jpg` a
  `<nuevo>_A/_B.jpg`. Respuesta `{ok, carpeta, archivos}`.
- Ambos flujos terminan con `POST /api/rebuild` + recarga (la categoría
  `carpetas_sin_json` se recalcula).

## 9. Rebuild bajo demanda

- `POST /api/rebuild` (cuerpo `{}`): `serve_web.py:_handle_rebuild` ejecuta
  `build_web.build(force=False)`, re-lee todos los JSONs y actualiza `IDS`
  en memoria (imprescindible tras `create_json`/`change_pick`), responde
  `{ok, resumen}`.
- El servidor arranca así mismo: `serve_web.py:main` → `build_web.build()` →
  `IDS.clear()` + re-poblado desde `_json/*/*.json` →
  `ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()`.

## 10. Estadísticas (`stats.html`)

- `web/stats.js:init` → `processData`: índices por `country_code` y por
  `iso_alpha2`, mapa ISO numérico→país, monedas propias (con
  `FUND_CODE_ALIASES`, ej. `USN→USD`), lista de países faltantes
  (catálogo sin billetes; `moneda_propia === 'no'` se excluye).
- `renderKPIs`: `#kpi-total-notes`, `#kpi-countries-owned` (con `#kpi-countries-pct`),
  `#kpi-countries-missing`, `#kpi-currencies-count` (distinct `currency_code`),
  `#kpi-special-count` (`conmemorativo || remarcado`).
- `renderMap`: TopoJSON → d3 `geoMercator` (960x500, zoom 1–8, botones
  `#zoom-in/#zoom-out/#zoom-reset`, tooltip `#map-tooltip`); estado por país:
  verde = tiene billetes de su `moneda_vigente`, rojo = tiene billetes pero no
  de la moneda vigente, gris = nada. Click → `openCountryModal` (dialog
  `#country-modal`, fotos `img_full || thumb_f || thumb_a`).
- `renderMissingCountries` (grid + búsqueda `#search-missing`);
  `renderCharts`: top países (`#top-countries-list`, query `pais:"X"`),
  décadas (`#decades-chart-list`, `anio>=X anio<Y`), condiciones
  (`#conditions-chart-list`, `condicion:"X"`), monedas
  (`#currencies-chart-list`, `currency_code:"X"`).
  Cada fila genera un link `index.html?q=...` con el query-establecido de
  `web.md` (el catálogo lo entiende sin cambios de frontend).
- El enlace a `index-edit.html` solo se muestra si `location.hostname` es
  `localhost`/`127.0.0.1`.

## Formatos de respuesta API

- Éxito: `{"ok": true, ...payload}` HTTP 200.
- Error: `{"ok": false, "error": "<mensaje en español>"}` HTTP 400/403/404/500
  (`serve_web.py:_json_error`). Todo el código cliente lo espera
  (`app.js:postUpdate`; en `problemas.js` cada acción hace su propio
  `fetch` con el mismo manejo de error).
