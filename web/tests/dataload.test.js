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