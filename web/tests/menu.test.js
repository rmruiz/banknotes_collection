/* Tests de web/lib/menu.js (menú lateral) — ejecutar: node --test web/tests/ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { menuItems, renderMenu } from "../lib/menu.js";

const LANG_BTN = { type: "button", id: "lang-toggle", icon: "lang", labelKey: "menu_lang" };

test("menuItems: ítems y orden por página", () => {
  // index: idioma (botón) + edición + estadísticas
  const idx = menuItems("index");
  assert.deepEqual(idx.map((i) => [i.type, i.icon, i.labelKey]), [
    ["button", "lang", "menu_lang"],
    ["link", "edit", "menu_edit"],
    ["link", "stats", "menu_stats"],
  ]);
  assert.equal(idx[0].id, "lang-toggle");
  assert.deepEqual(idx.filter((i) => i.type === "link").map((i) => i.href), [
    "index-edit.html",
    "stats.html",
  ]);

  // index-edit: idioma (botón) + lectura + estadísticas
  const edit = menuItems("index-edit");
  assert.deepEqual(edit.map((i) => [i.type, i.icon, i.labelKey]), [
    ["button", "lang", "menu_lang"],
    ["link", "reading", "menu_reading"],
    ["link", "stats", "menu_stats"],
  ]);
  assert.equal(edit[0].id, "lang-toggle");
  assert.deepEqual(edit.filter((i) => i.type === "link").map((i) => i.href), [
    "index.html",
    "stats.html",
  ]);

  // stats: catálogo + edición + problemas
  const stats = menuItems("stats");
  assert.deepEqual(stats.map((i) => [i.type, i.icon, i.labelKey]), [
    ["link", "catalog", "menu_catalog"],
    ["link", "edit", "menu_edit"],
    ["link", "problems", "menu_problems"],
  ]);
  assert.deepEqual(stats.map((i) => i.href), ["index.html", "index-edit.html", "problemas.html"]);

  // problemas: catálogo + estadísticas
  const prob = menuItems("problemas");
  assert.deepEqual(prob.map((i) => [i.type, i.icon, i.labelKey]), [
    ["link", "catalog", "menu_catalog"],
    ["link", "stats", "menu_stats"],
  ]);
  assert.deepEqual(prob.map((i) => i.href), ["index.html", "stats.html"]);
});

test("menuItems: página desconocida -> lista vacía", () => {
  assert.deepEqual(menuItems("no-existe"), []);
  assert.deepEqual(menuItems(undefined), []);
  assert.deepEqual(menuItems(""), []);
});

test("menuItems: lang-toggle solo en index e index-edit", () => {
  for (const page of ["index", "index-edit", "stats", "problemas"]) {
    const btns = menuItems(page).filter((i) => i.type === "button");
    if (page === "stats" || page === "problemas") {
      assert.equal(btns.length, 0, page);
    } else {
      assert.deepEqual(btns, [LANG_BTN], page);
    }
  }
});

test("menuItems: devuelve copias (no expone estado interno)", () => {
  const a = menuItems("index");
  a.push({ type: "link", href: "x.html" });
  a[0].href = "mutado";
  const b = menuItems("index");
  assert.equal(b.length, 3);
  assert.equal(b[0].id, "lang-toggle");
});

test("renderMenu: botón de idioma solo en index e index-edit", () => {
  assert.match(renderMenu("index", "es"), /id="lang-toggle"/);
  assert.match(renderMenu("index-edit", "es"), /id="lang-toggle"/);
  assert.doesNotMatch(renderMenu("stats", "es"), /id="lang-toggle"/);
  assert.doesNotMatch(renderMenu("problemas", "es"), /id="lang-toggle"/);
});

test("renderMenu: hrefs y etiquetas por idioma (index)", () => {
  const es = renderMenu("index", "es");
  for (const href of ["index-edit.html", "stats.html"]) {
    assert.match(es, new RegExp(`href="${href}"`));
  }
  assert.match(es, />Edición</);
  assert.match(es, />Estadísticas</);
  assert.match(es, />Idioma</);
  assert.match(es, />Menú</);

  const en = renderMenu("index", "en");
  assert.match(en, />Edit</);
  assert.match(en, />Statistics</);
  assert.match(en, />Language</);
  assert.match(en, />Menu</);
});

test("renderMenu: stats y problemas enlazan a las páginas correctas", () => {
  const s = renderMenu("stats", "es");
  for (const href of ["index.html", "index-edit.html", "problemas.html"]) {
    assert.match(s, new RegExp(`href="${href}"`));
  }
  assert.match(s, />Problemas</);
  assert.match(s, />Catálogo</);

  const p = renderMenu("problemas", "es");
  assert.match(p, /href="index.html"/);
  assert.match(p, /href="stats.html"/);
  assert.doesNotMatch(p, /index-edit\.html/);
});

test("renderMenu: página desconocida -> panel sin ítems", () => {
  assert.doesNotMatch(renderMenu("no-existe", "es"), /side-menu-item/);
});