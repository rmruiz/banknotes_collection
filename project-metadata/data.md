# Contratos de datos

Esquemas exactos verificados contra el código y los datos reales.

## 1. Convención de id y rutas

Definida UNA sola vez en `_scripts/util.py` (importada por `build_web.py`,
`serve_web.py`, `generar_imagen.py`):

- **id** = `_scripts/util.py:make_note_id(abbr, pick)` →
  `<abbr>-<pick sin `-`, `.` ni espacios, en minúsculas>`.
  Ej.: `ar` + `P-367a` → `ar-p367a`. El id ES:
  - el nombre del archivo: `_json/<carpeta>/<id>.json`
  - la carpeta de fotos: `web/_originals/<id>/`
  - la imagen compuesta: `web/_FULL/<id>.webp` (WebP lossy q80)
- **Rutas de fotos por convención** (no se almacenan en el JSON):
  | Dato | Ruta |
  |---|---|
  | Front | `web/_originals/<id>/<id>_A.jpg` |
  | Back | `web/_originals/<id>/<id>_B.jpg` |
  | Full (compuesta) | `web/_FULL/<id>.webp` (WebP q80, method=6) |
  | Miniaturas | `web/thumbs/<id>_A.jpg`, `<id>_B.jpg`, `<id>_F.jpg` |
  | Bandera | `web/_flags_svg/*.svg` vía `countries.json[<code>].flag_svg` (el archivo debe existir; sin alias) |
- **Validación de id** (API): `ID_RE = ^[a-z0-9][a-z0-9.\-]{0,80}$`
  (`serve_web.py`); el id además debe existir en el índice `IDS` construido
  con `_json/*/*.json`.
- **Validación de pick**: `PICK_RE = ^[A-Za-z0-9][A-Za-z0-9 .\-]{0,39}$`.
- **Textos normalizados**: `_scripts/util.py:unaccent` (NFKD→ASCII) para id y
  búsqueda. (`util.py:norm_flag` queda como residual del esquema legacy de
  banderas JPG; la resolución SVG ya no lo usa.)

## 2. JSON de billete — `_json/<carpeta>/<id>.json`

Fuente de verdad. Esquema (campos de ejemplo real: `cl-p125`):

```json
{
  "id": "cl-p125",
  "pick_number": "P-125",
  "country_code": "cl",
  "denomination": {
    "value": 10,
    "currency": "Pesos",
    "iso4217": "CLP",
    "subtype": "",
    "alternatives": ["1/100 Escudo", "1 Condor"]
  },
  "year": 1960,
  "precio": null,
  "signatures": ["Figueroa", "Mackenna"],
  "themes": ["personaje:manuel_bulnes"],
  "colnect": { "url": "https://colnect.com/...", "group": "1960 ND Provisional Issue" },
  "commemorative": false,
  "overprint": true,
  "verificado": false,
  "notes": { "serie": "", "bank": "", "zone": "", "vigencia": "1960 - 1961", "obs": "" },
  "specimens": [ { "serial_number": "266594", "condition": "UNC" } ],
  "numista": "https://en.numista.com/233694"
}
```

| Campo | Tipo | Notas / restricciones |
|---|---|---|
| `id` | str | Convención de id (sección 1). Debe coincidir con el nombre de archivo. |
| `pick_number` | str | Nº de Pick; `PICK_RE`. Deriva el id. |
| `country_code` | str | Clave de `countries.json` (minúscula). Campo canónico; hay compatibilidad legacy con `country: {es, en}` como fallback. |
| `denomination.value` | number \| null | Monto. API: `_v_num` (0 ≤ v < 10¹², no bool). |
| `denomination.currency` | str | Moneda original en texto libre (≤80). API: `_v_str(80)`. |
| `denomination.iso4217` | str \| null | Código ISO 4217. API: debe pertenecer a `currencies.json` (se guarda en mayúscula). |
| `denomination.subtype` | str | ≤80. |
| `denomination.alternatives` | str[] | Otras monedas/denominaciones. API: texto separado por coma (o `·`). |
| `denomination.subunidad` | bool (opcional) | Solo está presente cuando el billete usa la subunidad (ej. centavos); al desmarcarse se ELIMINA la clave. |
| `year` | int \| null | API: 1000–2100. |
| `precio` | number \| null | Cuánto cuesta el billete (valor de mercado); opcional — los JSONs legacy no lo tienen (se trata como `null`). API: `_v_num` (0 ≤ v < 10¹², `null` borra). |
| `signatures` | str[] | Firmas. API: texto separado por `" - "`. |
| `themes` | str[] | Pares `clave:valor` (claves típicas: `personaje`, `fauna`, `flora`, `lugar`…). API: `TEMA_RE = ^[\w\-]+\s*:\s*.+$` por par. |
| `colnect.url` | str | URL http(s) ≤300 (vacío permitido = borrar). |
| `colnect.group` | str | ≤200 (API: campo `grupo`). |
| `commemorative` | bool | Conmemorativo. |
| `overprint` | bool | Remarcado. |
| `verificado` | bool | Se edita desde la UI; `reset_verificados.py` / `git_clean_json.sh` lo ponen a false en masa. |
| `notes.serie/bank/zone/vigencia/obs` | str | ≤120 (obs ≤300). |
| `specimens[0].serial_number` | str | Nº de serie. API: ≤80. |
| `specimens[0].condition` | str | Escala IBNS: `""`, `UNC`, `AU`, `XF`, `VF`, `F`, `VG`, `G`, `Fair`, `Poor` (set `CONDICIONES` en `serve_web.py`). |
| `numista` | str | URL http(s) ≤300. |

El build (`build_web.py:make_record`) exige el esquema: un JSON que falle
(p. ej. falta `denomination` o `specimens[0]`) se omite del índice y aparece
en la categoría `json_invalidos` de `issues.json`.

## 3. `_json/countries.json` (206 entradas)

Diccionario `código → info`. Clave: código corto minúsculo propio del catálogo
(no siempre ISO alpha-2; ej. `xk`).

```json
"cl": {
  "code": "cl",
  "iso_alpha2": "CL",
  "iso_numeric": "152",
  "name": { "es": "Chile", "en": "Chile" },
  "vigente": "si",
  "flag_svg": "cl.svg",
  "folder": "chile",
  "moneda_vigente": "CLP"
}
```

| Campo | Tipo | Uso |
|---|---|---|
| `code` | str | Código canónico (mismo que la clave). Se usa como `country_code` en los billetes. |
| `iso_alpha2` | str \| null | Para el mapa D3 (`stats.js` también mapea por nombre/alpha-2). |
| `iso_numeric` | str \| null | El mapa usa el `id` (ISO numérico, pad 3) del TopoJSON → `numericToCountry`. |
| `name.es` / `name.en` | str | Nombres canónicos; `name.es` es la clave de `util.py:get_country_by_name`. |
| `vigente` | str | Marcador textual (ej. `"si"`). |
| `flag_svg` | str | Nombre del archivo SVG en `web/_flags_svg/` (p. ej. `cl.svg`). |
| `folder` | str | Carpeta bajo `_json/` de los billetes del país (`argentina`, `chile`, `usa`, `world`). |
| `moneda_vigente` | str | ISO 4217 de la moneda vigente; el mapa de `stats.html` la usa para verde/rojo. |

`web/stats.js:processData` maneja defensivamente un campo
`moneda_propia === 'no'` (países sin moneda propia), pero **ninguna** entrada
del archivo actual define ese campo.

**Editable desde la web** (V1: solo campos, sin agregar/eliminar entradas):
`POST /api/update_dataset` con `dataset: "countries"` y `code` = la clave;
whitelist `serve_web.py:DS_FIELDS["countries"]` = las 8 columnas expuestas
(`code` es la identidad y no se edita). Escribe `_json/countries.json` y
copia el mismo texto a `web/data/countries.json` (ver `data-flows.md` §11).

## 4. `_json/currencies.json` (215 entradas)

Diccionario `CÓDIGO ISO 4217 → info`.

```json
"CLP": {
  "codigo": "CLP",
  "nombres": { "es": "Peso chileno", "en": "Chilean peso" },
  "nombre_corto": { "es": "Peso", "es_p": "Pesos", "en": "Peso", "en_p": "Pesos" },
  "simbolo": "$",
  "iso_4217": { "numerico": "152", "decimales": 0 },
  "subunidad": { "codigo": null, "nombres": { "es": "centavo", "en": "centavo" }, "factor": 100 },
  "tipo": "fiat",
  "estado": "circulacion",
  "uso": { "emisor": ["CL"], "curso_legal": ["CL"] },
  "banco_central": "...", "historia": "...", "notas": "..."
}
```

| Campo | Tipo | Uso |
|---|---|---|
| `codigo` | str | Mismo que la clave. |
| `nombres.es/en` | str | Nombre completo. |
| `nombre_corto.es / es_p / en / en_p` | str | Corto + plural (`es_p`); `build_web.py:denominacion_full` elige singular/plural según el monto. |
| `simbolo` | str | Se oculta en la UI cuando el billete usa `subunidad`. |
| `iso_4217.numerico/decimales` | str/int | Referencia. |
| `subunidad` | obj | `codigo`, `nombres`, `factor`. El nombre de subunidad se muestra cuando `denomination.subunidad` es true (`util.py:currency_name(..., subunit=True)`). |
| `tipo`, `estado` | str | `fiat`, `circulacion`, etc. `estado` se expone como `currency_status` en el registro. |
| `uso.emisor/curso_legal` | str[] | Códigos de países. |
| `banco_central`, `historia`, `notas` | str | Texto de referencia. |

**Editable desde la web** (V1: solo campos, sin agregar/eliminar entradas):
`POST /api/update_dataset` con `dataset: "currencies"` y `code` = la clave;
whitelist `serve_web.py:DS_FIELDS["currencies"]` = las 21 columnas expuestas
por `web/lib/datasets.js` (rutas punteadas para campos anidados; `uso.*`
acepta lista o texto con comas; `decimales`/`factor` son int; `notas`,
`historia.*` son str|null). Escribe `_json/currencies.json` y copia el mismo
texto a `web/data/currencies.json` (ver `data-flows.md` §11).

## 5. Registro de `web/data/collection.json` (GENERADO — no editar)

Array de ~1102 registros, ordenado por `_scripts/build_web.py:sort_key`
(pais sin acentos en minúsculas → pick natural vía `natural_pick_key`).
Cada registro lo produce `_scripts/build_web.py:make_record` y tiene
**exactamente** estas claves (orden real):

| Clave | Tipo | Origen / cómo se calcula |
|---|---|---|
| `id` | str | `d.id` |
| `pick` | str | `d.pick_number` |
| `country_code` | str | `d.country_code` |
| `pais` | str | `countries.json[code].name.es` (fallback: `d.country.es`) |
| `pais_en` | str | `countries.json[code].name.en` (fallback: `d.country.en`) |
| `valor` | number \| null | `denomination.value` |
| `moneda` | str | `denomination.currency` (texto original) |
| `precio` | number \| null | `d.get("precio")` (directo del JSON; legacy → `null`) |
| `currency_code` | str | `denomination.iso4217` (mayúscula; `""` si falta) |
| `currency_name_es` | str | `util.py:currency_name(code, fallback, "es", subunit=…)` |
| `currency_name_en` | str | id. con `"en"` |
| `currency_symbol` | str | `currencies.json[code].simbolo`; `""` si `subunidad` |
| `currency_status` | str | `currencies.json[code].estado` |
| `denominacion` | str | `build_web.py:denominacion_full`: monto formateado + nombre corto (plural si monto ≠ 1) |
| `subunidad` | bool | `is_true(denomination.subunidad)` |
| `subtipo` | str | `denomination.subtype` |
| `alternativas` | str | `" · ".join(denomination.alternatives)` |
| `anio` | int \| null | `d.year` |
| `firmas` | str | `" - ".join(d.signatures)` |
| `temas` | str | `", ".join(d.themes)` |
| `obs`, `vigencia`, `serie`, `banco`, `zona` | str | `d.notes.*` |
| `serial` | str | `d.specimens[0].serial_number` |
| `condicion` | str | `d.specimens[0].condition` |
| `grupo` | str | `d.colnect.group` |
| `colnect` | str | `d.colnect.url` |
| `numista` | str | `d.numista` |
| `conmemorativo`, `remarcado`, `verificado` | bool | `d.commemorative` / `d.overprint` / `d.verificado` |
| `flag` | str | `_flags_svg/<archivo.svg>?v=<firma>` o `""` (`build_web.py:flag_file_for_note`) |
| `thumb_a`, `thumb_b`, `thumb_f` | str | `thumbs/<id>_X.jpg?v=<firma>` o `""` si no existe |
| `img_a`, `img_b`, `img_full` | str | `_originals/…?v=<firma>`, `_FULL/<id>.webp?v=<firma>` o `""` |
| `search` | str | `build_web.py:build_search`: id, pick, país (es/en), denominacion, moneda, valor, precio, año, código/nombre/símbolo/estado de moneda, firmas, temas, obs, grupo, subtipo, alternativas, vigencia, serie, banco, zona, serial, condición + las palabras `conmemorativo`/`remarcado` si aplican. Todo unaccent+lower, espacios colapsados. |

**Cacheo**: las URLs de imágenes llevan `?v=<md5[:10] de mtime_ns-size>`
(`build_web.py:file_v`/`file_sig`) para invalidar el caché del navegador al
cambiar la foto.

**Formato de montos** (`build_web.py:fmt_valor`, estilo es-CL):
`1000 → "1.000"`, `0.5 → "0,5"`, `None → ""`.

**Contrato de display cross-language (T14)**: Python es la fuente de
verdad. `build_web.py:denominacion_full` / `util.py:currency_name` y
`web/lib/format.js:denominationFullDisplay` / `currencyDisplay` deben
producir el mismo texto para la misma entrada; el pacto está encerrado
en `web/tests/fixtures/fmt.json` (secciones `denominacion`, `currency` y
`catalog`; se regenera con `python3 _scripts/generar_fixtures.py` —
Python calcula los `out`). Regla de caso: los nombres del catálogo
(`_json/currencies.json`) son la única fuente y van en Title Case curado;
el lado JS aplica `toTitleCase` como red de normalización (no-op sobre el
catálogo, normaliza los fallbacks de texto libre). Un test Python
(`test_build_web.py:…fixture_cross_language`) y dos tests JS
(`format.test.js`) corren cada lado contra el `out` commiteado.

## 6. `web/data/issues.json` (GENERADO)

```json
{
  "generado": "2026-08-29 15:51",
  "categorias": [ { "clave": "...", "titulo": "...", "columnas": [...], "items": [...] } ]
}
```

Producido por `_scripts/build_web.py:build_issues_data`. Categorías (claves
exactas, en orden de aparición) y forma de `items`:

| `clave` | Título | items |
|---|---|---|
| `json_invalidos` | Archivos JSON inválidos | filas `[archivo, error]` (relativa + `esquema inválido: <Excepción>: <msg>`) |
| `monedas_sin_vinculo` | Billetes sin moneda vinculada al catálogo | obj `{id, pick, pais, denominacion, moneda, currency_code, thumb_a/b, img_a/b}` |
| `carpetas_sin_json` | Carpetas de fotos sin JSON asociado | obj `{carpeta, archivos[], thumb_a/b, img_a/b}`; thumbs propias `thumbs/x_<md512>_A.jpg` |
| `picks_sin_formato` | Billetes sin número de pick válido | filas `[id, pais, denominacion, anio]` |
| `picks_formato_raro` | Picks con formato raro | obj `{id, pick, pais, denominacion, anio, thumb_a/b, img_a/b}` |
| `sin_colnect` | Billetes sin link de Colnect | obj `{id, pick, pais, denominacion, anio, thumb_a/b, img_a/b}` |
| `sin_condicion` | Billetes sin condición establecida | obj `{id, pick, pais, denominacion, anio, thumb_a/b, img_a/b}`; `condicion` de `specimens[0]` vacía o ausente |
| `sin_fotos` | Billetes sin fotos (front o back) | obj `{id, pick, pais, denominacion, anio, thumb_a/b, img_a/b}` |
| `sin_full` | Billetes sin imagen Full | obj `{id, pick, pais, denominacion, anio, thumb_a/b, img_a/b}` |

`web/problemas.js` renderiza cada clave con un renderer propio
(`RENDERERS[clave]`) o `genericTable` (usa `columnas`).

## 7. `web/data/thumbs_meta.json` (GENERADO)

Mapa `ruta-relativa-de-thumb → firma (mtime_ns-size)` de la última vez que se
generó. Base del build incremental: si la firma de la fuente no coincide, el
thumb se regenera. Se reescribe completo en cada build.

## 8. Datos de referencia servidos a la web

- `web/data/countries.json` y `web/data/currencies.json`: copias idénticas de
  `_json/`. Dos vías de sincronización: el build (si existen en `_json/`) y
  el API `POST /api/update_dataset`, que escribe primero `_json/` y copia el
  **mismo texto** a `web/data/` — por eso ambos archivos quedan siempre
  byte-idénticos y el build posterior es idempotente (los cambios editados
  sobreviven al build).
- `web/data/world-110m.json`: **no existe**; `stats.js` lo intenta y usa
  fallback CDN (ver `files.md`).
