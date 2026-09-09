/* Menú lateral colapsable (hamburguesa) compartido por las 4 páginas.
   - menuItems(currentPage): SIEMPRE todas las opciones (función pura,
    testeable en Node); el ítem de la página actual lleva current: true
    (renderMenu lo pinta con «<< » en la etiqueta + aria-current).
   - renderMenu(page, lang): HTML del panel (.side-menu).
   - initSideMenu(page): inyecta .menu-toggle + .side-menu en <body> y cablea
     el toggle. Siempre inicia colapsado (sin persistencia).
   Look & feel: estilos en web/styles.css (.menu-toggle, .side-menu,
   .side-menu-item). Los iconos reutilizan los paths SVG de las páginas.
   El botón de idioma se genera con id="lang-toggle": el wiring (listener de
   click) y la bandera la pinta applyI18n() de app.js; la etiqueta del ítem
   lleva data-i18n="menu_lang" para que se traduzca con el resto de la UI. */
import { translate } from "./i18n.js";

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Iconos SVG inline (mismos paths lucide de los top-bars actuales).
const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  lang:
    SVG_OPEN +
    '><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  edit:
    SVG_OPEN +
    '><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  stats:
    SVG_OPEN +
    '><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-4"/></svg>',
  catalog:
    SVG_OPEN +
    '><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
  problems:
    SVG_OPEN +
    '><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
};

// Opciones fijas del menú: SIEMPRE se muestran todas en las 4 páginas; se
// marca la página actual (current: true → etiqueta «<< » + aria-current).
// type "button": se renderiza como <button> con el id dado (solo el toggle de
// idioma; su wiring vive en app.js). type "link": <a>.
const NAV = [
  { id: "index", icon: "catalog", labelKey: "menu_catalog", href: "index.html" },
  { id: "index-edit", icon: "edit", labelKey: "menu_edit", href: "index-edit.html" },
  { id: "stats", icon: "stats", labelKey: "menu_stats", href: "stats.html" },
  { id: "problemas", icon: "problems", labelKey: "menu_problems", href: "problemas.html" },
];

export function menuItems(currentPage) {
  const items = [
    { type: "button", id: "lang-toggle", icon: "lang", labelKey: "menu_lang" },
  ];
  for (const p of NAV) {
    items.push({
      type: "link",
      icon: p.icon,
      labelKey: p.labelKey,
      href: p.href,
      current: p.id === currentPage,
    });
  }
  return items;
}

export function renderMenu(page, lang) {
  const rows = menuItems(page)
    .map((it) => {
      const icon = ICONS[it.icon] || "";
      const label = esc(translate(it.labelKey, lang));
      if (it.type === "button") {
        // La bandera y el title del botón los pinta applyI18n() (app.js) o
        // refreshMenuLang() (esta lib); la etiqueta se traduce vía data-i18n.
        return (
          '<div class="side-menu-item">' +
          `<button id="lang-toggle" type="button" class="side-menu-ico" title="${esc(translate("lang_tip", lang))}">${icon}</button>` +
          `<span class="side-menu-label" data-i18n="${it.labelKey}">${label}</span>` +
          "</div>"
        );
      }
      // La página actual se indica con «<< » en la etiqueta (+ aria-current
      // y clase .current para el resaltado en styles.css).
      const cur = it.current ? " current" : "";
      const linkLabel = (it.current ? "<< " : "") + label;
      return (
        `<a class="side-menu-item${cur}" href="${esc(it.href)}" title="${linkLabel}"${it.current ? ' aria-current="page"' : ""}>` +
        `<span class="side-menu-ico">${icon}</span>` +
        `<span class="side-menu-label" data-i18n="${it.labelKey}">${linkLabel}</span>` +
        "</a>"
      );
    })
    .join("");
  return (
    `<div class="side-menu-head" data-i18n="menu_title">${esc(translate("menu_title", lang))}</div>` +
    `<div class="side-menu-list">${rows}</div>`
  );
}

export function initSideMenu(page) {
  if (!page || document.querySelector(".side-menu")) return;
  const lang = localStorage.getItem("banknotes_lang") === "en" ? "en" : "es";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "menu-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.title = translate("menu_open", lang);
  toggle.innerHTML =
    '<span class="menu-bar"></span><span class="menu-bar"></span><span class="menu-bar"></span>';
  const panel = document.createElement("nav");
  panel.className = "side-menu";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = renderMenu(page, lang);
  document.body.appendChild(toggle);
  document.body.appendChild(panel);
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    toggle.title = translate(open ? "menu_close" : "menu_open", lang);
  });
}

// Refresca el panel ya inyectado al cambiar el idioma. In situ: actualiza los
// textos [data-i18n] del panel SIN reemplazar el <button id="lang-toggle">
// (sustituir el innerHTML del panel le haría perder su listener de click).
export function refreshMenuLang() {
  const panel = document.querySelector(".side-menu");
  if (!panel) return;
  const lang = localStorage.getItem("banknotes_lang") === "en" ? "en" : "es";
  panel.querySelectorAll("[data-i18n]").forEach((el) => {
    const prefix = el.closest("a.current") ? "<< " : "";
    el.textContent = prefix + translate(el.dataset.i18n, lang);
    const a = el.closest("a.side-menu-item");
    if (a) a.title = el.textContent;
  });
  // La bandera muestra el idioma al que se CAMBIA (misma convención que
  // applyI18n() de app.js).
  const btn = document.getElementById("lang-toggle");
  if (btn) {
    btn.textContent = lang === "en" ? "🇨🇱" : "🇬🇧";
    btn.title = translate("lang_tip", lang);
  }
}

// Cablea el botón de idioma (lo genera renderMenu): alterna el idioma
// persistido en localStorage y refresca el menú. `onAfter(lang)` deja a la
// página actualizar su propio UI (p. ej. applyI18n() en app.js; stats.js y
// problemas.js no tienen i18n propio y no pasan callback).
export function bindLangToggle(onAfter) {
  const btn = document.getElementById("lang-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const lang = localStorage.getItem("banknotes_lang") === "en" ? "es" : "en";
    localStorage.setItem("banknotes_lang", lang);
    refreshMenuLang();
    if (typeof onAfter === "function") onAfter(lang);
  });
}