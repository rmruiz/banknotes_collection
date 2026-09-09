/* Tests de web/lib/menu.js (menú lateral) — ejecutar: node --test web/tests/ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { menuItems, renderMenu } from "../lib/menu.js";

const PAGES = ["index", "index-edit", "stats", "problemas"];
const LABELS = ["menu_lang", "menu_catalog", "menu_edit", "menu_stats", "menu_problems"];
const HREFS = ["index.html", "index-edit.html", "stats.html", "problemas.html"];
const CURRENT_BY_PAGE = {
  index: "index.html",
  "index-edit": "index-edit.html",
  stats: "stats.html",
  problemas: "problemas.html",
};

test("menuItems: SIEMPRE todas las opciones en las 4 páginas", () => {
  for (const page of PAGES) {
    const items = menuItems(page);
    assert.equal(items.length, 5, `${page}: 5 ítems`);
    assert.deepEqual(items.map((i) => i.labelKey), LABELS, `${page}: orden`);
    assert.equal(items[0].type, "button", `${page}: primero el botón de idioma`);
    assert.equal(items[0].id, "lang-toggle", page);
    for (const it of items.slice(1)) assert.equal(it.type, "link", `${page}: links`);
    assert.deepEqual(items.slice(1).map((i) => i.href), HREFS, `${page}: hrefs`);
  }
});

test("menuItems: marca current=true solo en la página actual", () => {
  for (const [page, href] of Object.entries(CURRENT_BY_PAGE)) {
    const items = menuItems(page);
    const cur = items.filter((i) => i.current);
    assert.equal(cur.length, 1, `${page}: un solo actual`);
    assert.equal(cur[0].href, href, `${page}: el actual es ${href}`);
    assert.equal(items[0].current, undefined, `${page}: lang nunca es actual`);
  }
});

test("menuItems: página desconocida -> todas las opciones, ninguna current", () => {
  for (const bad of ["no-existe", undefined, ""]) {
    const items = menuItems(bad);
    assert.equal(items.length, 5);
    assert.equal(items[0].type, "button");
    assert.equal(items[0].id, "lang-toggle");
    assert.ok(!items.some((i) => i.current));
  }
});

test("menuItems: devuelve objetos nuevos (mutar no altera la lista base)", () => {
  // En "stats" el ítem actual es [3] (stats.html).
  const a = menuItems("stats");
  a[0].labelKey = "HACK";
  a[1].href = "hacked.html";
  a[3].current = false;
  const b = menuItems("stats");
  assert.equal(b[0].labelKey, "menu_lang");
  assert.equal(b[1].href, "index.html");
  assert.equal(b[3].current, true);
});

test("renderMenu: la página actual lleva «<< », aria-current y clase .current", () => {
  const html = renderMenu("stats", "es");
  assert.ok(html.includes('class="side-menu-item current"'), "clase current");
  assert.equal(html.match(/aria-current="page"/g).length, 1, "un solo aria-current");
  assert.ok(html.includes("<< Estadísticas"), "prefijo << en la etiqueta actual");
  for (const no of ["<< Catálogo", "<< Edición", "<< Problemas"]) {
    assert.ok(!html.includes(no), `sin prefijo: ${no}`);
  }
});

test("renderMenu: página desconocida -> sin «<<» ni aria-current", () => {
  const html = renderMenu("no-existe", "es");
  assert.ok(!html.includes("<<"));
  assert.ok(!html.includes("aria-current"));
});

test("renderMenu: todas las etiquetas llevan data-i18n (refresh in situ)", () => {
  const html = renderMenu("problemas", "es");
  for (const key of ["menu_title", "menu_lang", "menu_catalog", "menu_edit", "menu_stats", "menu_problems"]) {
    assert.ok(html.includes(`data-i18n="${key}"`), key);
  }
});

test("renderMenu: botón de idioma y los 4 links presentes en las 4 páginas", () => {
  for (const page of PAGES) {
    const html = renderMenu(page, "es");
    assert.match(html, /id="lang-toggle"/, page);
    for (const href of HREFS) {
      assert.match(html, new RegExp(`href="${href}"`), `${page}: ${href}`);
    }
  }
});

test("renderMenu: etiquetas traducidas según idioma (index)", () => {
  // En index, "Catálogo" es la página actual: lleva el prefijo «<< ».
  const es = renderMenu("index", "es");
  assert.match(es, />Menú</);
  assert.ok(es.includes("<< Catálogo"));
  for (const t of ["Idioma", "Edición", "Estadísticas", "Problemas"]) {
    assert.match(es, new RegExp(`>${t}</`), t);
  }
  for (const no of ["<< Edición", "<< Estadísticas", "<< Problemas"]) {
    assert.ok(!es.includes(no), `sin prefijo: ${no}`);
  }

  const en = renderMenu("index", "en");
  assert.match(en, />Menu</);
  assert.ok(en.includes("<< Catalog"));
  for (const t of ["Language", "Edit", "Statistics", "Issues"]) {
    assert.match(en, new RegExp(`>${t}</`), t);
  }
});