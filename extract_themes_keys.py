import glob
import json

keys = set()

for filename in glob.glob("_json/**/*.json", recursive=True):
    with open(filename, encoding="utf-8") as f:
        data = json.load(f)

    for item in data.get("themes", []):
        if ":" in item:
            key = item.split(":", 1)[0]
            keys.add(key)

for key in sorted(keys):
    print(key)
