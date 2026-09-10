/* Página del dataset countries (T4) — motor compartido web/lib/datasets.js.
   countries-edit.html activa el modo edición (celdas inline vía
   POST /api/update_dataset). El toggle de idioma de la barra superior
   (lib/lang.js) refresca el menú en el sitio y reaplica el i18n de la
   página (state.applyI18n). */
import { initDatasetPage } from "./lib/datasets.js";
import { initSideMenu } from "./lib/menu.js";
import { bindHeaderLang } from "./lib/lang.js";

const EDIT = location.pathname.endsWith("-edit.html");

initSideMenu(EDIT ? "countries-edit" : "countries");
bindHeaderLang((lang) => {
  const st = window.__datasetPage;
  if (!st) return;      // aún cargando el JSON
  st.lang = lang;
  st.applyI18n();
});

await initDatasetPage("countries", { edit: EDIT });
