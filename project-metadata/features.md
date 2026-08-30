# Features y su implementación

Cada feature trazada a `{archivo}:{función}` (o endpoint). "UI" indica dónde
se toca; "Impl." dónde vive la lógica.

## Catálogo (índice)

| Feature | UI | Impl. |
|---|---|---|
| Ver todos los billetes con foto, país, denominación, año y badges | `index.html` | `web/app.js:render` + `web/app.js:applyFilter`; datos de `data/collection.json` |
| Búsqueda global sin acentos | input `#q` (debounce 200 ms) | `web/app.js:parseQuery` + `r.search` (producida por `build_web.py:build_search`) |
| Filtro por campo (`col:valor`, `col:(a b)`, comparaciones numéricas, negación) | input `#q` | `web/app.js:parseQuery` (gramática en `web.md`) |
| Filtros bool 3 estados (verificado, conmemorativo, remarcado, subunidad) | click en el `<th>` | `web/app.js` → `state.boolFilters` + `web/app.js:updateBoolIndicators` |
| Ordenar por columna | click en el `<th>` | `web/app.js:applySort` |
| Mostrar/ocultar columnas | checkboxes del toolbar | `web/app.js:renderColsMenu` + `web/app.js:applyCols` + `state.cols` (`localStorage banknotes_cols`) |
| Paginación (25/pág) con pager y salto | footer | `web/app.js:renderPager`, `web/app.js:pageList` |
| Badge "N problemas" en el header (solo `index-edit.html`) | `#alert-link`/`#alert-count` → `problemas.html` | `web/app.js:loadIssuesBadge` + `data/issues.json` |
| Lightbox de imagen (front/back/full) | click en imagen | `web/app.js:openModal` (cierre vía `#modal-close`/Esc) |
| Fila → detalle con todas las propiedades + navegación ◂/▸ | click en fila | `web/app.js:openDetail`/`renderDetail`/`detailStep` |
| Detalle móvil | tap en fila (pantallas chicas) | `web/app.js:openMobileDetail`/`renderMobileDetail` |
| Enlaces externos Colnect / Numista | celdas del índice | `web/app.js:render` (valores de `colnect`/`numista`) |
| Detección de modo edición | — | `web/app.js` → `isEditMode` por `location.pathname` |

## Edición y persistencia (solo `index-edit.html`)

| Feature | UI | Impl. |
|---|---|---|
| Editar 23 campos inline (texto, número, URL, select condición, datalist ISO) | click en celda → input; Enter confirma, Escape/blur cancelan | `web/app.js:startEdit` → `postUpdate` → `POST /api/update` → `_scripts/serve_web.py:_handle_update` (whitelist `FIELDS` + validadores) |
| Confirmación tras respuesta del servidor + alert de error | celda + alert | `web/app.js:startEdit` (`Object.assign(rec, out.record)` al éxito; al fallo, `alert` + `render()` restaura) |
| Checkboxes verificado/conmemorativo/remarcado/subunidad | celdas bool | `web/app.js:toggleBool` → `POST /api/update` |
| Crear billete nuevo (país + pick) | botón header → `#new-dialog` | `web/app.js:createNewNote` → `POST /api/new_note` → `_scripts/serve_web.py:_handle_new_note` (plantilla + JSON + inserción ordenada en `collection.json`) |
| Subir foto front/back (JPEG ≤30 MB) | file input en `problemas.html` | `web/problemas.js:uploadPhoto` → `POST /api/upload_photo` → `_scripts/serve_web.py:_handle_upload_photo` (+ `_sanitize_jpeg`) |
| Generar imagen Full | botón en `problemas.html` | `web/problemas.js:generarFull` → `POST /api/generar_full` → `_scripts/serve_web.py:_handle_generar_full` → `_scripts/generar_imagen.py:compose` |
| Cambiar pick (renombrado en cascada JSON+fotos+full) | input en `problemas.html` | `web/problemas.js:changePick` → `POST /api/change_pick` → `_scripts/serve_web.py:_handle_change_pick` |
| Crear JSON a partir de carpeta huérfana | input pick en `problemas.html` | `web/problemas.js:createJson` → `POST /api/create_json` → `_scripts/serve_web.py:_handle_create_json` (+ `parse_old_folder`) |
| Renombrar carpeta de fotos | input en `problemas.html` | `web/problemas.js:renameFolder` → `POST /api/rename_folder` → `_scripts/serve_web.py:_handle_rename_folder` |
| Reindexado bajo demanda (tras cambios estructurales) | (automático en la UI) | `POST /api/rebuild` → `_scripts/serve_web.py:_handle_rebuild` → `_scripts/build_web.py:build` + refresco de `IDS` |
| Build al arrancar / por CLI | terminal | `_scripts/serve_web.py:main` / `_scripts/build_web.py:main` → `build` |
| Miniaturas incrementales (solo fuentes cambiadas) | — | `_scripts/build_web.py:build` + `thumb_jobs` + `web/data/thumbs_meta.json` (firma `mtime_ns-size`) |
| Invalideado de caché de imágenes | `?v=<hash>` en URLs | `_scripts/build_web.py:file_sig`/`file_v` + `web/serve_web.py` header `max-age` |

## Página de problemas (`problemas.html`)

| Feature | Impl. |
|---|---|
| Detectar 8 clases de problemas en el build | `_scripts/build_web.py:build_issues_data` → `data/issues.json` |
| Ver problemas agrupados en acordeones (estado persistido) | `web/problemas.js:load` + `localStorage problemas_open` |
| Ver los JSON inválidos con su error | renderer `json_invalidos` (filas `[archivo, error]`) |
| Subir fotos que faltan (A/B) y ver thumb al instante | `web/problemas.js:uploadPhoto` → `/api/upload_photo` → `/api/rebuild` |
| Generar las imágenes Full que faltan | `web/problemas.js:generarFull` → `/api/generar_full` → `/api/rebuild` |
| Corregir picks mal formateados | `web/problemas.js:changePick` → `/api/change_pick` → `/api/rebuild` |
| Registrar JSON de carpetas sin billete | `web/problemas.js:createJson` → `/api/create_json` → `/api/rebuild` |
| Renombrar carpetas huérfanas | `web/problemas.js:renameFolder` → `/api/rename_folder` → `/api/rebuild` |
| Guardar links Colnect que faltan | `web/problemas.js` (renderer `sin_colnect`) → `/api/update` (field `colnect`) |

## Estadísticas (`stats.html`)

| Feature | Impl. |
|---|---|
| KPIs: total, países "X / Y" + %, países faltantes, monedas distintas, especiales | `web/stats.js:renderKPIs` + `web/stats.js:processData` |
| Mapa mundial coloreado (verde/rojo/gris) con zoom y tooltip | `web/stats.js:renderMap` (d3 + topojson; TopoJSON local opcional, fallback CDN) |
| Click en país → modal con su bandera y sus billetes | `web/stats.js:openCountryModal` |
| Lista de países del catálogo sin billetes (filtrable) | `web/stats.js:renderMissingCountries`/`filterMissingCountries` |
| Charts: top países, décadas, condiciones, monedas — cada fila filtra el catálogo | `web/stats.js:renderCharts` → links `index.html?q=…` |
| Moneda "propia" con alias históricos (USN→USD…) | `web/stats.js:processData` (`FUND_CODE_ALIASES`) |

## Preferencias e i18n

| Feature | Impl. |
|---|---|
| Idioma ES/EN de toda la UI (selector header) | `web/app.js:applyI18n` + diccionario `L` + `localStorage banknotes_lang` |
| Recordar columnas visibles | `localStorage banknotes_cols` (`web/app.js:state.cols`) |
| Recordar acordeones abiertos en problemas | `localStorage problemas_open` (`web/problemas.js`) |

## Utilidades de datos (scripts, no UI)

| Feature | Impl. |
|---|---|
| Generar etiquetas imprimibles (PDF carta) | `_scripts/generar_etiquetas.py` |
| Componer imágenes Full en lote | `_scripts/generar_imagen.py` (CLI o vía `/api/generar_full`) |
| Validar billetes contra el catálogo de monedas | `_scripts/validate_currencies.py:validate_banknotes` |
| Corregir códigos ISO 4217 por país+año | `_scripts/fix_currency_errors.py:get_currencies_by_country_and_year` |
| Listar banderas faltantes | `_scripts/check_missing_flags.py:check_flags` |
| Extraer n.º de serie de la foto (LLM local) | `_scripts/extract_serial.py:process_banknote_jsons` |
| Extraer temas de la foto + contexto Numista (LLM local) | `_scripts/extract_themes_from_jpgs.py` |
| Resetear `verificado` en masa | `_scripts/reset_verificados.py:reset_verificado_status` o `_scripts/git_clean_json.sh` |
| Sincronizar `countries.json` desde `currencies.json` | `_scripts/update_countries_json.py:update_countries` |

## Mapa rápido feature → lugar clave

- "Los datos de la web no se actualizan" → build
  (`_scripts/build_web.py:build`) o `/api/rebuild`.
- "Un campo no se puede guardar" → whitelist/validador
  (`_scripts/serve_web.py:FIELDS`).
- "Una imagen se ve rara" → firmas de caché
  (`_scripts/build_web.py:file_sig`) y rutas por convención
  (`_scripts/util.py:make_note_id`).
- "La búsqueda no encuentra X" → campo `search`
  (`_scripts/build_web.py:build_search`) + gramática
  (`web/app.js:parseQuery`).
- "Un país aparece gris en el mapa" → `moneda_vigente` de
  `_json/countries.json` + `web/stats.js:renderMap`.
