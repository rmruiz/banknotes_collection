# 📚 Colección de Billetes  
**Sistema Local para Gestión y Enriquecimiento Automático de una Colección Numismática**  

## 🔍 Descripción General  
Este proyecto es un sistema integral basado en **archivos locales** (sin bases de datos SQL) que permite:  
- Catalogar billetes con metadatos estructurados.  
- Extraer información y temas automáticamente usando IA local (Ollama).  
- Generar imágenes consolidadas (`_FULL/`) y etiquetas imprimibles en PDF (`ReportLab`).  
- Visualizar, editar y buscar billetes mediante una interfaz web interactiva con API REST local.  

### Arquitectura  
1. **Capa de Almacenamiento**  
   - JSONs individuales por billete organizados en `_json/<categoría>/<id>.json` (ej. `chile/`, `argentina/`, `usa/`, `world/`).  
  - `_json/countries.json`: **Fuente única de verdad** para la información de países (código ISO, nombres en ES/EN, bandera asignada en `_flags/` y carpeta correspondiente).
   - `_json/countries.md`: Documentación detallada sobre la estructura del archivo countries.json
   - `_json/currencies.md`: Documentación detallada sobre la estructura del archivo currencies.json
  - `_json/currencies.json`: **Fuente única de verdad** para monedas, códigos ISO 4217, nombres, símbolos y estado histórico.
   - Fotos originales alojadas en `_originals/<id>/<id>_A.jpg` (frente) y `<id>_B.jpg` (reverso).  
2. **Capa de Procesamiento (`_scripts/`)**  
   - Scripts para compilación del catálogo, generación de miniaturas, imágenes consolidadas, etiquetas PDF y extracción de metadatos con IA.  
3. **Capa de Presentación (`web/`)**  
  - Frontend estático responsivo en `web/` con Vanilla JS y Pico.css, alimentado por `web/data/collection.json` y `web/data/currencies.json`.

---

## 🧰 Requisitos Previos  
Asegúrate de tener instalados:  
- [Python 3.8+](https://www.python.org/downloads/)  
- [ImageMagick](https://imagemagick.org) (para manipulación de imágenes y composición).  
- [ReportLab](https://www.reportlab.com/) (`pip install reportlab` para generación de PDFs).  
- [Ollama](https://ollama.com) (modelos LLM locales para tareas de visión e IA).  

---

## 🚀 Instalación y Configuración  

### Paso 1: Clonar el Repositorio  
```bash
git clone https://github.com/tu-usuario/banknotes_collection.git
cd banknotes_collection
```

### Paso 2: Instalar Dependencias de Python  
```bash
pip install reportlab beautifulsoup4 requests pydantic
```

### Paso 3: Iniciar Modelos Ollama (Opcional para IA)  
Ejemplo para descargar modelos locales:  
```bash
ollama pull gemma4:31b
ollama pull llava:34b
## 🖼️ Despliegue en Firebase

Para desplegar la aplicación web en Firebase Hosting:

1. Asegúrate de tener instalado Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Autentícate con tu cuenta de Firebase:
```bash
firebase login
```

3. Inicializa el proyecto Firebase (si aún no está configurado):
```bash
firebase init hosting
```

4. Despliega la aplicación:
```bash
firebase deploy --only hosting
```

> Nota: El directorio público para Firebase es `web/` según la configuración en `firebase.json`.
```

### Paso 4: Ejecutar el Servidor Web  
```bash
python3 _scripts/serve_web.py 8000
```
Accede a la aplicación en [http://localhost:8000/web/](http://localhost:8000/web/).

---

## 🛠️ Scripts Principales (`_scripts/`)

| Script | Propósito | Formas de Uso |  
|--------|-----------|---------------|  
| `_scripts/serve_web.py` | Servidor web local y API REST para visualización y administración (crear billetes, editar JSONs, verificar billetes y solicitar generación de imágenes `_FULL/`). | `python3 _scripts/serve_web.py 8000` |  
| `_scripts/build_web.py` | Genera el índice unificado `web/data/collection.json`, publica `web/data/currencies.json` y genera las miniaturas en `web/thumbs/`. | `python3 _scripts/build_web.py --force` |
| `_scripts/generar_imagen.py` | Genera la imagen consolidada `_FULL/<id>.jpg` (frente + info + bandera + reverso). Funciona en CLI y como servicio API del servidor web (`POST /api/generar_full`). | `python3 _scripts/generar_imagen.py` <br> `python3 _scripts/generar_imagen.py --filter chile` |  
| `_scripts/generar_etiquetas.py` | Genera un archivo PDF (`etiquetas.pdf`) imprimible en formato Carta con etiquetas físicas estructuradas para cada billete usando ReportLab. | `python3 _scripts/generar_etiquetas.py` <br> `python3 _scripts/generar_etiquetas.py --filter chile` |  
| `_scripts/extract_serial.py` | Extrae números de serie leyendo las imágenes de los billetes mediante IA local (Ollama). | `python3 _scripts/extract_serial.py` |  
| `_scripts/extract_themes_from_jpgs.py` | Analiza las imágenes con visión por IA (Ollama) para extraer temas visuales y descripciones. | `python3 _scripts/extract_themes_from_jpgs.py` |  
| `_scripts/reset_verificados.py` | Utility script para actualizar o reiniciar el campo `verificado` de los JSONs. | `python3 _scripts/reset_verificados.py` |  
| `_scripts/util.py` | Módulo de utilidades compartidas (normalización de texto, banderas e ID canónico `make_note_id`). | Importado por otros scripts. |  
| `_scripts/git_clean_json.sh` | Utility script para formatear/limpiar los JSONs antes de guardarlos en Git. | `./_scripts/git_clean_json.sh` |  

---

## 🌐 Gestión de Países (`_json/countries.json`)

- **`_json/countries.json`**: Centraliza los metadatos de todos los países catalogados. Cada entrada incluye:
  - `code`: Código interno (ej: `"cl"`, `"ar"`, `"us"`).
  - `iso_alpha2`: Código ISO 3166-1 alpha-2 (ej: `"CL"`, `"AR"`, `"US"`).
  - `name`: Nombre traducido en español (`es`) e inglés (`en`).
  - `flag`: Nombre del archivo de imagen de la bandera en `_flags/`.
  - `folder`: Carpeta en `_json/` donde se almacenan sus billetes (ej: `"chile"`, `"world"`).
- Las funciones de búsqueda y consulta se cargan directamente a través de [`_scripts/util.py`](file:///Users/rolando/git/banknotes_collection/_scripts/util.py).

## 💱 Gestión de Monedas (`_json/currencies.json`)

Los JSON individuales de billetes enlazan con el catálogo mediante
`denomination.iso4217`. El código identifica la moneda efectivamente emitida por
el billete, incluida la moneda histórica cuando corresponda. El campo
`denomination.currency` conserva el texto original de la fuente.

El build publica el catálogo como `web/data/currencies.json`. Los billetes sin
código o con una referencia inexistente siguen apareciendo usando el texto
original, pero se reportan en `issues.json` bajo `monedas_sin_vinculo`. Los casos
en que el código es válido pero puede no corresponder históricamente al billete
requieren revisión manual y no se corrigen automáticamente.

---

## 🧪 Lenguaje de Búsqueda Avanzado (QL)  
La barra de búsqueda de la aplicación web soporta consultas especializadas:  

### Ejemplos de Sintaxis  
| Consulta | Descripción |  
|----------|-------------|  
| `chile 1000` | Búsqueda global por "Chile" y "1000". |  
| `"banco central"` | Coincidencia exacta de frase. |  
| `temas:(bernardo ohiggins)` | Busca por la columna `temas`. |  
| `-pais:(argentina)` | Excluye billetes de Argentina. |  
| `anio>=1950` | Filtra por año ≥ 1950. |  

### Referencia de Columnas  
| Columna (UI) | Alias | Notas |  
|--------------|-------|-------|  
| **Pick** | `pick`, `id` | Identificador único. |  
| **País** | `pais`, `country` | Soporta búsquedas exactas con `""`. |  
| **Año** | `anio`, `year` | Operadores: `>=`, `<=`, `>`, `<`. |  

---

## 🖼️ Estructura del Proyecto  
```bash
banknotes_collection/
├── Readme.md                  # Documentación principal.
├── _FULL/                     # Imágenes consolidadas en alta resolución (<id>.jpg).
├── _flags/                    # Banderas de países en formato JPG/PNG.
├── _json/                     # Datos estructurados en JSON.
│   ├── countries.json         # Fuente única de verdad para datos de países.
│   ├── currencies.json        # Fuente única de verdad para monedas.
│   ├── countries.md           # Documentación detallada de countries.json
│   ├── currencies.md          # Documentación detallada de currencies.json
│   ├── argentina/             # JSONs de billetes de Argentina.
│   ├── chile/                 # JSONs de billetes de Chile.
│   ├── usa/                   # JSONs de billetes de EE.UU.
│   └── world/                 # JSONs de billetes del resto del mundo.
├── _originals/                # Fotografías originales por billete (_originals/<id>/<id>_A.jpg y <id>_B.jpg).
├── _scripts/                  # Scripts de automatización y servidor local.
│   ├── build_web.py          # Genera el índice web (collection.json) y miniaturas.
│   ├── serve_web.py          # Servidor web local + API REST de administración.
│   ├── generar_imagen.py     # Genera imágenes Full en _FULL/<id>.jpg (CLI y API).
│   ├── generar_etiquetas.py  # Genera etiquetas PDF imprimibles con ReportLab.
│   ├── extract_serial.py     # Extracción de números de serie mediante Ollama.
│   ├── extract_themes_from_jpgs.py # Extracción de temas con visión por IA.
│   ├── reset_verificados.py  # Script auxiliar para estado de verificación.
│   ├── util.py               # Convenios de ID y utilidades de normalización.
│   └── git_clean_json.sh     # Limpiador/formateador de archivos JSON.
└── web/                       # Aplicación web estática (HTML, JS, CSS).
    ├── index.html            # Página principal del catálogo numismático.
    ├── index-edit.html       # Página de edición.
    ├── problemas.html        # Página de seguimiento de problemas.
    ├── stats.html            # Página de estadísticas.
    ├── app.js                # Lógica principal de la aplicación web.
    ├── problemas.js          # Lógica para la página de problemas.
    ├── stats.js              # Lógica para la página de estadísticas.
    ├── styles.css            # Estilos personalizados (Pico.css).
    ├── stats.css             # Estilos específicos para estadísticas.
    └── data/                 # Datos generados para la aplicación web.
        ├── collection.json   # Índice unificado del catálogo.
        └── currencies.json   # Información de monedas.
```

---

## 🧩 Solución de Problemas Comunes  

### Error: `Ollama no conecta`  
- Asegúrate de que Ollama esté en ejecución:  
  ```bash
  ollama serve
  ```

### Error: `No se encontró 'reportlab'`  
- Instala ReportLab para la generación de etiquetas en PDF:  
  ```bash
  pip install reportlab
  ```

### Imágenes no se generan en `_FULL/`  
- Verifica que las fotos originales estén presentes en `_originals/<id>/` nombradas como `<id>_A.jpg` y `<id>_B.jpg`, y que la bandera correspondiente exista en `_flags/`.  

---

## 📜 Licencia  
Este proyecto está bajo la licencia MIT. Consulta el archivo `LICENSE` para más detalles.  

