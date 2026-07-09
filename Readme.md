# Documentación del Proyecto: Colección de Billetes

Sistema local integral para la gestión, catalogación, enriquecimiento (mediante IA) y visualización de una colección numismática (billetes).

## b. Scripts

### b.1 `extract_serial.py`
- **Propósito**: Extrae automáticamente el número de serie de los billetes procesando sus imágenes.
- **Mecánica**: Analiza la colección de JSONs para buscar billetes que carezcan del número de serie registrado. Al encontrarlos, localiza las fotografías del anverso y reverso y consulta a un modelo visual local mediante **Ollama** (usando `gemma4:31b` o `llava:34b`). Extrae el número de manera pura y lo sobreescribe en el archivo JSON original del billete.

### b.2 `banknote_processor.py`
- **Propósito**: Ejecuta un flujo de inteligencia artificial (usando LangGraph) para analizar las imágenes de los billetes y extraer características semánticas o temáticas (personajes, edificaciones, flora, fauna, etc.).
- **Mecánica**: 
  1. Utiliza `ChatOllama` con el modelo `llama3.2-vision` para crear una descripción detallada de los elementos en las fotos.
  2. Ejecuta una búsqueda contextual en internet (vía `DuckDuckGoSearchRun`) para validar y nombrar correctamente dichos elementos.
  3. Usa el modelo `qwen3:32b` para estructurar la salida final de las etiquetas.

### b.3 `generar_etiquetas.py`
- **Propósito**: Genera un documento PDF multipágina optimizado para impresión que contiene tarjetas recortables o etiquetas para la exhibición física de cada billete.

### b.4 Otros scripts relevantes
- **`_scripts/build_web.py`**: Actúa como el compilador estático del frontend. Consolida cientos de archivos JSON aislados en un solo índice (`collection.json`), construye y mapea las miniaturas (usando paralelización con `magick`) e identifica inconsistencias en la base de datos que emite a un `issues.json`.
- **`_scripts/generar_imagen.py`**: Compone una única imagen en formato vertical que une estéticamente el anverso del billete, una franja negra con datos de texto, la bandera respectiva y el reverso. Exporta el archivo a la carpeta `_FULL/`.
- **`_scripts/vincular_originales.py`**: Script de mantenimiento y migración. Hace match inteligente entre nombres descriptivos de carpetas antiguas y los nuevos identificadores estandarizados del proyecto.
- **`_json/generate_json.py`**: Procesa un inventario maestro en formato `.tsv` e instancia y normaliza la arquitectura base creando un archivo JSON individual para cada fila/billete.

## c. Arquitectura

El sistema está diseñado bajo el principio de "archivos de texto e imágenes como base de datos" (File-based CMS), evitando dependencias como SQL. La arquitectura se define en tres capas:

1. **Capa de Almacenamiento**: Toda la información de cada billete está descentralizada en un archivo `.json` independiente.
2. **Capa de Integración y Transformación (`_scripts/`)**: Encargada de generar vistas combinadas, manipular visuales y aportar enriquecimiento de datos a través de IA local.
3. **Capa de Presentación (Frontend y Servidor UI)**: Un frontend tipo SPA construido con Vanilla JS y Pico.css, situado en el directorio `web/`.

## d. Instalación y Uso

### Pre-requisitos de Sistema
- **Python 3.8+**, **ImageMagick**, **Ollama**.

**Modo de Uso**

Inicializar la plataforma web:
```bash
python3 _scripts/serve_web.py 8000
```
Acceso: `http://localhost:8000/web/`

---

## e. Búsqueda Avanzada (Lenguaje de Consultas)

La barra de búsqueda principal de la interfaz web soporta un lenguaje de consultas (QL) para realizar filtrados precisos. Por defecto, las búsquedas ignoran mayúsculas y acentos.

### Sintaxis Soportada

* **Búsqueda Global:** Palabras sueltas buscan coincidencias parciales en todos los datos.
  * `chile 1000`
* **Búsqueda Exacta:** Usa comillas dobles `""` para buscar una frase idéntica.
  * `"banco central"`
* **Búsqueda por Columna:** `columna:(valor)`.
  * `temas:(bernardo ohiggins)`
  * `country:(estados unidos)`
* **Campos Vacíos / Coincidencia Exacta:** Combina la sintaxis de columna con las comillas.
  * `colnect:("")` -> Billetes sin link de Colnect.
  * `serie:("")` -> Billetes sin número de serie registrado.
  * `pais:("chile")` -> Busca exactamente la palabra "chile" en la columna país.
* **Exclusión (Negación):** Antepone un guion `-` a cualquier término para excluir.
  * `-fantasia` -> Oculta billetes con la palabra "fantasía".
  * `-pais:(argentina)` -> Oculta todos los billetes de Argentina.
* **Operadores Relacionales:** Útiles para campos numéricos (`anio`, `monto`).
  * `anio>=1950`
  * `monto<1000`

### Referencia de Columnas

| Columna (UI) | Palabras Clave (Alias) | Nota de Uso |
| :--- | :--- | :--- |
| **Pick** | `pick` | |
| **ID** | `id` | |
| **País** | `pais`, `country` | |
| **Monto** | `monto`, `valor`, `value` | Soporta `>` `<` `>=` `<=` |
| **Moneda** | `moneda`, `currency` | |
| **Moneda Full** | `denominacion` | |
| **Subtipo** | `subtipo`, `subtype` | |
| **Otra moneda**| `alternativas` | |
| **Año** | `anio`, `year` | Soporta `>` `<` `>=` `<=` |
| **Firmas** | `firmas` | |
| **Temas** | `temas`, `themes` | |
| **Vigencia** | `vigencia` | |
| **Observaciones**| `obs` | |
| **Serie** | `serie` | |
| **Banco** | `banco`, `bank` | |
| **Zona** | `zona`, `zone` | |
| **N° de serie** | `serial` | |
| **Condición** | `condicion`, `condition` | |
| **Grupo Colnect**| `grupo`, `colnect_group` | |
| **Conmemorativo**| `conmemorativo` | Usa `:si` / `:no` |
| **Remarcado** | `remarcado` | Usa `:si` / `:no` |
| **Front** | `front`, `thumb_a`, `img_a` | Usa `:("")` para falta |
| **Back** | `back`, `thumb_b`, `img_b` | Usa `:("")` para falta |
| **Full** | `full`, `thumb_f` | Usa `:("")` para falta |
| **Colnect** | `colnect` | |
| **Verificado** | `verif`, `verificado` | Usa `:si` / `:no` |

