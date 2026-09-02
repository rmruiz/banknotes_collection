import json
import os
import glob

def get_currencies_by_country_and_year():
    currencies_path = '/Users/rolando/git/banknotes_collection/_json/currencies.json'
    with open(currencies_path, 'r', encoding='utf-8') as f:
        currencies = json.load(f)
    
    # Create a lookup: country_code -> list of (iso_code, start_year, end_year)
    country_currency_map = {}
    for iso_code, data in currencies.items():
        historia = data.get('historia', {})
        start = historia.get('fecha_introduccion')
        end = historia.get('fecha_fin')
        
        # Get countries that used this currency
        usage = data.get('uso', {})
        emitters = usage.get('emisor', [])
        
        for country in emitters:
            country_upper = country.upper()
            if country_upper not in country_currency_map:
                country_currency_map[country_upper] = []
            
            try:
                s_year = int(start) if start else -9999
                e_year = int(end) if end else 9999
                country_currency_map[country_upper].append((iso_code, s_year, e_year))
            except (ValueError, TypeError):
                continue
                
    return country_currency_map

def find_correct_currency(country_code, year, country_currency_map):
    country_upper = country_code.upper()
    if country_upper not in country_currency_map:
        return None
    
    for iso_code, start, end in country_currency_map[country_upper]:
        if start <= year <= end:
            return iso_code
    return None

def process_errors():
    error_file = '/Users/rolando/git/banknotes_collection/error-billetes-monedas.txt'
    if not os.path.exists(error_file):
        print("Error file not found.")
        return

    country_currency_map = get_currencies_by_country_and_year()
    
    with open(error_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    updated_lines = []
    
    # Pre-load all banknote JSONs for efficiency
    json_pattern = '/Users/rolando/git/banknotes_collection/_json/**/*.json'
    all_banknotes = {}
    for path in glob.glob(json_pattern, recursive=True):
        if 'currencies.json' in path or 'countries.json' in path:
            continue
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Try both common ID fields
                pick = data.get('pick_number') or data.get('id')
                if pick:
                    all_banknotes[pick] = data
        except:
            continue

    for line in lines:
        line = line.strip()
        if not line or "No currency range errors found" in line:
            updated_lines.append(line)
            continue
            
        # Remove previous suggestion if it exists
        if " -> Sugerencia:" in line:
            line = line.split(" -> Sugerencia:")[0]
            
        try:
            # Line format: "Pick P-XXXX: Year YYYY is ... "
            parts = line.split(':')
            pick_part = parts[0].replace('Pick ', '').strip()
            
            # We must check if pick_part is a key in all_banknotes
            # Some pick numbers might be slightly different (e.g., trailing spaces or format)
            banknote_data = all_banknotes.get(pick_part)
            
            if banknote_data:
                country_code = banknote_data.get('country_code', '').upper()
                year = banknote_data.get('year')
                
                if country_code and year:
                    try:
                        year_int = int(year)
                        suggestion = find_correct_currency(country_code, year_int, country_currency_map)
                        if suggestion:
                            line = f"{line} -> Sugerencia: {suggestion}"
                        else:
                            line = f"{line} -> Sugerencia: No encontrada"
                    except:
                        line = f"{line} -> Sugerencia: Error año"
                else:
                    line = f"{line} -> Sugerencia: Falta país/año"
            else:
                line = f"{line} -> Sugerencia: Billete no encontrado"
        except Exception:
            line = f"{line} -> Sugerencia: Error procesando línea"
            
        updated_lines.append(line)

    with open(error_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(updated_lines))

if __name__ == "__main__":
    process_errors()
