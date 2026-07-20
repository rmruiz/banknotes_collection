import json
import glob
import os

def reset_verificado_status():
    # Buscar todos los archivos JSON en la estructura de carpetas
    json_files = glob.glob('_json/*/*.json')
    
    archivos_procesados = 0
    archivos_con_error = 0

    print(f"Se encontraron {len(json_files)} archivos JSON. Iniciando proceso...")

    for file_path in json_files:
        try:
            # Leer el archivo JSON
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Cambiar el valor de "verificado" a False
            # Si la clave no existe, también la creará con el valor False
            data['verificado'] = False

            # Sobrescribir el archivo JSON con el nuevo dato
            # Usamos ensure_ascii=False para no dañar los acentos (ej: Afganistán)
            # Usamos indent=2 para mantener el formato legible y estructurado
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            archivos_procesados += 1

        except Exception as e:
            print(f"❌ Error procesando {file_path}: {e}")
            archivos_con_error += 1

    print("\n✅ Proceso completado.")
    print(f"Archivos actualizados exitosamente: {archivos_procesados}")
    if archivos_con_error > 0:
        print(f"Archivos con errores: {archivos_con_error}")

if __name__ == '__main__':
    reset_verificado_status()

