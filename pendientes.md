# Pendientes: Rediseño de Mapa de Estadísticas (Cobertura de Moneda Vigente)

## Objetivo
Cambiar la lógica de coloración del mapa mundial en `web/stats.html` para que refleje la posesión de la **moneda vigente** del país, en lugar de cualquier billete del país.

## Lógica de Coloración
Para cada país en el mapa:
- **Verde**: Si la `moneda_vigente` (definida en `countries.json`) existe en la colección de billetes.
- **Rojo**: Si la `moneda_vigente` NO existe en la colección.
- **Gris**: Si hay un error (país no encontrado o no tiene `moneda_vigente` definida).

## Pasos Técnicos

### 1. Optimización de Datos (`web/stats.js`)
- En la función `processData()`, crear un `Set` llamado `ownedCurrencies` que contenga todas las monedas presentes en `allNotes`.
  - `ownedCurrencies = new Set(allNotes.map(n => n.moneda))`

### 2. Modificación de `renderMap()` (`web/stats.js`)
- Localizar la función de coloración (donde se asigna el atributo `fill`).
- Implementar la nueva lógica:
    1. Obtener el código del país desde la entidad de TopoJSON.
    2. Buscar el país en `allCountries`.
    3. Si el país existe y tiene `moneda_vigente`:
        - Verificar si `ownedCurrencies.has(country.moneda_vigente)`.
        - Retornar `#22c55e` (Verde) si es true, `#ef4444` (Rojo) si es false.
    4. De lo contrario, retornar `#94a3b8` (Gris).

### 3. Actualización de Interfaz y Leyenda
- Actualizar el texto de la leyenda del mapa para aclarar que el color indica la "Cobertura de Moneda Vigente".
- Asegurar que el tooltip del mapa muestre la moneda vigente del país para facilitar la verificación.

## Criterios de Aceptación
- [ ] Los países de la Eurozona se pintan verdes si tengo al menos un billete de EUR.
- [ ] Países donde solo tengo billetes antiguos (moneda no vigente) se pintan rojos.
- [ ] Países sin billetes en la colección se pintan rojos.
- [ ] Países no definidos en el JSON se pintan grises.
