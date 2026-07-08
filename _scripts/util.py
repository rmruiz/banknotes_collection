#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Utilidades compartidas — convenios centrales del proyecto.

Centraliza lo que antes estaba copiado en varios módulos (build_web,
serve_web, generar_imagen, generate_json, vincular_originales), para que
el convenio de id y la normalización de texto tengan UNA sola definición.
"""
import re
import unicodedata


def unaccent(s):
    """'Perú' -> 'Peru'. NFKD y se descarta lo que no sea ASCII."""
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()


def norm_flag(s):
    """Clave para resolver banderas y comparar países: MAYÚSCULAS, sin
    acentos ni símbolos, ignorando lo que va entre paréntesis.
    'Macao (China)' -> 'MACAO'."""
    s = re.sub(r"\(.*?\)", "", s or "")
    return re.sub(r"[^A-Z0-9]", "", unaccent(s).upper())


def make_note_id(abbr, pick):
    """id canónico del billete = abreviación de país + pick sin separadores,
    en minúsculas. 'ar' + 'P-367a' -> 'ar-p367a'. El id ES el nombre de
    archivo del JSON, la carpeta de fotos y la imagen Full."""
    return f"{abbr}-" + re.sub(r"[-. ]", "", pick or "").lower()
