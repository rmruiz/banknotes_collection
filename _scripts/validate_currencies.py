import json
import glob

def validate_banknotes():
    currencies_path = '/Users/rolando/git/banknotes_collection/_json/currencies.json'
    with open(currencies_path, 'r', encoding='utf-8') as f:
        currencies = json.load(f)

    errors = []
    
    # Path to all banknote JSONs
    json_pattern = '/Users/rolando/git/banknotes_collection/_json/**/*.json'
    files = glob.glob(json_pattern, recursive=True)
    
    for file_path in files:
        if 'currencies.json' in file_path or 'countries.json' in file_path:
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # The banknote JSON has these fields
            pick = data.get('pick_number') or data.get('id')
            year = data.get('year')
            
            # Currency ISO code is inside denomination -> iso4217
            denomination = data.get('denomination', {})
            currency_code = denomination.get('iso4217')
            
            if not pick or not year or not currency_code:
                continue
            
            # Convert year to int if it's a string
            try:
                year_int = int(year)
            except (ValueError, TypeError):
                continue
                
            if currency_code in currencies:
                historia = currencies[currency_code].get('historia', {})
                fecha_intro = historia.get('fecha_introduccion')
                fecha_fin = historia.get('fecha_fin')
                
                # Validate start year
                if fecha_intro:
                    try:
                        if year_int < int(fecha_intro):
                            errors.append(f"Pick {pick}: Year {year} is before currency {currency_code} introduction ({fecha_intro})")
                    except (ValueError, TypeError):
                        pass
                
                # Validate end year
                if fecha_fin:
                    try:
                        if year_int > int(fecha_fin):
                            errors.append(f"Pick {pick}: Year {year} is after currency {currency_code} end ({fecha_fin})")
                    except (ValueError, TypeError):
                        pass
            else:
                errors.append(f"Pick {pick}: Currency code {currency_code} not found in currencies.json")
                
        except Exception as e:
            print(f"Error processing {file_path}: {e}")

    with open('/Users/rolando/git/banknotes_collection/error-billetes-monedas.txt', 'w', encoding='utf-8') as f:
        if errors:
            f.write('\n'.join(errors))
        else:
            f.write('No currency range errors found.')

if __name__ == "__main__":
    validate_banknotes()
