/* Tests de web/lib/i18n.js (T6) — ejecutar: node --test web/tests/ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { I18N, translate, paisDisplay } from "../lib/i18n.js";

test("translate: español e inglés", () => {
  assert.equal(translate("pais", "es"), "País");
  assert.equal(translate("pais", "en"), "Country");
  assert.equal(translate("verif", "es"), "Verificado");
  assert.equal(translate("verif", "en"), "Verified");
});

test("translate: clave desconocida -> la propia clave", () => {
  assert.equal(translate("no_existe", "es"), "no_existe");
  assert.equal(translate("no_existe", "en"), "no_existe");
});

test("translate: claves del menú lateral", () => {
  assert.equal(translate("menu_lang", "es"), "Idioma");
  assert.equal(translate("menu_lang", "en"), "Language");
  assert.equal(translate("menu_title", "es"), "Menú");
  assert.equal(translate("menu_title", "en"), "Menu");
  assert.equal(translate("menu_edit", "es"), "Edición");
  assert.equal(translate("menu_edit", "en"), "Edit");
  assert.equal(translate("menu_reading", "es"), "Lectura");
  assert.equal(translate("menu_reading", "en"), "Reading mode");
  assert.equal(translate("menu_stats", "es"), "Estadísticas");
  assert.equal(translate("menu_stats", "en"), "Statistics");
  assert.equal(translate("menu_catalog", "es"), "Catálogo");
  assert.equal(translate("menu_catalog", "en"), "Catalog");
  assert.equal(translate("menu_problems", "es"), "Problemas");
  assert.equal(translate("menu_problems", "en"), "Issues");
  assert.equal(translate("menu_open", "es"), "Abrir menú");
  assert.equal(translate("menu_open", "en"), "Open menu");
  assert.equal(translate("menu_close", "es"), "Cerrar menú");
  assert.equal(translate("menu_close", "en"), "Close menu");
});

test("I18N: cada clave es un par [es, en] de strings no vacíos", () => {
  for (const [k, v] of Object.entries(I18N)) {
    assert.ok(Array.isArray(v) && v.length === 2, k);
    assert.ok(typeof v[0] === "string" && v[0].length > 0, k);
    assert.ok(typeof v[1] === "string" && v[1].length > 0, k);
  }
});

test("paisDisplay: según idioma, con fallback a pais", () => {
  const r = { pais: "Chile", pais_en: "Chile" };
  assert.equal(paisDisplay(r, "es"), "Chile");
  assert.equal(paisDisplay(r, "en"), "Chile");
  assert.equal(paisDisplay({ pais: "Estados Unidos" }, "en"), "Estados Unidos");
  assert.equal(paisDisplay({ pais: "Estados Unidos" }, "es"), "Estados Unidos");
});
