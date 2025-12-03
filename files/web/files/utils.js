export const format = {
  file_size(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },
  parse_file_path(path = "") {
    if (!path) return { dir: "", name: "", ext: "" };

    const lastSlash = path.lastIndexOf("/");
    const dir = path.substring(0, lastSlash + 1);
    const filename = path.substring(lastSlash + 1);
    const lastDot = filename.lastIndexOf(".");

    if (lastDot <= 0 || lastDot === filename.length - 1) {
      return { dir, name: filename, ext: "" };
    }

    return {
      dir,
      name: filename.substring(0, lastDot),
      ext: filename.substring(lastDot),
    };
  },
};

function arrayBufferToBase62(buffer) {
  const base62Chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let uint8Array = new Uint8Array(buffer);
  let result = "";
  let num = 0;
  let bitLength = 0;

  for (const byte of uint8Array) {
    num = (num << 8) | byte;
    bitLength += 8;
    while (bitLength >= 6) {
      bitLength -= 6;
      const index = (num >> bitLength) & 0x3F; // 0x3F 即 63，取低 6 位
      result += base62Chars[index];
    }
  }
  if (bitLength > 0) {
    const index = (num << (6 - bitLength)) & 0x3F;
    result += base62Chars[index];
  }

  return result;
}

export async function calc_file_sha256(blob) {
  try {
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(blob);
    });

    const sha256Buffer = await crypto.subtle.digest("SHA-256", arrayBuffer);

    const sha256Str = Array.from(new Uint8Array(sha256Buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const sha256Base62 = arrayBufferToBase62(sha256Buffer);
    const sha256Base62First8 = sha256Base62.padStart(8, "0").slice(0, 8);
    return {
      sha256: sha256Str,
      hash_name: sha256Base62First8,
    };
  } catch (err) {
    throw new Error(`哈希计算失败：${err.message}`);
  }
}
