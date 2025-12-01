def format_size(bytes_int: int):
    units = ['B', 'K', 'M', 'G', 'T']
    n, i = bytes_int, 0
    while n >= 1000 and i < 4:
        n /= 1024
        i += 1
    return f"{n:.2f}{units[i]}"

