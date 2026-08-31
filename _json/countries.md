# countries.json

## Propósito

`countries.json` es el catálogo de países, territorios y otras entidades geográficas utilizadas por el proyecto.

La estructura principal está organizada por una **clave interna** que identifica cada registro. Cuando existe un código ISO 3166-1 alpha-2, normalmente esta clave coincide con su versión en minúsculas. Sin embargo, el archivo también incluye entidades que no poseen un código ISO 3166-1 alpha-2 y para las cuales se utiliza un código interno propio.

Cada registro contiene la identificación de la entidad, sus nombres en español e inglés, su estado de vigencia, información relacionada con la moneda, la bandera y la carpeta utilizada por el proyecto.

## Estructura general

```json
{
  "cl": {
    "code": "cl",
    "iso_alpha2": "CL",
    "iso_numeric": "152",
    "name": {
      "es": "Chile",
      "en": "Chile"
    },
    "vigente": "si",
    "moneda_propia": "si",
    "flag_svg": "cl.svg",
    "folder": "chile"
  }
}
```

El archivo contiene actualmente 206 registros.

## Campos

### Clave de primer nivel

La clave utilizada directamente dentro del objeto raíz identifica el registro de forma interna.

Ejemplo:

```json
"cl": { ... }
```

Para entidades con código ISO 3166-1 alpha-2, normalmente corresponde al código ISO escrito en minúsculas:

```text
CL → cl
BR → br
US → us
```

No todas las entidades del archivo tienen un código ISO. En esos casos se utilizan claves internas, por ejemplo `bia`, `sct`, `nir` o `pmr`.

### `code`

Código interno utilizado por el proyecto para identificar la entidad.

Normalmente coincide con la clave de primer nivel:

```json
"code": "cl"
```

Este campo debe mantenerse consistente con la clave externa del registro.

### `iso_alpha2`

Código ISO 3166-1 alpha-2 de dos letras.

Los códigos ISO se almacenan en mayúsculas:

```json
"iso_alpha2": "CL"
```

Puede ser `null` para entidades que no disponen de un código ISO 3166-1 alpha-2 aplicable.

Ejemplos de entidades del archivo sin código ISO alpha-2 incluyen Biafra, Escocia, Irlanda del Norte y Transnistria.

### `iso_numeric`

Código numérico ISO 3166-1 de tres dígitos.

Se almacena como `string` para conservar los ceros iniciales:

```json
"iso_numeric": "152"
```

Puede ser `null` cuando la entidad no tiene un código numérico ISO aplicable.

### `name`

Objeto que contiene los nombres de la entidad en distintos idiomas.

Actualmente se utilizan:

- `es` — nombre en español.
- `en` — nombre en inglés.

Ejemplo:

```json
"name": {
  "es": "Chile",
  "en": "Chile"
}
```

Los nombres deben conservar la denominación utilizada por el proyecto.

### `vigente`

Indica si el registro corresponde a una entidad considerada vigente dentro del catálogo.

Valores utilizados actualmente:

```text
si
no
```

`si` indica una entidad vigente.

`no` se utiliza para entidades históricas o que ya no se consideran vigentes dentro del modelo. Por ejemplo, el archivo incluye Biafra y Vietnam del Sur como registros no vigentes.

### `moneda_propia`

Indica si la entidad dispone de una moneda propia según el criterio utilizado por el proyecto.

Valores utilizados:

```text
si
no
```

Este campo **no significa necesariamente que la entidad tenga una moneda exclusiva o que sea la única entidad que utiliza dicha moneda**. Debe interpretarse como una clasificación del catálogo y mantenerse coherente con `currencies.json`.

Por ejemplo, el archivo marca Groenlandia y Sáhara Occidental con:

```json
"moneda_propia": "no"
```

mientras que Chile aparece con:

```json
"moneda_propia": "si"
```

### `flag_svg`

Nombre del archivo de imagen utilizado para representar la bandera de la entidad.

Ejemplo:

```json
"flag_svg": "cl.svg"
```

El campo contiene el nombre del archivo, no una URL.

La ubicación efectiva de la imagen depende de la estructura de directorios del proyecto.

### `folder`

Indica la carpeta utilizada por el proyecto para agrupar los recursos de la entidad.

Ejemplos:

```json
"folder": "world"
```

```json
"folder": "chile"
```

Actualmente existen registros almacenados en `world` y carpetas específicas como `argentina`, `chile` y `usa`.

## Códigos ISO y entidades especiales

El archivo no está limitado estrictamente a los países soberanos con códigos ISO.

También contiene territorios, dependencias y otras entidades utilizadas por el proyecto, así como entidades históricas o con reconocimiento internacional limitado.

Por esta razón:

- `iso_alpha2` puede ser `null`.
- `iso_numeric` puede ser `null`.
- la clave de primer nivel puede no coincidir con un código ISO.
- `code` puede representar un identificador interno.

El código interno debe utilizarse como identificador primario dentro de los datasets del proyecto, mientras que los campos `iso_alpha2` e `iso_numeric` deben utilizarse como referencias estandarizadas cuando estén disponibles.

## Diferencia entre `code` e `iso_alpha2`

Estos campos tienen funciones diferentes:

| Campo | Propósito | Ejemplo |
|---|---|---|
| `code` | Identificador interno del proyecto | `cl` |
| `iso_alpha2` | Código ISO 3166-1 alpha-2 | `CL` |

En la mayoría de los países coinciden conceptualmente, pero no siempre.

Por ejemplo, una entidad puede tener:

```json
{
  "code": "sct",
  "iso_alpha2": null
}
```

porque el proyecto necesita representar Escocia aunque no utilice un código ISO 3166-1 alpha-2 propio.

## Diferencia entre `vigente` y `moneda_propia`

Son atributos independientes.

`vigente` describe si el pais existe actualmente.

`moneda_propia` describe si el registro está clasificado como una entidad con moneda propia o utiliza una moneda de otro pais.

Por lo tanto, pueden existir combinaciones como:

```text
vigente = no
moneda_propia = si
```

para entidades históricas que emitieron moneda propia.

No se debe inferir automáticamente un campo a partir del otro.

## Convenciones

Los códigos ISO alpha-2 deben almacenarse en mayúsculas.

Los códigos numéricos ISO deben almacenarse como `string` y no como número, para conservar ceros iniciales.

Los valores de `vigente` y `moneda_propia` utilizan actualmente `si` y `no`.

Los nombres se almacenan dentro del objeto `name`, utilizando códigos de idioma de dos letras.

Los nombres de los archivos de bandera contenidos en `flag_svg` deben coincidir exactamente con los archivos existentes en el proyecto.

Los valores de `folder` deben corresponder a directorios válidos dentro de la estructura del proyecto.

Los campos ISO pueden ser `null` cuando no exista un código estándar aplicable.

## Ejemplo de una entidad con código ISO

```json
"cl": {
  "code": "cl",
  "iso_alpha2": "CL",
  "iso_numeric": "152",
  "name": {
    "es": "Chile",
    "en": "Chile"
  },
  "vigente": "si",
  "moneda_propia": "si",
  "flag_svg": "cl.svg",
  "folder": "chile"
}
```

## Ejemplo de una entidad sin código ISO propio

```json
"sct": {
  "code": "sct",
  "iso_alpha2": null,
  "iso_numeric": null,
  "name": {
    "es": "Escocia",
    "en": "Scotland"
  },
  "vigente": "si",
  "moneda_propia": "si",
  "flag_svg": "gb-sct.svg",
  "folder": "world"
}
```

