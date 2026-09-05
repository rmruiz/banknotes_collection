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