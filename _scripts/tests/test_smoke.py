"""Smoke test de infraestructura (T1).

Verifica que el harness puede importar el código del repo desde la raíz,
sin sockets ni red. T5 hará además que `import _scripts.util` esté libre
de efectos de módulo (parseo de argv / escaneo de disco).
"""


def test_import_scripts_package():
    """`_scripts` es importable como paquete namespace desde la raíz."""
    import _scripts  # noqa: F401


def test_import_util_from_root():
    """Contrato que usan los tests T2-T4: importar `util` desde la raíz."""
    from _scripts import util

    assert util.REPO.name == "banknotes_collection"
