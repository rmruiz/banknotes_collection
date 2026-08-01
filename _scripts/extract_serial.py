import os
import glob
import json
import ollama

def process_banknote_jsons():
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
            
        # Obtener la lista de especímenes (si no existe, usa una lista vacía)
        specimens = data.get("specimens", [])
        
        # Evaluar si necesitamos extraer el serial
        needs_extraction = False
        
        # Regla 2: Si está vacío, necesitamos extraer
        if len(specimens) == 0:
            needs_extraction = True
        # Regla 1 y 3: Si tiene elementos, revisamos SÓLO el primero
        elif len(specimens) > 0 and specimens[0].get("serial_number", "") == "":
            needs_extraction = True
                
        if needs_extraction:
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

            print(f"[{banknote_id}] Procesando con Ollama...")
            
            prompt = (
                "Look at the provided images of the front and back of a banknote. "
                "Find and extract the serial number. "
                "Respond ONLY with the exact serial number. "
                "Do not include any explanations, labels, or additional text. "
                "If you absolutely cannot read it, reply 'Not found'."
            )
            
            try:
                response = ollama.chat(
                    model='gemma4:31b',
                    messages=[
                        {
                            'role': 'user',
                            'content': prompt,
                            'images': images_to_process
                        }
                    ]
                )
                
                serial_number = response['message']['content'].strip()
                
                # Si el modelo no pudo leerlo, evitamos escribir "Not found" en el JSON
                if serial_number.lower() in ["not found", "not found."]:
                    print(f"[{banknote_id}] Resultado: No se pudo leer el serial. No se alterará el JSON.\n")
                    continue
                    
                print(f"[{banknote_id}] Serial extraído: {serial_number}")
                
                # Actualizamos el diccionario 'data' según las reglas
                if len(specimens) == 0:
                    # Crea el elemento si estaba vacío
                    data["specimens"] = [{
                        "serial_number": serial_number,
                        "condition": ""
                    }]
                else:
                    # Escribe en el primer elemento
                    data["specimens"][0]["serial_number"] = serial_number
                
                # Guardar el JSON sobreescribiendo el archivo original
                with open(json_path, 'w', encoding='utf-8') as f:
                    # indent=2 mantiene la estructura legible, ensure_ascii=False evita que se rompan las tildes/eñes
                    json.dump(data, f, indent=2, ensure_ascii=False)
                    
                print(f"[{banknote_id}] JSON actualizado exitosamente.\n")
                
            except Exception as e:
                print(f"[{banknote_id}] Error durante el procesamiento: {e}\n")

if __name__ == "__main__":
    print("Iniciando actualización masiva de JSONs usando llava:34b...\n")
    process_banknote_jsons()
    print("Proceso finalizado.")

