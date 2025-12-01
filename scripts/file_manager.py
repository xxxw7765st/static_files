import json
import os
from datetime import datetime, timezone
from typing import Literal, Optional, TypedDict
from utils import format_size


class FileInfo(TypedDict):
    type: Literal["file", "folder"]
    name: str
    relative_path: str
    size: int
    updated_at: str
    created_at: str
    children: Optional[dict[str, "FileInfo"]]


class FileManager:
    def __init__(self, base_folder_path: str, info_json_path: str):
        self.base_folder = base_folder_path
        self.info_json_path = info_json_path

        if os.path.exists(info_json_path):
            with open(info_json_path, "r") as f:
                self.info: FileInfo = json.load(f)
        else:
            now = self.get_now()
            self.info = {
                "type": "folder",
                "name": os.path.basename(base_folder_path.rstrip("/")),
                "relative_path": "",
                "size": 0,
                "updated_at": now,
                "created_at": now,
                "children": {},
            }

    def get_now(self):
        return datetime.now(timezone.utc).isoformat()

    def update_structure(self, time: str, folder: Optional[FileInfo] = None) -> None:
        """更新文件夹结构，检测文件/文件夹的新增和删除"""
        if folder is None:
            folder = self.info

        actual_path = os.path.join(self.base_folder, folder["relative_path"])
        if not os.path.exists(actual_path):
            return

        # 获取实际文件系统中的文件/文件夹
        actual_items = set()
        for item in os.listdir(actual_path):
            item_path = os.path.join(actual_path, item)
            if os.path.isfile(item_path):
                actual_items.add((item, "file"))
            elif os.path.isdir(item_path):
                actual_items.add((item, "folder"))

        # 获取当前记录的文件/文件夹
        current_children = folder.get("children", {}) or {}
        recorded_items = {
            (name, child["type"]) for name, child in current_children.items()
        }

        # 检测新增
        for name, item_type in actual_items - recorded_items:
            relative_path = os.path.join(folder["relative_path"], name).replace(
                "\\", "/"
            )
            if item_type == "file":
                file_path = os.path.join(actual_path, name)
                current_children[name] = {
                    "type": "file",
                    "name": name,
                    "relative_path": relative_path,
                    "size": os.path.getsize(file_path),
                    "updated_at": time,
                    "created_at": time,
                    "children": None,
                }
            else:  # folder
                current_children[name] = {
                    "type": "folder",
                    "name": name,
                    "relative_path": relative_path,
                    "size": 0,
                    "updated_at": time,
                    "created_at": time,
                    "children": {},
                }
                # 递归处理新文件夹
                self.update_structure(time, current_children[name])

        # 检测删除
        for name, item_type in recorded_items - actual_items:
            del current_children[name]

        # 更新现有项目
        for name, child in current_children.items():
            if (name, child["type"]) in actual_items and child["type"] == "folder":
                # 递归更新现有文件夹
                self.update_structure(time, child)

        folder["children"] = current_children

    def set_updated_at(self, time: str, *paths: str) -> None:
        """手动设置指定路径文件的更新时间"""
        for path in paths:
            self._set_single_updated_at(time, path)

    def _set_single_updated_at(self, time: str, path: str) -> None:
        """设置单个路径的更新时间"""
        segments = [seg for seg in path.split("/") if seg]
        current = self.info

        for seg in segments:
            children = current.get("children", {}) or {}
            if seg not in children:
                return  # 路径不存在，忽略
            current = children[seg]

        current["updated_at"] = time

    def update_folder_info(self, folder: Optional[FileInfo] = None) -> None:
        """递归更新文件夹信息（size和updated_at）"""
        if folder is None:
            folder = self.info

        if folder["type"] != "folder":
            return

        children = folder.get("children", {}) or {}
        if not children:
            folder["size"] = 0
            return

        total_size = 0
        latest_time = folder["created_at"]

        for child in children.values():
            if child["type"] == "folder":
                self.update_folder_info(child)
            total_size += child["size"]
            if child["updated_at"] > latest_time:
                latest_time = child["updated_at"]

        folder["size"] = total_size
        if latest_time > folder["updated_at"]:
            folder["updated_at"] = latest_time

    def save(self) -> None:
        """保存到JSON文件，children按name排序"""

        def sort_children(info: FileInfo) -> FileInfo:
            if info["type"] == "folder" and info["children"]:
                sorted_children = {
                    k: sort_children(v) for k, v in sorted(info["children"].items())
                }
                return {**info, "children": sorted_children}
            return info

        sorted_info = sort_children(self.info)
        parent_dir = os.path.dirname(self.info_json_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
        with open(self.info_json_path, "w+") as f:
            json.dump(sorted_info, f, indent=2, ensure_ascii=False)

    def print_tree(self, node: Optional[FileInfo] = None, indent: int = 0):
        """打印文件树"""
        if node is None:
            node = self.info
        prefix = "    " * indent

        if sub_nodes := node.get("children"):
            print(
                f"{prefix}📁 {node['name']} / {format_size(node['size'])} {node['updated_at']}"
            )
            for sub_node in sub_nodes.values():
                self.print_tree(sub_node, indent + 1)
        else:
            print(
                f"{prefix}📄 {node['name']} / {format_size(node['size'])} {node['updated_at']}"
            )
