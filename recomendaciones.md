# Recomendaciones de mejora — banknotes_image_builder

> Generado el 2026-07-06 a partir de una revisión completa del proyecto:
> scripts Python, frontend web, calidad de datos (1.007 JSON) y estructura del repo.
> Cada ítem indica severidad: 🔴 alta · 🟡 media · 🟢 baja.

---

## 3. Bugs — scripts Python

### serve_web.py
- 🔴 **`except OSError` demasiado estrecho** (`serve_web.py:609-629` y patrón repetido en
  `:398`, `:522`, `:575`): `json.loads` lanza `JSONDecodeError` y los apliers de campos lanzan
  `KeyError`/`IndexError` con JSONs incompletos → el hilo muere sin responder al cliente.
  Capturar `(OSError, KeyError, IndexError, json.JSONDecodeError)`.
- 🟡 **`_handle_change_pick` no es transaccional** (`serve_web.py:548-576`): si falla el rename
  de carpeta o `_FULL` a mitad, el JSON ya se movió y quedan thumbs huérfanos. Ordenar
  operaciones de menor a mayor riesgo.
- 🟢 `_set_pais` no des-acentúa la clave al buscar `COUNTRY_EN` (`serve_web.py:137`): "Peru"
  sin tilde deja el nombre EN desactualizado en silencio. Reusar `COUNTRY_LOOKUP`.
- 🟢 `int(sys.argv[1])` sin manejo (`serve_web.py:48`) y docstring desactualizado (dice 6
  campos editables; son 18).

### build_web.py
- 🟡 `magick` ausente del PATH no se captura (solo `CalledProcessError`) → traceback críptico
  (`build_web.py:191-197`). Verificar `shutil.which("magick")` al inicio.
- 🟡 **Ids duplicados entre carpetas no se detectan** (`world/x.json` + `chile/x.json` →
  registros duplicados y colisión de thumbs). Detectar stems duplicados y reportar en issues.
- 🟢 `thumbs_meta.json` y `web/thumbs/` nunca se podan: thumbs de ids renombrados quedan
  huérfanos para siempre. Añadir GC.
- 🟢 `ORIGINALS.iterdir()` revienta si `_originals/` no existe (clon sin LFS) (`build_web.py:203`).
- 🟢 `fmt_valor(1234.5)` → `"1234,5"` sin separador de miles, inconsistente con enteros.
- 🟢 `FORCE` se parsea de `sys.argv` a nivel de módulo → hereda los argv de serve_web al ser
  importado (`build_web.py:37`). Mover a argparse.

- 🟡 Mezcla `magick` (nuevo) con el binario legacy `identify` (`:64-71`); en instalaciones
  IM7 "solo magick" el segundo no existe. Usar `magick identify` y verificar PATH al inicio.
- 🟡 `FONT = "Verdana"` sin fallback (`:33`) — en Linux/CI sin fuentes MS falla. Permitir
  override por variable de entorno.
- 🟡 `ask()` usa `input()` sin TTY-check (`:158-172`): en cron/pipe cuelga o crashea. Si
  `not sys.stdin.isatty()`, asumir `skip_all`.
- 🟢 Email, tamaños de fuente y resize `1080x1350` hardcodeados; docstring desactualizado
  (menciona `specimens[0].images` que ya no existe); errores de magick se cuentan como
  "faltantes" en el resumen.

### generate_json.py
- 🟡 **Re-ejecutar el generador pisa JSONs curados** (`generate_json.py:205-208`): todo lo
  editado vía web (verificado, themes, seriales) se pierde. Rehusarse a sobrescribir salvo
  `--force`.
- 🟡 `parse_value` corrompe decimales con coma: `"1,5"` → `15` (`:99-100`). Tratar `,` seguida
  de 1-2 dígitos finales como separador decimal.
- 🟢 `"8.000.000"` dentro de `BLANKS` es un hack indocumentado; `--master` sin argumento →
  `IndexError`; `gen_master` lee el país con claves hardcodeadas en vez de `ALIASES`.

### vincular_originales.py
- 🟡 `used_folders` se declara y nunca se usa: dos carpetas pueden matchear el mismo JSON y
  la segunda pisa a la primera en silencio (`:120`, `:150`). Detectar y mover a `ambiguous`.
- 🟢 `incomplete` se llena pero jamás se reporta (`:148-150`); docstring y constantes
  (`FULL_REL`/`ORIG_REL`) muertos.

---

## 4. Bugs — frontend web

- 🔴 **Enter en "Cambiar pick" / "Guardar link" lanza TypeError y no guarda**
  (`problemas.js:365-372`): el handler de Enter asume que toda celda `.edit-folder` es de
  renombrar carpeta, pero las celdas pick-edit y url-edit comparten esa clase → llama
  `renameFolder(row, undefined)` y explota. Despachar según la clase real de la celda.
- 🔴 **En móvil las columnas ocultas reaparecen** (`styles.css:456-461` + `app.js:465-469`):
  la media query `#tbl td { display:block }` pisa el `[hidden]` del user-agent. Fix de una
  línea: `#tbl td[hidden], #tbl th[hidden] { display:none; }`.
- 🔴 **Carga inicial sin manejo de errores ni "Cargando…"** (`app.js:681-686`): si el fetch de
  `collection.json` (1 MB) falla, página en blanco sin mensaje. try/catch + placeholder.
- 🟡 `toggleBool()` no re-aplica el filtro (`app.js:513-528`): con "solo sin ✓" activo, marcar
  un billete no lo saca de la vista y el contador queda desactualizado.
- 🟡 El `alert("Número inválido")` roba el foco → dispara blur → se cancela la edición y el
  usuario pierde lo tecleado (`app.js:584-597`). Mostrar el error inline.
- 🟢 `openModal` sin null-check (`app.js:336`); datalist de países no se refresca tras crear
  uno nuevo (`app.js:756`); `replace(",", ".")` solo reemplaza la primera coma (`app.js:583`).
- ✅ **XSS: sin hallazgos** — todo `innerHTML` pasa por `esc()` correctamente.

---

## 5. Calidad de datos

Estado general **muy sano**: 1.007/1.007 JSON parsean, 0 ids inconsistentes con el nombre de
archivo, 0 duplicados de pick/colnect, 0 temas mal formateados, cobertura de imágenes 99%.

### 5.1 Nombres de país con errata o tilde faltante (🟡)
| Actual | Sugerido | Registros |
|---|---|---|
| Boznia y Herzegovina | Bosnia y Herzegovina | 2 |
| Sud Africa | Sudáfrica | 2 |
| Iran | Irán | 7 |
| Pakistan | Pakistán | 2 |
| Oman | Omán | 2 |
| Taiwan | Taiwán | 1 |
| Kirguistan | Kirguistán | 4 |
| Paises Bajos | Países Bajos | 1 |
| Somalía | Somalia | 1 |
| Santo Tomé y Principe | Santo Tomé y Príncipe | 4 |
| El Congo | Rep. Dem. del Congo | 3 |

Ojo: al corregir hay que actualizar también `country_map.py` (claves en minúscula) y revisar
que la bandera siga resolviendo (`build_web.FLAG_ALIASES`). Inconsistencias de estilo menores:
`Rep. Checa`/`Rep. Dominicana` abreviados, `Botswana`/`Lesotho` (grafía inglesa), `Bermuda`.

### 5.2 Completitud (🟡 — trabajo de catalogación pendiente)
- `signatures` vacías: **891 registros (88,5%)** — casi todo world/ y gran parte de argentina/.
- `specimens` sin serial ni condición: **1.007 (100%)** — ningún ejemplar físico cargado aún.
- `country.en == country.es` en 530 casos: la mayoría legítimos, pero los países de la tabla
  anterior necesitan además su traducción EN correcta.
- `verificado`: solo 11 marcados — el flujo de verificación recién empieza.

### 5.3 Registros especiales a decidir (🟢)
- `cl-ch032`: billete fantasía con value/currency null — ¿marcarlo con `subtype: "fantasía"`?
- `eu-0euros-2024`: value 0 legítimo (souvenir), pero romperá lógica que asuma `value > 0`.
- `cwsx-p1a`/`cwsx-p2a`: prefijo de 4 letras fuera del patrón; documentarlo como excepción.
- Huérfanos: `_originals/zz_RAPA.NUI_*` (2 carpetas) y `_FULL/cl-10000pesos-1947.jpg`,
  `_FULL/cl-100pesos-1941.jpg` sin JSON.
- 10 ids sin ninguna imagen: `cl-p92d5, ar-p356a7, hn-p95a2, id-p128a, nir-p345b, nz-p169a,
  nz-p193a, pe-p115a, pe-p140a, py-p234d` (pendiente conocido).
- 4 ids sin temas (decisión deliberada por falta de certeza/imagen): `id-p91a, kor-p29a1,
  nir-p345b, pe-p115a`.

### 5.4 Normalización de temas (🟡)
2.244 temas, todos dentro de la taxonomía y bien formateados. Pero hay variantes conceptuales:
- **Escudos, 22 variantes / 3 patrones**: `simbolo:escudo` (24×), `simbolo:escudo_nacional`
  (43×), `escudo_de_bolivia`, `escudo_bahamas`, `escudo_republica_checa`… Elegir UN patrón
  (sugerencia: `simbolo:escudo_nacional` a secas — el país ya está en el registro) y migrar.
- **Mapas**: `simbolo:mapa` genérico vs `mapa_de_europa`, `mapa_de_suecia`… mismo criterio.
- **Mismo valor bajo claves distintas** (elegir una): `aguila` (fauna/simbolo), `camello`
  (fauna/transporte), `leon` (arte/fauna), `machu_picchu` (construccion/lugar), `orfebreria`
  (actividad/arte), `puerto` (construccion/lugar).
- **Duplicado real**: `personaje:petar_petrovic_njegos` (4×) vs `personaje:petar_ii_petrovic_njegos`
  (1×) — unificar.
- Sugerencia: script `_scripts/validar_temas.py` con la taxonomía y un diccionario de alias,
  ejecutado dentro de `build_web` para alimentar la página de Problemas.

---

## 6. Rendimiento

- 🟡 `collection.json` (1 MB) se descarga completo con `cache: "no-store"` en cada visita
  (`app.js:683`). El campo `search` precalculado infla el payload ~25% y podría derivarse en
  el cliente. Alternativas: ETag/If-None-Match o gzip en serve_web.
- 🟡 Sin cache-busting para `app.js`/`styles.css`/`problemas.js` (las imágenes sí lo tienen):
  tras un deploy, un navegador puede servir JS viejo contra datos nuevos. Añadir `?v=` también
  a los assets.
- 🟢 `_handle_generar_full` y `/api/rebuild` retienen `WRITE_LOCK` durante segundos bloqueando
  toda edición (aceptable mono-usuario).
- 🟢 `loadIssuesBadge()` se re-fetchea en cada toggle de idioma sin necesidad (`app.js:631`).

---

## 7. Arquitectura y mantenibilidad

- 🟡 **`unaccent`/`norm` implementado 5 veces** con semánticas ligeramente distintas
  (build_web, generar_imagen, vincular_originales, serve_web, generate_json). Crear
  `_scripts/util.py` compartido.
- 🟡 **La construcción del id está cuadruplicada** (serve_web ×3 + generate_json.make_id) y
  **el esquema por defecto del billete está en 3 lugares**. Extraer `make_note_id()` y
  `default_note()` a util.py — es EL convenio central del proyecto y hoy puede divergir.
- 🟡 **Cero tests.** Los de mayor valor/menor esfuerzo: `parse_value` (hay 2 versiones),
  construcción de id, `parse_old_folder`/`parse_token`, `fmt_valor`, resolución de banderas.
  Un `pytest` de 30 casos cubriría los convenios críticos.
- 🟡 Duplicación frontend: `esc()` copiado en app.js y problemas.js; `imgCell` copiado 4 veces
  dentro de problemas.js; el patrón "POST → rebuild → reload" repetido en 6 funciones. Un
  `common.js` + helpers `postJson()`/`rebuildAndReload()` quitan ~120 líneas.
- 🟢 `banknote_processor.py` (experimento LLM local con Ollama/LangGraph) vive suelto en la
  raíz, sin documentar. Moverlo a `_scripts/` o `_experimental/`, o eliminarlo. Borrar
  `banknotes_output_catalog.txt` (28 bytes de salida basura).
- 🟢 Datos muertos en frontend: etiquetas español del array `COLUMNS` y `DETAIL_FIELDS` nunca
  se usan (todo pasa por `t(k)`).

---

## 8. UX

- 🟡 **i18n incompleto**: el toggle EN/ES solo existe en el índice; `problemas.html` está 100%
  en español (incluidos los textos que genera build_web en issues.json). Además `fmtValor`
  siempre formatea es-CL ("1.000" en modo inglés). Decidir si problemas se traduce o si el
  toggle se documenta como "solo índice".
- 🟡 Feedback de errores con `alert()` bloqueante en todas partes; blur cancela la edición
  sin avisar (convención habitual: blur = guardar). Un toast no modal + guardar-en-blur.
- 🟢 El modal de detalle omite `verificado` y la imagen Full que la tabla sí muestra.
- 🟢 Clic en imagen inconsistente: tabla/detalle = zoom modal; problemas = abre pestaña nueva
  (ambos con `cursor: zoom-in`).
- 🟢 Accesibilidad: los `th` ordenables no son focusables ni tienen `aria-sort`; faltan `alt`
  en 2 renderers de problemas.js.
- 🟢 Detalles: "Por página" no se persiste en localStorage (idioma/columnas/foto-size sí);
  sin atajo `/` para enfocar búsqueda; subida de fotos de hasta 30 MB sin barra de progreso;
  `#controls` desborda en ~375 px (falta `flex-wrap`); el botón de idioma muestra la bandera
  del idioma DESTINO (ambiguo — mejor texto "EN/ES").

---

## 9. Git / LFS / archivos generados

- 🔴 Ver §1.1 (worktree fantasma) y §1.2 (sin remote).
- 🟢 `.gitattributes`: línea stale `_jpg_examples/*.jpg` (la carpeta ya no existe). LFS cubre
  el 100% de los JPG — correcto.
- 🟢 `.gitignore`: entradas stale (`_INSTAGRAM/*`, `_folders.originals/`) y falta `.claude/`.
- 🟢 `web/data/*` + `web/thumbs/` (3.364 jpgs, ~110 MB) están versionados **a propósito**
  (decisión de plan_web.md §6 para publicar el sitio tal cual). Es defendible, pero: (a)
  documentarlo en el Readme, (b) si la publicación termina teniendo build propio, pasarlos a
  .gitignore — cada rebuild ensucia el diff con 1 MB de collection.json.
- 🟢 Borrar `.DS_Store` del disco (ya están ignorados).

---

## 10. Documentación

- 🟡 **`plan_gcp.md` no existe** — se perdió en el re-init de la historia (o nunca se
  commiteó). Si la publicación en GCP (VM e2-micro) sigue en agenda, reescribirlo; lo único
  que sobrevive es la sección §7 de plan_web.md.
- 🟢 `Readme.md` está actualizado y es bueno. Faltantes: paso explícito `git lfs pull` en el
  setup desde cero; mención de `banknote_processor.py` y sus dependencias pip (o eliminarlo);
  nota de que `web/data` + `web/thumbs` se versionan a propósito.
- 🟢 `plan_web.md` con drift menor: dice thumbs de 240 px (hoy 360), `python3 -m http.server`
  (hoy serve_web.py) y 930 billetes (hoy 1.007). Añadir nota "implementado — ver Readme".
- 🟢 Docstrings desactualizados en serve_web.py, generar_imagen.py y vincular_originales.py
  (referencias a `specimens[0].images` y listas de campos viejas).

---

## 11. Ideas futuras (sin urgencia)

1. **Completar specimens**: el esquema los soporta desde el día 1 y están 100% vacíos — una
   vista de edición dedicada (serial + condición IBNS por ejemplar) cerraría el ciclo del
   catálogo físico.
2. **Firmas del resto del mundo**: 891 registros sin signatures; priorizar por país con más
   billetes (Venezuela 43, Brasil 25, Colombia 16…).
3. **Búsqueda por tema como filtro visual**: los temas ya están en el índice de búsqueda;
   chips clicables (`fauna:jaguar`) en el modal harían navegable la colección temática.
4. **Export**: generar un CSV/Excel de la colección desde build_web para respaldo e
   intercambio con otros coleccionistas.
5. **Estadísticas**: página simple con conteos por país, década, moneda y tema (los datos ya
   están en collection.json).
6. **CI mínima**: GitHub/GitLab Actions que corra la validación de datos (§5) y los tests
   (§7) en cada push — gratis y evita regresiones de convenios.
