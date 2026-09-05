"""Genera fixtures cross-language (T6/A3) para los tests JS (`node --test`).

Python es la fuente de verdad: `util.fmt_valor` (separador de miles) y
`util.unaccent` (NFKD) definen el comportamiento esperado de
`web/lib/format.js` (fmtValor/unaccent). La salida se commitea en
`web/tests/fixtures/fmt.json` (no se regenera durante el build).

Uso: python3 _scripts/generar_fixtures.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_ROOT = _HERE.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from _scripts.build_web import fmt_valor  # noqa: E402
from _scripts.util import unaccent  # noqa: E402

VALORES: list[int | float] = [
    0, 1, 5, 0.5, 0.25, 0.05, 100, 999, 1000, 1234, 12345, 123456,
    1000000, 1234567.89,
]
CADENAS: list[str] = [
    "Chile", "Perú", "Estados Unidos", "Isla de Man", "La Pampa",
    "Sí", "No", "número", "condición", "África", "Argentina", "Serbia",
]
OUT = _ROOT / "web" / "tests" / "fixtures" / "fmt.json"


def main() -> int:
    fixture = {
        "valor": [{"v": v, "out": fmt_valor(v)} for v in VALORES],
        "unaccent": [{"s": s, "out": unaccent(s)} for s in CADENAS],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(fixture, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    rel = OUT.relative_to(_ROOT)
    print(f"[OK] {rel} ({len(VALORES)} valores, {len(CADENAS)} cadenas)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
