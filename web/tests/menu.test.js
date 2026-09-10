/* Tests de web/lib/menu.js (menú lateral por secciones) — ejecutar:
   node --test web/tests/ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { menuItems, renderMenu, NAV_SECTIONS } from "../lib/menu.js";

const PAGES = [
  "index", "index-edit",
  "countries", "countries-edit",
  "currencies", "currencies-edit",
  "stats", "problemas",
];
const LABELS = [
  "menu_catalog", "menu_edit",
  "menu_countries", "menu_countries_edit",
  "menu_currencies", "menu_currencies_edit",
  "menu_stats", "menu_problems",
];
const HREFS = [
  "index.html", "index-edit.html",
  "countries.html", "countries-edit.html",
  "currencies.html", "currencies-edit.html",
  "stats.html", "problemas.html",
];
const SECTION_IDS = [
  "collection", "collection",
  "countries", "countries",
  "currencies", "currencies",
  "others", "others",
];
const SECTION_KEYS = [
  "menu_section_collection", "menu_section_countries",
  "menu_section_currencies", "menu_section_others",
];
const CURRENT_BY_PAGE = Object.fromEntries(PAGES.map((p) => [p, p + ".html"]));

test("NAV_SECTIONS: 4 secciones con 2 ítems cada una (8 links)", () => {
  assert.equal(NAV_SECTIONS.length, 4);
  for (const sec of NAV_SECTIONS) {
    assert.ok(sec.id && sec.labelKey, `${sec.id}: id/labelKey`);
    assert.equal(sec.items.length, 2, `${sec.id}: 2 ítems`);
  }
  const flat = NAV_SECTIONS.flatMap((s) => s.items);
  assert.deepEqual(flat.map((i) => i.href), HREFS, "orden de los 8 links");
});

test("menuItems: SIEMPRE los 8 links en las 8 páginas, sin botón de idioma", () => {
  for (const page of PAGES) {
    const items = menuItems(page);
    assert.equal(items.length, 8, `${page}: 8 ítems`);
    assert.deepEqual(items.map((i) => i.labelKey), LABELS, `${page}: orden`);
    assert.deepEqual(items.map((i) => i.href), HREFS, `${page}: hrefs`);
    assert.deepEqual(items.map((i) => i.sectionId), SECTION_IDS, `${page}: secciones`);
    for (const it of items) assert.equal(it.type, "link", `${page}: solo links`);
  }
});

test("menuItems: marca current=true solo en la página actual", () => {
  for (const [page, href] of Object.entries(CURRENT_BY_PAGE)) {
    const items = menuItems(page);
    const cur = items.filter((i) => i.current);
    assert.equal(cur.length, 1, `${page}: un solo actual`);
    assert.equal(cur[0].href, href, `${page}: el actual es ${href}`);
  }
});

test("menuItems: página desconocida -> los 8 links, ninguno current", () => {
  for (const bad of ["no-existe", undefined, ""]) {
    const items = menuItems(bad);
    assert.equal(items.length, 8);
    assert.ok(!items.some((i) => i.current));
  }
});

test("menuItems: devuelve objetos nuevos (mutar no altera la lista base)", () => {
  // En "currencies" el ítem actual es [4] (currencies.html).
  const a = menuItems("currencies");
  a[1].href = "hacked.html";
  a[4].current = false;
  const b = menuItems("currencies");
  assert.equal(b[1].href, "index-edit.html");
  assert.equal(b[4].current, true);
});

test("renderMenu: las 4 secciones (encabezados data-i18n) en orden y los 8 links en cada página", () => {
  for (const page of PAGES) {
    const html = renderMenu(page, "es");
    let last = -1;
    for (const key of SECTION_KEYS) {
      const idx = html.indexOf(`data-i18n="${key}"`);
      assert.ok(idx >= 0, `${page}: sección ${key}`);
      assert.ok(idx > last, `${page}: secciones en orden`);
      last = idx;
    }
    for (const href of HREFS) {
      assert.match(html, new RegExp(`href="${href}"`), `${page}: ${href}`);
    }
    assert.ok(!html.includes("lang-toggle"), `${page}: sin botón de idioma en el menú`);
  }
});

test("renderMenu: la página actual lleva «<< », aria-current y clase .current", () => {
  const html = renderMenu("countries", "es");
  assert.ok(html.includes('class="side-menu-item current"'), "clase current");
  assert.equal(html.match(/aria-current="page"/g).length, 1, "un solo aria-current");
  assert.ok(html.includes("<< Lista"), "prefijo << en la etiqueta actual");
  for (const no of ["<< Listado", "<< Editar", "<< Estadísticas", "<< Problemas"]) {
    assert.ok(!html.includes(no), `sin prefijo: ${no}`);
  }
});

test("renderMenu: página desconocida -> sin «<<» ni aria-current", () => {
  const html = renderMenu("no-existe", "es");
  assert.ok(!html.includes("<<"));
  assert.ok(!html.includes("aria-current"));
});

test("renderMenu: todos los textos llevan data-i18n (refresh in situ)", () => {
  const html = renderMenu("problemas", "es");
  for (const key of ["menu_title", ...SECTION_KEYS, ...LABELS]) {
    assert.ok(html.includes(`data-i18n="${key}"`), key);
  }
});

test("renderMenu: etiquetas traducidas según idioma (index)", () => {
  // En index, "Listado" es la página actual: lleva el prefijo «<< ».
  const es = renderMenu("index", "es");
  assert.match(es, />Menú</);
  assert.ok(es.includes("<< Listado"));
  for (const t of ["Colección", "Países", "Monedas", "Otros", "Lista", "Editar", "Estadísticas", "Problemas"]) {
    assert.match(es, new RegExp(`>${t}</`), t);
  }

  const en = renderMenu("index", "en");
  assert.match(en, />Menu</);
  assert.ok(en.includes("<< Listing"));
  for (const t of ["Collection", "Countries", "Currencies", "Other", "List", "Edit", "Statistics", "Issues"]) {
    assert.match(en, new RegExp(`>${t}</`), t);
  }
});

test("top bar: las 8 páginas HTML tienen button#lang-toggle", () => {
  // Regresión T6: el botón pasó del panel del menú a la top bar HTML;
  // index/index-edit/stats/problemas lo perdieron y applyI18n() de app.js
  // tiraba antes de render() → tabla sin billetes.
  for (const page of PAGES) {
    const html = readFileSync(new URL(`../${page}.html`, import.meta.url), "utf-8");
    assert.ok(
      html.includes('id="lang-toggle"'),
      `${page}.html: falta button#lang-toggle`
    );
  }
});
