import os
import glob
import json
import ollama
import unicodedata
import requests
from bs4 import BeautifulSoup
from langchain_community.tools import DuckDuckGoSearchRun

# Diccionario estricto de conceptos permitidos
ALLOWED_KEYS = {
    "actividad", "arte", "construccion", "dictador", "evento", 
    "fauna", "flora", "lugar", "personaje", "reina", "rey", 
    "simbolo", "transporte"
}

MODEL_NAME = 'gemma4:31b' # Puedes cambiar a 'llava:34b' o 'llama3.2-vision'

def clean_value(text):
    # Normalizar para quitar acentos
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    # Reemplazar espacios y guiones medios por guiones bajos
    text = text.strip().lower().replace(' ', '_').replace('-', '_')
    # Quitar caracteres extraños que el modelo pueda haber colado
    text = ''.join(c for c in text if c.isalnum() or c == '_')
    return text

def get_numista_context(url):
    """Hace scraping básico de la página de Numista para obtener el texto descriptivo."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            # Extraemos los textos de los párrafos principales que suelen tener la info
            paragraphs = soup.find_all('p')
            text = " ".join([p.get_text() for p in paragraphs])
            return text[:2000] # Limitamos a 2000 caracteres para no desbordar el prompt
    except Exception as e:
        print(f"  [Advertencia] Error haciendo scraping en Numista: {e}")
    return ""

def get_search_context(country, value, currency, year):
    """Busca contexto en DuckDuckGo si no hay link de Numista."""
    try:
        search_tool = DuckDuckGoSearchRun()
        query = f"Billete {country} {value} {currency} {year} anverso reverso descripción características"
        result = search_tool.invoke(query)
        return result
    except Exception as e:
        print(f"  [Advertencia] Error en búsqueda web: {e}")
        return ""

def process_banknote_themes():
    json_pattern = os.path.join("_json", "*", "*.json")
    json_files = glob.glob(json_pattern)
    
    print(f"Se encontraron {len(json_files)} archivos JSON para revisar.\n")
    
    for json_path in json_files:
        with open(json_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                print(f"Error leyendo {json_path}. Saltando...")
                continue
        
        banknote_id = data.get("id")
        if not banknote_id:
            continue
            
        if len(data.get("themes", [])) > 0:
            continue
                
        front_image = os.path.join("_originals", banknote_id, f"{banknote_id}_A.jpg")
        back_image = os.path.join("_originals", banknote_id, f"{banknote_id}_B.jpg")
        
        images_to_process = []
        if os.path.exists(front_image):
            images_to_process.append(front_image)
        if os.path.exists(back_image):
            images_to_process.append(back_image)
            
        if not images_to_process:
            print(f"[{banknote_id}] Saltando: No se encontraron imágenes.")
            continue

        print(f"[{banknote_id}] Procesando...")

        # --- NUEVO: Obtener contexto ---
        numista_url = data.get("numista", "")
        contexto = ""
        
        if numista_url:
            print(f"  -> Extrayendo contexto desde Numista...")
            contexto = get_numista_context(numista_url)
            
        if not contexto: # Si no había Numista o el scraping falló
            print(f"  -> Buscando contexto en la web...")
            country = data.get("country", {}).get("es", "")
            value = data.get("denomination", {}).get("value", "")
            currency = data.get("denomination", {}).get("currency", "")
            year = data.get("year", "")
            contexto = get_search_context(country, value, currency, year)

        prompt = (
            "Analiza detalladamente las imágenes del anverso y reverso de este billete. "
            "Identifica los elementos visuales principales presentes en su diseño. "
            "Para ayudarte a ser extremadamente específico y exacto con los nombres propios "
            "(ej. en lugar de 'soldado', usar el nombre del héroe; en lugar de 'flor', la especie exacta), "
            "utiliza este contexto histórico extraído de internet:\n"
            "--- INICIO DEL CONTEXTO ---\n"
            f"{contexto}\n"
            "--- FIN DEL CONTEXTO ---\n\n"
            "IMPORTANTE: Solo nombra elementos que REALMENTE veas en la imagen, usando el contexto solo para darles su nombre preciso.\n"
            "Responde ÚNICAMENTE con una lista separada por comas en formato estricto 'key:value'. "
            f"Las 'key' permitidas son EXACTAMENTE estas: {', '.join(ALLOWED_KEYS)}. "
            "El 'value' debe ser el nombre específico del elemento en español, en minúsculas y usando guiones bajos en lugar de espacios. "
            "NO incluyas explicaciones ni texto markdown. Si no logras identificar nada relevante, responde 'Ninguno'."
        )
        
        try:
            response = ollama.chat(
                model=MODEL_NAME,
                messages=[
                    {
                        'role': 'user',
                        'content': prompt,
                        'images': images_to_process
                    }
                ]
            )
            
            output = response['message']['content'].strip()
            
            if output.lower() in ["ninguno", "none", "not found", ""]:
                print(f"  -> Resultado: No se identificaron temas.\n")
                continue
            
            extracted_themes = []
            raw_items = output.split(',')
            
            for item in raw_items:
                if ':' in item:
                    key, value = item.split(':', 1)
                    key = key.strip().lower()
                    value = clean_value(value)
                    
                    if key in ALLOWED_KEYS and value:
                        extracted_themes.append(f"{key}:{value}")
            
            if not extracted_themes:
                print(f"  -> Falló el parseo. Raw output: {output}\n")
                continue

            print(f"  -> Temas extraídos: {extracted_themes}")
            
            data["themes"] = extracted_themes
            
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            print(f"[{banknote_id}] JSON actualizado exitosamente.\n")
            
        except Exception as e:
            print(f"[{banknote_id}] Error durante el procesamiento: {e}\n")

if __name__ == "__main__":
    print(f"Iniciando extracción masiva con búsqueda web usando {MODEL_NAME}...\n")
    process_banknote_themes()
    print("Proceso finalizado.")

