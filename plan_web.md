# Plan: Web de visualización de la colección de billetes

## 1. Objetivo

Visualizar la colección (los JSON de `_json/` + las imágenes) en el navegador:

- **Fase actual:** uso local en el Mac (rápido de levantar, sin instalación pesada).
- **Fase futura:** publicable en internet y usable desde el celular (responsive).

## 2. Requisitos funcionales (v1)

| # | Requisito |
|---|-----------|
| R1 | Página principal simple: buscador arriba + tabla paginada abajo. |
| R2 | Al inicio se listan **todos** los billetes. |
| R3 | El buscador filtra por **todos los campos** del JSON (pick, país, moneda, año, firmas, obs, grupo colnect, etc.), insensible a mayúsculas y acentos. |
| R4 | Columnas de la tabla: pick, país, monto (valor), moneda, **año**, miniatura **front**, miniatura **back**, miniatura **full** (consolidada). |
| R5 | Las miniaturas son pequeñas; al hacer clic se abre **solo esa imagen** a tamaño completo en un **modal** (lightbox). |
| R6 | Si un billete no tiene una foto, **la celda queda vacía** (sirve para detectar fotos faltantes de un vistazo). |
| R7 | Paginación (ej. 25/50/100 por página). |
| R8 | Responsive: usable en pantalla de celular. |
| R9 | UI en **español**. (Inglés con toggle: v2+.) |

Fuera de alcance v1 (v2+ confirmado como dirección): **edición de los JSON** y **subida de fotos** desde la web (ver §7bis), toggle ES/EN, filtros por columna, orden por columna, ficha de detalle, estadísticas.

## 3. Decisión tecnológica

### Contexto que manda el diseño
- Los datos son **estáticos**: 930 JSON pequeños. Consolidados pesan < 1 MB → caben completos en el navegador y la búsqueda puede ser **100% client-side** (sin servidor de búsqueda ni base de datos).
- Las imágenes originales son escaneos **pesados** (varios MB c/u). Mostrar 930 filas con JPG originales es inviable → se necesitan **thumbnails** pre-generados.
- Ya existe tooling en **Python + ImageMagick** en el repo; conviene reutilizarlo para el paso de build.

### Alternativas evaluadas

| Opción | Pros | Contras |
|---|---|---|
| **A. Sitio estático** (build en Python + HTML/JS vanilla) ✅ | Cero dependencias de runtime; se sirve con `python3 -m http.server`; publicable gratis (Netlify/Cloudflare Pages); mismo código local y publicado | Sin edición de datos (solo lectura) |
| B. Backend Flask/FastAPI + templates | Permitiría CRUD en v2 | Requiere proceso corriendo; sobra para solo visualizar; complica publicar |
| C. SPA con React/Vue + Vite | UI muy pulida, componentes | Toolchain de node, build, dependencias… desproporcionado para una tabla+modal |

**Elección: Opción A — sitio 100% estático.**
- Lenguajes: **Python** (script de build) + **HTML/CSS/JS vanilla** (una sola página).
- CSS: [Pico.css](https://picocss.com/) (~10 KB, sin build, estilos decentes y responsive out-of-the-box). Sin frameworks JS; a lo sumo < 200 líneas de JS propio.
- Modal: elemento nativo `<dialog>` del navegador (soportado en Safari/Chrome/Firefox actuales). Sin plugins.
- Si en v2 se quiere edición, se agrega entonces un backend (FastAPI) reutilizando el mismo frontend; la decisión no se paga hoy.

## 4. Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│ BUILD (se corre cuando cambian los JSON o las fotos)         │
│                                                              │
│  _scripts/build_web.py                                       │
│    1. Lee _json/**/*.json                                    │
│    2. Consolida → web/data/collection.json  (~1 MB)          │
│       + campo "search" pre-normalizado (sin acentos, lower)  │
│    3. Genera thumbnails con magick:                          │
│       _originals/<id>/<id>_A.jpg → web/thumbs/<id>_A.jpg     │
│       _originals/<id>/<id>_B.jpg → web/thumbs/<id>_B.jpg     │
│       _FULL/<id>.jpg             → web/thumbs/<id>_F.jpg     │
│       (ancho 240 px, calidad 80 → ~15-30 KB c/u)             │
│       Incremental: salta thumbs ya existentes y vigentes.    │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ SERVE                                                        │
│                                                              │
│  web/                                                        │
│    index.html      página única (buscador + tabla + modal)   │
│    app.js          carga collection.json, filtra, pagina     │
│    styles.css      ajustes sobre Pico.css                    │
│    data/collection.json                                      │
│    thumbs/*.jpg    miniaturas                                │
│                                                              │
│  Local:  cd <repo> && python3 -m http.server 8000            │
│          → http://localhost:8000/web/                        │
│  (las imágenes full se sirven directo desde _originals/ y    │
│   _FULL/ del propio repo, mismo origen, sin copiarlas)       │
└──────────────────────────────────────────────────────────────┘
```

### Flujo en el navegador
1. `index.html` carga `collection.json` completo (una sola petición).
2. El JS mantiene el arreglo en memoria; el buscador (con debounce de ~200 ms) filtra contra el campo `search` pre-normalizado.
3. La tabla renderiza solo la página visible (25 filas por defecto) → DOM liviano.
4. Los `<img>` de miniaturas usan `loading="lazy"`.
5. Clic en una miniatura → `<dialog>` con **esa imagen** a tamaño completo (front → `_originals/<id>/<id>_A.jpg`, back → `_B.jpg`, full → `_FULL/<id>.jpg`). Sin navegación interna: se cierra y se clickea otra.
6. Celdas de imagen sin foto: vacías (detección visual de faltantes).

### Formato de `collection.json` (un registro)
```json
{
  "id": "cl-p15b7",
  "pick": "P-15b.7",
  "pais": "Chile",
  "valor": 1,
  "moneda": "Peso",
  "denominacion": "1 Peso",
  "anio": 1919,
  "firmas": "Zañartu - Magallanes",
  "obs": "",
  "grupo": "1898-1920 Issues",
  "colnect": "https://colnect.com/...",
  "conmemorativo": false,
  "remarcado": false,
  "thumb_a": "thumbs/cl-p15b7_A.jpg",
  "thumb_b": "thumbs/cl-p15b7_B.jpg",
  "thumb_f": "thumbs/cl-p15b7_F.jpg",
  "img_a": "../_originals/cl-p15b7/cl-p15b7_A.jpg",
  "img_b": "../_originals/cl-p15b7/cl-p15b7_B.jpg",
  "img_full": "../_FULL/cl-p15b7.jpg",
  "search": "cl-p15b7 p-15b.7 chile 1 peso 1919 zanartu magallanes 1898-1920 issues"
}
```
Los campos `thumb_*`/`img_*` van `""` cuando la foto no existe → la celda se renderiza vacía.

## 5. UI (wireframe)

```
┌────────────────────────────────────────────────────────┐
│  💵 Colección de billetes                (930 items)   │
│  ┌──────────────────────────────────────────────┐      │
│  │ 🔍 Buscar en todos los campos…               │      │
│  └──────────────────────────────────────────────┘      │
│                                                        │
│  Pick     País    Monto  Moneda  Año   Front Back Full │
│  ───────────────────────────────────────────────────── │
│  P-15b.7  Chile   1      Peso    1919  [img] [img] [i] │
│  P-83b.3  Chile   10     Pesos   1929  [img] [img]     │
│  P-90a    Chile   1      Peso    1943              ←celdas vacías = fotos faltantes
│  …                                                     │
│                                                        │
│  « 1 2 3 … 38 »          25 / 50 / 100 por página      │
└────────────────────────────────────────────────────────┘

Modal (clic en una miniatura → solo esa imagen):
┌────────────────────────────────────┐
│  P-15b.7 · Chile · 1 Peso · 1919  ✕│
│  ┌──────────────────────────────┐  │
│  │   la imagen clickeada        │  │
│  │   a tamaño completo          │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

En móvil la tabla colapsa: cada fila se muestra como tarjeta (pick + país + denominación + ambas miniaturas), usando CSS (`@media`), sin JS adicional.

## 6. Estructura de archivos nueva

```
web/
  index.html
  app.js
  styles.css
  pico.min.css          # vendorizado (sin CDN, funciona offline)
  data/collection.json  # generado — NO editar a mano
  thumbs/*.jpg          # generados — NO editar a mano
_scripts/
  build_web.py          # consolida JSON + genera thumbnails
```

- `.gitattributes`: agregar `web/thumbs/*.jpg` a LFS.
- `.gitignore`: nada nuevo (thumbs y collection.json sí se versionan para poder publicar el sitio tal cual).

## 7. Publicación futura (fase 2)

| Opción | Nota |
|---|---|
| **Cloudflare Pages / Netlify** ✅ recomendado | Sirven sitios estáticos gratis y **sí resuelven Git LFS** (Netlify con LFS propio; Cloudflare via build). El sitio queda igual que en local. |
| GitHub Pages | ⚠️ **No sirve archivos LFS** — las imágenes llegarían como punteros. Habría que sacar los JPG de LFS o copiarlos en el build. Descartado mientras se use LFS. |
| Servidor propio (nginx) | Válido si algún día hay backend. |

Consideración de privacidad: publicar expone los seriales/fotos de la colección; decidir en su momento si va con URL privada o pública.

## 7bis. Ruta v2: edición de JSON y subida de fotos (confirmado como dirección)

Cuando llegue la edición, el sitio estático se conserva y se le suma un **backend liviano en FastAPI** (Python, mismo stack del repo):

- `GET /api/collection` reemplaza al `collection.json` estático (misma forma de datos → el frontend casi no cambia).
- `PUT /api/billete/<id>` escribe el JSON en `_json/...` (los archivos siguen siendo la fuente de verdad, versionados en git).
- `POST /api/billete/<id>/foto` recibe front/back, las guarda en `_originals/<id>/` y dispara thumbnail (y opcionalmente `generar_imagen.py`).
- El frontend agrega un modo edición (formulario por billete) sobre la misma tabla.
- Local: `uvicorn`. Publicado: requiere un host con proceso (Fly.io, Railway, VPS) o mantener la web pública en modo lectura (estática) y editar solo en local — decisión para ese momento.

La v1 no paga ningún costo por esta ruta: el formato de `collection.json` y la estructura de `web/` ya son compatibles.

## 8. Plan de implementación

| Paso | Entregable | Esfuerzo |
|---|---|---|
| 1 | `_scripts/build_web.py` (collection.json + thumbs incrementales) | corto |
| 2 | `web/index.html` + `app.js` + CSS: tabla, buscador, paginación | medio |
| 3 | Modal front/back/full + enlace Colnect | corto |
| 4 | Responsive móvil (tarjetas) + pulido | corto |
| 5 | Documentar en Readme (`build` + `serve`) | corto |

Verificación: levantar `http.server`, probar búsqueda con acentos ("Belgica" encuentra "Bélgica"), paginación, modal, y vista móvil (viewport estrecho).

## 9. Decisiones tomadas (2026-07-03)

1. **Modal:** muestra solo la imagen clickeada. La tabla lleva 3 miniaturas: Front, Back y Full.
2. **Columna año:** sí, incluida.
3. **Billetes sin foto:** celda vacía (sin placeholder) — sirve para detectar visualmente las fotos que faltan.
4. **Idioma:** español en v1; toggle ES/EN en v2+.
5. **v2:** edición de JSON y subida de fotos vía web confirmadas como dirección futura → ruta FastAPI documentada en §7bis.

### Defaults asumidos (avisar si se quieren distintos)
- Orden inicial de la tabla: país (es) y luego pick.
- Página por defecto: 25 filas (selector 25/50/100).
- El contador muestra "N resultados" al filtrar.
