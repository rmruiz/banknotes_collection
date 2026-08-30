# Arquitectura

## Capas y responsabilidades

```
┌────────────────────────────────────────────────────────────────┐
│ FRONTEND (web/, HTML+JS plano, sin build)                      │
│  app.js: estado, filtros, render, edición, i18n, modales       │
│  stats.js: KPIs + mapa D3 + charts        problemas.js: issues │
└──────────────▲───────────────────────────▲─────────────────────┘
        fetch data/*.json            POST /api/* (JSON)
┌──────────────┴───────────────────────────┴─────────────────────┐
│ SERVIDOR (_scripts/serve_web.py)                               │
│  ThreadingHTTPServer (stdlib) · estáticos desde web/           │
│  API mínima de edición con whitelist + validadores             │
└──────────────▲───────────────────────────▲─────────────────────┘
        escribe         llama               re-escribe
┌──────────────┴─────┐   ┌────────────────┴──────────────────┐
│ GENERADOR          │   │ FUENTE DE VERDAD                  │
│ build_web.py       │   │ _json/*/*.json (billetes)         │
│ make_record,       │   │ _json/countries.json              │
│ thumbs, issues     │   │ _json/currencies.json             │
└────────────────────┘   │ web/_originals/ web/_FULL/ _flags/ │
                         └────────────────────────────────────┘
```

- **Una sola fuente de verdad**: `_json/`. La web NUNCA es la fuente:
  `web/data/*` y `web/thumbs/*` se regeneran con
  `_scripts/build_web.py:build` y están gitignored.
- **El servidor no tiene estado propio**: su único estado en memoria es `IDS`
  (id → path del JSON; se construye al cargar el módulo con
  `{f.stem: f for f in JSON_DIR.glob("*/*.json")}` y lo refresca
  `_handle_rebuild`, que limpia y re-puebla el índice).
- **Helpers desacoplados**: los scripts auxiliares (`validate_currencies.py`,
  `extract_themes_from_jpgs.py`, …) no entran en el pipeline de runtime; solo
  `build_web.py` (llamado por el servidor y el CLI) y `util.py` (módulo
  compartido) son dependencias directas.

## Modelo de seguridad de la API (`serve_web.py`)

Toda la confianza del diseño está en `do_POST`:

1. **Solo localhost**: `HOST_RE` sobre `Host` (localhost, 127.0.0.1[:p],
   `[::1]`) y `ORIGIN_RE` sobre `Origin` (solo `http://localhost[:p]`).
   Falla → 403.
2. **Cuerpo acotado**: JSON ≤ 4 KB (comprobación inline de `Content-Length`
   en `do_POST`) salvo `upload_photo` (binario ≤ 30 MB con comprobación
   doble: header y magic bytes JPEG).
3. **Whitelist de ids**: `ID_RE` + `id in IDS` (índice de `_json/*/*.json`).
   Todo endpoint opera sobre paths construidos desde ese id, con defensa
   anti-traversal (`parent == ORIGINALS`).
4. **Whitelist de campos**: `FIELDS` (23 campos) cada uno con validador
   propio (`_v_str`, `_v_num`, `_v_year`, `_v_url`, `_v_bool`, `_v_temas`,
   `_v_currency_code`). Nada más se puede escribir.
5. **Escritura serializada**: `WRITE_LOCK` (threading.Lock) + `atomic_write`
   (tmp + `os.replace`) para todo lo que toca disco; `ThreadingHTTPServer`
   permite concurrencia de lecturas.
6. **GET estático acotado**: solo `GET` bajo `/` de `web/`
   (`ALLOWED_GET_PREFIXES`), redirige `/web/` → `/`, 404 a `..`.
   Cache: el override `end_headers` añade `Cache-Control: no-cache` a TODO
   lo que no empieza por `CACHEABLE_PREFIXES` (`/thumbs/`, `/_originals/`,
   `/_FULL/`, `/_flags/`); esas rutas se sirven sin cabecera extra (caché
   por defecto del navegador) y además llevan `?v=<firma>` en la URL,
   puesta por el build, lo que invalida el caché al cambiar la foto.

> Nota: el docstring del módulo dice que solo escucha en 127.0.0.1, pero el
> código usa `BIND = "0.0.0.0"` (escucha todas las interfaces). El
> aislamiento real de la API es la comprobación Host/Origin (punto 1); el
> contenido estático sí queda expuesto a la red local.

## Caché y consistencia

- **URLs versionadas**: `build_web.py:file_sig` = `mtime_ns-size`, `file_v`
  = `md5(firma)[:10]`; `make_record` las añade a todas las imágenes.
- **Index no-store**: los `fetch` de datos usan `{cache: "no-store"}`, así que
  el cliente siempre ve la salida más reciente del último build.
- **Regla de coherencia**: tras cualquier cambio estructural (crear JSON,
  cambiar pick, subir foto, generar full) el cliente llama `POST /api/rebuild`
  y recarga; el servidor arranca con un build completo, por lo que un
  `serve_web.py` siempre sirve un `collection.json` coherente con `_json/`.

## Dependencias externas

| Dependencia | Dónde | Uso |
|---|---|---|
| Python 3 stdlib (`http.server`, `json`, `threading`, `concurrent.futures`, `re`, `pathlib`, `hashlib`) | `build_web.py`, `serve_web.py`, `util.py` | todo el pipeline |
| **ImageMagick** (`magick`) | `build_web.py:make_thumb`, `serve_web.py:_sanitize_jpeg`, `generar_imagen.py` | miniaturas (360px q80), re-encode de uploads, composición de Full |
| `d3.min.js` + `topojson-client.min.js` (commiteados en `web/`) | `stats.html` | mapa mundial |
| `ollama` (local) | `extract_serial.py`, `extract_themes_from_jpgs.py` | extracción de series/temas con LLM (opcional) |
| `reportlab` | `generar_etiquetas.py` | PDF de etiquetas |
| `requests`/`bs4`/`langchain` (DuckDuckGo) | `extract_themes_from_jpgs.py` | contexto Numista (opcional) |
| `jq` | `git_clean_json.sh` | reset de `verificado` en masa |

## Notas de diseño

- **Id = ancla de todo**: el id une archivo JSON, carpeta de fotos, imagen
  full y miniaturas. Por eso `change_pick` y `create_json` son operaciones de
  renombrado en cascada, y no simples ediciones de campo.
- **`collection.json` se mantiene en orden**: los updates reemplazan el
  registro in-place; `new_note` lo inserta en su posición (primera posición
  donde `sort_key` es mayor; si no hay, al final); solo el build completo
  reordena desde cero.
- **Borrar un billete no existe como API**: no hay endpoint de eliminación;
  la única forma de "borrar" campos es enviar valor vacío/`""` (los validadores
  lo permiten).
- **Campos bool**: `subunidad` se elimina de la clave cuando es false (para
  no ensuciar los JSONs); los demás bools se guardan como tal.
- **Filtrado bool en la UI**: los filtros `verificado`/`conmemorativo`/
  `remarcado`/`subunidad` tienen 3 estados (todos / solo sí / solo no) y
  viven en `state.boolFilters` (ver `web.md`), no en la query.
