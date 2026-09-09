/* Menú lateral colapsable (hamburguesa) compartido por las 4 páginas.
   - menuItems(page): lista de ítems por página (función pura, testeable en Node).
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
  reading:
    SVG_OPEN +
    '><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
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

// Ítems por página. type "button": se renderiza como <button> con el id dado
// (solo el toggle de idioma; su wiring vive en app.js). type "link": <a>.
const MENUS = {
  index: [
    { type: "button", id: "lang-toggle", icon: "lang", labelKey: "menu_lang" },
    { type: "link", href: "index-edit.html", icon: "edit", labelKey: "menu_edit" },
    { type: "link", href: "stats.html", icon: "stats", labelKey: "menu_stats" },
  ],
  "index-edit": [
    { type: "button", id: "lang-toggle", icon: "lang", labelKey: "menu_lang" },
    { type: "link", href: "index.html", icon: "reading", labelKey: "menu_reading" },
    { type: "link", href: "stats.html", icon: "stats", labelKey: "menu_stats" },
  ],
  stats: [
    { type: "link", href: "index.html", icon: "catalog", labelKey: "menu_catalog" },
    { type: "link", href: "index-edit.html", icon: "edit", labelKey: "menu_edit" },
    { type: "link", href: "problemas.html", icon: "problems", labelKey: "menu_problems" },
  ],
  problemas: [
    { type: "link", href: "index.html", icon: "catalog", labelKey: "menu_catalog" },
    { type: "link", href: "stats.html", icon: "stats", labelKey: "menu_stats" },
  ],
};

export function menuItems(page) {
  const list = MENUS[page];
  return list ? list.map((it) => ({ ...it })) : [];
}

export function renderMenu(page, lang) {
  const rows = menuItems(page)
    .map((it) => {
      const icon = ICONS[it.icon] || "";
      const label = esc(translate(it.labelKey, lang));
      if (it.type === "button") {
        // applyI18n() (app.js) reemplaza el contenido del botón por el emoji
        // de bandera y actualiza su title; la etiqueta se traduce vía data-i18n.
        return (
          '<div class="side-menu-item">' +
          `<button id="lang-toggle" type="button" class="side-menu-ico" title="${esc(translate("lang_tip", lang))}">${icon}</button>` +
          `<span class="side-menu-label" data-i18n="${it.labelKey}">${label}</span>` +
          "</div>"
        );
      }
      return (
        `<a class="side-menu-item" href="${esc(it.href)}" title="${label}">` +
        `<span class="side-menu-ico">${icon}</span>` +
        `<span class="side-menu-label">${label}</span>` +
        "</a>"
      );
    })
    .join("");
  return (
    `<div class="side-menu-head">${esc(translate("menu_title", lang))}</div>` +
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