import hashlib
import os
import re


def format_size(bytes_int: int):
    units = ["B", "K", "M", "G", "T"]
    n, i = bytes_int, 0
    while n >= 1000 and i < 4:
        n /= 1024
        i += 1
    return f"{n:.2f}{units[i]}"


BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"


def calc_md5(file_path, chunk=4096):
    md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        while chunk_data := f.read(chunk):
            md5.update(chunk_data)
    num = int.from_bytes(md5.digest(), byteorder="big")
    result = []
    while num > 0:
        num, rem = divmod(num, 62)
        result.append(BASE62_CHARS[rem])
    return "".join(reversed(result))
