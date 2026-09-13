# filters.json

## Propósito

`filters.json` almacena las "vistas" guardadas del catálogo de billetes. Cada
filtro (o vista) combina dos cosas:

1. Un conjunto de **columnas visibles** (`cols`).
2. Una **query de la barra de búsqueda** (`query`) que se aplica al catálogo
   mediante la search bar.

Se crea desde la UI (selector "Filtros" del toolbar del catálogo, opción
"Nuevo…") y se aplica con un click al seleccionar su nombre en el mismo
selector. El archivo es la fuente de verdad; `web/data/filters.json` es una
copia de solo lectura para el navegador (ver "Cómo lo consume la web").

## Estructura general

```json
{
  "version": 1,
  "filters": [
    {
      "name": "Chile UNC",
      "query": "pais:Chile condicion:UNC",
      "cols": ["pais", "denominacion", "anio", "precio", "front", "back", "full", "colnect", "numista", "verif"]
    }
  ]
}
```

## Campos

### `version`

Entero que indica la versión del esquema. Actualmente `1`. Los lectores lo
ignoran y solo leen `filters`; sirve para permitir evoluciones futuras del
formato.

### `filters`

Array de filtros. Puede estar vacío (semilla inicial:
`{ "version": 1, "filters": [] }`).

Cada entrada es un objeto con exactamente estos tres campos:

### `filters[].name`

Nombre del filtro (texto libre, sin espacios al inicio/final).

- Debe ser **único** dentro del archivo: es la clave del upsert. Al guardar
  desde la UI con un nombre ya existente se **sobrescribe** el filtro
  anterior (comparación exacta, sensible a mayúsculas).
- Límite: 60 caracteres.

### `filters[].query`

Query de la search bar tal como la escribe el usuario (p. ej.
`pais:Chile condicion:UNC`, `anio>=1900`, `"texto exacto"`). Es el mismo
lenguaje que documenta la barra de búsqueda del catálogo.

- `""` (cadena vacía) significa "sin filtro de búsqueda".
- Límite: 500 caracteres.

### `filters[].cols`

Array con las **claves** de las columnas visibles al grabar el filtro
(mismas claves que el menú "Columnas" del catálogo; p. ej. `pais`, `precio`,
`denominacion`, `anio`, `front`, `back`, `full`, `colnect`, `numista`,
`verif`, …).

- No incluye las columnas fijas (pick, imágenes estructurales, verificado
  cuando no está entre las seleccionables): solo claves del conjunto
  seleccionable.
- Límite: 100 claves de hasta 30 caracteres cada una.
- Al aplicar, el cliente descarta las claves que ya no existan (columnas
  renombradas/eliminadas en el futuro), de modo que un filtro viejo no se
  rompe.

## Reglas

- **Upsert por nombre**: no hay operación de "actualizar" aparte de guardar
  con un nombre existente, que reemplaza la entrada.
- **No se elimina desde la UI**: no hay botón de borrar; si un filtro deja de
  ser útil puede editarse/borrarse a mano en este archivo (luego de un build
  o recarga de la web).
- **Edición manual permitida**: es la fuente de verdad. Editar este archivo a
  mano y servir la web (o correr el build) refleja los cambios.
- Escritura atómica y con lock (`tmp + os.replace`), igual que el resto de
  `_json/`.

## Cómo lo consume la web
- El navegador **nunca** lee este archivo directamente: lee la copia
  `web/data/filters.json` (gitignored).
- Dos vías mantienen la copia sincronizada (patrón idéntico a
  `countries.json`/`currencies.json`):
  1. **Build** (`_scripts/build_web.py:build`): si existe
     `_json/filters.json`, lo copia a `web/data/filters.json`.
  2. **API** (`_scripts/serve_web.py:_handle_save_filter`, endpoint
     `POST /api/save_filter`): al guardar un filtro desde la UI, escribe
     primero la fuente y copia el **mismo texto** a `web/data/`, por lo que
     el build posterior queda idempotente.
