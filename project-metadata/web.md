# Frontend (`web/`)

Comportamiento verificado de las 8 páginas. Todo el JS es vanilla (ES6+), sin
frameworks ni build; los assets son servidos tal cual por `serve_web.py`.

## Páginas

| Archivo | Título | Rol | JS principal |
|---|---|---|---|
| `web/index.html` | Catálogo | Índice de billetes, modo lectura | `app.js` |
| `web/index-edit.html` | Catálogo (edición) | Ídem + edición inline + billete nuevo | `app.js` (mismo) |
| `web/countries.html` | Países | Catálogo de países (9 columnas), modo lectura | `countries.js` + `lib/datasets.js` |
| `web/countries-edit.html` | Países (edición) | Ídem + edición inline de las 9 columnas | `countries.js` + `lib/datasets.js` (edit) |
| `web/currencies.html` | Monedas | Catálogo de monedas (21 columnas), modo lectura | `currencies.js` + `lib/datasets.js` |
| `web/currencies-edit.html` | Monedas (edición) | Ídem + edición inline de las 21 columnas | `currencies.js` + `lib/datasets.js` (edit) |
| `web/stats.html` | Estadísticas | KPIs, mapa mundial, países faltantes, charts | `stats.js` (IIFE aislada) |
| `web/problemas.html` | Problemas | Corregir los problemas detectados por el build | `problemas.js` |

`app.js` detecta el modo por el path: `isEditMode =
location.pathname.includes("index-edit.html")` (controla visibilidad del
botón de nuevo billete, de los inputs editables y del toolbar).

## Menú lateral (hamburguesa)

Compartido por las 8 páginas. Vive en `web/lib/menu.js` (módulo testeable en
Node) + reglas `.menu-toggle`/`.side-menu`/`.side-menu-section` en
`web/styles.css`.

- **`NAV_SECTIONS`**: 4 secciones fijas — Colección (Listado, Editar),
  Países (Lista, Editar), Monedas (Lista, Editar), Otros (Estadísticas,
  Problemas) → 8 links en total. SIN botón de idioma (el idioma vive en la
  top bar, ver abajo).
- **`menuItems(currentPage)`** (función pura): devuelve SIEMPRE los 8 links
  (`{type: "link", sectionId, icon, labelKey, href, current}`); el ítem que
  corresponde a `currentPage` lleva `current: true`. Página desconocida →
  mismos 8 links, ninguno marcado como actual.
- **`renderMenu(page, lang)`**: HTML del panel (header "Menú" + por sección
  un encabezado `.side-menu-section` (en mayúsculas, con `data-i18n`) y sus
  ítems: icono SVG inline + etiqueta vía `translate(key, lang)`; `lang` se
  lee de `localStorage["banknotes_lang"]`). Todos los textos llevan
  `data-i18n` (refresh in situ). El ítem actual lleva prefijo «<< » en su
  etiqueta + `aria-current="page"` + clase `.side-menu-item.current`
  (resaltado en color marca). En las páginas de catálogo (index/index-edit)
  se añade además, bajo la sección Colección, el selector de vistas
  guardadas: `<details id="filters-dd">` con `<summary data-i18n="filters">`
  + `<ul id="filters-menu">` (ver sección `filters` abajo; `app.js` lo
  rellena y cablea por id).
- **`initSideMenu(page)`**: inyecta en `<body>` el botón `.menu-toggle` y el
  panel `<nav class="side-menu">`, cablea el toggle y actualiza
  `aria-expanded`/`aria-hidden`. Se llama al inicio del init de cada entry
  point (`app.js`, `stats.js`, `problemas.js`, `countries.js`,
  `currencies.js`).
- **Comportamiento**: siempre inicia colapsado (sin persistencia); se
  desliza desde la izquierda; SIN overlay — al abrirse, el contenido se
  desplaza con `padding-left` del `body` (`var(--side-menu-w)` = 264px con
  `body.menu-open`; `@720px`: `min(280px, 82vw)`). El botón **no reserva
  espacio** (sin gutter): flota fijo top-left (`z-index: 120`) sobre el
  contenido, que se centra en el viewport completo y queda justificada a la
  izquierda si es más ancha que la pantalla (el solape del botón sobre la
  esquina superior izquierda es aceptado por diseño). El botón z-120 y el
  panel z-110 quedan sobre el buscador sticky (100) y `.scroll-mask` (95);
  solo se cierra con el botón hamburguesa (que se morfea a ✕).
- **Idioma (top bar, no menú)**: `button#lang-toggle` está en
  `.top-actions` de la top bar (junto al ícono de GitHub) en las 8 páginas
  (en `stats.html`/`problemas.html` el ícono de GitHub se añadió junto a él).
  Lo cablea `web/lib/lang.js:bindHeaderLang(onAfter)`: pinta la bandera del
  idioma **destino** (🇬🇧 si el actual es es; 🇨🇱 si es en) + `title`/
  `aria-label` = `lang_tip`; al click alterna el idioma persistido en
  `localStorage["banknotes_lang"]`, refresca el panel del menú in situ
  (`menu.js:refreshMenuLang`) y llama a `onAfter(lang)`: `app.js`,
  `countries.js` y `currencies.js` pasan su `applyI18n`; `stats.js`/
  `problemas.js` no pasan callback (no tienen i18n propio; el cambio queda
  persistido y se aplica al entrar en las páginas con i18n).
- **Producción**: `web/lib/dataload.js:hideEditLinks()` — regla compartida
  que con `!isLocal()` oculta TODOS los `a[href$="-edit.html"]` (links del
  menú y links directos); la llama el init de cada página (`app.js`,
  `stats.js`, `problemas.js` y `datasets.js:initDatasetPage`).
- Tests: `web/tests/menu.test.js` (4 secciones, 8 links, sin `lang-toggle`
  en el menú, un solo current por página, encabezados de sección, «<< »/
  aria-current, data-i18n, página desconocida, copias seguras, y en la top
  bar: `#lang-toggle` + ícono de GitHub en las 8 páginas, y `#filters-dd`
  bajo Colección solo en index/index-edit),
  `web/tests/dataload.test.js` (`hideEditLinks`), `i18n.test.js` (claves
  `menu_*`/secciones/filtros) y `module_smoke.test.js` (enlace de `lib/menu.js`).

## Páginas de datasets (países / monedas)

Las 4 páginas comparten un solo motor: `web/lib/datasets.js` (núcleo puro
testeable en Node + capa DOM) y un entry point fino por dataset
(`countries.js`/`currencies.js`), que detecta el modo con
`location.pathname.endsWith("-edit.html")` y llama a
`initDatasetPage("countries"|"currencies", { edit })`.

- **Columnas** (config declarativa en `datasets.js:DATASETS`):
  - **countries (9):** `code` (clave, solo lectura), `iso_alpha2`,
    `iso_numeric`, `flag_svg` (celda de preview `<img src="_flags_svg/…">`),
    `name.es`, `name.en`, `vigente` (select si/no), `moneda_vigente`,
    `folder`.
  - **currencies (21):** `codigo` (clave, solo lectura),
    `iso_4217.numerico`, `iso_4217.decimales`, `simbolo`, `nombres.es`,
    `nombres.en`, `nombres.ar` (celda `dir="rtl"`), `nombre_corto.es`,
    `tipo`, `estado`, **subunidad** (`subunidad.nombres.es` +
    `subunidad.factor`) y **banco central** (`banco_central.nombre` +
    `banco_central.codigo`) como columnas combinadas (cada parte es una
    sub-celda `.ds-subcell` editable independiente),
    `historia.fecha_introduccion`, `historia.fecha_fin`,
    `historia.moneda_anterior`, `historia.moneda_sucesora`,
    `uso.emisor`, `uso.curso_legal`, `uso.circulacion`, `uso.de_facto`
    (listas; se editan como texto separado por comas), `notas`.
- **Núcleo puro**: `getByPath`/`setByPath` (rutas punteadas; `setByPath`
  crea objetos intermedios), `rowFor` (fila aplanada por columna:
  `null`↔`""`, listas → texto con comas), `filterRows` (reutiliza
  `query.js:parseQuery`/`matches` sobre los campos aplanados — misma UX de
  búsqueda que `index.html`, sin acentos), `sortRows` (numérico para
  `decimales`, `factor` y `iso_numeric`; `null` al final), `paginate`.
- **Capa DOM** (`initDatasetPage`): fetch de `data/{dataset}.json`, tabla
  con `th[data-sort]` (click ordena, ▲/▼ como en `index.html`), `#q`
  sticky, footer con `#count` + `#ds-status` (mensaje "Guardado ✓"/error) +
  `#pager` + `#perpage` (25/50/100). Modo edición: celdas `.editable`,
  click → input (text / number / select `vigente` / texto con comas
  `uso.*`), Enter/blur → `POST /api/update_dataset`
  `{dataset, code, field, value}` (ruta punteada) → actualiza la celda y el
  estado. Expone `state.applyI18n` (vía `window.__datasetPage`) para que el
  toggle de idioma repinte labels sin recargar.
- **Estilo**: scroll horizontal con el `.table-wrap` existente (21
  columnas); `body.ds-dense` en monedas (padding menor); `.flag-cell img`,
  `.rtl-cell` y `.ds-subcell` en `web/styles.css`.
- **Alcance V1**: sin agregar ni eliminar registros; los sub-campos
  anidados no expuestos como columna (`subunidad.codigo`,
  `subunidad.nombres.en`, `nombre_corto.es_p/en/en_p`) ni se muestran ni se
  editan.
- Tests: `web/tests/datasets.test.js` (rutas punteadas, aplanado
  null↔`""`/listas, búsqueda, orden numérico vs alfabético, paginación).

## `app.js` — estado

```js
state = {
  all: [],          // todos los registros de collection.json
  currencies: {},   // currencies.json (para el datalist de códigos ISO)
  filtered: [],     // resultado del último filter+sort
  page: 1,
  perPage: 25,
  detailIdx: -1,      // índice del billete en el modal de detalle (escritorio)
  mobileDetailIdx: -1, // ídem, modal móvil
  cols: Set(…),       // visibilidad de columnas (localStorage "banknotes_cols")
  sort: {key: null, dir: 1}, // orden activo (1 asc, -1 desc)
  boolFilters: { verificado, conmemorativo, remarcado, subunidad },
  filters: []        // vistas guardadas {name, query, cols} (data/filters.json)
}
```

- **`COLUMNS`**: 29 columnas seleccionables más la fija `pick`
  (`[key, label, visiblePorDefecto]`); fijas además: imágenes front/back/full,
  verificado. Visibles por defecto: `pais`, `precio`, `denominacion`, `anio`,
  `front`, `back`, `full`, `colnect`, `numista`, `verif`. El resto se muestra
  u oculta con los checkboxes del toolbar (`renderColsMenu`/`applyCols`) y
  persiste en `localStorage["banknotes_cols"]`; `web/app.js:loadCols` filtra
  la lista guardada contra las claves de `COLUMNS` y aplica migraciones de una
  sola vez (p. ej. añade `precio` a las listas anteriores al campo, marcando
  `banknotes_cols_migrated_precio`).
- **`filters` (vistas guardadas)**: en el menú lateral, bajo la sección
  Colección (inyectado por `renderMenu` solo en index/index-edit), el
  selector `#filters-dd` lista los filtros
  guardados + "Nuevo…". Se carga en el init de `data/filters.json`
  (`no-store`, `.catch(() => null)`; inexistente → `[]`) y se normaliza con
  `web/lib/filters.js:normalizeFilters`. Al seleccionar un nombre
  (`applySavedFilter`): se reemplazan las columnas visibles por las del
  filtro (claves desconocidas descartadas vía `filterCols`, misma
  tolerancia que `loadCols`), se persiste `banknotes_cols`, se repinta con
  `renderColsMenu()`/`applyCols()`, y su `query` se escribe en `#q` +
  `applyFilter()` (reutiliza la cadena existente de la search bar; NO hay
  persistencia extra de la selección activa: ni parámetro de URL ni key de
  localStorage). "Nuevo…" abre `#filter-dialog` (nombre + Guardar) →
  `POST /api/save_filter` (upsert por nombre; escribe `_json/filters.json`
  + copia `web/data/`) → actualiza `state.filters` con la respuesta y
  aplica el filtro guardado. El radio activo es *derivado*
  (`matchesFilter` contra `state.cols` + `#q`): se recalcula al togglear
  columnas o al buscar, de modo que tras un cambio manual ningún filtro
  queda marcado.
- **`boolFilters`**: cada key es `"all" | "yes" | "no"`. Se ciclan
  clickando el header (`click` en `<th>`); el ícono de la columna lo refleja
  (`web/app.js:updateBoolIndicators`).

## `app.js` — lenguaje de query del buscador

`parseQuery(q)` (en `web/lib/query.js`, importado por `app.js`) compila la
query de `#q` a tests de filtro que aplica `matches(r, tests)`; el orden lo
hace `sortRecords(records, sort, ctx)`. Gramática
(como se documenta en el placeholder del input y la ayuda del footer):

| Sintaxis | Significado |
|---|---|
| `palabra` | contiene (global, sobre `r.search`, sin acentos/minúsculas) |
| `"texto exacto"` | frase exacta sobre `r.search` |
| `col:valor` | campo específico (normaliza y compara) |
| `col:"frase con espacios"` | campo, frase exacta |
| `col:(a b c)` | campo en {a, b, c} (OR; se admiten frases quoted dentro) |
| `col>=n` / `col<=n` / `col>n` / `col<n` | comparaciones numéricas (ej. `anio>=1900 anio<2000`) |
| `-` al inicio | negación del token (no contiene / no es) |
| columnas imagen (`front`/`back`/`full`) | aceptan `si/no`/`true/false`/`""` para filtrar por presencia/ausencia de imagen |

- Tokenización: palabras multi-espacio van entre comillas; `:` solo se toma
  como prefijo de campo si el lado izquierdo es un key válido de
  `web/lib/query.js:getCol` / `COL_ALIASES` (mapa nombre-de-columna→key) o un
  alias
  de imagen; si no, es "texto
  exacto".
- Todo se normaliza con `unaccent+lower` (misma función que el build usó al
  generar `r.search`), por lo que la búsqueda no distingue acentos ni
  mayúsculas.
- Ejemplos que la UI produce: `pais:"Estados Unidos"`, `anio>=1900`,
  `condicion:"UNC"`, `currency_code:"USD"` (ver charts de `stats.js`).
- Debounce de 200 ms en el input (`web/app.js:debounce(fn, ms)` aplicado a
  `#q`); la URL `?q=` se lee al
  cargar y se reescribe en la URL al cambiar (history.replaceState).

## `app.js` — render, orden, paginación

- `applyFilter()`: recorre `state.all` con
  `web/lib/query.js:matches(r, tests)` (tests de `parseQuery` +
  `boolFilters`) → `state.filtered` → `applySort()` → `render()`.
- `applySort()`: delega en `web/lib/query.js:sortRecords` (números:
  `NUM_SORT_KEYS` = `anio`, `valor`, `precio`; bools: `BOOL_SORT_KEYS`;
  texto: `localeCompare` es); `dir` asc/desc; `null`/ausentes siempre al
  final (asc y desc); `ctx.getValue` sobrepasa `pais` para ordenar por el
  nombre mostrado (i18n). Los headers clicables (`th[data-sort]`) reciben las
  clases `sort-asc`/`sort-desc` que pinta el ▲/▼ vía CSS (`web/styles.css`).
- `render()`: pagina `state.filtered` con `state.page` (25/pág), construye
  `<tr>` por registro con las columnas visibles (`COLUMNS` + `state.cols`);
  renderiza badges (verificado, conmemorativo, remarcado, subunidad),
  enlaces Colnect/Numista, miniaturas, y en modo edición convierte la celda
  en input/select al hacer click (`startEdit`).
- `web/app.js:renderPager(pages)` + `web/app.js:pageList(cur, last)`: pager
  en `#pager`; `#count` muestra total de resultados.
- La ayuda breve vive en el placeholder de `#q` ("Buscar en todos los
  campos… (país, pick, moneda, año, firmas…)"); la gramática completa la
  describe esta sección.

## `app.js` — modales

- **Lightbox** (`web/app.js:openModal(imgPath, id, side)`; cierre vía
  `#modal-close` y Esc nativo del `<dialog>`): click en una imagen →
  `#modal-img` con `img_full || img_a/b`, flechas ◂/▸ para pasar de lado
  (A↔B↔Full), `Esc` cierra.
- **Detalle escritorio** (`openDetail`/`renderDetail`/`detailStep`): click en
  la fila → modal con todas las columnas del billete; ◂/▸ navega por los
  resultados filtrados (no por `all`); `Esc` cierra.
- **Detalle móvil** (`openMobileDetail`/`renderMobileDetail`): versión
  apilada para pantallas pequeñas (mismo dataset, otra plantilla).
- **Billete nuevo** (solo edición): botón `#new-note` (oculto en modo
  lectura) abre `#new-dialog` (patrón `<dialog>`); campos país (datalist
  `#paises-list` relleno por `fillPaisesDatalist` con los países distintos
  `state.all`) + pick. Ver flujo en `data-flows.md` §4.
- **Nuevo filtro** (`#filter-dialog`, ambas páginas `index.html`/
  `index-edit.html`): el ítem "Nuevo…" de `#filters-dd` abre el diálogo
  (nombre `#filter-name` ≤ 60 + botón Guardar); al enviar,
  `POST /api/save_filter` con `{name, query: valor de #q, cols:
  [...state.cols]}`; al éxito aplica el filtro guardado y cierra, al fallo
  `alert` (`err_save` + `err_server`). Cierre vía `#filter-close`/Esc/clic
  fuera. Claves i18n: `filters`, `filter_new`, `filter_title`,
  `filter_name`, `filter_save`.

## `app.js` — i18n y preferencias

- `L` = diccionario `{es: {…}, en: {…}}` con todas las cadenas UI
  (título, labels de columnas, botones, ayuda, diálogos).
- `applyI18n()`: recorre `[data-i18n]` (text) y `[data-i18n-ph]` (placeholder)
  y rellena según `localStorage["banknotes_lang"]` (default `es`); el selector
  de idioma del header persiste.
- `localStorage` keys usadas por la web: `banknotes_cols` (columnas),
  `banknotes_lang` (idioma), `problemas_open` (categorías abiertas en la
  página de problemas).

## `app.js` — modo edición

- `isEditMode` (path `index-edit.html`). En modo edición cada celda editable
  se convierte en input al hacer click (`startEdit(td, rec)`); tipos de
  control según `EDIT_COLS[field]`: text, number, url, `currency` (datalist
  de códigos ISO desde `state.currencies`), select `CONDICIONES`.
- Confirmación (dentro de `startEdit`): Enter (o `change` en select) →
  `web/app.js:postUpdate(id, field, value)` → `POST /api/update`; con éxito
  `Object.assign(rec, out.record)` reemplaza el registro local por el del
  servidor (con `denominacion`/`search` recalculados) y `render()`; con error
  `alert(t("err_save") …)` y `render()` restaura la celda. Escape/blur
  cancelan sin guardar. Números (`monto`, `precio`): `,`→`.` y `anio` se
  trunca; no numérico → `alert`.
- `web/app.js:toggleBool(cb)`: checkboxes verificado/conmemorativo/remarcado/
  subunidad (lee `cb.dataset.id/field/checked`) por el mismo endpoint; si
  falla, revierte el checkbox y muestra alert.
- `fillPaisesDatalist()`: países distintos presentes en `state.all` (no
  importa `countries.json` directamente).
- `createNewNote(e)`: flujo del diálogo nuevo (ver `data-flows.md` §4); al
  éxito: inserta `out.record` en `state.all`, fija `#q` al nuevo id y
  `applyFilter()` para dejarlo visible.
- `loadIssuesBadge()`: `data/issues.json` → suma de `items` de todas las
  categorías → `#alert-count` en `#alert-link` (link a `problemas.html`,
  clase `ok` cuando es 0; se oculta si no existe `issues.json`). El enlace
  solo está presente en `index-edit.html` (en `index.html` la función
  aborta al no encontrar `#alert-link`).

## `stats.js` (IIFE, sin estado global)

- `init()`: fetch de `data/collection.json`, `data/countries.json` (sin
  datos → `{}`) y `data/currencies.json` (los tres `{cache:"no-store"}`); si
  el catálogo está vacío no renderiza nada.
- `processData()`: índices `notesByCountryCode`, `notesByIsoA2`,
  `numericToCountry` (ISO numérico pad 3), `ownedCurrencies` (con
  `FUND_CODE_ALIASES`, p. ej. `USN→USD` para códigos históricos) y
  `missingCountriesList` (países del catálogo sin billetes; se excluye
  `moneda_propia === 'no'`; ordenados por `name.es`).
- KPIs (`renderKPIs`): `#kpi-total-notes`, `#kpi-countries-owned` ("X / Y" +
  `#kpi-countries-pct`), `#kpi-countries-missing`, `#kpi-currencies-count`
  (distinct `currency_code`), `#kpi-total-value` (Σ `precio` vía
  `web/lib/format.js:sumPrecio`, unit-testeado; formateado con `fmtPrecio`
  → "$ 1.234,5"; `null`/ausente/NaN cuenta 0).
- Mapa (`renderMap`): TopoJSON primero desde `data/world-110m.json` (no
  existe hoy) y fallback CDN `world-atlas@2/countries-110m.json`;
  `geoMercator` 960×500, zoom 1–8 (`#zoom-in`, `#zoom-out`, `#zoom-reset`),
  tooltip `#map-tooltip`. Estado por país: verde = posee billetes de su
  `moneda_vigente`; rojo = posee billetes pero no de la moneda vigente;
  gris = nada. Click → `openCountryModal` (dialog `#country-modal`: bandera
  `../_flags_svg/<flag_svg>`, lista de mini-cards con foto `img_full || thumb_f ||
  thumb_a`).
- Países faltantes (`renderMissingCountries` + `filterMissingCountries`):
  grid `#missing-countries-grid` (contador `#missing-count-header`) + filtro
  en vivo `#search-missing`.
- Charts (`renderCharts`), cada fila enlaza a `index.html?q=<query>` usando
  la gramática de `app.js`:
  - `#top-countries-list`: `pais:"<Nombre>"`
  - `#decades-chart-list`: `anio>=<dec> anio<+10` (y "Sin fecha")
  - `#conditions-chart-list`: `condicion:"UNC"` etc.
  - `#currencies-chart-list`: `currency_code:"USD"` etc.
- El link a `index-edit.html` se oculta si `location.hostname` no es
  `localhost`/`127.0.0.1`.
- `esc()` y `fmtPrecio()` vienen de `web/lib/format.js` (stats.js no importa
  app.js).

## `problemas.js`

- `load()`: `fetch("data/issues.json", {cache:"no-store"})`; muestra
  `#gen` (campo `generado`) y renderiza cada categoría de `categorias`.
- Cada categoría es un `<details class="problema">` con badge de conteo; el
  estado abierto se persiste en `localStorage["problemas_open"]` (objeto
  `{clave: bool}`; por defecto todo abierto, cerrado solo si `=== false`).
- `RENDERERS[clave]`: renderer por clave de `issues.json` (ver
  `data.md` §6); si no existe, `genericTable` usando `cat.columnas`.
  Las filas de `monedas_sin_vinculo` incluyen la miniatura
  (`thumb_a || img_a`) como enlace a la imagen original.
- Acciones (todas terminan en `POST /api/rebuild` + `load()`):
  | Acción | Endpoint | Renderer |
  |---|---|---|
  | Renombrar carpeta | `POST /api/rename_folder` | `carpetas_sin_json` (input + botón) |
  | Crear JSON | `POST /api/create_json` | `carpetas_sin_json` (input pick + botón) |
  | Cambiar pick | `POST /api/change_pick` | `picks_formato_raro` (input + botón) |
  | Guardar Colnect | `POST /api/update` (field `colnect`) | `sin_colnect` (input URL) |
  | Guardar condición | `POST /api/update` (field `condicion`) | `sin_condicion` (select `CONDICIONES` + botón) |
  | Subir foto A/B | `POST /api/upload_photo?id&side` | `sin_fotos` (file input `image/jpeg`, ≤30 MB) |
  | Generar Full | `POST /api/generar_full` | `sin_full` (botón) |
  | `json_invalidos` | — (solo muestra `archivo` + `error`) | — |
  | `monedas_sin_vinculo`, `picks_sin_formato` | — (informativas) | — |
- No hay wrapper de fetch: cada acción hace su `fetch` propio y si
  `!res.ok || !out.ok` lanza `new Error(out.error)` → `alert` con el mensaje
  de `{ok:false,error}`; todas terminan en `load()` (recarga de issues.json).
