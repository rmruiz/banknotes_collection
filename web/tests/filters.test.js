/* Tests de web/lib/filters.js — ejecutar: node --test web/tests/
   Vistas (filtros) guardadas del catálogo: _json/filters.json.
   normalizeFilters (JSON crudo -> array canónico), filterCols (tolerancia a
   claves desconocidas) y matchesFilter (filtro activo derivado). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFilters, filterCols, matchesFilter } from "../lib/filters.js";

test("normalizeFilters: null/undefined/otros tipos -> []", () => {
  assert.deepEqual(normalizeFilters(null), []);
  assert.deepEqual(normalizeFilters(undefined), []);
  assert.deepEqual(normalizeFilters(42), []);
  assert.deepEqual(normalizeFilters("no"), []);
  assert.deepEqual(normalizeFilters({}), []);
  assert.deepEqual(normalizeFilters({ filters: "no" }), []);
});

test("normalizeFilters: {version, filters} y array plano", () => {
  const f = { name: "A", query: "q", cols: ["x", "y"] };
  assert.deepEqual(normalizeFilters({ version: 1, filters: [f] }), [f]);
  assert.deepEqual(normalizeFilters([f]), [f]);
});

test("normalizeFilters: descarta entradas inválidas", () => {
  const raw = {
    version: 1,
    filters: [
      { name: "Ok", query: "", cols: [] },
      null,
      42,
      "string",
      { name: 5, query: "", cols: [] },          // name no string
      { name: "  ", query: "", cols: [] },       // name vacío
      { name: "B", query: 7, cols: [] },         // query no string
      { name: "C", query: "", cols: "no" },      // cols no array
      { name: "D", query: "", cols: [1] },       // cols con no-string
      { name: "E", query: "" },                  // cols ausente
    ],
  };
  assert.deepEqual(normalizeFilters(raw), [{ name: "Ok", query: "", cols: [] }]);
});

test("normalizeFilters: dedupe por name (la última gana) y cols sin dup", () => {
  const raw = {
    filters: [
      { name: "A", query: "q1", cols: ["x", "x", "y"] },
      { name: "B", query: "", cols: [] },
      { name: "A", query: "q2", cols: ["z"] },
    ],
  };
  assert.deepEqual(normalizeFilters(raw), [
    { name: "A", query: "q2", cols: ["z"] },
    { name: "B", query: "", cols: [] },
  ]);
});

test("filterCols: limita a claves válidas, orden y sin duplicados", () => {
  assert.deepEqual(filterCols(["a", "zzz", "b", "a"], ["a", "b", "c"]), ["a", "b"]);
  assert.deepEqual(filterCols(["b", "a"], ["a", "b", "c"]), ["b", "a"]);
  assert.deepEqual(filterCols(null, ["a"]), []);
  assert.deepEqual(filterCols(undefined, ["a"]), []);
  assert.deepEqual(filterCols([1, null, "a"], ["a"]), ["a"]);
  assert.deepEqual(filterCols([], ["a"]), []);
});

test("matchesFilter: igualdad de conjuntos + query idéntico", () => {
  const f = { name: "A", query: "q", cols: ["x", "y"] };
  assert.equal(matchesFilter({ cols: ["x", "y"], query: "q" }, f), true);
  assert.equal(matchesFilter({ cols: ["y", "x"], query: "q" }, f), true); // orden da igual
  assert.equal(matchesFilter({ cols: ["x"], query: "q" }, f), false);      // falta una
  assert.equal(matchesFilter({ cols: ["x", "y", "z"], query: "q" }, f), false); // sobra una
  assert.equal(matchesFilter({ cols: ["x", "y"], query: "" }, f), false);  // query distinta
  assert.equal(matchesFilter({ cols: ["x", "y"], query: "q " }, f), false);
  assert.equal(matchesFilter({ cols: [], query: "" }, { name: "B", query: "", cols: [] }), true);
});

test("matchesFilter: filtro nulo/inválido -> false", () => {
  assert.equal(matchesFilter({ cols: ["x"], query: "q" }, null), false);
  assert.equal(matchesFilter({ cols: ["x"], query: "q" }, undefined), false);
  assert.equal(matchesFilter({ cols: ["x"], query: "q" }, { name: "A", cols: ["x"] }), false);
  assert.equal(matchesFilter({ cols: ["x"], query: "q" }, { name: "A", query: 3, cols: ["x"] }), false);
});
