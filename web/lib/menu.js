/* Menú lateral colapsable (hamburguesa) compartido por las 8 páginas.
   - NAV_SECTIONS: 4 secciones fijas — Colección (index, index-edit),
     Países (countries, countries-edit), Monedas (currencies,
     currencies-edit), Otros (stats, problemas) → 8 links en total.
   - menuItems(currentPage): SIEMPRE todos los links (función pura,
     testeable en Node); el ítem de la página actual lleva current: true
     (renderMenu lo pinta con «<< » en la etiqueta + aria-current).
   - renderMenu(page, lang): HTML del panel (.side-menu): antes de los links
     de cada sección va su encabezado .side-menu-section (data-i18n).
   - initSideMenu(page): inyecta .menu-toggle + .side-menu en <body> y cablea
     el toggle. Siempre inicia colapsado (sin persistencia).
   Look & feel: estilos en web/styles.css (.menu-toggle, .side-menu,
   .side-menu-item, .side-menu-section). Los iconos reutilizan los paths SVG
   de las páginas. El toggle de idioma NO está en el menú: es el botón de la
   barra superior (button#lang-toggle; wiring en web/lib/lang.js). */
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
  globe:
    SVG_OPEN +
    '><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  coins:
    SVG_OPEN +
    '><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
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

// Secciones fijas del menú: SIEMPRE se muestran las 4 (8 links) en las 8
// páginas; se marca la página actual (current: true → etiqueta «<< » +
// aria-current). Cada ítem se renderiza como <a> (side-menu-item).
export const NAV_SECTIONS = [
  {
    id: "collection",
    labelKey: "menu_section_collection",
    items: [
      { id: "index", icon: "catalog", labelKey: "menu_catalog", href: "index.html" },
      { id: "index-edit", icon: "edit", labelKey: "menu_edit", href: "index-edit.html" },
    ],
  },
  {
    id: "countries",
    labelKey: "menu_section_countries",
    items: [
      { id: "countries", icon: "globe", labelKey: "menu_countries", href: "countries.html" },
      { id: "countries-edit", icon: "edit", labelKey: "menu_countries_edit", href: "countries-edit.html" },
    ],
  },
  {
    id: "currencies",
    labelKey: "menu_section_currencies",
    items: [
      { id: "currencies", icon: "coins", labelKey: "menu_currencies", href: "currencies.html" },
      { id: "currencies-edit", icon: "edit", labelKey: "menu_currencies_edit", href: "currencies-edit.html" },
    ],
  },
  {
    id: "others",
    labelKey: "menu_section_others",
    items: [
      { id: "stats", icon: "stats", labelKey: "menu_stats", href: "stats.html" },
      { id: "problemas", icon: "problems", labelKey: "menu_problems", href: "problemas.html" },
    ],
  },
];

export function menuItems(currentPage) {
  const items = [];
  for (const sec of NAV_SECTIONS) {
    for (const p of sec.items) {
      items.push({
        type: "link",
        sectionId: sec.id,
        icon: p.icon,
        labelKey: p.labelKey,
        href: p.href,
        current: p.id === currentPage,
      });
    }
  }
  return items;
}

export function renderMenu(page, lang) {
  let rows = "";
  for (const sec of NAV_SECTIONS) {
    // Encabezado de sección (se traduce in situ vía data-i18n).
    rows +=
      `<div class="side-menu-section" data-i18n="${sec.labelKey}">` +
      `${esc(translate(sec.labelKey, lang))}</div>`;
    for (const it of sec.items) {
      // La página actual se indica con «<< » en la etiqueta (+ aria-current
      // y clase .current para el resaltado en styles.css).
      const isCur = it.id === page;
      const cur = isCur ? " current" : "";
      const linkLabel = (isCur ? "<< " : "") + esc(translate(it.labelKey, lang));
      const icon = ICONS[it.icon] || "";
      rows +=
        `<a class="side-menu-item${cur}" href="${esc(it.href)}" title="${linkLabel}"${isCur ? ' aria-current="page"' : ""}>` +
        `<span class="side-menu-ico">${icon}</span>` +
        `<span class="side-menu-label" data-i18n="${it.labelKey}">${linkLabel}</span>` +
        "</a>";
    }
  }
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