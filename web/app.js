/* Colección de billetes — tabla, búsqueda, paginación y modal (vanilla JS) */
"use strict";

const $ = (sel) => document.querySelector(sel);

/* --- idioma (es/en) --- */

let lang = localStorage.getItem("banknotes_lang") === "en" ? "en" : "es";

// clave: [español, inglés]
const L = {
  title: ["💵 Colección de billetes", "💵 Banknote Collection"],
  search_ph: ["Buscar en todos los campos… (país, pick, moneda, año, firmas…)",
              "Search all fields… (country, pick, currency, year, signatures…)"],
  reload: ["🔄 Recargar datos", "🔄 Reload data"],
  reloading: ["⏳ Reconstruyendo…", "⏳ Rebuilding…"],
  thumbs_new: ["miniaturas nuevas", "new thumbnails"],
  columns: ["Columnas", "Columns"],
  photos: ["Fotos", "Photos"],
  perpage: ["Por página", "Per page"],
  billetes: ["billetes", "banknotes"],
  resultados: ["resultados", "results"],
  issues_none: ["Sin problemas detectados", "No issues detected"],
  issues_some: ["problemas detectados — click para verlos",
                "issues detected — click to view"],
  lang_tip: ["Switch to English", "Cambiar a español"],
  pick: ["Pick", "Pick"],
  id: ["ID", "ID"],
  pais: ["País", "Country"],
  monto: ["Monto", "Amount"],
  moneda: ["Moneda", "Currency"],
  denominacion: ["Moneda Full", "Denomination"],
  subtipo: ["Subtipo", "Subtype"],
  alternativas: ["Otra moneda", "Other currency"],
  anio: ["Año", "Year"],
  firmas: ["Firmas", "Signatures"],
  temas: ["Temas", "Themes"],
  vigencia: ["Vigencia", "Validity"],
  obs: ["Observaciones", "Notes"],
  serie: ["Serie", "Series"],
  banco: ["Banco", "Bank"],
  zona: ["Zona", "Zone"],
  serial: ["N° de serie", "Serial no."],
  condicion: ["Condición", "Condition"],
  grupo: ["Grupo Colnect", "Colnect group"],
  conmemorativo: ["Conmemorativo", "Commemorative"],
  remarcado: ["Remarcado", "Overprint"],
  front: ["Front", "Front"],
  back: ["Back", "Back"],
  full: ["Full", "Full"],
  colnect: ["Colnect", "Colnect"],
  verif: ["Verificado", "Verified"],
  ver_colnect: ["Ver en Colnect ↗", "View on Colnect ↗"],
  si: ["Sí", "Yes"],
  vf_both: ["Mostrando todos — click: solo con ✓", "Showing all — click: only ✓"],
  vf_on: ["Solo con ✓ — click: solo sin ✓", "Only ✓ — click: only without ✓"],
  vf_off: ["Solo sin ✓ — click: mostrar todos", "Only without ✓ — click: show all"],
  err_save: ["No se pudo guardar", "Could not save"],
  err_server: ["¿Está corriendo el servidor de edición? (_scripts/serve_web.py)",
               "Is the edit server running? (_scripts/serve_web.py)"],
  err_num: ["Número inválido", "Invalid number"],
  new_note: ["➕ Nuevo", "➕ New"],
  new_title: ["Nuevo billete", "New banknote"],
  new_pick: ["Pick number", "Pick number"],
  new_create: ["Crear", "Create"],
  err_create: ["No se pudo crear", "Could not create"],
};

const t = (key) => (L[key] ? L[key][lang === "en" ? 1 : 0] : key);
const paisDisplay = (r) => (lang === "en" ? (r.pais_en || r.pais) : r.pais);

// columnas seleccionables (Pick es fija y no aparece aquí)
// [clave, etiqueta, visible por defecto]
const COLUMNS = [
  ["id", "ID", false],
  ["pais", "País", true],
  ["monto", "Monto", true],
  ["moneda", "Moneda", true],
  ["denominacion", "Moneda Full", false],
  ["subtipo", "Subtipo", false],
  ["alternativas", "Otra moneda", false],
  ["anio", "Año", true],
  ["firmas", "Firmas", false],
  ["temas", "Temas", false],
  ["vigencia", "Vigencia", false],
  ["obs", "Observaciones", false],
  ["serie", "Serie", false],
  ["banco", "Banco", false],
  ["zona", "Zona", false],
  ["serial", "N° de serie", false],
  ["condicion", "Condición", false],
  ["grupo", "Grupo Colnect", false],
  ["conmemorativo", "Conmemorativo", false],
  ["remarcado", "Remarcado", false],
  ["front", "Front", true],
  ["back", "Back", true],
  ["full", "Full", true],
  ["colnect", "Colnect", true],
  ["verif", "Verificado", true],
];
const COLS_KEY = "banknotes_cols";

function loadCols() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLS_KEY));
    if (Array.isArray(saved) && saved.length) {
      return new Set(saved.filter((k) => COLUMNS.some(([c]) => c === k)));
    }
  } catch { /* localStorage corrupto o bloqueado: usar default */ }
  return new Set(COLUMNS.filter(([, , def]) => def).map(([k]) => k));
}

const state = {
  all: [],       // todos los registros
  filtered: [],  // resultado de la búsqueda
  page: 1,
  perPage: 25,
  detailIdx: -1,  // índice del billete mostrado en el modal de detalle
  cols: loadCols(),  // columnas visibles
  sort: { key: null, dir: 1 },  // orden activo (dir: 1 asc, -1 desc)
  // filtros cíclicos de columnas booleanas: both -> on -> off
  boolFilters: { verificado: "both", conmemorativo: "both", remarcado: "both" },
};

// columna de la tabla -> campo booleano filtrable/editable
const BOOL_COLS = {
  verif: "verificado",
  conmemorativo: "conmemorativo",
  remarcado: "remarcado",
};

/* --- utilidades --- */

function unaccent(s) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtValor(v) {
  if (v === null || v === undefined) return "";
  return v.toLocaleString("es-CL");
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* --- orden --- */

const NUM_KEYS = new Set(["valor", "anio"]);
const BOOL_KEYS = new Set(["conmemorativo", "remarcado"]);

function pickNum(p) {
  const m = /\d+/.exec(p || "");
  return m ? parseInt(m[0], 10) : Infinity;
}

function isEmptyVal(v) {
  return v === null || v === undefined || v === "";
}

function applySort() {
  const { key, dir } = state.sort;
  if (!key) return;
  const get = (r) => (key === "pais" ? paisDisplay(r) : r[key]);
  state.filtered = [...state.filtered].sort((a, b) => {
    const va = get(a), vb = get(b);
    // vacíos siempre al final, sin importar la dirección
    const ea = isEmptyVal(va), eb = isEmptyVal(vb);
    if (ea && eb) return 0;
    if (ea) return 1;
    if (eb) return -1;
    let c;
    if (key === "pick") {
      c = pickNum(va) - pickNum(vb) ||
          String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
    } else if (NUM_KEYS.has(key)) {
      c = va - vb;
    } else if (BOOL_KEYS.has(key)) {
      c = Number(va) - Number(vb);
    } else {
      c = String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
    }
    return c * dir;
  });
}

function updateSortIndicators() {
  document.querySelectorAll("#tbl thead th[data-sort]").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sort === state.sort.key) {
      th.classList.add(state.sort.dir === 1 ? "sort-asc" : "sort-desc");
    }
  });
}

/* --- búsqueda --- */

// Alias para usar español o inglés indistintamente en la consulta
const COL_ALIASES = {
  country: "pais", 
  year: "anio", 
  monto: "valor",
  front: "thumb_a", 
  back: "thumb_b",  
  full: "thumb_f"   
};

function getCol(c) {
  c = c.toLowerCase();
  return COL_ALIASES[c] || c;
}

// Extrae el valor como un string limpio (sin acentos, en minúscula)
function getStrVal(r, col) {
  let v = r[col];
  if (v === null || v === undefined) return "";
  return unaccent(String(v)).toLowerCase();
}

function parseQuery(q) {
  const tests = [];
  // Regex que soporta guiones bajos en los nombres de columnas ([a-z_]+)
  const regex = /(-?)(?:([a-z_]+)(>=|<=|>|<)(\d+(?:\.\d+)?)|([a-z_]+):\((.*?)\)|([a-z_]+):"([^"]*)"|"([^"]*)"|([^\s]+))/gi;
  let m;
  
  while ((m = regex.exec(q)) !== null) {
    const neg = m[1] === '-';
    
    if (m[2]) { 
      tests.push({ type: 'rel', neg, col: getCol(m[2]), op: m[3], val: parseFloat(m[4]) });
    } else if (m[5]) { 
      const col = getCol(m[5]);
      let inner = m[6].trim();
      if (inner.startsWith('"') && inner.endsWith('"')) {
        tests.push({ type: 'col_exact', neg, col, val: inner.slice(1, -1) });
      } else {
        tests.push({ type: 'col_group', neg, col, vals: inner.split(/\s+/) });
      }
    } else if (m[7]) { 
      tests.push({ type: 'col_exact', neg, col: getCol(m[7]), val: m[8] });
    } else if (m[9]) { 
      tests.push({ type: 'global_exact', neg, val: m[9] });
    } else if (m[10]) { 
      tests.push({ type: 'global', neg, val: m[10] });
    }
  }
  return tests;
}

function applyFilter() {
  const q = $("#q").value.trim();
  
  if (!q) {
    state.filtered = state.all;
  } else {
    const tests = parseQuery(q);
    
    state.filtered = state.all.filter((r) => {
      for (const t of tests) {
        let pass = false;
        
        if (t.type === 'rel') {
          const v = r[t.col];
          if (typeof v === 'number' && !isNaN(v)) {
            if (t.op === '>') pass = v > t.val;
            else if (t.op === '<') pass = v < t.val;
            else if (t.op === '>=') pass = v >= t.val;
            else if (t.op === '<=') pass = v <= t.val;
          }
        } else if (t.type === 'col_exact' || t.type === 'col_group') {
          const colVal = getStrVal(r, t.col);
          const isImage = ["thumb_a", "thumb_b", "thumb_f"].includes(t.col);
          
          if (isImage) {
            // Súper lógica para imágenes: entiende front:no, front:si, front:""
            const queryVals = t.type === 'col_exact' ? [t.val] : t.vals;
            pass = queryVals.some(val => {
              val = unaccent(val).toLowerCase();
              if (val === "" || val === "no" || val === "false") return colVal === "";
              if (val === "si" || val === "yes" || val === "true") return colVal !== "";
              // Fallback
              return t.type === 'col_exact' ? colVal === val : colVal.includes(val);
            });
          } else {
            if (t.type === 'col_exact') {
              pass = colVal === unaccent(t.val).toLowerCase();
            } else {
              pass = t.vals.some(val => colVal.includes(unaccent(val).toLowerCase()));
            }
          }
        } else if (t.type === 'global_exact') {
          pass = (r.search || "").includes(unaccent(t.val).toLowerCase());
        } else if (t.type === 'global') {
          pass = (r.search || "").includes(unaccent(t.val).toLowerCase());
        }

        if (t.neg) pass = !pass;
        if (!pass) return false;
      }
      return true;
    });
  }

  for (const [field, mode] of Object.entries(state.boolFilters)) {
    if (mode === "on") {
      state.filtered = state.filtered.filter((r) => r[field]);
    } else if (mode === "off") {
      state.filtered = state.filtered.filter((r) => !r[field]);
    }
  }
  
  applySort();
  state.page = 1;
  render();
}

function updateBoolIndicators() {
  for (const [col, field] of Object.entries(BOOL_COLS)) {
    const th = document.querySelector(`th[data-col="${col}"]`);
    const mode = state.boolFilters[field];
    th.dataset.vf = mode;
    th.title = t(`vf_${mode}`);
  }
}

/* --- render tabla --- */

function thumbCell(rec, thumbKey, imgKey, label, col) {
  const thumb = rec[thumbKey];
  if (!thumb) return `<td class="img" data-label="${label}" data-col="${col}"></td>`;
  return `<td class="img" data-label="${label}" data-col="${col}">
    <img src="${esc(thumb)}" loading="lazy" alt="${label} ${esc(rec.pick)}"
         data-img="${esc(rec[imgKey])}" data-id="${esc(rec.id)}" data-side="${label}">
  </td>`;
}

function render() {
  const total = state.filtered.length;
  const pages = Math.max(1, Math.ceil(total / state.perPage));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * state.perPage;
  const slice = state.filtered.slice(start, start + state.perPage);

  const txtCell = (r, key) =>
    `<td data-label="${t(key)}" data-col="${key}" class="${EDIT_COLS[key] ? "editable" : ""}">${esc(r[key])}</td>`;
  const checkCell = (r, col, field) => `
    <td data-label="${t(col)}" data-col="${col}" class="verif">
      <input type="checkbox" class="bool-check" data-id="${esc(r.id)}" data-field="${field}"
             ${r[field] ? "checked" : ""} aria-label="${t(col)} ${esc(r.pick)}">
    </td>`;

  $("#rows").innerHTML = slice.map((r) => `
    <tr>
      <td data-label="Pick"><a href="#" class="pick-link" data-id="${esc(r.id)}">${esc(r.pick) || esc(r.id)}</a></td>
      ${txtCell(r, "id")}
      <td data-label="${t("pais")}" data-col="pais" class="editable">${esc(paisDisplay(r))}</td>
      <td data-label="${t("monto")}" data-col="monto" class="num editable">${fmtValor(r.valor)}</td>
      <td data-label="${t("moneda")}" data-col="moneda" class="editable">${esc(r.moneda)}</td>
      ${txtCell(r, "denominacion")}
      ${txtCell(r, "subtipo")}
      ${txtCell(r, "alternativas")}
      <td data-label="${t("anio")}" data-col="anio" class="num editable">${r.anio ?? ""}</td>
      ${txtCell(r, "firmas")}
      ${txtCell(r, "temas")}
      ${txtCell(r, "vigencia")}
      ${txtCell(r, "obs")}
      ${txtCell(r, "serie")}
      ${txtCell(r, "banco")}
      ${txtCell(r, "zona")}
      ${txtCell(r, "serial")}
      ${txtCell(r, "condicion")}
      ${txtCell(r, "grupo")}
      ${checkCell(r, "conmemorativo", "conmemorativo")}
      ${checkCell(r, "remarcado", "remarcado")}
      ${thumbCell(r, "thumb_a", "img_a", "Front", "front")}
      ${thumbCell(r, "thumb_b", "img_b", "Back", "back")}
      ${thumbCell(r, "thumb_f", "img_full", "Full", "full")}
      <td data-label="Colnect" data-col="colnect" class="ext">${r.colnect
        ? `<a href="${esc(r.colnect)}" target="_blank" rel="noopener" title="${t("ver_colnect")}">↗</a>`
        : ""}</td>
      ${checkCell(r, "verif", "verificado")}
    </tr>`).join("");

  applyCols();

  $("#count").textContent =
    `${total} ${total === state.all.length ? t("billetes") : t("resultados")}`;

  renderPager(pages);
}

/* --- paginación --- */

function pageList(cur, last) {
  // 1 … cur-1 cur cur+1 … last (compacto)
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

function renderPager(pages) {
  const cur = state.page;
  const btn = (label, page, opts = {}) => {
    if (opts.gap) return `<span class="gap">…</span>`;
    const cls = [opts.current ? "current" : "", opts.nav ? "nav" : ""].join(" ").trim();
    const dis = opts.disabled ? "disabled" : "";
    return `<button class="${cls}" data-page="${page}" ${dis}>${label}</button>`;
  };
  let html = btn("«", cur - 1, { nav: true, disabled: cur <= 1 });
  for (const p of pageList(cur, pages)) {
    html += p === "…" ? btn("", 0, { gap: true })
                      : btn(p, p, { current: p === cur });
  }
  html += btn("»", cur + 1, { nav: true, disabled: cur >= pages });
  $("#pager").innerHTML = html;
}

/* --- modal --- */

function openModal(imgPath, id, side) {
  const rec = state.all.find((r) => r.id === id);
  const parts = [rec.pick || rec.id, paisDisplay(rec), rec.denominacion, rec.anio, side];
  $("#modal-title").textContent = parts.filter(Boolean).join(" · ");
  const img = $("#modal-img");
  img.src = imgPath;
  img.alt = `${side} ${rec.pick || rec.id}`;
  $("#modal").showModal();
}

/* --- modal de detalle (todos los campos poblados del JSON) --- */

const DETAIL_FIELDS = [
  ["id", "ID"],
  ["pick", "Pick"],
  ["pais", "País"],
  ["denominacion", "Moneda Full"],
  ["subtipo", "Subtipo"],
  ["alternativas", "Otra moneda"],
  ["anio", "Año"],
  ["firmas", "Firmas"],
  ["temas", "Temas"],
  ["vigencia", "Vigencia"],
  ["obs", "Observaciones"],
  ["serie", "Serie"],
  ["banco", "Banco"],
  ["zona", "Zona"],
  ["serial", "N° de serie"],
  ["condicion", "Condición"],
  ["grupo", "Grupo Colnect"],
  ["colnect", "Colnect"],
  ["conmemorativo", "Conmemorativo"],
  ["remarcado", "Remarcado"],
];

function detailValue(key, val, r) {
  if (key === "colnect") {
    return `<a href="${esc(val)}" target="_blank" rel="noopener">${t("ver_colnect")}</a>`;
  }
  if (key === "pais") {
    const otro = lang === "en" ? r.pais : r.pais_en;
    return esc(r.pais_en && r.pais_en !== r.pais
      ? `${paisDisplay(r)} (${otro})` : paisDisplay(r));
  }
  if (typeof val === "boolean") return t("si");
  return esc(val);
}

function openDetail(id) {
  const idx = state.filtered.findIndex((x) => x.id === id);
  if (idx === -1) return;
  state.detailIdx = idx;
  renderDetail();
  if (!$("#detail").open) $("#detail").showModal();
}

function renderDetail() {
  const r = state.filtered[state.detailIdx];
  if (!r) return;

  $("#detail-title").textContent =
    [r.pick || r.id, paisDisplay(r), r.denominacion, r.anio].filter(Boolean).join(" · ");

  const flag = $("#detail-flag");
  if (r.flag) {
    flag.src = r.flag;
    flag.alt = `Bandera de ${r.pais}`;
    flag.hidden = false;
  } else {
    flag.hidden = true;
    flag.src = "";
  }

  $("#detail-body").innerHTML = DETAIL_FIELDS
    .filter(([k]) => {
      const v = r[k];
      if (typeof v === "boolean") return v;           // solo si es true
      return v !== null && v !== undefined && v !== "";
    })
    .map(([k]) => `<dt>${t(k)}</dt><dd>${detailValue(k, r[k], r)}</dd>`)
    .join("");

  $("#detail-imgs").innerHTML = [
    ["img_a", "Front"], ["img_b", "Back"],
  ]
    .filter(([k]) => r[k])
    .map(([k, side]) => `<img src="${esc(r[k])}" loading="lazy" alt="${side} ${esc(r.pick)}"
        data-img="${esc(r[k])}" data-id="${esc(r.id)}" data-side="${side}">`)
    .join("");

  $("#detail-prev").disabled = state.detailIdx <= 0;
  $("#detail-next").disabled = state.detailIdx >= state.filtered.length - 1;
}

function detailStep(delta) {
  const next = state.detailIdx + delta;
  if (next < 0 || next >= state.filtered.length) return;
  state.detailIdx = next;
  renderDetail();
}

/* --- badge de problemas --- */

async function loadIssuesBadge() {
  const link = $("#alert-link");
  try {
    const res = await fetch("data/issues.json", { cache: "no-store" });
    const data = await res.json();
    const total = data.categorias.reduce((n, c) => n + c.items.length, 0);
    $("#alert-count").textContent = total;
    link.hidden = false;
    link.classList.toggle("ok", total === 0);
    link.title = total === 0 ? t("issues_none")
                             : `${total} ${t("issues_some")}`;
  } catch {
    link.hidden = true;   // sin issues.json (build antiguo): no mostrar
  }
}

/* --- selector de columnas --- */

function renderColsMenu() {
  $("#cols-menu").innerHTML = COLUMNS.map(([k]) => `
    <li><label>
      <input type="checkbox" data-col-toggle="${k}" ${state.cols.has(k) ? "checked" : ""}>
      ${t(k)}
    </label></li>`).join("");
}

function applyCols() {
  document.querySelectorAll("#tbl [data-col]").forEach((el) => {
    el.hidden = !state.cols.has(el.dataset.col);
  });
}

/* --- edición --- */

// columna de la tabla -> [campo del API, tipo de input]
const EDIT_COLS = {
  pais: ["pais", "text"],
  monto: ["valor", "number"],
  moneda: ["moneda", "text"],
  subtipo: ["subtipo", "text"],
  alternativas: ["alternativas", "text"],
  anio: ["anio", "number"],
  obs: ["obs", "text"],
  grupo: ["grupo", "text"],
  vigencia: ["vigencia", "text"],
  serie: ["serie", "text"],
  banco: ["banco", "text"],
  zona: ["zona", "text"],
  serial: ["serial", "text"],
  firmas: ["firmas", "text"],
  temas: ["temas", "text"],
  condicion: ["condicion", "select"],
};

// escala internacional de condición (IBNS)
const CONDICIONES = ["", "UNC", "AU", "XF", "VF", "F", "VG", "G", "Fair", "Poor"];

// pistas de formato por campo (title del input)
const EDIT_HINTS = {
  temas: ["clave:valor separados por coma — ej: fauna:leon, flora:copihue",
          "key:value comma-separated — e.g. fauna:lion, flora:rose"],
  firmas: ["Separadas por ' - ' — ej: Mora - Meyerholz",
           "Separated by ' - ' — e.g. Mora - Meyerholz"],
  alternativas: ["Separadas por coma — ej: 10 Libras, 5 Pesos",
                 "Comma-separated — e.g. 10 Pounds, 5 Pesos"],
};

async function postUpdate(id, field, value) {
  const res = await fetch("/api/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, field, value }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);
  return out;
}

async function toggleBool(cb) {
  const id = cb.dataset.id;
  const field = cb.dataset.field;
  const val = cb.checked;
  cb.disabled = true;
  try {
    const out = await postUpdate(id, field, val);
    const rec = state.all.find((r) => r.id === id);
    if (rec) Object.assign(rec, out.record);
  } catch (err) {
    cb.checked = !val;   // revertir si no se pudo guardar
    alert(`${t("err_save")} "${field}" (${err.message}).\n${t("err_server")}`);
  } finally {
    cb.disabled = false;
  }
}

function startEdit(td, rec) {
  if (td.querySelector("input, select")) return;   // ya en edición
  const [field, type] = EDIT_COLS[td.dataset.col];

  if (type === "select") {
    const sel = document.createElement("select");
    sel.className = "cell-edit";
    sel.innerHTML = CONDICIONES.map((c) =>
      `<option value="${c}" ${c === (rec[field] ?? "") ? "selected" : ""}>${c || "—"}</option>`).join("");
    td.textContent = "";
    td.appendChild(sel);
    sel.focus();
    let done = false;
    sel.addEventListener("change", async () => {
      done = true;
      sel.disabled = true;
      try {
        const out = await postUpdate(rec.id, field, sel.value);
        Object.assign(rec, out.record);
      } catch (err) {
        alert(`${t("err_save")} (${err.message}).`);
      }
      render();
    });
    sel.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !done) { done = true; render(); }
    });
    sel.addEventListener("blur", () => { if (!done) { done = true; render(); } });
    return;
  }

  const input = document.createElement("input");
  input.type = type;
  if (type === "number") input.step = "any";
  if (EDIT_HINTS[td.dataset.col]) {
    input.title = EDIT_HINTS[td.dataset.col][lang === "en" ? 1 : 0];
    input.placeholder = input.title;
  }
  input.value = rec[field] ?? "";
  input.className = "cell-edit";
  td.textContent = "";
  td.appendChild(input);
  input.focus();
  input.select();

  let done = false;
  const cancel = () => { if (!done) { done = true; render(); } };

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") { cancel(); return; }
    if (e.key !== "Enter") return;
    let value = input.value.trim();
    if (type === "number") {
      value = value === "" ? null : Number(value.replace(",", "."));
      if (value !== null && !Number.isFinite(value)) { alert(t("err_num")); return; }
      if (field === "anio" && value !== null) value = Math.trunc(value);
    }
    done = true;
    input.disabled = true;
    try {
      const out = await postUpdate(rec.id, field, value);
      Object.assign(rec, out.record);   // in-place: filtered/all comparten objeto
    } catch (err) {
      alert(`${t("err_save")} (${err.message}).`);
    }
    render();
  });
  input.addEventListener("blur", cancel);   // click fuera = cancelar
}

/* --- aplicar idioma a la UI --- */

function applyI18n() {
  document.documentElement.lang = lang;
  document.title = lang === "en" ? "Banknote Collection" : "Colección de billetes";
  $("#top h1").textContent = t("title");
  $("#q").placeholder = t("search_ph");
  const btn = $("#rebuild");
  if (!btn.disabled) btn.textContent = t("reload");
  $("#new-note").textContent = t("new_note");
  $("#new-title").textContent = t("new_title");
  $("#new-pais-label").firstChild.nodeValue = t("pais") + " ";
  $("#new-pick-label").firstChild.nodeValue = t("new_pick") + " ";
  $("#new-submit").textContent = t("new_create");
  $("#cols-dd summary").textContent = t("columns");
  $("#imgsize-label").firstChild.nodeValue = t("photos") + " ";
  $("#perpage-label").firstChild.nodeValue = t("perpage") + " ";
  // headers de la tabla
  document.querySelectorAll("#tbl thead th").forEach((th) => {
    const key = th.dataset.col || (th.dataset.sort === "pick" ? "pick" : null);
    if (key === "monto" || key === "valor") th.textContent = t("monto");
    else if (key) th.textContent = t(key);
  });
  // botón de idioma
  const lt = $("#lang-toggle");
  lt.textContent = lang === "en" ? "🇨🇱" : "🇬🇧";
  lt.title = t("lang_tip");
  renderColsMenu();
  updateBoolIndicators();
  updateSortIndicators();
  render();
  loadIssuesBadge();
}

/* --- crear billete nuevo --- */

function fillPaisesDatalist() {
  const paises = [...new Set(state.all.map((r) => r.pais))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }));
  $("#paises-list").innerHTML = paises.map((p) => `<option value="${esc(p)}">`).join("");
}

async function createNewNote(e) {
  e.preventDefault();
  const pais = $("#new-pais").value.trim();
  const pick = $("#new-pick").value.trim();
  if (!pais || !pick) return;
  const btn = $("#new-submit");
  btn.disabled = true;
  try {
    const res = await fetch("/api/new_note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pais, pick }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    // insertar ordenado en memoria (mismo criterio del build: país, pick natural)
    const rec = out.record;
    const key = (r) => [unaccent(r.pais).toLowerCase(), pickNum(r.pick)];
    const pos = state.all.findIndex((r) => {
      const [pa, na] = key(r), [pb, nb] = key(rec);
      return pa > pb || (pa === pb && na > nb);
    });
    state.all.splice(pos === -1 ? state.all.length : pos, 0, rec);

    $("#new-dialog").close();
    $("#new-form").reset();
    // dejar el billete nuevo en pantalla, listo para editar inline
    $("#q").value = rec.id;
    applyFilter();
  } catch (err) {
    alert(`${t("err_create")} (${err.message})`);
  } finally {
    btn.disabled = false;
  }
}

/* --- eventos --- */

document.addEventListener("DOMContentLoaded", async () => {
  // no-store: siempre datos frescos aunque se sirva sin serve_web.py
  const res = await fetch("data/collection.json", { cache: "no-store" });
  state.all = await res.json();
  state.filtered = state.all;
  applyI18n();

  $("#q").addEventListener("input", debounce(applyFilter, 200));

  document.querySelector("#tbl thead").addEventListener("click", (e) => {
    const thBool = e.target.closest("th[data-col]");
    if (thBool && BOOL_COLS[thBool.dataset.col]) {
      const field = BOOL_COLS[thBool.dataset.col];
      const next = { both: "on", on: "off", off: "both" };
      state.boolFilters[field] = next[state.boolFilters[field]];
      updateBoolIndicators();
      applyFilter();   // re-filtra manteniendo búsqueda y orden
      return;
    }
    const th = e.target.closest("th[data-sort]");
    if (!th) return;
    const key = th.dataset.sort;
    if (state.sort.key === key) {
      state.sort.dir = -state.sort.dir;   // 2° click: descendente
    } else {
      state.sort = { key, dir: 1 };       // 1er click: ascendente
    }
    applySort();
    state.page = 1;
    render();
    updateSortIndicators();
  });

  $("#rebuild").addEventListener("click", async () => {
    const btn = $("#rebuild");
    btn.disabled = true;
    btn.textContent = t("reloading");
    try {
      const res = await fetch("/api/rebuild", { method: "POST" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);
      const data = await fetch("data/collection.json", { cache: "no-store" });
      state.all = await data.json();
      applyFilter();   // re-aplica búsqueda/orden/filtro sobre los datos frescos
      loadIssuesBadge();
      btn.textContent = `✓ ${out.thumbs_generadas} ${t("thumbs_new")}`
        + (out.json_invalidos ? ` — ⚠ ${out.json_invalidos} JSON` : "");
    } catch (err) {
      btn.textContent = t("reload");
      alert(`${t("err_save")} (${err.message}).\n${t("err_server")}`);
      return;
    } finally {
      btn.disabled = false;
    }
    setTimeout(() => { btn.textContent = t("reload"); }, 2500);
  });

  $("#cols-menu").addEventListener("change", (e) => {
    const cb = e.target.closest("input[data-col-toggle]");
    if (!cb) return;
    if (cb.checked) state.cols.add(cb.dataset.colToggle);
    else state.cols.delete(cb.dataset.colToggle);
    localStorage.setItem(COLS_KEY, JSON.stringify([...state.cols]));
    applyCols();
  });

  $("#perpage").addEventListener("change", (e) => {
    state.perPage = parseInt(e.target.value, 10);
    state.page = 1;
    render();
  });

  // tamaño de las miniaturas (1x/2x/3x), persistido
  const imgSize = localStorage.getItem("banknotes_imgsize") || "1";
  $("#imgsize").value = imgSize;
  $("#tbl").dataset.imgsize = imgSize;
  fillPaisesDatalist();
  $("#new-note").addEventListener("click", () => {
    $("#new-form").reset();
    $("#new-dialog").showModal();
    $("#new-pais").focus();
  });
  $("#new-close").addEventListener("click", () => $("#new-dialog").close());
  $("#new-dialog").addEventListener("click", (e) => {
    if (e.target === $("#new-dialog")) $("#new-dialog").close();
  });
  $("#new-form").addEventListener("submit", createNewNote);

  $("#lang-toggle").addEventListener("click", () => {
    lang = lang === "en" ? "es" : "en";
    localStorage.setItem("banknotes_lang", lang);
    applySort();   // re-ordenar si el orden activo es País
    applyI18n();
  });

  $("#imgsize").addEventListener("change", (e) => {
    $("#tbl").dataset.imgsize = e.target.value;
    localStorage.setItem("banknotes_imgsize", e.target.value);
  });

  $("#pager").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]");
    if (!b || b.disabled) return;
    state.page = parseInt(b.dataset.page, 10);
    render();
    $("#top").scrollIntoView({ behavior: "instant" });
  });

  $("#rows").addEventListener("change", (e) => {
    const cb = e.target.closest("input.bool-check");
    if (cb) toggleBool(cb);
  });

  $("#rows").addEventListener("click", (e) => {
    const pick = e.target.closest("a.pick-link");
    if (pick) {
      e.preventDefault();
      openDetail(pick.dataset.id);
      return;
    }
    const img = e.target.closest("img[data-img]");
    if (img) {
      openModal(img.dataset.img, img.dataset.id, img.dataset.side);
      return;
    }
    const td = e.target.closest("td.editable[data-col]");
    if (td && EDIT_COLS[td.dataset.col]) {
      const id = td.closest("tr").querySelector("a.pick-link").dataset.id;
      const rec = state.all.find((r) => r.id === id);
      if (rec) startEdit(td, rec);
    }
  });

  const modal = $("#modal");
  $("#modal-close").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();   // clic fuera del cuadro
  });
  modal.addEventListener("close", () => { $("#modal-img").src = ""; });

  const detail = $("#detail");
  $("#detail-close").addEventListener("click", () => detail.close());
  detail.addEventListener("click", (e) => {
    if (e.target === detail) detail.close();
  });
  $("#detail-prev").addEventListener("click", () => detailStep(-1));
  $("#detail-next").addEventListener("click", () => detailStep(1));
  $("#detail-imgs").addEventListener("click", (e) => {
    const img = e.target.closest("img[data-img]");
    if (img) openModal(img.dataset.img, img.dataset.id, img.dataset.side);
  });
  document.addEventListener("keydown", (e) => {
    if (!detail.open || $("#modal").open) return;
    if (e.key === "ArrowLeft") detailStep(-1);
    if (e.key === "ArrowRight") detailStep(1);
  });
});
