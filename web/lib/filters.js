/* Vistas (filtros) guardadas del catálogo — módulo puro testeable en Node.
   Un filtro = {name, query, cols}: nombre + query de la search bar + claves
   de columnas visibles. Fuente de verdad: _json/filters.json (documentado
   en _json/filters.md); el navegador lee la copia web/data/filters.json. */

// Normaliza el JSON crudo de data/filters.json (o la respuesta de
// POST /api/save_filter) a array canónico de {name, query, cols: string[]}.
// Acepta {version, filters} o array plano; null/undefined/otro tipo -> [].
// Descarta entradas inválidas (name/query no string, name vacío, cols no
// array de strings) y deduplica por name (la última gana).
export function normalizeFilters(raw) {
  let list;
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object" && Array.isArray(raw.filters)) {
    list = raw.filters;
  } else {
    list = [];
  }
  const seen = new Map();
  for (const f of list) {
    if (!f || typeof f !== "object" || Array.isArray(f)) continue;
    const { name, query, cols } = f;
    if (typeof name !== "string" || !name.trim()) continue;
    if (typeof query !== "string") continue;
    if (!Array.isArray(cols) || !cols.every((c) => typeof c === "string")) continue;
    seen.set(name, { name, query, cols: [...new Set(cols)] });
  }
  return [...seen.values()];
}

// Limita `cols` a las claves válidas (p. ej. las de COLUMNS de app.js),
// preservando el orden y sin duplicados. `validCols`: iterable de claves.
export function filterCols(cols, validCols) {
  const valid = new Set(validCols);
  const out = [];
  const seen = new Set();
  for (const c of cols || []) {
    if (typeof c === "string" && valid.has(c) && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

// ¿El estado actual (columnas visibles + query de #q) coincide exactamente
// con el filtro guardado? Igualdad de conjuntos de columnas + query idéntico.
// `state`: {cols: string[]|iterable, query: string}; `f`: {cols, query}.
export function matchesFilter(state, f) {
  if (!f || typeof f.query !== "string") return false;
  if (state.query !== f.query) return false;
  const a = new Set(state.cols || []);
  const b = new Set(f.cols || []);
  if (a.size !== b.size) return false;
  for (const c of a) if (!b.has(c)) return false;
  return true;
}
