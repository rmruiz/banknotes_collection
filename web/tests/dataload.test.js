/* Tests del guard de carga de datos (T11): showDataError/isLocal con stub
   mínimo de DOM (mismo enfoque que module_smoke.test.js). */
import test from "node:test";
import assert from "node:assert/strict";

function makeDom(hostname) {
  function makeEl(tag) {
    return {
      tagName: String(tag).toUpperCase(),
      className: "",
      textContent: "",
      children: [],
      appendChild(c) { this.children.push(c); return c; },
      prepend(c) { this.children.unshift(c); return c; },
    };
  }
  const body = makeEl("body");
  globalThis.window = { location: { hostname } };
  globalThis.document = { body, createElement: (t) => makeEl(t) };
  return { body };
}

test("isLocal: solo localhost/127.0.0.1", async () => {
  makeDom("localhost");
  const { isLocal } = await import("../lib/dataload.js");
  assert.equal(isLocal(), true);
  makeDom("127.0.0.1");
  assert.equal(isLocal(), true);
  makeDom("banknotes.web.app");
  assert.equal(isLocal(), false);
});

test("showDataError: banner .data-error al inicio del root, una <p> por línea", async () => {
  const { body } = makeDom("localhost");
  const { showDataError } = await import("../lib/dataload.js");
  showDataError(body, ["l1", "l2"]);
  const box = body.children[0];
  assert.equal(box.tagName, "DIV");
  assert.equal(box.className, "data-error");
  assert.equal(box.children.length, 2);
  assert.deepEqual(box.children.map((p) => p.textContent), ["l1", "l2"]);
});

test("showDataError: textContent — el contenido no se parsea como HTML", async () => {
  const { body } = makeDom("localhost");
  const { showDataError } = await import("../lib/dataload.js");
  showDataError(body, ['<img src=x onerror="alert(1)">']);
  const p = body.children[0].children[0];
  assert.equal(p.textContent, '<img src=x onerror="alert(1)">');
  assert.equal(p.children.length, 0);
});

test("hideEditLinks: fuera de localhost oculta todos los links -edit.html; en local no toca nada", async () => {
  const els = [
    { href: "index-edit.html", style: {} },
    { href: "countries-edit.html", style: {} },
    { href: "index.html", style: {} },
  ];
  makeDom("banknotes.web.app");
  globalThis.document.querySelectorAll = (sel) => {
    assert.equal(sel, 'a[href$="-edit.html"]');
    return els.filter((e) => /-edit\.html$/.test(e.href));
  };
  const { hideEditLinks } = await import("../lib/dataload.js");
  hideEditLinks();
  assert.equal(els[0].style.display, "none");
  assert.equal(els[1].style.display, "none");
  assert.equal(els[2].style.display, undefined);
  // Modo local: no toca los links (ni restaura, ni oculta).
  els[0].style.display = "";
  makeDom("localhost");
  hideEditLinks();
  assert.equal(els[0].style.display, "");
});

test("useMidImages: producción remapea img_* a _MID; local conserva originales", async () => {
  const { useMidImages } = await import("../lib/dataload.js");
  const rec = {
    img_a: "_originals/ab-p3a/ab-p3a_A.jpg?v=1", mid_a: "_MID/ab-p3a_A.webp?v=1",
    img_b: "_originals/ab-p3a/ab-p3a_B.jpg?v=2", mid_b: "_MID/ab-p3a_B.webp?v=2",
    img_full: "_FULL/ab-p3a.webp?v=3", mid_full: "_MID/ab-p3a_F.webp?v=3",
  };
  // local (modo admin): intacto — el zoom carga el original
  makeDom("localhost");
  useMidImages([rec]);
  assert.ok(rec.img_a.startsWith("_originals/"));
  assert.ok(rec.img_full.startsWith("_FULL/"));
  // producción: cada img_* con media disponible pasa a _MID
  makeDom("banknotes.web.app");
  useMidImages([rec]);
  assert.equal(rec.img_a, "_MID/ab-p3a_A.webp?v=1");
  assert.equal(rec.img_b, "_MID/ab-p3a_B.webp?v=2");
  assert.equal(rec.img_full, "_MID/ab-p3a_F.webp?v=3");
});

test("useMidImages: sin media o sin claves se conserva la ruta original", async () => {
  makeDom("banknotes.web.app");
  const { useMidImages } = await import("../lib/dataload.js");
  const sinMedia = { img_a: "_originals/x/x_A.jpg?v=9", mid_a: "" };
  const items = [sinMedia, ["archivo.json", "error"], { id: "huérfana", img_a: "_originals/o/A.jpg" }];
  useMidImages(items);
  assert.equal(sinMedia.img_a, "_originals/x/x_A.jpg?v=9");
  assert.deepEqual(items[1], ["archivo.json", "error"]);
  assert.equal(items[2].img_a, "_originals/o/A.jpg");
});