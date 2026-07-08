# Procesador de la colección de billetes

Este proyecto cataloga una colección de billetes en archivos **JSON** (uno por tipo de billete) y genera, a partir de ellos, una **imagen consolidada** (frente + panel de info + bandera + reverso) lista para publicar.

Reemplaza el flujo antiguo de scripts de shell (`_step0`…`_step4`) por dos scripts de Python manejados por los JSON.

---

## Requisitos

```bash
brew install imagemagick        # 'magick' e 'identify'
brew install git-lfs && git lfs install
python3                         # incluido en macOS
```

**Fuentes de ImageMagick** (solo la primera vez en un Mac nuevo — necesario para que `magick` encuentre Verdana):
```bash
mkdir -p ~/.magick
cp _step0_config/imagick_type_gen /tmp/script.pl && chmod +x /tmp/script.pl
/tmp/script.pl > ~/.magick/type.xml
# si faltan fuentes del sistema:
# find /System/Library/Fonts/Supplemental/ -type f -name '*.*' | /tmp/script.pl -f - > ~/.magick/type.xml
```

---

## Modelo de datos (JSON)

Un JSON por **tipo** de billete. Si hay varios ejemplares físicos del mismo tipo, van en `specimens[]`.

- **Ubicación:** `_json/chile/`, `_json/argentina/`, `_json/usa/` y `_json/world/` (todos los demás países).
- **`id` / nombre de archivo:** abreviación del país + pick number, en minúsculas, sin `-`, sin espacios y **sin puntos**. Ej.: Chile `P-15b.7` → `cl-p15b7.json`. Los ids son únicos globalmente (llevan el país adentro), así que no colisionan dentro de `world/`.

```json
{
  "id": "cl-p15b7",
  "pick_number": "P-15b.7",
  "country": { "en": "Chile", "es": "Chile" },
  "denomination": {
    "value": 1, "currency": "Peso", "full": "1 Peso",
    "subtype": "", "alternatives": []
  },
  "year": 1919,
  "signatures": ["Zañartu", "Magallanes"],
  "themes": [],
  "colnect": { "url": "https://colnect.com/...", "group": "..." },
  "commemorative": false,
  "overprint": false,
  "notes": { "serie": "", "bank": "", "zone": "", "vigencia": "", "obs": "" },
  "specimens": [
    { "serial_number": "", "condition": "" }
  ]
}
```

**Las rutas de imágenes NO se guardan en el JSON**: se derivan del `id` por convención (el disco es la fuente de verdad):

| Imagen | Ruta |
|---|---|
| Front | `_originals/<id>/<id>_A.jpg` |
| Back | `_originals/<id>/<id>_B.jpg` |
| Consolidada | `_FULL/<id>.jpg` |

(Si algún día hay 2+ ejemplares del mismo tipo: el segundo usa `<id>_A2.jpg` / `<id>_B2.jpg`.)

Para agregar fotos a un billete basta con dejar los archivos en `_originals/<id>/` con esos nombres y presionar el botón **"🔄 Recargar datos"** de la web (o correr `python3 _scripts/build_web.py`) — aparecen sin tocar el JSON.

> Importante: la web no lee el disco directamente, lee `web/data/collection.json` (generado). Cualquier cambio hecho a mano (fotos o JSON: agregar, renombrar, borrar, editar) requiere rebuild. Hay dos formas: el botón **«🔄 Recargar datos»**, o **reiniciar `serve_web.py`** (hace rebuild automático al arrancar).

Reglas de derivación al importar (ver más abajo): `1.000`→1000, `1/2`→0.5, `2 1/2`→2.5, `N/A`/`… MM`→null · `overprint:true` si obs trae "Remarcado" · `commemorative:true` si hay aniversario/fantasía/conmemorativo · homóglifos cirílicos en el pick se pasan a latino.

---

## Estructura de carpetas

```
_json/
  chile/  argentina/  usa/  world/   # los JSON (uno por billete)
  country_map.py                     # país (es) -> abreviación del id
  generate_json.py                   # importa TSV -> JSON
  _import_world.tsv                  # volcado maestro del resto del mundo
_originals/<id>/<id>_A.jpg           # frente (front)
_originals/<id>/<id>_B.jpg           # reverso (back)
_flags/FLAG_<PAIS>.jpg               # banderas
_FULL/<id>.jpg                       # imagen consolidada final (salida)
_scripts/
  vincular_originales.py             # enlaza JSON <-> fotos y escribe rutas
  generar_imagen.py                  # genera la imagen consolidada
```

Todos los `.jpg` (`_FULL`, `_originals`, `_flags`, `_jpg_examples`) están en **Git LFS** vía `.gitattributes`.

---

## Flujo de trabajo

### 1. Importar datos → JSON
Los datos vienen de una tabla (TSV) exportada, con columnas que varían por país (se normalizan por nombre de columna).

```bash
cd _json
python3 generate_json.py chile          # lee chile/_source.tsv
python3 generate_json.py argentina      # lee argentina/_source.tsv
python3 generate_json.py --master _import_world.tsv   # el resto -> world/
```
Genera un JSON por fila. Para un país nuevo: agregar su abreviación en `country_map.py`.

### 2. Vincular fotos (solo para migrar carpetas con nombre viejo)
Enlaza cada JSON con su carpeta de fotos con nombre antiguo y la renombra a `_originals/<id>/` (las rutas no se escriben en los JSON: se derivan del id).

```bash
cd ..
python3 _scripts/vincular_originales.py            # DRY-RUN: solo reporta
python3 _scripts/vincular_originales.py --apply    # ejecuta
```
Escribe `_json/_link_report.tsv`. Los casos ambiguos / sin match quedan **intactos** para revisión manual. Para fotos nuevas no se necesita: basta nombrar la carpeta directamente `_originals/<id>/`.

### 3. Generar la imagen consolidada
Lee las rutas de cada JSON y compone `_FULL/<id>.jpg`.

```bash
python3 _scripts/generar_imagen.py                 # interactivo
python3 _scripts/generar_imagen.py --filter chile  # solo ids/carpetas que contengan 'chile'
python3 _scripts/generar_imagen.py --overwrite-all # sobrescribe sin preguntar
python3 _scripts/generar_imagen.py --skip-existing # salta los ya generados
```
- Si `_FULL/<id>.jpg` ya existe pregunta: **s** sobrescribir · **S** sobrescribir todos · **n** saltar · **N** saltar todos.
- Verifica bandera + front + back; si falta alguno lo informa y salta.
- **Nunca borra imágenes**; solo (re)escribe en `_FULL/` cuando corresponde.

---

## Composición de la imagen (`_FULL/<id>.jpg`)

Apilado vertical sobre fondo negro (equivalente al antiguo `_append_text.sh`):

1. **Frente** (`_A.jpg`) — esquinas redondeadas + borde negro.
2. **Panel de info** — texto alineado a la izquierda:
   - línea 1: país (Verdana 120)
   - línea 2: `denominación - año` (Verdana 80)
   - línea 3: firmas unidas, si existen (Verdana 60)
   - línea 4: `banknotes.cl@gmail.com` (Verdana 30)
   - **bandera** a la derecha, con borde en capas y sombra, al alto del texto.
3. **Reverso** (`_B.jpg`) — esquinas redondeadas + borde negro.

Salida redimensionada a **1080×1350**.

La bandera se resuelve por nombre normalizado del país contra `_flags/FLAG_*.jpg`.

---

## Web de visualización

Sitio estático para explorar la colección (ver diseño en `plan_web.md`): buscador sobre todos los campos (insensible a acentos), tabla paginada con miniaturas Front/Back/Full (celda vacía = foto faltante) y modal con la imagen a tamaño completo. Responsive para celular.

```bash
# 1. build: consolida los JSON y genera miniaturas (incremental; --force para regenerar)
python3 _scripts/build_web.py

# 2. servir (web + API de edición)
python3 _scripts/serve_web.py 8000
# -> http://localhost:8000/web/
```

Generados (no editar a mano): `web/data/collection.json` y `web/thumbs/*.jpg`. Volver a correr el build cada vez que cambien los JSON o las fotos.

### Página de problemas
El ícono **⚠️ N** (esquina superior derecha) lleva a `problemas.html`, que lista inconsistencias de la colección por categoría. Por ahora: **carpetas de `_originals/` sin JSON asociado** (nombre que no coincide con ningún id). Los datos salen de `web/data/issues.json`, regenerado en cada build / botón «Recargar datos». La página es genérica: agregar una categoría nueva = agregarla en `build_issues()` de `build_web.py`.

### Edición desde la web
Requiere servir con `serve_web.py` (con `python3 -m http.server` la web queda solo-lectura y avisa al intentar guardar).

- **Verificado**: checkbox en la fila.
- **País, Monto, Moneda, Moneda Full y Año**: click en la celda → aparece un input → **Enter guarda**, **Esc o click fuera cancela**.
- Al editar **País** el servidor actualiza también `country.en` (mapa ES→EN) y la bandera.

Los cambios se guardan vía `POST /api/update {id, field, value}` en el JSON del billete (fuente de verdad) y regeneran su registro en `collection.json` (búsqueda y bandera incluidas).

Seguridad del API: escucha solo en `127.0.0.1`, valida el id contra los JSON existentes (sin path traversal), whitelist de campos con validación de tipo/valor (año 1000–2100, monto numérico ≥ 0, país no vacío), body ≤ 4 KB y escritura atómica.

---

## Pendientes por revisar

La página **⚠️ Problemas** de la web (`web/problemas.html`) es la fuente viva de pendientes: carpetas de fotos sin vincular, billetes sin pick válido, picks con formato raro y billetes sin link de Colnect — todos con acciones de corrección en línea.
