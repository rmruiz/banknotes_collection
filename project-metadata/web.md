# Frontend (`web/`)

Comportamiento verificado de las 4 páginas. Todo el JS es vanilla (ES6+), sin
frameworks ni build; los assets son servidos tal cual por `serve_web.py`.

## Páginas

| Archivo | Título | Rol | JS principal |
|---|---|---|---|
| `web/index.html` | Catálogo | Índice de billetes, modo lectura | `app.js` |
| `web/index-edit.html` | Catálogo (edición) | Ídem + edición inline + billete nuevo | `app.js` (mismo) |
| `web/stats.html` | Estadísticas | KPIs, mapa mundial, países faltantes, charts | `stats.js` (IIFE aislada) |
| `web/problemas.html` | Problemas | Corregir los problemas detectados por el build | `problemas.js` |

`app.js` detecta el modo por el path: `isEditMode =
location.pathname.includes("index-edit.html")` (controla visibilidad del
botón de nuevo billete, de los inputs editables y del toolbar).

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
  boolFilters: { verificado, conmemorativo, remarcado, subunidad }
}
```

- **`COLUMNS`**: ~28 columnas definidas con `{key, label, render…}`; fijas:
  pick, imágenes front/back/full, verificado. Visibles por defecto:
  `pais`, `denominacion`, `anio`, `front`, `back`, `full`, `colnect`,
  `numista`, `verif`. El resto se muestra u oculta con los checkboxes del
  toolbar (`renderColsMenu`/`applyCols`) y persiste en `localStorage["banknotes_cols"]`.
- **`boolFilters`**: cada key es `"all" | "yes" | "no"`. Se ciclan
  clickando el header (`click` en `<th>`); el ícono de la columna lo refleja
  (`web/app.js:updateBoolIndicators`).

## `app.js` — lenguaje de query del buscador

`parseQuery(q)` compila la query de `#q` a una función de filtro. Gramática
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
  `web/app.js:getCol` / `COL_ALIASES` (mapa nombre-de-columna→key) o un alias
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

- `applyFilter()`: recorre `state.all` con la función compilada +
  `boolFilters` → `state.filtered` → `applySort()` → `render()`.
- `applySort()`: key numérica (`anio`, `valor`) vs. textual
  (`localeCompare` es); `dir` asc/desc; los headers clicables
  (`th[data-sort]`) reciben las clases `sort-asc`/`sort-desc` que pinta el
  ▲/▼ vía CSS (`web/styles.css`).
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
  de `state.all`) + pick. Ver flujo en `data-flows.md` §4.

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
  cancelan sin guardar. Números: `,`→`.` y `anio` se trunca; no numérico →
  `alert`.
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

- `init()`: fetch de `data/collection.json`, `data/countries.json`
  (fallback `../_json/countries.json`) y `data/currencies.json`; si el
  catálogo está vacío no renderiza nada.
- `processData()`: índices `notesByCountryCode`, `notesByIsoA2`,
  `numericToCountry` (ISO numérico pad 3), `ownedCurrencies` (con
  `FUND_CODE_ALIASES`, p. ej. `USN→USD` para códigos históricos) y
  `missingCountriesList` (países del catálogo sin billetes; se excluye
  `moneda_propia === 'no'`; ordenados por `name.es`).
- KPIs (`renderKPIs`): `#kpi-total-notes`, `#kpi-countries-owned` ("X / Y" +
  `#kpi-countries-pct`), `#kpi-countries-missing`, `#kpi-currencies-count`
  (distinct `currency_code`), `#kpi-special-count`
  (`conmemorativo || remarcado`).
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
- `esc()` está duplicado a propósito (stats.js no importa app.js).

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
  | Subir foto A/B | `POST /api/upload_photo?id&side` | `sin_fotos` (file input `image/jpeg`, ≤30 MB) |
  | Generar Full | `POST /api/generar_full` | `sin_full` (botón) |
  | `json_invalidos` | — (solo muestra `archivo` + `error`) | — |
  | `monedas_sin_vinculo`, `picks_sin_formato` | — (informativas) | — |
- No hay wrapper de fetch: cada acción hace su `fetch` propio y si
  `!res.ok || !out.ok` lanza `new Error(out.error)` → `alert` con el mensaje
  de `{ok:false,error}`; todas terminan en `load()` (recarga de issues.json).
