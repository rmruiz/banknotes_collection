/* Tests de web/lib/query.js (T6) — ejecutar: node --test web/tests/
   Sintaxis de consulta: palabra | "frase" | col:(a b) | col:"v" |
   col>=n / col<=n / col>n / col<n | -<token> (negación). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { COL_ALIASES, getCol, getStrVal, parseQuery } from "../lib/query.js";

test("getCol: alias español/inglés y normalización", () => {
  assert.equal(getCol("country"), "pais");
  assert.equal(getCol("YEAR"), "anio");
  assert.equal(getCol("monto"), "valor");
  assert.equal(getCol("front"), "thumb_a");
  assert.equal(getCol("back"), "thumb_b");
  assert.equal(getCol("full"), "thumb_f");
  assert.equal(getCol("pais"), "pais");      // sin alias -> igual
  assert.equal(COL_ALIASES.year, "anio");
});

test("getStrVal: sin acentos, minúsculas, null-safe", () => {
  assert.equal(getStrVal({ pais: "Estados Unidos" }, "pais"), "estados unidos");
  assert.equal(getStrVal({ pais: "Perú" }, "pais"), "peru");
  assert.equal(getStrVal({}, "pais"), "");
  assert.equal(getStrVal({ pais: null }, "pais"), "");
  assert.equal(getStrVal({ valor: 1000 }, "valor"), "1000");
});

test("parseQuery: comparativo numérico + negación", () => {
  const t = parseQuery("valor>1000 -anio<2000");
  assert.deepEqual(t, [
    { type: "rel", neg: false, col: "valor", op: ">", val: 1000 },
    { type: "rel", neg: true, col: "anio", op: "<", val: 2000 },
  ]);
});

test("parseQuery: operadores >= <= y decimales", () => {
  const t = parseQuery("valor>=0.5 monto<=100000");
  assert.deepEqual(t, [
    { type: "rel", neg: false, col: "valor", op: ">=", val: 0.5 },
    { type: "rel", neg: false, col: "valor", op: "<=", val: 100000 },
  ]);
});

test("parseQuery: grupo de valores en columna", () => {
  const t = parseQuery("pais:(chile perú)");
  assert.deepEqual(t, [
    { type: "col_group", neg: false, col: "pais", vals: ["chile", "perú"] },
  ]);
});

test("parseQuery: valor exacto en columna (con y sin comillas internas)", () => {
  assert.deepEqual(parseQuery('pais:"Isla de Man"'), [
    { type: "col_exact", neg: false, col: "pais", val: "Isla de Man" },
  ]);
  assert.deepEqual(parseQuery('obs:"a b"'), [
    { type: "col_exact", neg: false, col: "obs", val: "a b" },
  ]);
});

test("parseQuery: frase exacta global y palabras sueltas", () => {
  const t = parseQuery('"P-125" chile 1961');
  assert.deepEqual(t, [
    { type: "global_exact", neg: false, val: "P-125" },
    { type: "global", neg: false, val: "chile" },
    { type: "global", neg: false, val: "1961" },
  ]);
});

test("parseQuery: alias se resuelven en la columna", () => {
  const t = parseQuery("country:(chile) front:(a b)");
  assert.deepEqual(t, [
    { type: "col_group", neg: false, col: "pais", vals: ["chile"] },
    { type: "col_group", neg: false, col: "thumb_a", vals: ["a", "b"] },
  ]);
});

test("parseQuery: vacío no genera tests", () => {
  assert.deepEqual(parseQuery(""), []);
  assert.deepEqual(parseQuery("   "), []);
});
