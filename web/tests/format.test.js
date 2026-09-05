/* Tests de web/lib/format.js (T6) — ejecutar: node --test web/tests/
   fmtValor/unaccent se validan contra el fixture cross-language
   web/tests/fixtures/fmt.json (generado por _scripts/generar_fixtures.py,
   con Python como fuente de verdad). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  unaccent, esc, fmtValor, toTitleCase, pickNum, isEmptyVal,
  currencyDisplay, currencyShortName, denominationFullDisplay,
} from "../lib/format.js";

const FIXTURE = JSON.parse(
  readFileSync(new URL("./fixtures/fmt.json", import.meta.url), "utf-8"),
);

test("unaccent: fixture cross-language Python↔JS", () => {
  for (const { s, out } of FIXTURE.unaccent) {
    assert.equal(unaccent(s), out, `unaccent(${JSON.stringify(s)})`);
  }
});

test("esc: los 5 caracteres HTML", () => {
  assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.equal(esc("sin cambios"), "sin cambios");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(5), "5");
});

test("fmtValor: fixture cross-language Python↔JS", () => {
  for (const { v, out } of FIXTURE.valor) {
    assert.equal(fmtValor(v), out, `fmtValor(${v})`);
  }
});

test("fmtValor: null/undefined -> ''", () => {
  assert.equal(fmtValor(null), "");
  assert.equal(fmtValor(undefined), "");
});

test("toTitleCase: ejemplos documentados", () => {
  assert.equal(toTitleCase("marco alemán"), "Marco Alemán");
  assert.equal(toTitleCase("yuan chino (renminbi)"), "Yuan Chino (Renminbi)");
  assert.equal(toTitleCase("united states dollar"), "United States Dollar");
  assert.equal(toTitleCase(null), "");
  assert.equal(toTitleCase(""), "");
});

test("pickNum: primer número del pick", () => {
  assert.equal(pickNum("P-367a"), 367);
  assert.equal(pickNum("P-12"), 12);
  assert.equal(pickNum(""), Infinity);
  assert.equal(pickNum(null), Infinity);
  assert.equal(pickNum("xx"), Infinity);   // sin dígitos: ordena al final
});

test("isEmptyVal: null/undefined/'' sí; 0 y false no", () => {
  assert.ok(isEmptyVal(null));
  assert.ok(isEmptyVal(undefined));
  assert.ok(isEmptyVal(""));
  assert.ok(!isEmptyVal(0));
  assert.ok(!isEmptyVal(false));
  assert.ok(!isEmptyVal("x"));
});

const CAT = {
  CLP: {
    nombre_corto: { es: "peso", es_p: "pesos", en: "peso", en_p: "pesos" },
    nombres: { es: "Peso Chileno", en: "Chilean Peso" },
    simbolo: "$",
  },
};

test("currencyDisplay: catálogo + símbolo (es/en)", () => {
  const rec = { currency_code: "clp", valor: 1000 };
  assert.equal(currencyDisplay(rec, "es", CAT), "Peso Chileno ($)");
  assert.equal(currencyDisplay(rec, "en", CAT), "Chilean Peso ($)");
});

test("currencyDisplay: fallback sin catálogo (campo precargado)", () => {
  const rec = { currency_code: "", moneda: "Escudos", currency_symbol: "E" };
  assert.equal(currencyDisplay(rec, "es", {}), "Escudos (E)");
  assert.equal(currencyDisplay(rec, "es", null), "Escudos (E)");
});

test("currencyShortName: singular/plural e idioma", () => {
  assert.equal(currencyShortName({ currency_code: "CLP", valor: 1 }, "es", CAT), "peso");
  assert.equal(currencyShortName({ currency_code: "CLP", valor: 2 }, "es", CAT), "pesos");
  assert.equal(currencyShortName({ currency_code: "CLP", valor: null }, "en", CAT), "pesos");
  assert.equal(currencyShortName({ currency_code: "XXX", valor: 1 }, "es", CAT), "");
  assert.equal(currencyShortName({ currency_code: "", valor: 1 }, "es", CAT), "");
});

test("denominationFullDisplay: monto + nombre corto", () => {
  assert.equal(
    denominationFullDisplay({ currency_code: "CLP", valor: 1000 }, "es", CAT),
    "1.000 Pesos",
  );
});

test("denominationFullDisplay: fallback al campo precargado", () => {
  assert.equal(
    denominationFullDisplay(
      { currency_code: "", denominacion: "1000 escudos" }, "es", {},
    ),
    "1000 Escudos",
  );
});
