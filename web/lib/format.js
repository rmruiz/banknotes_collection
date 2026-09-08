/* Utilidades de formato compartidas (T6) — funciones puras usadas por
   app.js, stats.js y problemas.js. Testeables en Node (node --test).
   `fmtValor`/`unaccent` deben coincidir con util.fmt_valor/util.unaccent
   (Python, fuente de verdad — ver web/tests/fixtures/fmt.json). */

export function unaccent(s) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function fmtValor(v) {
  if (v === null || v === undefined) return "";
  return v.toLocaleString("es-CL");
}

// Columna "Precio" (valor de mercado, distinto del monto facial):
// "$ " + fmtValor; null/undefined -> '' (celda vacía).
export function fmtPrecio(v) {
  if (v === null || v === undefined) return "";
  return "$ " + fmtValor(v);
}

// Σ valor de la colección (KPI de stats): suma de los `precio` finitos;
// null/undefined/NaN/∞/cadenas cuentan 0. El callback suma SIEMPRE sobre el
// acumulador s (regresión histórica: devolver n.precio sin sumar a s dejaba
// el KPI en 0 cuando la última nota no tenía precio).
export function sumPrecio(notes) {
  return notes.reduce(
    (s, n) => s + (Number.isFinite(n.precio) ? n.precio : 0),
    0
  );
}

// Capitaliza la primera letra de cada palabra (respeta tildes y paréntesis).
// Ejemplos:
//     'marco alemán'             -> 'Marco Alemán'
//     'yuan chino (renminbi)'    -> 'Yuan Chino (Renminbi)'
//     'united states dollar'     -> 'United States Dollar'
export function toTitleCase(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/(\s|\(|\[)\w/g, (m) => m.toUpperCase())
                  .replace(/^\w/, (m) => m.toUpperCase());
}

// Primer número del pick (para ordenar P-367a < P-367b < P-12).
export function pickNum(p) {
  const m = /\d+/.exec(p || "");
  return m ? parseInt(m[0], 10) : Infinity;
}

export function isEmptyVal(v) {
  return v === null || v === undefined || v === "";
}

/* --- Helpers de moneda basados en web/data/currencies.json ---
   `catalog` es el catálogo ISO 4217 publicado por el build
   (web/data/currencies.json); `lang` es "es" | "en". */

export function currencyInfoFor(rec, catalog) {
  const code = (rec.currency_code || "").trim().toUpperCase();
  if (!code) return null;
  return (catalog && catalog[code]) || null;
}

// Columna "Moneda": nombre completo + símbolo del catálogo.
export function currencyDisplay(rec, lang, catalog) {
  const info = currencyInfoFor(rec, catalog);
  const key = lang === "en" ? "en" : "es";
  let name = "";
  if (info) {
    const full = (info.nombres || {})[key] ||
                 (info.nombres || {}).es ||
                 (info.nombres || {}).en ||
                 "";
    name = full;
  }
  if (!name) {
    // Fallback a los campos ya pre-generados en build_web.py (nombre corto
    // o el texto libre original), para que sigamos mostrando algo útil
    // incluso si el catálogo no tiene el código.
    name = lang === "en"
      ? (rec.currency_name_en || rec.moneda || "")
      : (rec.currency_name_es || rec.moneda || "");
  }
  const symbol = info ? (info.simbolo || "") : (rec.currency_symbol || "");
  const title = toTitleCase(name);
  return symbol ? `${title} (${symbol})` : title;
}

// Nombre corto de la moneda (nombre_corto) para "Moneda Full".
// Se respeta el plural si el monto no es 1 (null -> plural/indeterminado).
export function currencyShortName(rec, lang, catalog) {
  const info = currencyInfoFor(rec, catalog);
  if (!info) return "";
  const key = lang === "en" ? "en" : "es";
  const short = info.nombre_corto || {};
  const valor = rec.valor;
  const plural = valor !== 1;
  const pk = plural ? `${key}_p` : key;
  return short[pk] || short[key] || short.es_p || short.es || short.en_p || short.en ||
         (info.nombres || {})[key] || (info.nombres || {}).es || "";
}

// "Moneda Full" = monto (con formato) + nombre corto. Se calcula al vuelo
// con el catálogo; el valor precargado en rec.denominacion (build_web)
// ya sigue este patrón.
export function denominationFullDisplay(rec, lang, catalog) {
  const short = currencyShortName(rec, lang, catalog);
  if (short) return toTitleCase(`${fmtValor(rec.valor)} ${short}`).trim();
  // Fallback: usa el campo precargado (ya es "monto moneda").
  return toTitleCase(rec.denominacion || "");
}
