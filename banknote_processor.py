import os
import json
import glob
import base64
import random
from typing import TypedDict, List, Dict, Any
from pydantic import BaseModel, Field

from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.tools import DuckDuckGoSearchRun
from langgraph.graph import StateGraph, END

# ==========================================
# 1. DEFINICIÓN DEL ESTADO DEL GRAFO
# ==========================================
class BanknoteState(TypedDict):
    banknote_id: str
    json_path: str
    json_data: Dict[str, Any]
    image_front_path: str
    image_back_path: str
    image_analysis: str
    search_context: str
    extracted_themes: List[str]
    error: str

# Modelo Pydantic para forzar la salida estructurada del LLM final
class ThemeExtraction(BaseModel):
    themes: List[str] = Field(
        description="Lista de características del billete en formato clave:valor en minúsculas y con guiones bajos. Ej: personaje:bernardo_ohiggins, construccion:banco_central"
    )

# ==========================================
# 2. FUNCIONES DE AYUDA Y CONFIGURACIÓN LOCAL
# ==========================================
def encode_image(image_path: str) -> str:
    """Codifica una imagen a Base64 para enviarla al modelo de visión."""
    if not os.path.exists(image_path):
        return None
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

# Inicialización de modelos locales con Ollama
# Asegúrate de que Ollama esté corriendo en tu Mac
vision_llm = ChatOllama(
    model="llama3.2-vision", 
    temperature=0.1
)

extraction_llm = ChatOllama(
    model="qwen3:32b", 
    temperature=0
).with_structured_output(ThemeExtraction)

search_tool = DuckDuckGoSearchRun()

# ==========================================
# 3. DEFINICIÓN DE NODOS DE LANGGRAPH
# ==========================================
def load_data_node(state: BanknoteState) -> dict:
    """Carga el JSON y verifica la existencia de imágenes."""
    try:
        with open(state["json_path"], "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Rutas a las imágenes (frente: _a.jpg, reverso: _b.jpg)
        base_dir = f"_originals/{state['banknote_id']}"
        img_front = f"{base_dir}/{state['banknote_id']}_a.jpg"
        img_back = f"{base_dir}/{state['banknote_id']}_b.jpg"

        return {
            "json_data": data,
            "image_front_path": img_front,
            "image_back_path": img_back
        }
    except Exception as e:
        return {"error": f"Error cargando datos: {str(e)}"}

def analyze_images_node(state: BanknoteState) -> dict:
    """Analiza visualmente el frente y el reverso del billete usando Llama 3.2 Vision."""
    if state.get("error"): return {}

    front_b64 = encode_image(state["image_front_path"])
    back_b64 = encode_image(state["image_back_path"])

    country = state["json_data"].get("country", {}).get("es", "Desconocido")
    year = state["json_data"].get("year", "Desconocido")
    denomination = state["json_data"].get("denomination", {}).get("value", "")
    currency = state["json_data"].get("denomination", {}).get("currency", "")

    # Llama 3.2 Vision responde mejor a instrucciones directas y concisas
    content = [
        {
            "type": "text", 
            "text": f"Observa este billete de {country}, año {year}, valor {denomination} {currency}. "
                    f"Describe de forma muy detallada qué ves: retratos de personas, flora, fauna, edificios, eventos, "
                    f"símbolos, actividades u obras de arte en el anverso y el reverso."
        }
    ]

    if front_b64:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{front_b64}"}})
    if back_b64:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{back_b64}"}})

    if len(content) == 1:
        return {"error": "No se encontraron imágenes para analizar."}

    try:
        # Invocamos el modelo visual local
        response = vision_llm.invoke([HumanMessage(content=content)])
        return {"image_analysis": response.content}
    except Exception as e:
        return {"error": f"Error en análisis visual: {str(e)}"}

def search_context_node(state: BanknoteState) -> dict:
    """Busca en internet para complementar y verificar la identidad de los elementos hallados."""
    if state.get("error"): return {}
    
    country = state["json_data"].get("country", {}).get("es", "")
    year = state["json_data"].get("year", "")
    denomination = state["json_data"].get("denomination", {}).get("value", "")
    currency = state["json_data"].get("denomination", {}).get("currency", "")

    query = f"Billete {country} {denomination} {currency} {year} anverso reverso personajes edificios flora fauna"
    
    try:
        search_result = search_tool.invoke(query)
        print(f"[{state['banknote_id']}] web: {search_result}")
        return {"search_context": search_result}
    except Exception as e:
        # Si falla la búsqueda, no detenemos el flujo, solo pasamos el error como contexto
        return {"search_context": f"Búsqueda omitida o fallida: {str(e)}"}

def extract_themes_node(state: BanknoteState) -> dict:
    """Cruza la metadata, el análisis visual y la búsqueda web para crear los tags finales con Llama 3.1."""
    if state.get("error"): return {}

    prompt = f"""
    Eres un experto numismático. Extrae las características del billete en estricto formato clave:valor.
    
    claves permitidas: actividad, arte, construccion, evento, fauna, flora, lugar, personaje, dictador.
    Reglas: 
    1. Todo en minúsculas.
    2. Sin acentos ni caracteres especiales.
    3. Usa guiones bajos (_) en lugar de espacios.
    Ejemplos válidos: construccion:iglesia_de_los_dominicos, personaje:ignacio_carrera_pinto, fauna:condor.
    Ejemplos inválidos: construccion, ignacio_carrera_pinto,  
    
    [DATOS DEL JSON ORIGINAL]: {json.dumps(state["json_data"])}
    [ANÁLISIS VISUAL]: {state["image_analysis"]}
    [DATOS DE BÚSQUEDA WEB]: {state["search_context"]}
    
    Genera únicamente la lista de temas encontrados.
    """

    try:
        # Invocamos el modelo de extracción estructurada
        result: ThemeExtraction = extraction_llm.invoke([SystemMessage(content=prompt)])
        return {"extracted_themes": result.themes}
    except Exception as e:
        return {"error": f"Error extrayendo temas: {str(e)}"}

def save_record_node(state: BanknoteState) -> dict:
    """Guarda el resultado formateado en un archivo de texto de salida."""
    if state.get("error"): 
        print(f"[{state['banknote_id']}] Omitido por error: {state['error']}")
        return {}

    # Unir las etiquetas en el formato solicitado
    output_line = f"{state['banknote_id']} | " + " | ".join(state["extracted_themes"]) + "\n"
    
    with open("banknotes_output_catalog.txt", "a", encoding="utf-8") as f:
        f.write(output_line)
    
    print(f"[{state['banknote_id']}] Procesado exitosamente. Etiquetas: {state['extracted_themes']}")
    return {}

# ==========================================
# 4. CONSTRUCCIÓN DEL GRAFO
# ==========================================
workflow = StateGraph(BanknoteState)

workflow.add_node("load_data", load_data_node)
workflow.add_node("analyze_images", analyze_images_node)
workflow.add_node("search_context", search_context_node)
workflow.add_node("extract_themes", extract_themes_node)
workflow.add_node("save_record", save_record_node)

workflow.set_entry_point("load_data")
workflow.add_edge("load_data", "analyze_images")
workflow.add_edge("analyze_images", "search_context")
workflow.add_edge("search_context", "extract_themes")
workflow.add_edge("extract_themes", "save_record")
workflow.add_edge("save_record", END)

app = workflow.compile()

# ==========================================
# 5. BUCLE DE EJECUCIÓN PRINCIPAL
# ==========================================
def process_collection():
    # Encuentra todos los archivos JSON en los subdirectorios indicados
    json_files = glob.glob("_json/*/*.json")
    random.shuffle(json_files)
    
    print(f"Se encontraron {len(json_files)} billetes para procesar localmente.")
    
    # Crear/Limpiar el archivo de salida
    with open("banknotes_output_catalog.txt", "w", encoding="utf-8") as f:
        f.write("--- Catálogo Extraído ---\n")

    for json_path in json_files:
        filename = os.path.basename(json_path)
        banknote_id = os.path.splitext(filename)[0]
        
        initial_state = {
            "banknote_id": banknote_id,
            "json_path": json_path,
            "error": ""
        }
        
        # Ejecutar el grafo de procesamiento
        app.invoke(initial_state)

if __name__ == "__main__":
    process_collection()