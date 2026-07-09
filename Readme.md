
# Documentación del Proyecto: Colección de Billetes

Sistema local integral para la gestión, catalogación, enriquecimiento (mediante IA) y visualización de una colección numismática (billetes).

## a. Servidor Web
El proyecto incluye un servidor web local y una API mínima implementada en el archivo `_scripts/serve_web.py`.

- **Funcionalidad Principal**: Sirve la aplicación web estática (HTML/JS/CSS) alojada en la carpeta `web/` y los recursos gráficos (imágenes originales, vistas full y banderas).
- **API de Edición**: Proporciona endpoints REST (`POST /api/update`, `/api/upload_photo`, `/api/rename_folder`, `/api/create_json`, etc.) que permiten modificar los metadatos de los billetes directamente desde la interfaz web.
- **Manejo de Datos Seguros**: Realiza escrituras atómicas y controladas por candados (Threads/Locks) sobre la fuente de verdad (archivos JSON).
- **Seguridad**: Está diseñado para uso estrictamente local. Escucha únicamente en la interfaz `127.0.0.1` (localhost), restringe el acceso GET a una lista blanca de directorios (previniendo path traversal), y posee mecanismos contra CSRF y DNS-rebinding para proteger los archivos locales.

## b. Scripts

### b.1 `extract_serial.py`
- **Propósito**: Extrae automáticamente el número de serie de los billetes procesando sus imágenes.
- **Mecánica**: Analiza la colección de JSONs para buscar billetes que carezcan del número de serie registrado. Al encontrarlos, localiza las fotografías del anverso y reverso y consulta a un modelo visual local mediante **Ollama** (usando `gemma4:31b` o `llava:34b`). Extrae el número de manera pura y lo sobreescribe en el archivo JSON original del billete.

### b.2 `banknote_processor.py`
- **Propósito**: Ejecuta un flujo de inteligencia artificial (usando LangGraph) para analizar las imágenes de los billetes y extraer características semánticas o temáticas (personajes, edificaciones, flora, fauna, etc.).
- **Mecánica**: 
  1. Utiliza `ChatOllama` con el modelo `llama3.2-vision` para crear una descripción detallada de los elementos en las fotos.
  2. Ejecuta una búsqueda contextual en internet (vía `DuckDuckGoSearchRun`) para validar y nombrar correctamente dichos elementos.
  3. Usa el modelo `qwen3:32b` para estructurar la salida final de las etiquetas (ej. `personaje:bernardo_ohiggins`).
  4. Los resultados son emitidos hacia un archivo plano de catálogo (`banknotes_output_catalog.txt`).

### b.3 `generar_etiquetas.py`
- **Propósito**: Genera un documento PDF multipágina optimizado para impresión (hojas tamaño CARTA) que contiene tarjetas recortables o etiquetas para la exhibición física de cada billete.
- **Mecánica**: Usa utilidades CLI de `ImageMagick` (`magick` y `montage`) para renderizar paramétricamente el texto de la etiqueta (código Pick, País, Año, Denominación, firmas y bandera oficial). Soporta filtrado por país y por el estado de "verificado".

### b.4 Otros scripts relevantes
- **`_scripts/build_web.py`**: Actúa como el compilador estático del frontend. Consolida cientos de archivos JSON aislados en un solo índice (`collection.json`), construye y mapea las miniaturas (usando paralelización con `magick`) e identifica inconsistencias en la base de datos que emite a un `issues.json`.
- **`_scripts/generar_imagen.py`**: Compone una única imagen en formato vertical que une estéticamente el anverso del billete, una franja negra con datos de texto (país, denominación, pick), la bandera respectiva y el reverso. Exporta el archivo a la carpeta `_FULL/`.
- **`_scripts/vincular_originales.py`**: Script de mantenimiento y migración. Hace match inteligente (por nombre de país, valor, año y firmas) entre nombres descriptivos de carpetas antiguas y los nuevos identificadores estandarizados del proyecto, renombrando los directorios físicos y los archivos de foto correspondientes.
- **`_json/generate_json.py`**: Procesa un inventario maestro en formato `.tsv` e instancia y normaliza la arquitectura base creando un archivo JSON individual para cada fila/billete.

## c. Arquitectura

El sistema está diseñado bajo el principio de "archivos de texto e imágenes como base de datos" (File-based CMS), evitando dependencias como SQL. La arquitectura se define en tres capas:

1. **Capa de Almacenamiento (Fuente de Verdad)**:
   - Toda la información de cada billete está descentralizada en un archivo `.json` independiente bajo el directorio `_json/<pais>/<id>.json`.
   - Los assets visuales se distribuyen en las carpetas `_originals/` (fotos puras), `_FULL/` (composiciones) y `_flags/` (banderas de países).
2. **Capa de Integración y Transformación (`_scripts/`)**:
   - Compone la capa intermedia lógica encargada de generar vistas combinadas (`build_web.py`), manipular visuales (`generar_imagen.py`, `generar_etiquetas.py`) y aportar enriquecimiento de datos a través de IA local (`banknote_processor.py`, `extract_serial.py`).
3. **Capa de Presentación (Frontend y Servidor UI)**:
   - Un frontend tipo SPA construido con Vanilla JS y Pico.css, situado en el directorio `web/`.
   - Se alimenta del archivo unificado `web/data/collection.json`.
   - Interactúa a través del servidor asíncrono (`serve_web.py`) con capacidad para invocar reconstrucciones on-demand del propio sistema.

## d. Instalación y Uso (Pre-requisitos)

### Pre-requisitos de Sistema
- **Python**: Versión 3.8 o superior.
- **ImageMagick**: Debe estar instalado en el sistema y disponible en el `PATH` global (el comando `magick` y `identify` deben ser accesibles desde la terminal).
- **Ollama**: Motor para correr los LLMs localmente (requerido únicamente para los scripts b.1 y b.2). Debes haber descargado los siguientes modelos:
  - `ollama run llama3.2-vision`
  - `ollama run qwen3:32b`
  - `ollama run gemma4:31b` (o alternativamente ajustar a `llava` en el código).

### Pre-requisitos de Python (Paquetes)
Se recomienda instalar las dependencias en un entorno virtual (venv):

```bash
   pip install langchain-ollama langchain-core langchain-community langgraph pydantic duckduckgo-search ollama
   ``` 

**Modo de Uso**

Inicializar la plataforma web:
Posiciónate en la raíz del proyecto y ejecuta el servidor local indicando el puerto de tu elección (ej. 8000).

```bash
    python3 _scripts/serve_web.py 8000
  ```

**Acceso al Catálogo:**

Abre un navegador web y accede a: http://localhost:8000/web/

**Generación de etiquetas:**

```bash
python3 _scripts/generar_etiquetas.py --out etiquetas_coleccion.pdf
```

**Procesamiento de Inteligencia Artificial (Extracción y Análisis):**

Asegúrate de que Ollama esté en ejecución de fondo y corre los scripts independientemente.

```bash
python3 banknote_processor.py
python3 extract_serial.py
```




