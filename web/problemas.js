/* Página de problemas — renderiza las categorías de data/issues.json */
"use strict";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* renderers específicos por categoría; el resto usa la tabla genérica */
const RENDERERS = {
  json_invalidos(cat) {
    const filas = cat.items.map(([archivo, error]) => `
      <tr>
        <td><code>${esc(archivo)}</code></td>
        <td class="err-detalle"><code>${esc(error)}</code></td>
      </tr>`).join("");
    return `<div class="table-wrap"><table>
        <thead><tr><th>Archivo</th><th>Error</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>`;
  },

  carpetas_sin_json(cat) {
    const imgCell = (thumb, img, alt) => thumb
      ? `<td class="img"><a href="${esc(img)}" target="_blank" rel="noopener">
           <img src="${esc(thumb)}" loading="lazy" alt="${esc(alt)}"></a></td>`
      : `<td class="img"></td>`;
    const filas = cat.items.map((it) => `
      <tr data-carpeta="${esc(it.carpeta)}">
        <td class="edit-folder">
          <input value="${esc(it.carpeta)}" spellcheck="false">
          <button class="rename">Renombrar</button>
          <button class="create-json" title="Escribe el pick number en el campo y crea el JSON del billete (país/valor/año se derivan del nombre de la carpeta)">Crear JSON</button>
        </td>
        ${imgCell(it.thumb_a, it.img_a, "Front " + it.carpeta)}
        ${imgCell(it.thumb_b, it.img_b, "Back " + it.carpeta)}
        <td class="files" title="${esc(it.archivos.join("\n"))}">${it.archivos.length} archivo${it.archivos.length === 1 ? "" : "s"}</td>
      </tr>`).join("");
    return `<div class="table-wrap"><table>
        <thead><tr><th>Carpeta</th><th>Front</th><th>Back</th><th>Archivos</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>`;
  },

  picks_formato_raro(cat) {
    const imgCell = (thumb, img, alt) => thumb
      ? `<td class="img"><a href="${esc(img)}" target="_blank" rel="noopener">
           <img src="${esc(thumb)}" loading="lazy" alt="${esc(alt)}"></a></td>`
      : `<td class="img"></td>`;
    const filas = cat.items.map((it) => `
      <tr data-id="${esc(it.id)}">
        <td class="edit-folder pick-edit">
          <input value="${esc(it.pick)}" spellcheck="false">
          <button class="change-pick">Cambiar pick</button>
        </td>
        <td>${esc(it.id)}</td>
        <td>${esc(it.pais)}</td>
        <td>${esc(it.denominacion)}</td>
        <td>${esc(it.anio)}</td>
        ${imgCell(it.thumb_a, it.img_a, "Front " + it.id)}
        ${imgCell(it.thumb_b, it.img_b, "Back " + it.id)}
      </tr>`).join("");
    return `<div class="table-wrap"><table>
        <thead><tr><th>Pick</th><th>ID</th><th>País</th><th>Moneda Full</th><th>Año</th><th>Front</th><th>Back</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>`;
  },

  sin_colnect(cat) {
    const imgCell = (thumb, img, alt) => thumb
      ? `<td class="img"><a href="${esc(img)}" target="_blank" rel="noopener">
           <img src="${esc(thumb)}" loading="lazy" alt="${esc(alt)}"></a></td>`
      : `<td class="img"></td>`;
    const filas = cat.items.map((it) => `
      <tr data-id="${esc(it.id)}">
        <td>${esc(it.pick) || esc(it.id)}</td>
        <td>${esc(it.pais)}</td>
        <td>${esc(it.denominacion)}</td>
        <td>${esc(it.anio)}</td>
        ${imgCell(it.thumb_a, it.img_a, "Front " + it.id)}
        ${imgCell(it.thumb_b, it.img_b, "Back " + it.id)}
        <td class="edit-folder url-edit">
          <input type="url" placeholder="https://colnect.com/…" spellcheck="false">
          <button class="save-colnect">Guardar link</button>
        </td>
      </tr>`).join("");
    return `<div class="table-wrap"><table>
        <thead><tr><th>Pick</th><th>País</th><th>Moneda Full</th><th>Año</th><th>Front</th><th>Back</th><th>Link Colnect</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>`;
  },

  sin_fotos(cat) {
    const celda = (it, side, thumb, img) => thumb
      ? `<td class="img"><a href="${esc(img)}" target="_blank" rel="noopener">
           <img src="${esc(thumb)}" loading="lazy"></a></td>`
      : `<td class="img upload-cell">
           <input type="file" class="upload-photo" data-id="${esc(it.id)}"
                  data-side="${side}" accept="image/jpeg,.jpg" title="Subir JPG del ${side === "A" ? "frente" : "reverso"}">
         </td>`;
    const filas = cat.items.map((it) => `
      <tr data-id="${esc(it.id)}">
        <td>${esc(it.pick) || esc(it.id)}</td>
        <td>${esc(it.pais)}</td>
        <td>${esc(it.denominacion)}</td>
        <td>${esc(it.anio)}</td>
        ${celda(it, "A", it.thumb_a, it.img_a)}
        ${celda(it, "B", it.thumb_b, it.img_b)}
      </tr>`).join("");
    return `<div class="table-wrap"><table>
        <thead><tr><th>Pick</th><th>País</th><th>Moneda Full</th><th>Año</th><th>Front</th><th>Back</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>`;
  },

  sin_full(cat) {
    const imgCell = (thumb, img) => thumb
      ? `<td class="img"><a href="${esc(img)}" target="_blank" rel="noopener">
           <img src="${esc(thumb)}" loading="lazy"></a></td>`
      : `<td class="img"></td>`;
    const filas = cat.items.map((it) => `
      <tr data-id="${esc(it.id)}">
        <td>${esc(it.pick) || esc(it.id)}</td>
        <td>${esc(it.pais)}</td>
        <td>${esc(it.denominacion)}</td>
        <td>${esc(it.anio)}</td>
        ${imgCell(it.thumb_a, it.img_a)}
        ${imgCell(it.thumb_b, it.img_b)}
        <td><button class="gen-full">Generar Full</button></td>
      </tr>`).join("");
    return `<div class="table-wrap"><table>
        <thead><tr><th>Pick</th><th>País</th><th>Moneda Full</th><th>Año</th><th>Front</th><th>Back</th><th></th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>`;
  },
};

function genericTable(cat) {
  const filas = cat.items.map((item) =>
    `<tr>${item.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("");
  return `<div class="table-wrap"><table>
      <thead><tr>${(cat.columnas || []).map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${filas}</tbody>
    </table></div>`;
}

async function load() {
  let data;
  try {
    const res = await fetch("data/issues.json", { cache: "no-store" });
    data = await res.json();
  } catch {
    document.querySelector("#secciones").innerHTML =
      "<p>No se pudo cargar data/issues.json — corre el build o presiona " +
      "«Recargar datos» en la página principal.</p>";
    return;
  }

  document.querySelector("#gen").textContent =
    `Generado: ${data.generado} — se actualiza con el botón «Recargar datos» o al correr build_web.py`;

  // estado abierto/cerrado por categoría (persistido)
  let openState = {};
  try { openState = JSON.parse(localStorage.getItem("problemas_open")) || {}; }
  catch { /* default: todo abierto */ }

  document.querySelector("#secciones").innerHTML = data.categorias.map((cat) => `
    <details class="problema" data-cat="${esc(cat.clave)}"
             ${openState[cat.clave] === false ? "" : "open"}>
      <summary>${esc(cat.titulo)} <span class="badge">${cat.items.length}</span></summary>
      <p class="desc">${esc(cat.descripcion)}</p>
      ${cat.items.length === 0
        ? `<p class="ok">✓ Sin problemas en esta categoría.</p>`
        : (RENDERERS[cat.clave] || genericTable)(cat)}
    </details>`).join("");

  document.querySelectorAll("details.problema").forEach((det) => {
    det.addEventListener("toggle", () => {
      openState[det.dataset.cat] = det.open;
      localStorage.setItem("problemas_open", JSON.stringify(openState));
    });
  });
}

async function renameFolder(row, btn) {
  const carpeta = row.dataset.carpeta;
  const nuevo = row.querySelector("input").value.trim();
  if (!nuevo || nuevo === carpeta) return;

  btn.disabled = true;
  btn.textContent = "⏳…";
  try {
    let res = await fetch("/api/rename_folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carpeta, nuevo }),
    });
    let out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    // rebuild: refresca issues.json, collection.json y miniaturas
    res = await fetch("/api/rebuild", { method: "POST" });
    out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    await load();   // re-renderiza: si quedó vinculada, desaparece de la lista
  } catch (err) {
    alert(`No se pudo renombrar (${err.message}).`);
    btn.disabled = false;
    btn.textContent = "Renombrar";
  }
}

async function createJson(row, btn) {
  const carpeta = row.dataset.carpeta;
  const pick = row.querySelector("input").value.trim();
  if (!pick || pick === carpeta) {
    alert("Escribe el pick number en el campo (ej: P-416a) y luego presiona «Crear JSON».");
    return;
  }

  btn.disabled = true;
  btn.textContent = "⏳…";
  try {
    let res = await fetch("/api/create_json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carpeta, pick }),
    });
    let out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    // rebuild: el billete nuevo entra a la colección con sus fotos
    res = await fetch("/api/rebuild", { method: "POST" });
    out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    await load();
  } catch (err) {
    alert(`No se pudo crear el JSON (${err.message}).`);
    btn.disabled = false;
    btn.textContent = "Crear JSON";
  }
}

async function changePick(row, btn) {
  const id = row.dataset.id;
  const pick = row.querySelector("input").value.trim();
  if (!pick) return;

  btn.disabled = true;
  btn.textContent = "⏳…";
  try {
    let res = await fetch("/api/change_pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pick }),
    });
    let out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    res = await fetch("/api/rebuild", { method: "POST" });
    out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    await load();
  } catch (err) {
    alert(`No se pudo cambiar el pick (${err.message}).`);
    btn.disabled = false;
    btn.textContent = "Cambiar pick";
  }
}

async function saveColnect(row, btn) {
  const id = row.dataset.id;
  const url = row.querySelector("input").value.trim();
  if (!url) {
    alert("Pega el link de Colnect en el campo (https://colnect.com/…).");
    return;
  }
  if (!/^https?:\/\//.test(url)) {
    alert("El link debe empezar con http:// o https://");
    return;
  }

  btn.disabled = true;
  btn.textContent = "⏳…";
  try {
    let res = await fetch("/api/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, field: "colnect", value: url }),
    });
    let out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    res = await fetch("/api/rebuild", { method: "POST" });
    out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    await load();
  } catch (err) {
    alert(`No se pudo guardar el link (${err.message}).`);
    btn.disabled = false;
    btn.textContent = "Guardar link";
  }
}

async function uploadPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) { alert("Máximo 30 MB."); return; }
  input.disabled = true;
  try {
    const url = `/api/upload_photo?id=${encodeURIComponent(input.dataset.id)}&side=${input.dataset.side}`;
    let res = await fetch(url, { method: "POST",
      headers: { "Content-Type": "image/jpeg" }, body: file });
    let out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    res = await fetch("/api/rebuild", { method: "POST" });
    out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);
    await load();
  } catch (err) {
    alert(`No se pudo subir la foto (${err.message}).`);
    input.disabled = false;
  }
}

async function generarFull(row, btn) {
  const id = row.dataset.id;
  btn.disabled = true;
  btn.textContent = "⏳…";
  try {
    let res = await fetch("/api/generar_full", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    let out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    res = await fetch("/api/rebuild", { method: "POST" });
    out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);
    await load();
  } catch (err) {
    alert(`No se pudo generar la Full (${err.message}).`);
    btn.disabled = false;
    btn.textContent = "Generar Full";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  load();

  document.querySelector("#secciones").addEventListener("change", (e) => {
    const input = e.target.closest("input.upload-photo");
    if (input) uploadPhoto(input);
  });

  document.querySelector("#secciones").addEventListener("click", (e) => {
    const btnR = e.target.closest("button.rename");
    if (btnR) { renameFolder(btnR.closest("tr"), btnR); return; }
    const btnC = e.target.closest("button.create-json");
    if (btnC) { createJson(btnC.closest("tr"), btnC); return; }
    const btnP = e.target.closest("button.change-pick");
    if (btnP) { changePick(btnP.closest("tr"), btnP); return; }
    const btnU = e.target.closest("button.save-colnect");
    if (btnU) { saveColnect(btnU.closest("tr"), btnU); return; }
    const btnG = e.target.closest("button.gen-full");
    if (btnG) generarFull(btnG.closest("tr"), btnG);
  });

  document.querySelector("#secciones").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const input = e.target.closest(".edit-folder input");
    if (input) {
      const row = input.closest("tr");
      renameFolder(row, row.querySelector("button.rename"));
    }
  });
});
