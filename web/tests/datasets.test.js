/* Tests del núcleo puro de web/lib/datasets.js (T3): rutas punteadas,
   aplanado de registros (null→"", uso.* → texto con comas, `search`),
   filtro global (query.js), orden (alfabético/numérico, vacíos al final)
   y paginación. Cadenas con acentos para probar el tratamiento de acentos. */
import test from "node:test";
import assert from "node:assert/strict";

import {
  getByPath, setByPath, rowFor, filterRows, sortRows, paginate,
  listToText, textToList, valueForEdit, flatValue, editTypeFor,
  COUNTRIES_COLS, CURRENCIES_COLS,
} from "../lib/datasets.js";

// registro de país de prueba (forma idéntica a _json/countries.json)
const cl = {
  code: "cl",
  iso_alpha2: "CL",
  iso_numeric: "152",
  name: { es: "Chile", en: "Chile" },
  vigente: "si",
  flag_svg: "cl.svg",
  folder: "world",
  moneda_vigente: "CLP",
};
const py = {
  code: "py",
  iso_alpha2: "PY",
  iso_numeric: "600",
  name: { es: "Paraguay", en: "Paraguay" },
  vigente: "si",
  flag_svg: "py.svg",
  folder: "world",
  moneda_vigente: "PYG",
};
const ae = {
  code: "ae",
  iso_alpha2: "AE",
  iso_numeric: "784",
  name: { es: "Emiratos Árabes Unidos", en: "United Arab Emirates" },
  vigente: "si",
  flag_svg: "ae.svg",
  folder: "world",
  moneda_vigente: null,   // moneda_vigente nulo -> "" aplanado
};

test("getByPath: rutas punteadas y tramos ausentes", () => {
  assert.equal(getByPath({ a: { b: { c: 5 } } }, "a.b.c"), 5);
  assert.equal(getByPath({ a: { b: {} } }, "a.b.c"), undefined);
  assert.equal(getByPath(null, "a.b"), undefined);
  assert.equal(getByPath({ a: [1, 2] }, "a.0"), 1);
});

test("setByPath: crea intermedarios y escribe null", () => {
  const d = {};
  setByPath(d, "iso_4217.decimales", 2);
  setByPath(d, "historia.fecha_fin", null);
  setByPath(d, "subunidad.factor", 100);
  assert.deepEqual(d, {
    iso_4217: { decimales: 2 },
    historia: { fecha_fin: null },
    subunidad: { factor: 100 },
  });
  // si el tramo intermedio no es objeto, se reemplaza por objeto nuevo
  const d2 = { a: 5 };
  setByPath(d2, "a.b", "x");
  assert.deepEqual(d2, { a: { b: "x" } });
});

test("flatValue/listToText/textToList: null y listas a texto con comas", () => {
  assert.equal(flatValue(null), "");
  assert.equal(flatValue(["AE", "CM"]), "AE, CM");
  assert.equal(flatValue(2), "2");
  assert.equal(listToText(["AE", "CM"]), "AE, CM");
  assert.equal(listToText(null), "");
  assert.deepEqual(textToList("AE, CM, CL"), ["AE", "CM", "CL"]);
  assert.deepEqual(textToList(""), []);
  assert.equal(textToList(null), null);
  // espacios y vacíos se limpian
  assert.deepEqual(textToList("CL , , PY "), ["CL", "PY"]);
});

test("valueForEdit: tipos text/number/list", () => {
  assert.equal(valueForEdit("CL", "text"), "CL");
  assert.equal(valueForEdit("", "text"), null);
  assert.equal(valueForEdit("  ", "text"), null);
  assert.equal(valueForEdit("2", "number"), 2);
  assert.equal(valueForEdit("3,5", "number"), 3.5);
  assert.equal(valueForEdit("", "number"), null);
  assert.equal(valueForEdit("abc", "number"), null);
  assert.deepEqual(valueForEdit("AE, CM", "list"), ["AE", "CM"]);
  assert.deepEqual(valueForEdit("", "list"), []);
  assert.deepEqual(valueForEdit(null, "list"), []);
});

test("rowFor: aplanado + code + search (minúsculas sin acentos)", () => {
  const row = rowFor("cl", cl, COUNTRIES_COLS);
  assert.equal(row.code, "cl");
  assert.equal(row["name.es"], "Chile");
  assert.equal(row["name.en"], "Chile");
  assert.equal(row.iso_numeric, "152");
  assert.equal(row.vigente, "si");
  assert.equal(row.flag_svg, "cl.svg");
  assert.equal(row.moneda_vigente, "CLP");
  // search: todos los campos, minúsculas, sin acentos
  assert.ok(row.search.includes("chile"));
  assert.ok(row.search.includes("cl"));
  assert.ok(!row.search.includes("Á"));
  // registro con acentos en el nombre
  const rowAe = rowFor("ae", ae, COUNTRIES_COLS);
  assert.ok(rowAe.search.includes("emiratos arabes unidos"));
});

test("filterRows: vacío -> todos; global por palabra (acentos)", () => {
  const rows = [rowFor("cl", cl, COUNTRIES_COLS),
                rowFor("py", py, COUNTRIES_COLS),
                rowFor("ae", ae, COUNTRIES_COLS)];
  assert.equal(filterRows(rows, "").length, 3);
  assert.equal(filterRows(rows, "   ").length, 3);
  // acentos: buscar "emiratos" pilla "Emiratos Árabes Unidos"
  assert.deepEqual(filterRows(rows, "emiratos").map((r) => r.code), ["ae"]);
  // negación
  assert.deepEqual(filterRows(rows, "-chile").map((r) => r.code), ["py", "ae"]);
  // grupo en columna
  assert.deepEqual(filterRows(rows, "code:(cl py)").map((r) => r.code), ["cl", "py"]);
});

test("sortRows: alfabético es, numérico, vacíos al final, no muta", () => {
  const rows = [rowFor("py", py, COUNTRIES_COLS),
                rowFor("ae", ae, COUNTRIES_COLS),
                rowFor("cl", cl, COUNTRIES_COLS)];
  const byName = sortRows(rows, "name_es", 1, COUNTRIES_COLS).map((r) => r.code);
  // colación es: "Chile" < "Emiratos Árabes Unidos" < "Paraguay"
  assert.deepEqual(byName, ["cl", "ae", "py"]);
  // orden inverso
  const byNameDesc = sortRows(rows, "name_es", -1, COUNTRIES_COLS).map((r) => r.code);
  assert.deepEqual(byNameDesc, ["py", "ae", "cl"]);
  // numérico: "99" vs "100" (string y numérico difieren)
  const rec99 = { ...cl, iso_numeric: "99", code: "zz", name: { es: "Zzz", en: "Zzz" } };
  const rec100 = { ...py, iso_numeric: "100", code: "yy", name: { es: "Yyy", en: "Yyy" } };
  const numRows = [rowFor("yy", rec100, COUNTRIES_COLS), rowFor("zz", rec99, COUNTRIES_COLS)];
  assert.deepEqual(sortRows(numRows, "iso_numeric", 1, COUNTRIES_COLS).map((r) => r.iso_numeric),
    ["99", "100"]);
  // vacíos al final en ambas direcciones
  const withEmpty = [
    { code: "a", iso_numeric: "" },
    { code: "b", iso_numeric: "2" },
    { code: "c", iso_numeric: "1" },
  ];
  const cols = [{ key: "iso_numeric", fields: ["iso_numeric"], numeric: true }];
  assert.deepEqual(sortRows(withEmpty, "iso_numeric", 1, cols).map((r) => r.code), ["c", "b", "a"]);
  assert.deepEqual(sortRows(withEmpty, "iso_numeric", -1, cols).map((r) => r.code), ["b", "c", "a"]);
  // no muta el array original
  const orig = [rows[0], rows[1]];
  const sorted = sortRows(orig, "name_es", 1, COUNTRIES_COLS);
  assert.notEqual(sorted, orig);
  assert.deepEqual(orig, [rows[0], rows[1]]);
});

test("sortRows: columnas combinadas ordenan por el primer campo", () => {
  const r1 = { codigo: "A", "subunidad.nombres.es": "céntimo", "subunidad.factor": 100 };
  const r2 = { codigo: "B", "subunidad.nombres.es": "peso", "subunidad.factor": 10 };
  const rows = [r2, r1];
  const cols = CURRENCIES_COLS;
  // "céntimo" < "peso" (colación es) aunque el factor de B sea menor:
  // la columna combinada ordena SOLO por el primer campo
  assert.deepEqual(sortRows(rows, "subunidad", 1, cols).map((r) => r.codigo), ["A", "B"]);
});

test("paginate: slices, pages mínimo 1, page recortado", () => {
  const rows = Array.from({ length: 52 }, (_, i) => ({ i }));
  assert.deepEqual(paginate(rows, 1, 25), { slice: rows.slice(0, 25), pages: 3, page: 1 });
  assert.deepEqual(paginate(rows, 3, 25).slice, rows.slice(50, 52));
  // page fuera de rango -> recorte
  assert.equal(paginate(rows, 99, 25).page, 3);
  assert.equal(paginate(rows, 0, 25).page, 1);
  // 0 filas -> 1 página
  assert.deepEqual(paginate([], 1, 25), { slice: [], pages: 1, page: 1 });
});

test("editTypeFor: columnas combinadas usan types[i]; default text", () => {
  const sub = CURRENCIES_COLS.find((c) => c.key === "subunidad");
  assert.equal(editTypeFor(sub, "subunidad.nombres.es"), "text");
  assert.equal(editTypeFor(sub, "subunidad.factor"), "number");
  const banco = CURRENCIES_COLS.find((c) => c.key === "banco_central");
  assert.equal(editTypeFor(banco, "banco_central.nombre"), "text");
  const vigente = COUNTRIES_COLS.find((c) => c.key === "vigente");
  assert.equal(editTypeFor(vigente, "vigente"), "select");
  const uso = CURRENCIES_COLS.find((c) => c.key === "uso_emisor");
  assert.equal(editTypeFor(uso, "uso.emisor"), "list");
  const name = COUNTRIES_COLS.find((c) => c.key === "name_es");
  assert.equal(editTypeFor(name, "name.es"), "text");
});

test("COUNTRIES_COLS/CURRENCIES_COLS: keys únicas y labelKey presente", () => {
  for (const cols of [COUNTRIES_COLS, CURRENCIES_COLS]) {
    const keys = new Set(cols.map((c) => c.key));
    assert.equal(keys.size, cols.length, "keys de columna únicas");
    for (const c of cols) {
      assert.ok(c.labelKey, `labelKey en ${c.key}`);
      assert.ok(c.fields.length >= 1, `fields en ${c.key}`);
    }
  }
});
