# Scripts (`_scripts/`)

Resumen del documento: `build_web.py` y `serve_web.py` son el pipeline de
runtime; `util.py` el módulo de convenios; el resto, utilidades puntuales.
Notación `{archivo}:{función}`; entradas de CLI entre comillas.

## Pipeline de runtime

### `build_web.py` (~535 líneas) — generador del índice web

- **Entrada**: `python3 _scripts/build_web.py [--force]`. `--force`
  regenera todas las miniaturas aunque la firma no haya cambiado; el CLI
  siempre corre con `verbose=True` (no hay flag `--verbose`).
- **Salida** (todo atómico, ver `files.md`): `web/data/collection.json`,
  `issues.json`, `thumbs_meta.json`, copias de `countries.json`/
  `currencies.json`, `web/thumbs/*.jpg`.
- **API principal**: `build(force=False, verbose=False) → dict` (resumen:
  `registros`, `json_invalidos`, `problemas`, `con_front/back/full`,
  `thumbs_generadas`, `thumbs_errores`, `errores`, `kb`). Es lo que llama
  `serve_web.py` (arranque y `/api/rebuild`).
- **Funciones clave**:
  - `make_record(d)` — JSON de billete → registro de `collection.json`
    (ver `data.md` §5). Lanza si el esquema es inválido (el build lo captura
    y lo pasa a `json_invalidos`).
  - `sort_key` / `natural_pick_key` — orden país → pick natural.
  - `denominacion_full` / `fmt_valor` — monto + nombre de moneda
    (singular/plural, subunidad).
  - `file_sig` / `file_v` — firma `mtime_ns-size` y `?v=` de caché.
  - `flag_file_for_note(d)` + `FLAG_INDEX` + `FLAG_ALIASES` — resolución de
    bandera (`countries.json[code].flag` → `web/_flags/`, con alias p. ej.
    `FIYI→FIJI`, `MOLDAVIA→MOLDOVA`).
  - `thumb_jobs(rec, meta, force)` / `make_thumb(job)` — plan y ejecución de
    miniaturas (magick, 360px, q80, `ThreadPoolExecutor(8)`).
  - `build_issues_data(records, meta, force, json_malos)` — las 8 categorías
    de `issues.json` + miniaturas de carpetas huérfanas
    (`thumbs/x_<md512>_X.jpg`).
  - `build_search(d, rec)` — campo `search` normalizado.
- **No tiene dependencias de red**; solo stdlib + `magick` + `util.py`.

### `serve_web.py` (~781 líneas) — servidor local + API de edición

- **Entrada**: `python3 _scripts/serve_web.py [puerto]` (default 8000).
  `BIND = "0.0.0.0"` (ver nota de `architecture.md`); `Handler` es
  `BaseHTTPRequestHandler` sobre `ThreadingHTTPServer`.
- **Arranque** (`main`): `build_web.build()` completo → `IDS` (id → path de
  `_json/*/*.json`; se construye al cargar el módulo con
  `{f.stem: f for f in JSON_DIR.glob("*/*.json")}` y lo refresca
  `_handle_rebuild`) → serve.
- **GET**: estáticos de `web/` (ver `architecture.md` §seguridad, punto 6).
- **POST** (todas las respuestas `{ok,…}`; ver `data-flows.md`). Body JSON
  limitado a `0 < len ≤ 4096` bytes (4 KB) para todos los endpoints salvo
  `upload_photo` (binario, límite propio):
  | Endpoint | Handler | Payload |
  |---|---|---|
  | `POST /api/update` | `_handle_update(id, field, value)` | `{id, field, value}` — whitelist `FIELDS` (23) + validadores |
  | `POST /api/verificado` | delega a `_handle_update(id, "verificado", …)` | `{id, verificado}` (bool; compat legado) |
  | `POST /api/new_note` | `_handle_new_note` | `{pais, pick}` |
  | `POST /api/generar_full` | `_handle_generar_full` | `{id}` |
  | `POST /api/change_pick` | `_handle_change_pick` | `{id, pick}` |
  | `POST /api/rename_folder` | `_handle_rename_folder` | `{carpeta, nuevo}` |
  | `POST /api/create_json` | `_handle_create_json` | `{carpeta, pick}` |
  | `POST /api/upload_photo` | `_handle_upload_photo` | query `?id=&side=A|B` + binario JPEG ≤30 MB |
  | `POST /api/rebuild` | `_handle_rebuild` | sin body (se responde antes de parsear) |
- **Whitelist `FIELDS`** (campo UI → donde vive en el JSON):
  `pais`→`country_code`, `colnect`→`colnect.url`, `numista`, `valor`→
  `denomination.value`, `moneda`→`denomination.currency`, `currency_code`→
  `denomination.iso4217`, `subunidad`→`denomination.subunidad` (borra la clave
  si false), `anio`, `verificado`, `conmemorativo`, `remarcado`→`overprint`,
  `obs`/`vigencia`/`serie`/`banco`/`zona`→`notes.*`, `serial`→
  `specimens[0].serial_number`, `condicion`→`specimens[0].condition`,
  `firmas`/`temas`/`alternativas` (text→list), `grupo`→`colnect.group`,
  `subtipo`.
- **Validadores** (uno por campo): `_v_str(max, allow_empty)`,
  `_v_num` (0 ≤ v < 10¹², no bool), `_v_year` (1000–2100 o null),
  `_v_url` (http(s) ≤300 o `""`), `_v_bool` (flexible), `_v_temas`
  (`TEMA_RE` por par `k:v`), `_v_currency_code` (∈ `currencies.json`, se
  normaliza a mayúscula).
- **Conexión con `generar_imagen.py`**: `_handle_generar_full` importa
  `generar_imagen` y llama a `compose(d, front, back, flag, dest, tmp)`.

## Módulo compartido

### `util.py`

Convenios que usan `build_web.py`, `serve_web.py`, `generar_imagen.py` y
`extract_themes_from_jpgs.py`:

| Función | Rol |
|---|---|
| `unaccent(s)` | NFKD→ASCII, sin acentos (ids, lookup de países, búsqueda) |
| `norm_flag(s)` | normaliza nombres de bandera (mayúsculas alfanuméricas, quita paréntesis) |
| `make_note_id(abbr, pick)` | `<abbr>-<pick>` minúsculo sin `-`/`.`/espacios |
| `load_countries()` / `COUNTRIES` | cache de `_json/countries.json` |
| `get_country_by_code(code)` | lookup por `code` |
| `get_country_by_name(nombre)` | lookup por `name.es` (unaccent+lower) |
| `load_currencies()` / `CURRENCIES` | cache de `_json/currencies.json` |
| `get_currency_by_code(code)` | lookup por código ISO 4217 |
| `is_true(v)` | bool flexible (true/false/1/0/si/no/yes) |
| `currency_name(code, fallback, lang, subunit=False)` | nombre de moneda (corto o subunidad) en `es`/`en`, con fallback al texto libre |

## Utilidades puntuales (no están en el pipeline de runtime)

| Script | Entrada | Qué hace | Efectos / dependencias |
|---|---|---|---|
| `generar_imagen.py` | `python3 _scripts/generar_imagen.py [--filter <s>] [--overwrite-all]` o como módulo (`compose`, `flag_for`, `flag_for_note`) | Compone `web/_FULL/<id>.jpg` = front + banda de info (pick, país, denominación, año, moneda, firma) + bandera + back | Escribe `_FULL/`; usa `magick`; **también lo importa `serve_web.py:_handle_generar_full`** |
| `generar_etiquetas.py` | `python3 _scripts/generar_etiquetas.py` | Genera `etiquetas.pdf` (ReportLab, carta, 1 etiqueta por billete) | Escribe `etiquetas.pdf` (gitignored) |
| `validate_currencies.py` | `python3 _scripts/validate_currencies.py` → `validate_banknotes()` | Valida los `_json/*/*.json` contra `currencies.json` (códigos existentes, etc.) | Solo lee; salida por stdout |
| `fix_currency_errors.py` | `python3 _scripts/fix_currency_errors.py` → `get_currencies_by_country_and_year()` | Corrige `denomination.iso4217` por país+año usando `currencies.json` | Escribe JSONs de `_json/`; revisar cambios antes de commitear |
| `check_missing_flags.py` | `python3 _scripts/check_missing_flags.py` → `check_flags()` | Compara banderas de `countries.json` con `web/_flags/` y lista faltantes | Solo lee; **tiene rutas absolutas hardcodeadas** |
| `extract_serial.py` | `python3 _scripts/extract_serial.py` → `process_banknote_jsons()` | Para billetes sin `specimens[0].serial_number`, extrae el serial de la foto con un LLM local (Ollama) y lo escribe | Escribe JSONs de `_json/`; requiere `ollama` corriendo |
| `extract_themes_from_jpgs.py` | `python3 _scripts/extract_themes_from_jpgs.py` | Extrae `themes` (claves permitidas: actividad, arte, construccion, dictador, evento, fauna, flora, lugar, personaje, reina, rey, simbolo, transporte) de las fotos con LLM local + contexto Numista (scraping/requests/bs4, búsqueda DuckDuckGo vía langchain) | Escribe JSONs de `_json/`; requiere `ollama` (modelo `gemma4:31b` por defecto) |
| `reset_verificados.py` | `python3 _scripts/reset_verificados.py` → `reset_verificado_status()` | Pone `verificado = false` en todos los `_json/*/*.json` | Escribe en masa; usar antes de auditar |
| `update_countries_json.py` | `python3 _scripts/update_countries_json.py` → `update_countries()` | Actualiza `_json/countries.json` con datos derivados de `currencies.json` | Escribe `countries.json`; **rutas absolutas hardcodeadas** |
| `git_clean_json.sh` | usarse como filtro: `cat archivo.json \| bash _scripts/git_clean_json.sh` | Es solo el filtro `jq '.verificado = false'` (sin globbing propio); el usuario encadena los archivos (p. ej. desde `git ls-files`) | Salida por stdout; requiere `jq`; equivale a `reset_verificados.py` vía jq |

## Convenciones transversales de scripts

- Todos los escritorios de JSON usan formato `ensure_ascii=False, indent=2`
  + salto de línea final (igual que `_handle_update`).
- Los que escriben `_json/` deben ser seguidos de un build/`/api/rebuild`
  para que la web refleje los cambios.
- `check_missing_flags.py` y `update_countries_json.py` asumen rutas
  absolutas del equipo original; revisarlos antes de ejecutar en otra máquina.
- `git_clean_json.sh` es la variante "jq" del reset de `verificado`: el
  script solo contiene el filtro `jq`, así que hay que darle los JSONs por
  stdin (p. ej. desde una lista de `git ls-files`).
