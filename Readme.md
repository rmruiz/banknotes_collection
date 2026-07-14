# 📚 Colección de Billetes  
**Sistema Local para Gestión y Enriquecimiento Automático de una Colección Numismática**  

## 🔍 Descripción General  
Este proyecto es un sistema integral basado en **archivos locales** (sin bases de datos SQL) que permite:  
- Catalogar billetes con metadatos estructurados.  
- Extraer información automáticamente usando IA local.  
- Visualizar y buscar billetes mediante una interfaz web interactiva.  

### Arquitectura  
1. **Capa de Almacenamiento**  
   - JSON individuales por billete en `_json/<país>/<id>.json`.  
2. **Capa de Procesamiento**  
   - Scripts para análisis visual (IA), generación de miniaturas y sincronización de datos.  
3. **Capa de Presentación**  
   - Frontend estático en `web/` con Vanilla JS y Pico.css.  

---

## 🧰 Requisitos Previos  
Asegúrate de tener instalados:  
- [Python 3.8+](https://www.python.org/downloads/)  
- [ImageMagick](https://imagemagick.org) (para miniaturas y generación de imágenes).  
- [Ollama](https://ollama.com) (modelos LLM locales como `gemma4:31b`, `llava:34b`).  

---

## 🚀 Instalación y Configuración  

### Paso 1: Clonar el Repositorio  
```bash
git clone https://github.com/tu-usuario/banknotes_collection.git
cd banknotes_collection
```

### Paso 2: Instalar Dependencias de Python  
```bash
pip install langchain-ollama langgraph pydantic langchain-community reportlab beautifulsoup4 requests
```

### Paso 3: Iniciar Modelos Ollama (Opcional)  
Ejemplo para descargar un modelo:  
```bash
ollama pull gemma4:31b
ollama pull llava:34b
ollama pull qwen3:32b
```

### Paso 4: Ejecutar el Servidor Web  
```bash
python3 _scripts/serve_web.py 8000
```
Accede a la aplicación en [http://localhost:8000/web/](http://localhost:8000/web/).

---

## 🛠️ Scripts Principales  

### `extract_serial.py`  
- **Propósito**: Extrae el número de serie de billetes faltantes.  
- **Cómo usarlo**:  
  ```bash
  python3 extract_serial.py
  ```
- **Funcionamiento**:  
  - Analiza JSONs sin `serial_number`.  
  - Usa Ollama (modelo `gemma4:31b`) para leer imágenes en `_originals/<id>/`.  

---

### `banknote_processor.py`  
- **Propósito**: Genera etiquetas temáticas usando IA.  
- **Cómo usarlo**:  
  ```bash
  python3 banknote_processor.py
  ```
- **Flujo de Trabajo**:  
  1. Analiza imágenes con `llama3.2-vision`.  
  2. Busca contexto adicional en DuckDuckGo.  
  3. Extrae etiquetas estructuradas con `qwen3:32b`.  

---

### Otros Scripts Relevantes  
| Script | Propósito | Cómo Usarlo |  
|--------|-----------|-------------|  
| `_scripts/build_web.py` | Genera el índice `collection.json` y miniaturas. | `python3 _scripts/build_web.py --force` |  
| `_scripts/generar_imagen.py` | Crea imágenes Full (frente + info + bandera + reverso). | `python3 _scripts/generar_imagen.py` |  
| `_json/generate_json.py` | Genera JSONs desde un TSV maestro. | `python3 _json/generate_json.py --master inventario.tsv` |  

---

## 🧪 Lenguaje de Búsqueda Avanzado (QL)  
La barra de búsqueda soporta consultas especializadas:  

### Sintaxis Ejemplos  
| Consulta | Descripción |  
|----------|-------------|  
| `chile 1000` | Búsqueda global por "Chile" y "1000". |  
| `"banco central"` | Coincidencia exacta de frase. |  
| `temas:(bernardo ohiggins)` | Busca por columna `temas`. |  
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
├── Readme.md                  # Este archivo.
├── banknote_processor.py      # Análisis temático con IA.
├── _json/                      # JSONs por billete (estructura: país/id.json).
│   ├── country_map.py         # Mapeo de nombres de países a códigos ISO.
│   └── generate_json.py       # Genera JSONs desde TSV.
├── _scripts/                  # Scripts de automatización.
│   ├── build_web.py          # Construye la web estática.
│   ├── serve_web.py          # Servidor local con API REST.
│   └── generar_imagen.py      # Genera imágenes Full.
└── web/                       # Frontend (HTML, JS, CSS).
    ├── index.html            # Página principal de la colección.
    └── styles.css            # Estilos personalizados.
```

---

## 🧩 Solución de Problemas Comunes  

### Error: `Ollama no conecta`  
- Asegúrate de que Ollama esté corriendo:  
  ```bash
  ollama serve
  ```

### Imágenes no se generan  
- Verifica que las imágenes en `_originals/<id>/` tengan nombres como `<id>_A.jpg` y `<id>_B.jpg`.  

---

## 🌐 Recursos Adicionales  
- **Documentación Web**: Abre `web/problemas.html` para ver errores detectados.  
- **Comunidades de Apoyo**: [Enlace a foro/Discord si aplica].  

---

## 📜 Licencia  
Este proyecto está bajo la licencia MIT. Consulta el archivo `LICENSE` para más detalles.  

--- 

