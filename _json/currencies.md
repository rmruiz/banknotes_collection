# currencies.json

## Propósito

`currencies.json` es el catálogo central de monedas utilizadas por los países y territorios representados en el proyecto.

La estructura principal del archivo está organizada por el **código ISO 4217 alfabético de tres caracteres**. Por ejemplo, `MAD` corresponde al dírham marroquí.

Cada moneda contiene información de identificación, nombres en distintos idiomas, características monetarias, países y territorios donde se utiliza, información histórica y metadatos de verificación.

## Estructura general

```json
{
  "MAD": {
    "codigo": "MAD",
    "nombres": {
      "es": "Dírham marroquí",
      "en": "Moroccan dirham",
      "fr": "Dirham marocain",
      "ar": "درهم مغربي"
    },
    "nombre_corto": {
      "es": "Dírham",
      "en": "Dirham"
    },
    "simbolo": "د.م.",
    "iso_4217": {
      "numerico": "504",
      "decimales": 2
    },
    "subunidad": {
      "codigo": null,
      "nombres": {
        "es": "céntimo",
        "en": "centime",
        "fr": "centime"
      },
      "factor": 100
    },
    "tipo": "fiat",
    "estado": "circulacion",
    "uso": {
      "emisor": ["MA"],
      "curso_legal": ["MA"],
      "circulacion": ["MA", "EH"],
      "de_facto": ["EH"]
    },
    "banco_central": {
      "nombre": "Bank Al-Maghrib",
      "codigo": "BAM"
    },
    "historia": {
      "fecha_introduccion": "1965",
      "moneda_anterior": null,
      "moneda_sucesora": null
    },
    "notas": null
  }
}
```

## Campos

### `codigo`

Código ISO 4217 alfabético de tres caracteres.

El valor debe coincidir con la clave utilizada para identificar la moneda.

Ejemplo:

```json
"codigo": "MAD"
```

### `nombres`

Nombres oficiales de la moneda en distintos idiomas. Se debe incluir Español, Inglés e Idioma de origen (si corresponde)

Ejemplo:

```json
"nombres": {
  "es": "Dírham marroquí",
  "en": "Moroccan dirham",
  "origen": "درهم مغربي"
}
```

### `nombre_corto`

Nombre abreviado o nombre habitual de la moneda, en español e ingles.

```json
"nombre_corto": {
  "es": "Dírham",
  "en": "Dirham"
}
```

### `simbolo`

Símbolo monetario utilizado habitualmente.

```json
"simbolo": "د.م."
```

Cuando una moneda no tiene un símbolo único o ampliamente utilizado, el valor puede ser `null`.

### `iso_4217`

Información adicional definida por ISO 4217.

#### `iso_4217.numerico`

Código numérico de tres dígitos.

```json
"numerico": "504"
```

Se recomienda almacenarlo como `string` para conservar posibles ceros iniciales.

#### `iso_4217.decimales`

Número habitual de posiciones decimales utilizadas para expresar valores de la moneda.

```json
"decimales": 2
```

### `subunidad`

Información sobre la unidad fraccionaria de la moneda.

#### `subunidad.codigo`

Código o abreviatura de la subunidad, cuando exista.

#### `subunidad.nombres`

Nombre de la subunidad en distintos idiomas.

#### `subunidad.factor`

Número de subunidades equivalentes a una unidad principal.

Por ejemplo:

```json
"factor": 100
```

significa que 100 céntimos equivalen a 1 dírham.

### `estado`

Estado de la moneda.

Valores recomendados:

- `circulacion` — moneda actualmente en circulación.
- `fuera_de_circulacion` — moneda retirada, pero utilizada históricamente.
- `historica` — moneda histórica que ya no tiene circulación.
- `propuesta` — moneda propuesta pero no implementada.
- `no_emitida` — moneda definida oficialmente pero nunca emitida.

### `uso`

Describe la relación entre la moneda y los países o territorios.

Los valores contienen códigos ISO 3166-1 alpha-2 correspondientes a `countries.json`.

#### `uso.emisor`

Países o entidades que emiten oficialmente la moneda.

#### `uso.curso_legal`

Países o territorios donde la moneda tiene curso legal.

#### `uso.circulacion`

Países o territorios donde la moneda circula habitualmente, aunque su situación jurídica pueda ser diferente.

#### `uso.de_facto`

Países o territorios donde la moneda se utiliza de facto sin necesariamente constituir la moneda oficial.

Esta separación es importante para casos como territorios disputados, economías dolarizadas o países que utilizan una moneda extranjera.

### `banco_central`

Información sobre la autoridad monetaria responsable de la emisión.

#### `banco_central.nombre`

Nombre de la institución.

#### `banco_central.codigo`

Código interno o abreviatura utilizada para identificarla.

### `historia`

Información básica sobre la evolución de la moneda.

#### `historia.fecha_introduccion`

Fecha o año en que la moneda fue introducida.

Puede expresarse como:

```json
"1965"
```

o, cuando se disponga del dato completo:

```json
"1965-06-17"
```

#### `historia.moneda_anterior`

Código de la moneda que fue reemplazada.

Debe corresponder a otra clave de `currencies.json` cuando dicha moneda esté incluida en el catálogo.

#### `historia.moneda_sucesora`

Código de la moneda que posteriormente reemplazó a la moneda actual.

Es especialmente útil para monedas históricas.

### `notas`

Campo libre para observaciones relevantes que no puedan representarse mediante los demás campos.

Puede ser `null` cuando no existan observaciones.

## Convenciones

Los nombres de campos deben utilizar `snake_case`.

Los códigos ISO deben utilizar mayúsculas.

Los códigos de países utilizados dentro de `uso` deben corresponder a los códigos definidos en `countries.json`.

Los códigos de monedas utilizados como referencias históricas deben corresponder a claves existentes en `currencies.json`, salvo que exista una razón documentada para utilizar un código externo.

Las fechas deben utilizar el formato ISO 8601.

Los valores desconocidos deben representarse como `null` cuando el campo sea aplicable pero la información todavía no esté disponible. No debe utilizarse texto como `"unknown"`, `"N/A"` o `"-"` para representar ausencia de datos.
