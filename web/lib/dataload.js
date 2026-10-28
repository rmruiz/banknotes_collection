/* Guard de carga de datos (T11): utilities compartidos para que las páginas
   muestren un banner visible cuando web/data/ falta o falla, en vez de
   quedarse rotas. DRY: isLocal() deduplica el chequeo que app.js y stats.js
   repetían en línea (B10). */

/** True si se sirve desde localhost (modo local, con _scripts/ disponible). */
export function isLocal() {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

/**
 * Regla de producción compartida (T6): fuera de localhost se ocultan TODOS
 * los links de edición (a[href$="-edit.html"]) — menú lateral y links
 * directos. Cada página la llama en su init (reemplaza la regla ad hoc que
 * solo cubría index-edit.html en app.js). En modo local no hace nada.
 */
export function hideEditLinks() {
  if (isLocal()) return;
  document.querySelectorAll('a[href$="-edit.html"]').forEach((el) => {
    el.style.display = "none";
  });
}

/**
 * Regla de producción compartida: fuera de localhost, los zooms y fallbacks
 * que apuntan a `_originals/` (≈2 MB/cara) o `_FULL/` (≈300 KB) se remapean
 * a la capa media `_MID/` (≤800 px), que es la única resolución de imágenes
 * que Firebase sirve — los originales no se despliegan. Mutua `records` in
 * place; registra sin media conserva su ruta original (muestra el 404 que
 * ya mostraría hoy). Auto-protegido: en localhost (modo admin) no hace nada.
 * @param {object[]} records registros de collection.json (o items de issues.json)
 */
export function useMidImages(records) {
  if (isLocal()) return records;
  for (const r of records) {
    if (r.mid_a) r.img_a = r.mid_a;
    if (r.mid_b) r.img_b = r.mid_b;
    if (r.mid_full) r.img_full = r.mid_full;
  }
  return records;
}

/**
 * Inserta un banner de error de datos al inicio de `root`.
 * Usa textContent (nunca innerHTML) — las líneas no se parsean como HTML.
 * @param {Element} root contenedor (document.body o el main de la página)
 * @param {string[]} lines líneas de mensaje (ya en el idioma deseado)
 */
export function showDataError(root, lines) {
  const box = document.createElement("div");
  box.className = "data-error";
  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line;
    box.appendChild(p);
  }
  root.prepend(box);
  return box;
}