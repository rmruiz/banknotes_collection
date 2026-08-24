# Tech Context: Banknotes Collection

## Technology Stack
- **Language:** Python 3.8+
- **Frontend:** Vanilla JavaScript, HTML5, CSS3 (Pico.css for styling).
- **Data Format:** JSON.
- **Image Processing:** ImageMagick.
- **PDF Generation:** ReportLab.
- **AI/LLM:** Ollama (Models: Gemma, LLaVA).
- **Hosting:** Firebase Hosting.

## Development Setup
- **Local Server:** `python3 _scripts/serve_web.py 8000` provides a local environment for the web app and an API for administration.
- **Dependencies:**
    - `reportlab`: PDF generation.
    - `beautifulsoup4`: Potential HTML parsing.
    - `requests`: API calls to Ollama.
    - `pydantic`: Data validation (used in scripts).

## Constraints
- **No Database:** The system must remain database-less to ensure simplicity and portability.
- **File System Dependency:** Image processing depends on the specific directory structure (`_originals`, `_FULL`, `_flags`).
- **Local AI:** Processing speed for AI tasks depends on the host machine's GPU/CPU capabilities via Ollama.

## Tool Usage Patterns
- **ID Convention:** Banknotes are identified by a unique "Pick" or custom ID used across JSONs and folders.
- **Git Workflow:** JSON files are formatted using `_scripts/git_clean_json.sh` to maintain clean diffs.
