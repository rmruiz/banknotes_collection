"""Bootstrap del harness de tests (T1).

Patrón documentado (T5): los entry points siguen ejecutándose como hoy
(`python3 _scripts/xxx.py`) y los tests importan el código desde la raíz
del repo (`from _scripts import util`, como paquete namespace). Este
conftest pone la raíz en `sys.path` para que pytest pueda hacerlo sin
tocar el código de producción.
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
