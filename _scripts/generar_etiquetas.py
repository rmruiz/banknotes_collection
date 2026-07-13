"""Genera hojas CARTA imprimibles con una etiqueta por billete usando ReportLab.

Esta versión reemplaza ImageMagick por ReportLab, resolviendo nativamente
el problema del formato en negrita (Bold) al usar las fuentes estándar de PDF, 
y agiliza considerablemente la generación.
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import cm
    from reportlab.lib.utils import ImageReader
    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER
except ImportError:
    sys.exit("ERROR: No se encontró 'reportlab'. Instálalo ejecutando: pip install reportlab")

REPO = Path(__file__).resolve().parent.parent
JSON_DIR = REPO / "_json"
FLAGS = REPO / "_flags"
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    import build_web
except ImportError:
    print("Advertencia: No se encontró build_web.py. Se simularán datos para prueba.")
    class DummyBuildWeb:
        @staticmethod
        def flag_file(pais): return "dummy.png"
        @staticmethod
        def denominacion_full(d): return str(d.get("value", ""))
        @staticmethod
        def unaccent(s): return s
        @staticmethod
        def natural_pick_key(p): return p
    build_web = DummyBuildWeb()

# ---------------------------------------------------------------- geometría
LABEL_W_CM, LABEL_H_CM = 2.8, 6.6
COLS, ROWS = 7, 4

def px300_to_pt(px):
    return px * 72.0 / 300.0

PAD_PT = px300_to_pt(18)
SIDE_PAD_PT = px300_to_pt(20)
BORDER_PT = px300_to_pt(15)
EDGE_PAD_PT = px300_to_pt(50)

# ---------------------------------------------------------------- campos
def is_usa(r):   return r["pais"] == "Estados Unidos"
def is_chile(r): return r["pais"] == "Chile"

def format_value(val):
    if not val:
        return ""
    val = str(val).strip()
    
    if ',' in val and '.' not in val:
        parts = val.split(',', 1)
        int_part = parts[0]
        dec_part = '.' + parts[1]
    elif '.' in val:
        parts = val.split('.', 1)
        int_part = parts[0]
        dec_part = '.' + parts[1]
    else:
        int_part = val
        dec_part = ""
        
    int_part = int_part.replace('.', '').replace(',', '')
    
    try:
        # Aquí formateamos con puntos como separador de miles
        int_part_clean = "{:,}".format(int(int_part)).replace(',', '.')
    except ValueError:
        int_part_clean = int_part
        
    return int_part_clean + dec_part

FIELDS = [
    {"key": "pick",   "size": 42, "bold": False, "wrap": False, "align": "top",
     "get": lambda r: r["pick"]},
    {"key": "value",  "size": 45, "bold": True,  "wrap": True,  "align": "top",
     "get": lambda r: format_value(r["value"])},
    {"key": "currency","size": 42,"bold": True,  "wrap": True,  "align": "top",
     "get": lambda r: r["currency"]},
    {"key": "anio",   "size": 42, "bold": False, "wrap": False, "align": "center",
     "get": lambda r: r["anio"], "when": lambda r: not is_usa(r)},
    {"key": "zona",   "size": 24, "bold": True,  "wrap": True,  "align": "center",
     "get": lambda r: r["zone"], "when": is_usa},
    {"key": "serie",  "size": 40, "bold": False, "wrap": False, "align": "center",
     "get": lambda r: r["serie"], "when": is_usa},
    {"key": "firmas", "size": 24, "bold": False, "wrap": True,  "align": "center",
     "get": lambda r: r["firmas"], "when": is_chile},
    {"key": "pais",   "size": 42, "bold": True,  "wrap": True,  "align": "bottom",
     "get": lambda r: r["pais"]},
    {"key": "flag",   "type": "image", "width_cm": 2.1,         "align": "bottom",
     "get": lambda r: r["flag_path"]},
]

# ---------------------------------------------------------------- registro
def load_records(filter_str=None, solo_verificados=False):
    recs = []
    for f in sorted(JSON_DIR.glob("*/*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if filter_str and filter_str.lower() not in d["country"]["es"].lower() and filter_str.lower() not in str(f.parent.name).lower():
            continue
        if solo_verificados and not d.get("verificado"):
            continue
        
        pais = d["country"]["es"]
        flag = build_web.flag_file(pais)
        
        recs.append({
            "id": d.get("id", ""),
            "pick": d.get("pick_number", "") or "",
            "pais": pais,
            "value": (d.get("denomination") or {}).get("value", "") or "",
            "currency": (d.get("denomination") or {}).get("currency", "") or "",
            "anio": str(d.get("year") or ""),
            "serie": (d.get("notes") or {}).get("serie", "") or "",
            "zone": (d.get("notes") or {}).get("zone", "") or "",
            "firmas": " / ".join(d.get("signatures") or []),
            "flag_path": str(FLAGS / flag) if flag and (FLAGS / flag).exists() else "",
        })
    recs.sort(key=lambda r: (build_web.unaccent(r["pais"]).lower(),
                             build_web.natural_pick_key(r["pick"])))
    return recs

# ---------------------------------------------------------------- helpers de diseño
def get_style(fld):
    font_name = "Helvetica-Bold" if fld.get("bold") else "Helvetica"
    font_size = px300_to_pt(fld["size"])
    return ParagraphStyle(
        name=fld["key"],
        fontName=font_name,
        fontSize=font_size,
        leading=font_size * 1.15,
        alignment=TA_CENTER
    )

def get_img_height(path, img_w):
    try:
        img = ImageReader(path)
        iw, ih = img.getSize()
        return img_w * ih / iw
    except Exception:
        return 0

# ---------------------------------------------------------------- render de etiqueta
def render_label(c, rec, x, y, w, h):
    # Dibujar el contorno (guía de corte) siempre
    c.setLineWidth(BORDER_PT)
    c.rect(x, y, w, h)
    
    # Si rec es None, significa que es una de las etiquetas vacías
    if rec is None:
        return
        
    inner_w = w - (2 * SIDE_PAD_PT)
    top_el = []
    center_el = []
    bottom_el = []
    
    for fld in FIELDS:
        if fld.get("when") and not fld["when"](rec):
            continue
        val = fld["get"](rec)
        if not val:
            continue
            
        el = {"align": fld.get("align", "center")}
        
        if fld.get("type") == "image":
            el["type"] = "image"
            el["w"] = fld.get("width_cm", 1.7) * cm
            el["path"] = val
            el["h"] = get_img_height(val, el["w"])
        else:
            el["type"] = "text"
            p = Paragraph(str(val), get_style(fld))
            p_w, p_h = p.wrap(inner_w, h)
            el["w"] = inner_w
            el["h"] = p_h
            el["obj"] = p
            
        if el["h"] > 0:
            if el["align"] == "top": top_el.append(el)
            elif el["align"] == "bottom": bottom_el.append(el)
            else: center_el.append(el)

    # 3. Dibujar Bloque Superior (Anclado al norte)
    top_bound = y + h - EDGE_PAD_PT
    for el in top_el:
        if el["type"] == "text":
            el["obj"].drawOn(c, x + SIDE_PAD_PT, top_bound - el["h"])
            top_bound -= (el["h"] + PAD_PT)
            
    # 4. Dibujar Bloque Inferior (Anclado al sur, desde abajo hacia arriba)
    bottom_bound = y + EDGE_PAD_PT
    for el in reversed(bottom_el):
        if el["type"] == "image":
            img_x = x + (w - el["w"])/2
            c.drawImage(el["path"], img_x, bottom_bound, width=el["w"], height=el["h"], mask="auto")
            
            # Dibujar borde negro fino a la bandera
            c.saveState()
            c.setLineWidth(0.5) # Borde fino (0.5 pt)
            c.setStrokeColorRGB(0, 0, 0) # Color negro
            c.rect(img_x, bottom_bound, el["w"], el["h"])
            c.restoreState()
            
            bottom_bound += (el["h"] + PAD_PT)
        else:
            bottom_bound += el["h"]
            el["obj"].drawOn(c, x + SIDE_PAD_PT, bottom_bound - el["h"])
            bottom_bound += PAD_PT
            
    # 5. Dibujar Bloque Central (Centrado verticalmente en el espacio disponible)
    mid_y = (top_bound + bottom_bound) / 2
    total_center_h = sum([el["h"] for el in center_el]) + (PAD_PT * max(0, len(center_el) - 1))
    
    cur_y = mid_y + (total_center_h / 2)
    for el in center_el:
        if el["type"] == "text":
            el["obj"].drawOn(c, x + SIDE_PAD_PT, cur_y - el["h"])
            cur_y -= (el["h"] + PAD_PT)

# ---------------------------------------------------------------- rutina principal
def main():
    ap = argparse.ArgumentParser(description="Etiquetas imprimibles con ReportLab")
    ap.add_argument("--filter", help="carpeta o país a incluir")
    ap.add_argument("--verificados", action="store_true", help="solo verificado=true")
    ap.add_argument("--out", default=str(REPO / "etiquetas.pdf"), help="PDF de salida")
    args = ap.parse_args()

    recs = load_records(args.filter, args.verificados)
    if not recs:
        sys.exit("No hay billetes que coincidan con el filtro.")
        
    print(f"Generando {len(recs)} etiquetas en PDF (ReportLab)...")
    
    c = canvas.Canvas(args.out, pagesize=letter)
    
    per_page = COLS * ROWS
    max_recs_per_page = per_page - 2  # Dejamos 2 espacios vacíos por página
    
    # Agrupar registros asegurando los espacios vacíos al final de cada página
    paged_recs = []
    for i in range(0, len(recs), max_recs_per_page):
        chunk = recs[i:i + max_recs_per_page]
        paged_recs.extend(chunk)
        
        # Rellenar con 'None' hasta completar los 32 espacios (lo que asegura al menos 2 vacíos)
        blanks_needed = per_page - len(chunk)
        paged_recs.extend([None] * blanks_needed)

    grid_w = COLS * LABEL_W_CM * cm
    grid_h = ROWS * LABEL_H_CM * cm
    
    start_x = (letter[0] - grid_w) / 2.0
    start_y = (letter[1] + grid_h) / 2.0
    
    for i, rec in enumerate(paged_recs):
        if i > 0 and i % per_page == 0:
            c.showPage()
            
        pos = i % per_page
        row = pos // COLS
        col = pos % COLS
        
        x = start_x + col * LABEL_W_CM * cm
        y = start_y - (row + 1) * LABEL_H_CM * cm
        
        # Se dibuja la etiqueta (si es None, solo dibujará el contorno)
        render_label(c, rec, x, y, LABEL_W_CM * cm, LABEL_H_CM * cm)
        
    c.save()
    print(f"✓ PDF guardado en: {args.out} (Billetes reales impresos, con espacios vacíos)")

if __name__ == "__main__":
    main()
