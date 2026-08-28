import json
import os

def update_countries():
    countries_path = '/Users/rolando/git/banknotes_collection/_json/countries.json'
    currencies_path = '/Users/rolando/git/banknotes_collection/_json/currencies.json'
    
    with open(countries_path, 'r', encoding='utf-8') as f:
        countries = json.load(f)
        
    with open(currencies_path, 'r', encoding='utf-8') as f:
        currencies = json.load(f)
        
    # Build a map: country_code (upper) -> current_currency_iso
    country_to_currency = {}
    for iso_code, data in currencies.items():
        estado = data.get('estado')
        if estado == 'circulacion':
            uso = data.get('uso', {})
            legal = uso.get('curso_legal', []) or []
            circ = uso.get('circulacion', []) or []
            
            for c in legal + circ:
                if c:
                    country_to_currency[c.upper()] = iso_code

    # Update countries
    for code, data in countries.items():
        if data is None:
            continue
            
        # 1. Remove 'moneda_propia'
        if 'moneda_propia' in data:
            del data['moneda_propia']
            
        # 2. Add 'moneda_vigente' for current countries
        if data.get('vigente') == 'si':
            iso_alpha2 = data.get('iso_alpha2')
            if iso_alpha2 and isinstance(iso_alpha2, str):
                current_currency = country_to_currency.get(iso_alpha2.upper())
                if current_currency:
                    data['moneda_vigente'] = current_currency
            else:
                # Handle cases where iso_alpha2 might be missing or not a string
                pass

    with open(countries_path, 'w', encoding='utf-8') as f:
        json.dump(countries, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    update_countries()
