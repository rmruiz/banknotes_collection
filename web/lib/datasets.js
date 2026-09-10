/* Motor compartido de las páginas de datasets (countries/currencies, T3).
   El JSON es un DICCIONARIO: la clave es la identidad (no hay `id` aparte)
   y el orden estable es el orden de inserción del archivo (lo conserva
   render(); los encabezados permiten ordenar por columna sin mutarlo).

   Dos capas:
   1) Núcleo puro (testeable en Node, ver web/tests/datasets.test.js):
      getByPath/setByPath (rutas punteadas), rowFor (aplana un registro a
      los campos de las columnas: null→"", listas uso.*→texto con comas,
      e incluye `search` para la búsqueda global de query.js), filterRows
      (parseQuery/matches de query.js sobre los campos aplanados),
      sortRows (numérico para decimales/factor/iso_numeric; vacíos al final)
      y paginate.
   2) Capa DOM: initDatasetPage(dataset, { edit }) — fetch de
      data/{dataset}.json, tabla con th data-sort, #q sticky, footer con
      #perpage (25/50/100) + #pager y mensaje de estado; en modo edición
      cada celda se edita inline (text / number / select para vigente /
      texto con comas para uso.*) y Enter/blur guardan vía
      POST /api/update_dataset {dataset, code, field, value}.

   Los sub-campos anidados NO expuestos como columna (subunidad.codigo,
   subunidad.nombres.en, nombre_corto.es_p/en/en_p) quedan fuera de
   alcance V1: no se muestran ni se editan (documentado para trazabilidad).
   Columnas combinadas (subunidad, banco_central): cada parte es una
   sub-celda editable independiente. La celda nombre AR usa dir="rtl". */

import { unaccent, esc, isEmptyVal } from "./format.js";
import { parseQuery, matches } from "./query.js";
import { showDataError, hideEditLinks } from "./dataload.js";
import { translate } from "./i18n.js";

/* --- núcleo puro ---------------------------------------------------------- */

// getByPath(obj, "a.b.c"): undefined si falta algún tramo.
export function getByPath(obj, path) {
  let cur = obj;
  for (const part of String(path).split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

// setByPath(obj, "a.b.c", v): crea los objetos intermedarios que falten y
// escribe `v` (puede ser null). No valida tipos: la validación la hace la
// API (whitelist por campo). Devuelve el mismo obj (mutado).
export function setByPath(obj, path, value) {
  const parts = String(path).split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === null || typeof cur[p] !== "object" || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

// listas uso.* -> texto editable ("AE, CM"); null/undefined -> "".
export function listToText(v) {
  if (!Array.isArray(v)) return v === null || v === undefined ? "" : String(v);
  return v.join(", ");
}

// texto editable -> lista ("" -> []; entrada null/undefined -> null para
// campos str|null — ver valueForEdit).
export function textToList(v) {
  if (v === null || v === undefined) return null;
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}

// Valor a guardar a partir del texto de la celda según el tipo de campo:
//  - list  : "" -> [] (uso.* es lista, nunca null)
//  - number: "" -> null; número -> Number (NaN -> null; el caller valida)
//  - texto : "" -> null (str|null en pantalla/guardado)
export function valueForEdit(text, type) {
  if (type === "list") return textToList(text) || [];
  if (type === "number") {
    if (text === null || String(text).trim() === "") return null;
    const n = Number(String(text).trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const s = String(text === null ? "" : text).trim();
  return s === "" ? null : s;
}

// Valor "aplanado" para pantalla/búsqueda de un campo: null->""; listas ->
// texto con comas; números -> String.
export function flatValue(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

// rowFor(key, record, cols): objeto con `code` (la clave del diccionario) +
// un campo por cada ruta punteada de cada columna (valores aplanados) +
// `search` (concatenación en minúscula sin acentos de TODOS los campos,
// para la búsqueda global de query.js — mismo contrato que collection.json).
export function rowFor(key, record, cols) {
  const row = { code: key };
  for (const col of cols) {
    for (const f of col.fields) {
      row[f] = flatValue(getByPath(record, f));
    }
  }
  row.search = unaccent(Object.values(row).join(" ")).toLowerCase();
  return row;
}

// filterRows(rows, q): sin q -> mismos rows; con q -> parseQuery + matches
// (mismo motor de búsqueda que la tabla de billetes: acentos, col:val, …).
export function filterRows(rows, q) {
  const query = (q || "").trim();
  if (!query) return rows;
  const tests = parseQuery(query);
  if (!tests.length) return rows;
  return rows.filter((r) => matches(r, tests));
}

// sortRows(rows, colKey, dir, cols): devuelve un array NUEVO (no muta).
// Columna numérica (col.numeric) -> comparación numérica; resto ->
// localeCompare es (numeric: true). Vacíos (""/null) SIEMPRE al final, sin
// importar la dirección (mismo contrato que sortRecords de query.js).
// Columna combinada: ordena por su primer campo.
export function sortRows(rows, colKey, dir, cols) {
  if (!colKey) return rows;
  const col = (cols || []).find((c) => c.key === colKey);
  const field = col ? col.fields[0] : colKey;
  const numeric = col ? !!col.numeric : false;
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };
  return [...rows].sort((a, b) => {
    const va = a[field];
    const vb = b[field];
    const ea = isEmptyVal(va), eb = isEmptyVal(vb);
    if (ea && eb) return 0;
    if (ea) return 1;
    if (eb) return -1;
    let c;
    if (numeric) {
      const na = toNum(va), nb = toNum(vb);
      c = (Number.isNaN(na) ? 0 : na) - (Number.isNaN(nb) ? 0 : nb);
    } else {
      c = String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
    }
    return c * (dir || 1);
  });
}

// paginate(rows, page, perPage) -> { slice, pages, page }: pages >= 1 y page
// recortado a [1, pages].
export function paginate(rows, page, perPage) {
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const cur = Math.min(Math.max(1, page || 1), pages);
  const start = (cur - 1) * perPage;
  return { slice: rows.slice(start, start + perPage), pages, page: cur };
}

/* --- configuración declarativa por dataset -------------------------------- */

// Cada columna:
//   key      -> data-col / data-sort (clave interna de orden)
//   labelKey -> clave i18n del encabezado (web/lib/i18n.js)
//   fields   -> rutas punteadas (1 = normal; 2 = columna combinada, cada
//               parte es sub-celda editable independiente)
//   types    -> tipo de edición por sub-celda (columna combinada)
//   numeric  -> orden numérico
//   type     -> "text" (default) | "number" | "select" | "list"
//   options  -> opciones del select (type "select")
//   rtl      -> celda dir="rtl" (nombre árabe)
//   preview  -> "flag": celda de preview <img src="_flags_svg/{flag_svg}"> 
//   readOnly -> no editable (la clave es la identidad del registro)
export const COUNTRIES_COLS = [
  { key: "code", labelKey: "code", fields: ["code"], readOnly: true },
  { key: "iso_alpha2", labelKey: "iso2", fields: ["iso_alpha2"] },
  { key: "iso_numeric", labelKey: "isonum", fields: ["iso_numeric"], numeric: true },
  { key: "flag_svg", labelKey: "flag", fields: ["flag_svg"], preview: "flag" },
  { key: "name_es", labelKey: "name_es", fields: ["name.es"] },
  { key: "name_en", labelKey: "name_en", fields: ["name.en"] },
  { key: "vigente", labelKey: "vigente", fields: ["vigente"], type: "select", options: ["si", "no"] },
  { key: "moneda_vigente", labelKey: "currency_code", fields: ["moneda_vigente"] },
  { key: "folder", labelKey: "folder", fields: ["folder"] },
];

export const CURRENCIES_COLS = [
  { key: "codigo", labelKey: "code", fields: ["codigo"], readOnly: true },
  { key: "iso_numeric", labelKey: "currency_code", fields: ["iso_4217.numerico"], numeric: true },
  { key: "decimales", labelKey: "decimales", fields: ["iso_4217.decimales"], numeric: true, type: "number" },
  { key: "simbolo", labelKey: "simbolo", fields: ["simbolo"] },
  { key: "nombres_es", labelKey: "name_es", fields: ["nombres.es"] },
  { key: "nombres_en", labelKey: "name_en", fields: ["nombres.en"] },
  { key: "nombres_ar", labelKey: "name_ar", fields: ["nombres.ar"], rtl: true },
  { key: "nombre_corto_es", labelKey: "name_short", fields: ["nombre_corto.es"] },
  { key: "tipo", labelKey: "tipo", fields: ["tipo"] },
  { key: "estado", labelKey: "estado", fields: ["estado"] },
  { key: "subunidad", labelKey: "subunidad",
    fields: ["subunidad.nombres.es", "subunidad.factor"],
    types: ["text", "number"] },
  { key: "banco_central", labelKey: "banco_central",
    fields: ["banco_central.nombre", "banco_central.codigo"] },
  { key: "fecha_introduccion", labelKey: "fecha_intro", fields: ["historia.fecha_introduccion"] },
  { key: "fecha_fin", labelKey: "fecha_fin", fields: ["historia.fecha_fin"] },
  { key: "moneda_anterior", labelKey: "moneda_ant", fields: ["historia.moneda_anterior"] },
  { key: "moneda_sucesora", labelKey: "moneda_suc", fields: ["historia.moneda_sucesora"] },
  { key: "uso_emisor", labelKey: "uso_emisor", fields: ["uso.emisor"], type: "list" },
  { key: "uso_curso_legal", labelKey: "uso_legal", fields: ["uso.curso_legal"], type: "list" },
  { key: "uso_circulacion", labelKey: "uso_circ", fields: ["uso.circulacion"], type: "list" },
  { key: "uso_de_facto", labelKey: "uso_facto", fields: ["uso.de_facto"], type: "list" },
  { key: "notas", labelKey: "notas", fields: ["notas"] },
];

export const DATASETS = {
  countries: { cols: COUNTRIES_COLS, titleKey: "countries_title",
               searchKey: "countries_search_ph" },
  currencies: { cols: CURRENCIES_COLS, titleKey: "currencies_title",
                searchKey: "currencies_search_ph" },
};

// tipo de edición de un campo dentro de su columna (columna combinada:
// col.types[i] por sub-celda i; si no, col.type; default "text").
export function editTypeFor(col, field) {
  const i = col.fields.indexOf(field);
  if (i >= 0 && Array.isArray(col.types) && col.types[i]) return col.types[i];
  return col.type || "text";
}

/* --- capa DOM -------------------------------------------------------------- */

const $ = (sel) => document.querySelector(sel);
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// pager compacto (misma lógica visual que app.js: 1 … cur-1 cur cur+1 … last)
function pageList(cur, last) {
  const set = new Set([1, 2, cur - 1, cur, cur + 1, last - 1, last]);
  const list = [...set].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of list) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

// pager de retorno de la página de colección (mismo que #pager de app.js).
export function renderPagerTo(el, state, t) {
  const { pages, page } = paginate(state.filtered, state.page, state.perPage);
  const btn = (label, p, opts = {}) => {
    if (opts.gap) return `<span class="gap">…</span>`;
    const cls = [opts.current ? "current" : "", opts.nav ? "nav" : ""].join(" ").trim();
    const dis = opts.disabled ? " disabled" : "";
    return `<button class="${cls}" data-page="${p}"${dis}>${label}</button>`;
  };
  let html = btn("«", page - 1, { nav: true, disabled: page <= 1 });
  for (const p of pageList(page, pages)) {
    html += p === "…" ? btn("", 0, { gap: true }) : btn(p, p, { current: p === page });
  }
  html += btn("»", page + 1, { nav: true, disabled: page >= pages });
  html += `<form class="page-jump" aria-label="${t("page_label")}">
    <input type="number" min="1" max="${pages}" value="${page}" class="page-jump-input"
           aria-label="${t("page_label")}">
    <button type="submit">${t("page_go")}</button>
  </form>`;
  el.innerHTML = html;
  return { pages, page };
}

/* --- initDatasetPage -------------------------------------------------------- */

// initDatasetPage(dataset, { edit }):
//   dataset = "countries" | "currencies" (páginas de los tasks 4-7)
//   edit    = true en *-edit.html (celdas editables inline)
// Expone state.applyI18n para que el toggle de idioma (lib/lang.js) pueda
// re-aplicar el i18n tras actualizar state.lang; el panel del menú se
// refresca en el sitio por lang.js (refreshMenuLang).
export async function initDatasetPage(dataset, { edit = false } = {}) {
  const cfg = DATASETS[dataset];
  if (!cfg) throw new Error(`dataset desconocido: ${dataset}`);
  const cols = cfg.cols;

  const state = {
    dataset, edit,
    records: {},      // clave -> registro (orden de inserción del JSON)
    all: [],          // filas aplanadas (mismo orden)
    filtered: [],
    sort: { key: null, dir: 1 },
    page: 1,
    perPage: 25,
    lang: localStorage.getItem("banknotes_lang") === "en" ? "en" : "es",
  };
  window.__datasetPage = state;   // para tests/QA manual

  const t = (key) => translate(key, state.lang);

  /* --- i18n (lo llama la página al cambiar de idioma) --- */
  function applyI18n() {
    document.documentElement.lang = state.lang;
    const titleKey = state.edit ? `${dataset}_edit_title` : cfg.titleKey;
    document.title = t(titleKey);
    // el <h1> lleva un icono SVG: solo se reemplaza el texto
    const h1 = $("#page-title-text") || $("#top h1");
    if (h1) h1.textContent = t(titleKey);
    const q = $("#q");
    if (q) q.placeholder = t(cfg.searchKey);
    document.querySelectorAll("#tbl thead th[data-label]").forEach((th) => {
      const span = th.querySelector(".th-label");
      if (span) span.textContent = t(th.dataset.label); else th.textContent = t(th.dataset.label);
    });
    const pl = $("#perpage-label");
    if (pl) pl.firstChild.nodeValue = t("perpage") + " ";
    render();
  }
  state.applyI18n = applyI18n;   // para el toggle de idioma (lib/lang.js)

  /* --- estado (footer) --- */
  let statusTimer = null;
  function setStatus(kind) {
    const el = $("#ds-status");
    if (!el) return;
    clearTimeout(statusTimer);
    if (kind === "ok") {
      el.textContent = t("saved_ok");
      el.className = "ds-status ok";
      statusTimer = setTimeout(() => { el.textContent = ""; el.className = "ds-status"; }, 2500);
    } else if (kind === "err") {
      el.textContent = t("err_save");
      el.className = "ds-status err";
    } else { el.textContent = ""; el.className = "ds-status"; }
  }

  /* --- fetch de datos --- */
  let res;
  try {
    res = await fetch(`data/${dataset}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    for (const [key, rec] of Object.entries(data)) {
      state.records[key] = rec;
      state.all.push(rowFor(key, rec, cols));
    }
  } catch (err) {
    showDataError(document.querySelector("main") || document.body,
      [t("data_err"), t("data_err_build")]);
    return state;
  }
  state.filtered = state.all;

  /* --- thead (data-sort + data-label i18n) --- */
  const thead = $("#tbl thead");
  if (thead) {
    thead.innerHTML = `<tr>${cols.map((c) => {
      const cls = [c.numeric ? "num" : "", c.fields.length > 1 ? "combined" : ""]
        .join(" ").trim();
      return `<th data-col="${esc(c.key)}" data-sort="${esc(c.key)}" data-label="${esc(c.labelKey)}"${cls ? ` class="${cls}"` : ""}><span class="th-label">${esc(translate(c.labelKey, state.lang))}</span></th>`;
    }).join("")}</tr>`;
  }

  /* --- celdas --- */
  function cellHtml(row, col) {
    const isEdit = state.edit;
    return col.fields.map((f) => {
      const val = row[f];
      const type = editTypeFor(col, f);
      if (col.preview === "flag") {
        return `<td class="flag-cell" data-col="${esc(col.key)}">
          ${val ? `<img src="_flags_svg/${esc(val)}" alt="${esc(val)}" loading="lazy">` : ""}</td>`;
      }
      const editable = isEdit && !col.readOnly;
      const cls = [
        col.rtl ? "rtl-cell" : "",
        editable ? "editable" : "",
        col.numeric ? "num" : "",
        col.fields.length > 1 ? "ds-subcell" : "",
      ].join(" ").trim();
      const editAttrs = editable ? ` data-field="${esc(f)}" data-type="${esc(type)}"` : "";
      const dir = col.rtl ? ' dir="rtl"' : "";
      return `<td class="${cls}" data-col="${esc(col.key)}"${editAttrs}${dir}>${esc(val)}</td>`;
    }).join("");
  }

  function refreshRows() {
    // re-aplana los registros (tras un guardado) conservando clave/orden
    state.all = Object.keys(state.records).map((k) => rowFor(k, state.records[k], cols));
    recompute();
  }

  function recompute() {
    state.filtered = filterRows(state.all, $("#q").value);
    state.filtered = sortRows(state.filtered, state.sort.key, state.sort.dir, cols);
    render();
  }

  function render() {
    const tbody = $("#rows");
    if (!tbody) return;
    const { slice, pages, page } = paginate(state.filtered, state.page, state.perPage);
    state.page = page;
    tbody.innerHTML = slice.map((row) =>
      `<tr data-code="${esc(row.code)}">${cols.map((c) => cellHtml(row, c)).join("")}</tr>`
    ).join("");
    const count = $("#count");
    if (count) count.textContent = `${state.filtered.length} ${t("resultados")}`;
    const pager = $("#pager");
    if (pager) renderPagerTo(pager, state, t);
    document.querySelectorAll("#tbl thead th[data-sort]").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.sort === state.sort.key) {
        th.classList.add(state.sort.dir === 1 ? "sort-asc" : "sort-desc");
      }
    });
  }

  /* --- eventos --- */
  const qEl = $("#q");
  if (qEl) qEl.addEventListener("input", debounce(recompute, 200));
  if (thead) {
    thead.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sort]");
      if (!th) return;
      const key = th.dataset.sort;
      if (state.sort.key === key) state.sort.dir = -state.sort.dir;
      else state.sort = { key, dir: 1 };
      state.page = 1;
      recompute();
    });
  }
  const perEl = $("#perpage");
  if (perEl) perEl.addEventListener("change", (e) => {
    state.perPage = parseInt(e.target.value, 10);
    state.page = 1;
    render();
  });
  const pagerEl = $("#pager");
  if (pagerEl) {
    pagerEl.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-page]");
      if (!b || b.disabled) return;
      state.page = parseInt(b.dataset.page, 10);
      render();
      scrollTop();
    });
    pagerEl.addEventListener("submit", (e) => {
      const form = e.target.closest(".page-jump");
      if (!form) return;
      e.preventDefault();
      const input = form.querySelector(".page-jump-input");
      const pages = Math.max(1, Math.ceil(state.filtered.length / state.perPage));
      const requested = Number.parseInt(input.value, 10);
      if (!Number.isFinite(requested)) { input.value = state.page; return; }
      state.page = Math.min(Math.max(requested, 1), pages);
      render();
      scrollTop();
    });
  }
  function scrollTop() {
    const top = $("#top");
    if (top) top.scrollIntoView({ behavior: "instant" });
  }

  if (state.edit) {
    const tbody = $("#rows");
    if (tbody) tbody.addEventListener("click", (e) => {
      const td = e.target.closest("td.editable[data-field]");
      if (!td) return;
      const code = td.closest("tr").dataset.code;
      const record = state.records[code];
      const col = cols.find((c) => c.key === td.dataset.col);
      if (record && col) startCellEdit(td, code, record, col, td.dataset.field);
    });
  }

  /* --- persistencia --- */
  async function postDatasetUpdate(code, field, value) {
    const r = await fetch("/api/update_dataset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset, code, field, value }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.ok) throw new Error(out.error || `HTTP ${r.status}`);
    return out;
  }

  // guardado inline de una celda (Enter/blur) — ver startCellEdit
  function startCellEdit(td, code, record, col, field) {
    if (td.querySelector("input, select")) return;   // ya en edición
    const type = editTypeFor(col, field);
    const current = getByPath(record, field);

    let ctl;
    if (type === "select") {
      ctl = document.createElement("select");
      ctl.className = "cell-edit";
      ctl.innerHTML = (col.options || []).map((o) =>
        `<option value="${esc(o)}" ${o === (current ?? "") ? "selected" : ""}>${esc(o)}</option>`).join("");
    } else {
      ctl = document.createElement("input");
      ctl.type = type === "number" ? "number" : "text";
      if (type === "number") ctl.step = "any";
      ctl.className = "cell-edit";
      ctl.value = flatValue(current);
      if (type === "list") ctl.placeholder = "AE, CM…";
    }
    td.textContent = "";
    td.appendChild(ctl);
    ctl.focus();
    if (ctl.select) ctl.select();

    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      if (!commit) { render(); return; }
      let value;
      if (type === "number") {
        const raw = String(ctl.value).trim();
        if (raw === "") value = null;
        else {
          value = Number(raw.replace(",", "."));
          if (!Number.isFinite(value)) {
            alert(t("err_num"));
            render();
            return;
          }
          value = Math.trunc(value);
        }
      } else {
        value = valueForEdit(ctl.value, type);
      }
      ctl.disabled = true;
      postDatasetUpdate(code, field, value)
        .then(() => {
          setByPath(record, field, value);
          refreshRows();
          setStatus("ok");
        })
        .catch((err) => {
          setStatus("err");
          alert(`${t("err_save")} (${err.message})\n${t("err_server")}`);
        })
        .finally(render);
    };

    if (type === "select") {
      ctl.addEventListener("change", () => finish(true));
    } else {
      ctl.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { finish(false); return; }
        if (e.key === "Enter") { e.preventDefault(); finish(true); }
      });
    }
    ctl.addEventListener("blur", () => finish(true));
  }

  /* --- inicial --- */
  hideEditLinks();
  applyI18n();
  return state;
}
