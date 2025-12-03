import os
import re
from typing import Callable

from utils import calc_sha256

HASH_NAME_PATTERN = re.compile(r"_H[0-9a-zA-Z]{8}_")


def action_empty(filepath: str, _: list[str]):
    return filepath


def action_rename(filepath: str, name: str):
    dir = os.path.dirname(filepath)
    new_file_path = os.path.join(dir, name)
    os.rename(filepath, new_file_path)
    return new_file_path


def action_hash_name(filepath: str, _: list[str]):
    hash_str = calc_sha256(filepath).zfill(8)[:8]
    bname = os.path.basename(filepath)
    name, ext = os.path.splitext(bname)
    name = HASH_NAME_PATTERN.sub("", name)
    return action_rename(filepath, f"{name}_H{hash_str}_{ext}")


type AtActionFunc = Callable[
    [str, list[str]],  # ( filepath, params )
    None  # filepath not changed
    | str  # changed filepath
    | tuple[str, list[str]],  # filepath and paths (other changed files)
]
action_dict: dict[str, AtActionFunc] = {
    "empty": action_empty,
    "hash_name": action_hash_name,
}


def parse_actions(s: str):
    parts = s.split("@")
    if len(parts) > 1:
        name = parts.pop()
        actions = [part.strip().split() for part in parts]
        return (name, actions)
    return (s, [])


def run_action(filepath: str):
    name = os.path.basename(filepath)
    name, actions = parse_actions(name)
    filepath = action_rename(filepath, name)
    if actions:
        filepath = action_rename(filepath, name)

    # process action
    other_filepaths = []
    for action in actions:
        if len(action) <= 0:
            continue
        action_res = action_dict.get(action[0], action_empty)(filepath, action[1:])
        if type(action_res) is str:
            filepath = action_res
        elif type(action_res) is tuple:
            filepath, other = action_res
            other_filepaths.extend(other)

    return filepath, other_filepaths


if __name__ == "__main__":
    test_file = "@hash_name@test.txt"
    with open(test_file, "w+") as f:
        pass
    run_action(test_file)
