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


def calc_sha256(file_path, chunk=4096):
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk_data := f.read(chunk):
            sha256.update(chunk_data)
    num = int.from_bytes(sha256.digest(), byteorder="big")
    result = []
    while num > 0:
        num, rem = divmod(num, 62)
        result.append(BASE62_CHARS[rem])
    return "".join(reversed(result))
