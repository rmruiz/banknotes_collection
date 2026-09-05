"""Escrituras atómicas (T12): definición única de lo que antes estaba
copiado 3 veces (build_web._atomic_write_text, serve_web.atomic_write,
serve_web.atomic_write_bytes).

tmp + os.replace: un GET concurrente del navegador nunca lee el
destinatario a medio escribir; si la escritura falla, no queda .tmp.
"""
import os
import tempfile
from pathlib import Path


def atomic_write_text(path: Path, text: str) -> None:
    """Escribe `text` (UTF-8) en `path` de forma atómica."""
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


def atomic_write_bytes(path: Path, data: bytes) -> None:
    """Escribe `data` binaria en `path` de forma atómica."""
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise