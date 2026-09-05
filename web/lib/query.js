/* Parser de consultas de búsqueda (T6) — extraído de web/app.js para
   poder testearlo en Node. Sintaxis:
     palabra                      -> búsqueda global (cualquier campo)
     "frase exacta"               -> coincidencia exacta global
     col:(a b c)                  -> grupo de valores en la columna
     col:"valor"                  -> valor exacto en la columna
     col>=n / col<=n / col>n / col<n  -> comparativo numérico
     -<token>                     -> negación del token
   Los alias en COL_ALIASES permiten español o inglés indistintamente. */

import { unaccent } from "./format.js";

export const COL_ALIASES = {
  country: "pais",
  year: "anio",
  monto: "valor",
  front: "thumb_a",
  back: "thumb_b",
  full: "thumb_f",
};

export function getCol(c) {
  c = c.toLowerCase();
  return COL_ALIASES[c] || c;
}

// Extrae el valor como un string limpio (sin acentos, en minúscula)
export function getStrVal(r, col) {
  const v = r[col];
  if (v === null || v === undefined) return "";
  return unaccent(String(v)).toLowerCase();
}

export function parseQuery(q) {
  const tests = [];
  // Regex que soporta guiones bajos en los nombres de columnas ([a-z_]+)
  const regex = /(-?)(?:([a-z_]+)(>=|<=|>|<)(\d+(?:\.\d+)?)|([a-z_]+):\((.*?)\)|([a-z_]+):"([^"]*)"|"([^"]*)"|([^\s]+))/gi;
  let m;

  while ((m = regex.exec(q)) !== null) {
    const neg = m[1] === '-';

    if (m[2]) {
      tests.push({ type: 'rel', neg, col: getCol(m[2]), op: m[3], val: parseFloat(m[4]) });
    } else if (m[5]) {
      const col = getCol(m[5]);
      const inner = m[6].trim();
      if (inner.startsWith('"') && inner.endsWith('"')) {
        tests.push({ type: 'col_exact', neg, col, val: inner.slice(1, -1) });
      } else {
        tests.push({ type: 'col_group', neg, col, vals: inner.split(/\s+/) });
      }
    } else if (m[7]) {
      tests.push({ type: 'col_exact', neg, col: getCol(m[7]), val: m[8] });
    } else if (m[9]) {
      tests.push({ type: 'global_exact', neg, val: m[9] });
    } else if (m[10]) {
      tests.push({ type: 'global', neg, val: m[10] });
    }
  }
  return tests;
}
