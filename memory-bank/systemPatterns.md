# System Patterns: Banknotes Collection

## Architecture
The system follows a **Decoupled Flat-File Architecture**:
- **Storage Layer:** JSON files organized by country. No SQL.
- **Logic Layer:** Python scripts in `_scripts/` that act as "compilers" or "processors" transforming raw data into assets.
- **Presentation Layer:** A static web frontend in `web/` that consumes a pre-compiled `collection.json`.

## Key Technical Decisions
- **JSON-per-Banknote:** Each banknote has its own file, preventing large-file merge conflicts and allowing granular updates.
- **Single Source of Truth (SSoT):** `countries.json` and `currencies.json` are the masters for all lookup data to ensure consistency.
- **Pre-computation:** Instead of calculating stats or searches on the fly in the browser, `build_web.py` pre-computes `collection.json`.
- **Local AI Integration:** Use of Ollama allows for private, local processing of images without relying on cloud APIs.

## Critical Paths
- **Image Pipeline:** `_originals/` $\rightarrow$ `generar_imagen.py` (ImageMagick) $\rightarrow$ `_FULL/`.
- **Web Pipeline:** `_json/**.json` $\rightarrow$ `build_web.py` $\rightarrow$ `web/data/collection.json`.
- **PDF Pipeline:** `_json/**.json` $\rightarrow$ `generar_etiquetas.py` (ReportLab) $\rightarrow$ `etiquetas.pdf`.

## Component Relationships
- `_scripts/util.py` provides shared logic for ID normalization and path resolution used by almost all other scripts.
- `web/app.js` handles the client-side filtering and rendering logic.
