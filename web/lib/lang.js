/* Toggle de idioma de la barra superior (button#lang-toggle) compartido por
   las 8 páginas (T6). El botón vive en el HTML de cada página (junto al
   icono de GitHub); este módulo pinta la bandera (🇨🇱 → mostrar EN /
   🇬🇧 → mostrar ES, misma convención que el botón antiguo del menú) y al
   hacer click:
     1. guarda el nuevo idioma en localStorage (clave "banknotes_lang",
        misma que leerá cada página al iniciar),
     2. actualiza el botón,
     3. refresca en el sitio el menú lateral (labels, subtítulo, marcador
        de página actual — el panel NO se regenera),
     4. llama al callback (si existe) para que la página aplique el i18n
        propio (aplicarI18n + re-render del contenido).
   Cada página llama bindHeaderLang() en su init (app.js, stats.js,
   problemas.js pasan el callback; las páginas de datasets lo hacen vía
   initDatasetPage). */
import { translate } from "./i18n.js";
import { refreshMenuLang } from "./menu.js";

// idioma activo: "en" si localStorage dice "en"; por defecto "es".
export function currentLang() {
  return localStorage.getItem("banknotes_lang") === "en" ? "en" : "es";
}

// onAfter(lang): callback opcional que la página ejecuta tras cambiar el
// idioma (aplicar su i18n y re-renderizar). Devuelve el botón (o null si no
// existe en la página).
export function bindHeaderLang(onAfter) {
  const btn = document.getElementById("lang-toggle");
  if (!btn) return null;

  const paint = () => {
    const lang = currentLang();
    btn.textContent = lang === "en" ? "🇨🇱" : "🇬🇧";
    btn.title = translate("lang_tip", lang);
    btn.setAttribute("aria-label", translate("lang_tip", lang));
  };
  paint();

  btn.addEventListener("click", () => {
    const next = currentLang() === "en" ? "es" : "en";
    localStorage.setItem("banknotes_lang", next);
    paint();
    refreshMenuLang(next);   // el menú persiste: solo se traduce en el sitio
    if (typeof onAfter === "function") onAfter(next);
  });
  return btn;
}
