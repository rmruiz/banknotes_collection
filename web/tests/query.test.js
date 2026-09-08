/* Tests de web/lib/query.js (T6) — ejecutar: node --test web/tests/
   Sintaxis de consulta: palabra | "frase" | col:(a b) | col:"v" |
   col>=n / col<=n / col>n / col<n | -<token> (negación). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { COL_ALIASES, getCol, getStrVal, parseQuery, matches, sortRecords, NUM_SORT_KEYS } from "../lib/query.js";

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

/* --- matches / sortRecords (T6 precio) --- */

test("parseQuery: precio>=100 -> test rel numérico", () => {
  assert.deepEqual(parseQuery("precio>=100"), [
    { type: "rel", neg: false, col: "precio", op: ">=", val: 100 },
  ]);
});

test("matches: rel sobre precio (numérico; null/ausente no pasa)", () => {
  const tests = parseQuery("precio>=100");
  assert.equal(matches({ precio: 150 }, tests), true);
  assert.equal(matches({ precio: 50 }, tests), false);
  assert.equal(matches({ precio: null }, tests), false);
  assert.equal(matches({}, tests), false);
  assert.equal(matches({ precio: null }, []), true); // sin tests -> pasa
});

test("matches: demás tipos de test conservan su comportamiento", () => {
  assert.equal(matches({ search: "chile P-125 1961" }, parseQuery("chile 1961")), true);
  assert.equal(matches({ search: "chile P-125 1961" }, parseQuery("bolivia")), false);
  assert.equal(matches({ pais: "Chile" }, parseQuery('pais:"chile"')), true);
  assert.equal(matches({ pais: "Chile" }, parseQuery("pais:(chile)")), true);
  assert.equal(matches({ thumb_a: "x.jpg" }, parseQuery("front:(si)")), true);
  assert.equal(matches({ thumb_a: "" }, parseQuery("front:(no)")), true);
  assert.equal(matches({ thumb_a: "x.jpg" }, parseQuery("-front:(no)")), true);
  assert.equal(matches({ thumb_a: "" }, parseQuery('front:""')), true);
});

test("NUM_SORT_KEYS: precio es numérico como valor/anio", () => {
  assert.ok(NUM_SORT_KEYS.has("precio"));
  assert.ok(NUM_SORT_KEYS.has("valor"));
  assert.ok(NUM_SORT_KEYS.has("anio"));
});

test("sortRecords: precio numérico (10 < 100); null/ausente siempre al final", () => {
  const data = [
    { pick: "P-3", precio: 100 },
    { pick: "P-1", precio: null },
    { pick: "P-2", precio: 10 },
    { pick: "P-4" }, // ausente
  ];
  const asc = sortRecords(data, { key: "precio", dir: 1 }, {});
  assert.deepEqual(asc.map((r) => r.pick), ["P-2", "P-3", "P-1", "P-4"]);
  const desc = sortRecords(data, { key: "precio", dir: -1 }, {});
  assert.deepEqual(desc.map((r) => r.pick), ["P-3", "P-2", "P-1", "P-4"]);
  // no muta la entrada
  assert.deepEqual(data.map((r) => r.pick), ["P-3", "P-1", "P-2", "P-4"]);
});

test("sortRecords: ctx.getValue (pais i18n) y sin key -> mismo array", () => {
  const data = [{ pick: "P-2", pais: "Chile" }, { pick: "P-1", pais: "Perú" }];
  const ctx = { getValue: (r) => `ZZ-${r.pais}` };
  const out = sortRecords(data, { key: "pais", dir: -1 }, ctx);
  assert.deepEqual(out.map((r) => r.pick), ["P-1", "P-2"]);
  assert.deepEqual(sortRecords(data, { key: null, dir: 1 }, ctx), data);
});
