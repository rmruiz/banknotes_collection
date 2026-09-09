/* T6: smoke de enlace de módulos.
   Importa app.js / stats.js / problemas.js en Node con stubs mínimos del
   DOM: verifica que el grafo de módulos (imports relativos, sin nombres
   duplicados) enlace y que el código de nivel superior no dependa del
   DOM real (todo el boot está en listeners de DOMContentLoaded). */
import { test } from "node:test";
import assert from "node:assert/strict";

function installDomStubs() {
  const noop = () => {};
  globalThis.window = { location: { pathname: "/" } };
  globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  globalThis.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    createElement: () => ({
      style: {},
      dataset: {},
      classList: { add: noop, remove: noop, toggle: noop },
      appendChild: noop,
    }),
    body: { appendChild: noop },
    documentElement: { style: {} },
  };
}

for (const name of ["app.js", "stats.js", "problemas.js"]) {
  test(`enlace módulo: ${name} (top-level sin DOM real)`, async () => {
    installDomStubs();
    await assert.doesNotReject(
      import(new URL(`../${name}`, import.meta.url).href),
      `${name} debe importarse sin errores de enlace`,
    );
  });
}

test("enlace módulo: lib/menu.js (top-level sin DOM real)", async () => {
  installDomStubs();
  await assert.doesNotReject(
    import(new URL("../lib/menu.js", import.meta.url).href),
    "lib/menu.js debe importarse sin errores de enlace",
  );
});
