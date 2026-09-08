/* Parser de consultas de búsqueda (T6) — extraído de web/app.js para
   poder testearlo en Node. Sintaxis:
     palabra                      -> búsqueda global (cualquier campo)
     "frase exacta"               -> coincidencia exacta global
     col:(a b c)                  -> grupo de valores en la columna
     col:"valor"                  -> valor exacto en la columna
     col>=n / col<=n / col>n / col<n  -> comparativo numérico
     -<token>                     -> negación del token
   Los alias en COL_ALIASES permiten español o inglés indistintamente. */

import { unaccent, pickNum, isEmptyVal } from "./format.js";

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

// --- filtrado/orden (extraído de web/app.js para poder testearlo en Node) ---

// Claves numéricas: ordenan por valor numérico; null/undefined/"" siempre al
// final, sin importar la dirección (mismo contrato para valor/anio/precio).
export const NUM_SORT_KEYS = new Set(["valor", "anio", "precio"]);
// Claves booleanas: ordenan por Number (false < true).
export const BOOL_SORT_KEYS = new Set(["conmemorativo", "remarcado"]);

// Devuelve true si el registro r pasa TODOS los tests de la query
// (misma lógica que el filtro de la tabla en app.js).
export function matches(r, tests) {
  for (const t of tests) {
    let pass = false;

    if (t.type === 'rel') {
      const v = r[t.col];
      if (typeof v === 'number' && !isNaN(v)) {
        if (t.op === '>') pass = v > t.val;
        else if (t.op === '<') pass = v < t.val;
        else if (t.op === '>=') pass = v >= t.val;
        else if (t.op === '<=') pass = v <= t.val;
      }
    } else if (t.type === 'col_exact' || t.type === 'col_group') {
      const colVal = getStrVal(r, t.col);
      const isImage = ["thumb_a", "thumb_b", "thumb_f"].includes(t.col);

      if (isImage) {
        // Súper lógica para imágenes: entiende front:(si), front:(no), front:""
        const queryVals = t.type === 'col_exact' ? [t.val] : t.vals;
        pass = queryVals.some(val => {
          val = unaccent(val).toLowerCase();
          if (val === "" || val === "no" || val === "false") return colVal === "";
          if (val === "si" || val === "yes" || val === "true") return colVal !== "";
          // Fallback
          return t.type === 'col_exact' ? colVal === val : colVal.includes(val);
        });
      } else {
        if (t.type === 'col_exact') {
          pass = colVal === unaccent(t.val).toLowerCase();
        } else {
          pass = t.vals.some(val => colVal.includes(unaccent(val).toLowerCase()));
        }
      }
    } else if (t.type === 'global_exact' || t.type === 'global') {
      pass = (r.search || "").includes(unaccent(t.val).toLowerCase());
    }

    if (t.neg) pass = !pass;
    if (!pass) return false;
  }
  return true;
}

// Ordena registros por { key, dir } y devuelve un array NUEVO (no muta la
// entrada). ctx.getValue(r) permite sobrepasar el valor a comparar (p. ej. el
// nombre de país mostrado en i18n); si no se da, se usa r[key] directamente.
export function sortRecords(records, sort, ctx = {}) {
  const { key, dir } = sort;
  if (!key) return records;
  const get = ctx.getValue || ((r) => r[key]);
  return [...records].sort((a, b) => {
    const va = get(a), vb = get(b);
    // vacíos siempre al final, sin importar la dirección
    const ea = isEmptyVal(va), eb = isEmptyVal(vb);
    if (ea && eb) return 0;
    if (ea) return 1;
    if (eb) return -1;
    let c;
    if (key === "pick") {
      c = pickNum(va) - pickNum(vb) ||
          String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
    } else if (NUM_SORT_KEYS.has(key)) {
      c = va - vb;
    } else if (BOOL_SORT_KEYS.has(key)) {
      c = Number(va) - Number(vb);
    } else {
      c = String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
    }
    return c * dir;
  });
}
