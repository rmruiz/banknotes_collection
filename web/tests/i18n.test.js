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

test("translate: claves del menú lateral (secciones + items)", () => {
  assert.equal(translate("menu_section_collection", "es"), "Colección");
  assert.equal(translate("menu_section_collection", "en"), "Collection");
  assert.equal(translate("menu_section_countries", "es"), "Países");
  assert.equal(translate("menu_section_countries", "en"), "Countries");
  assert.equal(translate("menu_section_currencies", "es"), "Monedas");
  assert.equal(translate("menu_section_currencies", "en"), "Currencies");
  assert.equal(translate("menu_section_others", "es"), "Otros");
  assert.equal(translate("menu_section_others", "en"), "Other");
  assert.equal(translate("menu_title", "es"), "Menú");
  assert.equal(translate("menu_title", "en"), "Menu");
  assert.equal(translate("menu_catalog", "es"), "Listado");
  assert.equal(translate("menu_catalog", "en"), "Listing");
  assert.equal(translate("menu_edit", "es"), "Editar");
  assert.equal(translate("menu_edit", "en"), "Edit");
  assert.equal(translate("menu_countries", "es"), "Lista");
  assert.equal(translate("menu_countries", "en"), "List");
  assert.equal(translate("menu_countries_edit", "es"), "Editar");
  assert.equal(translate("menu_countries_edit", "en"), "Edit");
  assert.equal(translate("menu_currencies", "es"), "Lista");
  assert.equal(translate("menu_currencies", "en"), "List");
  assert.equal(translate("menu_currencies_edit", "es"), "Editar");
  assert.equal(translate("menu_currencies_edit", "en"), "Edit");
  assert.equal(translate("menu_stats", "es"), "Estadísticas");
  assert.equal(translate("menu_stats", "en"), "Statistics");
  assert.equal(translate("menu_problems", "es"), "Problemas");
  assert.equal(translate("menu_problems", "en"), "Issues");
  assert.equal(translate("menu_open", "es"), "Abrir menú");
  assert.equal(translate("menu_open", "en"), "Open menu");
  assert.equal(translate("menu_close", "es"), "Cerrar menú");
  assert.equal(translate("menu_close", "en"), "Close menu");
});

test("translate: páginas de países/monedas (títulos, placeholders, estados)", () => {
  assert.equal(translate("countries_title", "es"), "Países actuales");
  assert.equal(translate("countries_title", "en"), "Current countries");
  assert.equal(translate("countries_edit_title", "es"), "Países actuales (Edición)");
  assert.equal(translate("countries_edit_title", "en"), "Current countries (Edit)");
  assert.equal(translate("currencies_title", "es"), "Monedas actuales");
  assert.equal(translate("currencies_title", "en"), "Current currencies");
  assert.equal(translate("currencies_edit_title", "es"), "Monedas actuales (Edición)");
  assert.equal(translate("currencies_edit_title", "en"), "Current currencies (Edit)");
  assert.ok(translate("countries_search_ph", "es").includes("código"));
  assert.ok(translate("currencies_search_ph", "en").includes("code"));
  assert.equal(translate("saved_ok", "es"), "Guardado ✓");
  assert.equal(translate("saved_ok", "en"), "Saved ✓");
  assert.equal(translate("err_save", "es"), "No se pudo guardar");
});

test("translate: columnas de países (9) y monedas (21)", () => {
  assert.equal(translate("code", "es"), "Código");
  assert.equal(translate("code", "en"), "Code");
  assert.equal(translate("iso2", "es"), "ISO alpha-2");
  assert.equal(translate("isonum", "es"), "ISO num");
  assert.equal(translate("flag", "es"), "Bandera");
  assert.equal(translate("flag", "en"), "Flag");
  assert.equal(translate("name_es", "es"), "Nombre (ES)");
  assert.equal(translate("name_en", "en"), "Name (EN)");
  assert.equal(translate("name_ar", "es"), "Nombre (AR)");
  assert.equal(translate("name_short", "es"), "Nombre corto");
  assert.equal(translate("name_short", "en"), "Short name");
  assert.equal(translate("vigente", "es"), "Vigente");
  assert.equal(translate("vigente", "en"), "Current");
  assert.equal(translate("folder", "es"), "Carpeta");
  assert.equal(translate("folder", "en"), "Folder");
  assert.equal(translate("decimales", "es"), "Decimales");
  assert.equal(translate("simbolo", "es"), "Símbolo");
  assert.equal(translate("tipo", "es"), "Tipo");
  assert.equal(translate("estado", "es"), "Estado");
  assert.equal(translate("banco_central", "es"), "Banco central");
  assert.equal(translate("banco_central", "en"), "Central bank");
  assert.equal(translate("fecha_intro", "es"), "Introducida");
  assert.equal(translate("fecha_fin", "es"), "Fin");
  assert.equal(translate("moneda_ant", "es"), "Moneda anterior");
  assert.equal(translate("moneda_suc", "es"), "Moneda sucesora");
  assert.equal(translate("uso_emisor", "es"), "Emisor");
  assert.equal(translate("uso_legal", "es"), "Curso legal");
  assert.equal(translate("uso_legal", "en"), "Legal tender");
  assert.equal(translate("uso_circ", "es"), "Circulación");
  assert.equal(translate("uso_facto", "es"), "De facto");
  assert.equal(translate("notas", "es"), "Notas");
  assert.equal(translate("notas", "en"), "Notes");
  // Reutilizadas de claves existentes:
  assert.equal(translate("moneda", "es"), "Moneda");
  assert.equal(translate("subunidad", "es"), "Subunidad");
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
