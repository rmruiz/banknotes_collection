import os
import glob
import json
import ollama
import unicodedata

# Diccionario estricto de conceptos permitidos
ALLOWED_KEYS = {
    "actividad", "arte", "construccion", "dictador", "evento", 
    "fauna", "flora", "lugar", "personaje", "reina", "rey", 
    "simbolo", "transporte"
}

MODEL_NAME = 'gemma4:31b' # 'llama3.2-vision' # Puedes cambiar a 'llava:34b' o 'gemma4:31b' si prefieres

def clean_value(text):
    """Limpia el valor: minúsculas, sin acentos, y espacios a guiones bajos."""
    # Normalizar para quitar acentos
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    # Reemplazar espacios y guiones medios por guiones bajos
    text = text.strip().lower().replace(' ', '_').replace('-', '_')
    # Quitar caracteres extraños que el modelo pueda haber colado
    text = ''.join(c for c in text if c.isalnum() or c == '_')
    return text

def process_banknote_themes():
    # Buscar todos los archivos json en _json/*/*.json
    json_pattern = os.path.join("_json", "*", "*.json")
    json_files = glob.glob(json_pattern)
    
    print(f"Se encontraron {len(json_files)} archivos JSON para revisar.\n")
    
    for json_path in json_files:
        # Leer el archivo JSON
        with open(json_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                print(f"Error leyendo {json_path}. Saltando...")
                continue
        
        banknote_id = data.get("id")
        if not banknote_id:
            continue
            
        # Evaluar si necesitamos extraer los temas.
        # Regla: Si el array 'themes' ya tiene elementos, saltamos para no sobreescribir trabajo manual previo.
        if len(data.get("themes", [])) > 0:
            continue
                
        # Construir rutas de las imágenes
        front_image = os.path.join("_originals", banknote_id, f"{banknote_id}_A.jpg")
        back_image = os.path.join("_originals", banknote_id, f"{banknote_id}_B.jpg")
        
        images_to_process = []
        if os.path.exists(front_image):
            images_to_process.append(front_image)
        if os.path.exists(back_image):
            images_to_process.append(back_image)
            
        if not images_to_process:
            print(f"[{banknote_id}] Saltando: No se encontraron imágenes en _originals/{banknote_id}/")
            continue

        print(f"[{banknote_id}] Procesando imágenes con Ollama...")
        
        prompt = (
            "Analiza detalladamente las imágenes del anverso y reverso de este billete. "
            "Identifica los elementos visuales principales presentes en su diseño. "
            "Responde ÚNICAMENTE con una lista separada por comas en formato estricto 'key:value'. "
            f"Las 'key' permitidas son EXACTAMENTE y ÚNICAMENTE estas: {', '.join(ALLOWED_KEYS)}. "
            "El 'value' debe ser el nombre específico del elemento en español, en minúsculas y usando guiones bajos en lugar de espacios. "
            "Ejemplos del formato que debes devolver: personaje:bernardo_ohiggins, fauna:condor, construccion:palacio_de_la_moneda, simbolo:escudo_nacional. "
            "NO incluyas explicaciones, etiquetas adicionales, ni texto markdown. Si no logras identificar nada relevante, responde 'Ninguno'."
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
                print(f"[{banknote_id}] Resultado: No se identificaron temas.\n")
                continue
            
            # Procesar y limpiar la respuesta del LLM
            extracted_themes = []
            raw_items = output.split(',')
            
            for item in raw_items:
                if ':' in item:
                    key, value = item.split(':', 1)
                    key = key.strip().lower()
                    value = clean_value(value)
                    
                    # Filtrar estrictamente por las keys permitidas y asegurar que haya un valor
                    if key in ALLOWED_KEYS and value:
                        extracted_themes.append(f"{key}:{value}")
            
            if not extracted_themes:
                print(f"[{banknote_id}] Falló el parseo o no se devolvieron keys válidas. Raw output: {output}\n")
                continue

            print(f"[{banknote_id}] Temas extraídos: {extracted_themes}")
            
            # Actualizamos el diccionario 'data'
            data["themes"] = extracted_themes
            
            # Guardar el JSON sobreescribiendo el archivo original
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            print(f"[{banknote_id}] JSON actualizado exitosamente.\n")
            
        except Exception as e:
            print(f"[{banknote_id}] Error durante el procesamiento: {e}\n")

if __name__ == "__main__":
    print(f"Iniciando extracción masiva de temas usando {MODEL_NAME}...\n")
    process_banknote_themes()
    print("Proceso finalizado.")
