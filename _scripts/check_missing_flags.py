import json
import os
import glob
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

def check_flags():
    countries_path = REPO / '_json' / 'countries.json'
    flags_dir = REPO / 'web' / '_flags_svg'
    
    with open(countries_path, 'r', encoding='utf-8') as f:
        countries = json.load(f)
    
    # Get list of existing flags in the folder
    existing_flags = set(os.listdir(flags_dir))
    
    missing_flags = []
    
    for code, data in countries.items():
        name_es = data.get('name', {}).get('es', 'Desconocido')
        flag_name = data.get('flag_svg')
        
        if not flag_name:
            missing_flags.append({
                "pais": name_es,
                "code": code,
                "error": "Sin bandera SVG asignada en countries.json"
            })
        elif flag_name not in existing_flags:
            missing_flags.append({
                "pais": name_es,
                "code": code,
                "error": f"Archivo {flag_name} no encontrado en _flags_svg/"
            })
            
    # The web interface reads issues from web/data/issues.json
    issues_path = REPO / 'web' / 'data' / 'issues.json'
    
    # Try to load existing issues
    try:
        with open(issues_path, 'r', encoding='utf-8') as f:
            all_issues = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        all_issues = {}
    
    # Add flags issues
    all_issues['banderas_faltantes'] = {
        "titulo": "Banderas faltantes o no asignadas",
        "descripcion": "Países que no tienen una bandera definida o el archivo no existe en el servidor.",
        "items": missing_flags
    }
    
    with open(issues_path, 'w', encoding='utf-8') as f:
        json.dump(all_issues, f, indent=2, ensure_ascii=False)
    
    print(f"Checked {len(countries)} countries. Found {len(missing_flags)} issues.")

if __name__ == "__main__":
    check_flags()
