import json

from file_action import run_action
from file_manager import FileManager

# get changes
changes: list[str] = []
try:
    with open(".github/outputs/all_changed_files.json") as f:
        changes: list[str] = json.load(f)
except:
    pass

# process actions
new_changes = []
for filepath in changes:
    new_filepath, other = run_action(filepath)
    new_changes.append(new_filepath)
    new_changes.extend(other)

now = FileManager.get_now()
folders = ["static", "assets"]
for folder in folders:
    folder_path = f"files/{folder}/"
    manager = FileManager(folder_path, f"data/files/info_{folder}.json")
    manager.update_structure(now)
    folder_changes = [
        file[len(folder_path) :] for file in new_changes if file.startswith(folder_path)
    ]
    manager.set_updated_at(now, *folder_changes)
    manager.update_folder_info()
    manager.save()
    print(f"""
          {"=" * 10}
          🌳 Tree: {folder_path}
    """)
    manager.print_tree()
