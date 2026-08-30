# Inventario de archivos

Clasificación por rol. "Git" indica si está commiteado (ver `git ls-files`) o
gitignored (ver `.gitignore`).

## Estructura de alto nivel

```
banknotes_collection/
├── _json/                  # FUENTE DE VERDAD (datos)
│   ├── countries.json      #   catálogo de países (206 entradas)
│   ├── countries.md        #   documentación del catálogo
│   ├── currencies.json     #   catálogo de monedas ISO 4217 (215 entradas)
│   ├── currencies.md       #   documentación del catálogo
│   ├── argentina/*.json    #   88 billetes
│   ├── chile/*.json        #   123 billetes
│   ├── usa/*.json          #   79 billetes
│   └── world/*.json        #   812 billetes (resto del mundo)
├── _scripts/               # Generador, servidor y helpers (Python/bash)
├── web/                    # Frontend estático + assets de imágenes
│   ├── index.html          #   catálogo (solo lectura)
│   ├── index-edit.html     #   catálogo (modo edición)
│   ├── app.js              #   toda la lógica del catálogo
│   ├── styles.css          #   estilos compartidos
│   ├── stats.html/stats.js/stats.css   # dashboard de estadísticas (D3)
│   ├── problemas.html/problemas.js     # página de problemas detectados
│   ├── d3.min.js, topojson-client.min.js  # librerías vendor commiteadas
│   ├── _flags/             # banderas FLAG_*.jpg (~210, commiteadas)
│   ├── _originals/         # fotos por billete: <id>/<id>_A.jpg,_B.jpg (commiteadas)
│   ├── _FULL/              # imagen compuesta <id>.webp (commiteadas)
│   ├── data/               # GENERADO (gitignored) — salida del build
│   └── thumbs/             # GENERADO (gitignored) — miniaturas
├── project-metadata.md     # este metadata (punto de entrada)
└── project-metadata/       # este metadata (detalles)
```

## Datos fuente (SÍ versionar como fuente)

| Ruta | Rol | Git |
|---|---|---|
| `_json/<carpeta>/<id>.json` | Un JSON por billete. Carpeta = ruta del país (`argentina`, `chile`, `usa`, `world`) según `countries.json[<code>].folder`. El id = nombre del archivo. | ✅ commiteado |
| `_json/countries.json` | Catálogo de países: clave = código corto (`cl`, `xk`…). Fuente única para nombre, bandera, carpeta y moneda vigente. | ✅ commiteado |
| `_json/currencies.json` | Catálogo de monedas: clave = código ISO 4217 (`CLP`…). Fuente de nombres, símbolo, subunidad, estado, etc. | ✅ commiteado |
| `_json/countries.md`, `_json/currencies.md` | Documentación humana de los catálogos. | ✅ commiteado |

## Generado (NO fuente — se regenera con el build)

| Ruta | Generado por | Git |
|---|---|---|
| `web/data/collection.json` | `_scripts/build_web.py:build` (consolida `_json/**/*.json`, ~1102 registros, ordenados) | ❌ gitignored |
| `web/data/issues.json` | `_scripts/build_web.py:build_issues_data` | ❌ gitignored |
| `web/data/thumbs_meta.json` | `_scripts/build_web.py:build` (firma de cada thumb: `mtime_ns-size`) | ❌ gitignored |
| `web/data/countries.json` | copia idéntica de `_json/countries.json` (sincronizada en el build para acceso directo desde la web) | ❌ gitignored |
| `web/data/currencies.json` | copia idéntica de `_json/currencies.json` (id.) | ❌ gitignored |
| `web/thumbs/<id>_A.jpg`, `<id>_B.jpg`, `<id>_F.jpg` | `_scripts/build_web.py:make_thumb` (magick, 360px, q80) | ❌ gitignored |
| `web/thumbs/x_<hash12>_A.jpg`, `_B.jpg` | miniaturas de carpetas huérfanas (ver `build_issues_data`) | ❌ gitignored |
| `etiquetas.pdf` | `_scripts/generar_etiquetas.py` (ReportLab) | ❌ gitignored |
| `web/data.json` | relicto antiguo, ya no lo produce el build | ❌ gitignored |

> `data/world-110m.json` (TopoJSON del mapa de `stats.html`) **no existe** en
> el repo ni lo produce el build: `web/stats.js:renderMap` intenta
> `data/world-110m.json` y cae al fallback del CDN
> `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`.

## Imágenes versionadas (SÍ fuente)

| Ruta | Rol | Git |
|---|---|---|
| `web/_flags/FLAG_*.jpg` | Banderas por país; se resuelven vía `countries.json[<code>].flag` (o alias en `build_web.py:FLAG_ALIASES`) | ✅ commiteado |
| `web/_originals/<id>/<id>_A.jpg` | Foto del frente (se sirve también vía `/api/upload_photo`) | ✅ commiteado |
| `web/_originals/<id>/<id>_B.jpg` | Foto del reverso | ✅ commiteado |
| `web/_FULL/<id>.webp` | Imagen compuesta front+info+bandera+back (WebP lossy q80, method=6; `generar_imagen.py:compose`); commiteada, regenerable | ✅ commiteado |

Son ~3500 archivos versionados bajo `web/` (verificado con `git ls-files`).

## Frontend (fuente)

| Ruta | Rol |
|---|---|
| `web/index.html` | Catálogo modo lectura. Assets: `styles.css`, `app.js`. |
| `web/index-edit.html` | Catálogo modo edición (mismo `app.js`; el modo se detecta por el path). Contiene el diálogo de billete nuevo (`#new-dialog`). |
| `web/app.js` | Toda la lógica: estado, filtros, render, edición, guardado, i18n, modales. |
| `web/styles.css` | Hoja de estilos compartida por las 4 páginas. |
| `web/stats.html` | Dashboard. Assets: `styles.css`, `stats.css`, `d3.min.js`, `topojson-client.min.js`, `stats.js`. |
| `web/stats.js` | KPIs, mapa mundial (D3 + TopoJSON), países faltantes, charts. IIFE aislada. |
| `web/stats.css` | Estilos propios del dashboard (KPIs, mapa, charts, modal). |
| `web/problemas.html` | Página de problemas. Assets: `styles.css`, `problemas.js` (no tiene CSS propio). |
| `web/problemas.js` | Renderiza `data/issues.json` por categorías + acciones correctivas vía API. |
| `web/d3.min.js`, `web/topojson-client.min.js` | Librerías vendor commiteadas (usadas solo por `stats.html`). |

## Scripts (`_scripts/`)

Ver `project-metadata/scripts.md`. Archivos: `build_web.py`, `serve_web.py`,
`util.py`, `generar_imagen.py`, `generar_etiquetas.py`, `validate_currencies.py`,
`fix_currency_errors.py`, `check_missing_flags.py`, `extract_serial.py`,
`extract_themes_from_jpgs.py`, `reset_verificados.py`, `update_countries_json.py`,
`git_clean_json.sh`. (`__pycache__/` es gitignored.)

## `.gitignore` (lista exacta)

```
.DS_Store
_INSTAGRAM/*
_folders.originals/
__pycache__/
.claude/
web/thumbs/
web/data/
scratchpad
etiquetas.pdf
digest.txt
web/data.json
.aider*
.agents/
.firebase/hosting.d2Vi.cache
aider
node_modules/
package-lock.json
package.json
template.html
requirement.md
```

Nota: `web/_originals/`, `web/_FULL/` y `web/_flags/` **no** aparecen en el
gitignore y **sí** están versionados (son parte de la fuente).
