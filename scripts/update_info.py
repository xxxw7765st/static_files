import json

with open(".github/outputs/all_changed_files.json") as f:
    changes = json.load(f)

print(changes)
