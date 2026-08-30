# Project Metadata — banknotes_collection

Metadata orientada a LLMs sobre el proyecto **banknotes_collection** (catálogo
personal de billetes, en español). Este documento es el punto de entrada; los
detalles están en los archivos de `project-metadata/`.

> Regla de oro: **`_json/` es la única fuente de verdad**. Todo lo que se
> genere a partir de ella (`web/data/`, `web/thumbs/`, y los `_FULL/*.jpg`
> compuestos) puede regenerarse con `_scripts/build_web.py` y nunca debe
> tratarse como fuente.

## Qué es el proyecto

Un catálogo de billetes con:

1. **Datos fuente** en `_json/` (un JSON por billete + catálogos de referencia
   de países y monedas).
2. **Generador estático** (`_scripts/build_web.py`) que consolida los JSON en
   `web/data/collection.json`, genera miniaturas (`web/thumbs/`) y detecta
   problemas (`web/data/issues.json`).
3. **Servidor local** (`_scripts/serve_web.py`) que sirve la web y expone una
   API mínima de edición que persiste de vuelta en `_json/`.
4. **Frontend** estático sin dependencias de build (`web/`): catálogo
   (`index.html` / `index-edit.html`), estadísticas (`stats.html`, D3 +
   TopoJSON) y página de problemas (`problemas.html`).

## Índice de este metadata

| Archivo | Contenido |
|---|---|
| `project-metadata/files.md` | Inventario completo: qué archivos son fuente, generados, commiteados o gitignored |
| `project-metadata/data.md` | Esquemas exactos: JSON de billete, `countries.json`, `currencies.json`, registro de `collection.json`, `issues.json`, convenios de id/rutas |
| `project-metadata/data-flows.md` | Ciclos de vida de datos paso a paso, con notación `{archivo}:{función}` |
| `project-metadata/architecture.md` | Capas, modelo de seguridad, concurrencia, cacheo, dependencias externas |
| `project-metadata/web.md` | Comportamiento página a página: estado, lenguaje de filtros, edición, i18n, localStorage |
| `project-metadata/scripts.md` | Todos los scripts de `_scripts/`: propósito, entrada, efectos, dependencias |
| `project-metadata/features.md` | Features de usuario trazadas a su implementación `{archivo}:{función}` |

## Invariantes que hay que respetar

- **Fuente de verdad**: `_json/*/*.json` (billetes) + `_json/countries.json`
  y `_json/currencies.json` (catálogos). Las copias en `web/data/` son
  sincronizaciones de solo lectura para el navegador.
- **Generado / gitignored (NO fuente)**: `web/data/` (collection.json,
  issues.json, thumbs_meta.json, copias de países/monedas), `web/thumbs/`,
  `etiquetas.pdf`, `web/data.json` (relicto antiguo). Ver
  `project-metadata/files.md`.
- **Imágenes commiteadas (SÍ fuente)**: `web/_flags/` (banderas),
  `web/_originals/<id>/` (fotos front/back) y `web/_FULL/<id>.jpg` (imagen
  compuesta) están versionados en git.
- **Convención de id**: `<abreviatura-país>-<pick sin separadores, minúsculas>`
  (`util.py:make_note_id`). El id ES el nombre del archivo JSON, de la carpeta
  de fotos y de la imagen full. Cambiar el pick implica renombrar en cascada
  (`serve_web.py:_handle_change_pick`).
- **Rutas por convención** (no se guardan en el JSON):
  `web/_originals/<id>/<id>_A.jpg` (front), `web/_originals/<id>/<id>_B.jpg`
  (back), `web/_FULL/<id>.jpg`, `web/_flags/FLAG_*.jpg`,
  `web/thumbs/<id>_A.jpg` / `_B.jpg` / `_F.jpg`.
- **Escrituras atómicas + lock**: todo lo que se modifica en disco usa
  `tmp + os.replace` y `WRITE_LOCK` (un solo escritor a la vez).
- **La web siempre es consistente después de un build**: `serve_web.py`
  arranca con un `build_web.build()` completo y el endpoint `/api/rebuild` lo
  re-ejecuta bajo demanda.

## Comandos esenciales

```bash
python3 _scripts/build_web.py            # incremental (solo thumbs nuevas/cambiadas)
python3 _scripts/build_web.py --force    # regenera todas las miniaturas
python3 _scripts/serve_web.py [puerto]   # default 8000 -> http://localhost:8000/
```

Dependencias externas en uso: Python 3 (stdlib), **ImageMagick** (`magick`)
para miniaturas/composición, y en helpers opcionales: `ollama`, `reportlab`,
`requests`/`bs4`/`langchain` (extraction vía LLM).

## Cómo navegar (guía rápida para LLMs)

- ¿Dónde se guarda un dato? → `project-metadata/data.md`
- ¿Qué hace un endpoint o una función? → `project-metadata/data-flows.md`
- ¿Qué es generado y qué no? → `project-metadata/files.md`
- ¿Cómo se edita desde la UI? → `project-metadata/web.md` (sección Modo edición)
- ¿Para qué sirve cada script? → `project-metadata/scripts.md`
- ¿Dónde implementa la web cada feature? → `project-metadata/features.md`

Todas las referencias de este metadata usan la notación `{archivo}:{función}`
con nombres reales y verificados contra el código (p. ej.
`_scripts/serve_web.py:_handle_update`).
