import { calc_file_md5, format } from "./utils.js";
import { squish } from "https://esm.sh/picsquish@0.3.0";

class Modal {
  static show(message, title = "info") {
    const modal = document.createElement("div");
    modal.className =
      "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-sm mx-4">
        <div class="text-center">
          <h3 class="text-lg font-medium mb-2">${title}</h3>
          <p class="text-gray-600">${message}</p>
          <button class="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg">
            确定
          </button>
        </div>
      </div>
    `;

    const closeBtn = modal.querySelector("button");
    closeBtn.addEventListener("click", () => modal.remove());

    document.body.appendChild(modal);
  }
}

class Confirm {
  static show(message) {
    return new Promise((resolve) => {
      const confirm = document.createElement("div");
      confirm.className =
        "fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50";
      confirm.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-sm mx-4">
          <div class="text-center">
            <h3 class="text-lg font-medium mb-2">确认操作</h3>
            <p class="text-gray-600">${message}</p>
            <div class="mt-4 flex gap-2 justify-center">
              <button class="cancel-btn bg-gray-300 px-4 py-2 rounded-lg">取消</button>
              <button class="confirm-btn bg-red-500 text-white px-4 py-2 rounded-lg">确认</button>
            </div>
          </div>
        </div>
      `;

      const handleResult = (result) => {
        confirm.remove();
        resolve(result);
      };

      confirm.querySelector(".cancel-btn").addEventListener(
        "click",
        () => handleResult(false),
      );
      confirm.querySelector(".confirm-btn").addEventListener(
        "click",
        () => handleResult(true),
      );

      document.body.appendChild(confirm);
    });
  }
}

class ImagePreview {
  static show(file) {
    if (!file || !file.type) {
      Modal.show("无效的文件", "error");
      return;
    }

    if (!file.type.startsWith("image/")) {
      Modal.show("不支持的文件类型，仅支持图片文件", "error");
      return;
    }

    const preview = document.createElement("div");
    preview.className =
      "fixed inset-0 bg-black/90 flex items-center justify-center z-50";

    const objectUrl = URL.createObjectURL(file);

    preview.innerHTML = `
      <div class="relative max-w-4xl max-h-full">
        <img src="${objectUrl}" alt="图片预览" class="max-w-full max-h-full object-contain">
        <div class="absolute top-4 right-4 flex gap-2">
          <button class="fullscreen-btn bg-white text-black px-3 py-1 rounded text-sm">全屏</button>
          <button class="close-btn bg-red-500 text-white px-3 py-1 rounded text-sm">关闭</button>
        </div>
      </div>
    `;

    const cleanup = () => {
      preview.remove();
      URL.revokeObjectURL(objectUrl);
    };

    preview.querySelector(".fullscreen-btn").addEventListener("click", () => {
      preview.querySelector("img").requestFullscreen();
    });

    preview.querySelector(".close-btn").addEventListener("click", cleanup);

    // 点击背景关闭
    preview.addEventListener("click", (e) => {
      if (e.target === preview) cleanup();
    });

    document.body.appendChild(preview);

    // 30秒后自动清理
    setTimeout(() => {
      if (preview.parentNode) cleanup();
    }, 30000);
  }

  static formatFileSize(bytes) {
    return format.file_size(bytes);
  }
}

class Prompt {
  static show(message, opts = {}) {
    opts = {
      default: "",
      placeholder: "请输入内容",
      enter: true,
      ...opts,
    };

    return new Promise((resolve) => {
      const prompt = document.createElement("div");
      prompt.className =
        "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
      prompt.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-sm mx-4">
          <div class="text-center">
            <h3 class="text-lg font-medium mb-2">请输入</h3>
            <p class="text-gray-600 mb-4 message">${message}</p>
            <div class="relative mb-4">
              <input type="text" class="prompt-input w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:border-blue-500">
              <button type="button" class="clear-btn absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none" style="top: 50%;transform: translateY(-50%);">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div class="mt-4 flex gap-2 justify-center">
              <button class="cancel-btn bg-gray-300 px-4 py-2 rounded-lg">取消</button>
              <button class="confirm-btn bg-blue-500 text-white px-4 py-2 rounded-lg">确定</button>
            </div>
          </div>
        </div>
      `;

      const input = prompt.querySelector(".prompt-input");
      input.value = opts.default;
      input.placeholder = opts.placeholder;

      const handleResult = (result) => {
        prompt.remove();
        resolve(result);
      };

      prompt.querySelector(".clear-btn").addEventListener("click", () => {
        input.value = "";
        input.focus();
      });

      prompt.querySelector(".cancel-btn").addEventListener(
        "click",
        () => handleResult(null),
      );
      prompt.querySelector(".confirm-btn").addEventListener(
        "click",
        () => handleResult(input.value),
      );

      // 自动聚焦输入框
      input.focus();
      input.select();

      // 支持回车键确认
      if (opts.enter) {
        input.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            prompt.querySelector(".confirm-btn").click();
          }
        });
      }

      document.body.appendChild(prompt);
    });
  }
}

class SelectBox {
  /**
   * @param options (Record<string,any> & {name: string})[]
   */
  static show(options, title = "请选择操作") {
    return new Promise((resolve) => {
      const selectBox = document.createElement("div");
      selectBox.className =
        "fixed inset-0 bg-black/50 flex items-center justify-center z-50";

      selectBox.innerHTML = `
        <div class="bg-white rounded-lg p-4 max-w-sm mx-4 w-full">
          <h3 class="text-lg font-medium mb-3">${title}</h3>
          <div class="options-container space-y-2">
            ${
        options.map((option, index) => `
              <button class="option-btn w-full text-left p-3 hover:bg-gray-100 rounded-lg border" data-index="${index}">
                ${SelectBox.escapeHtml(option.name)}
              </button>
            `).join("")
      }
          </div>
          <button class="cancel-btn w-full mt-3 bg-gray-200 p-2 rounded-lg">取消</button>
        </div>
      `;

      const handleResult = (result) => {
        selectBox.remove();
        resolve(result);
      };

      selectBox.querySelector(".options-container").addEventListener(
        "click",
        (e) => {
          if (e.target.classList.contains("option-btn")) {
            const index = parseInt(e.target.dataset.index);
            handleResult(options[index]);
          }
        },
      );

      selectBox.querySelector(".cancel-btn").addEventListener(
        "click",
        () => handleResult(null),
      );

      document.body.appendChild(selectBox);
    });
  }

  static escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// 文件操作定义
const fileOperations = [
  {
    name: "预览图像",
    do: async (pathname, file) => {
      if (window.ImagePreview) {
        window.ImagePreview.show(file);
      } else {
        console.error("ImagePreview not found");
      }
      return [pathname, file];
    },
  },
  {
    name: "查看文件信息",
    do: async (pathname, file) => {
      const fileInfo = `文件名: ${pathname}\n大小: ${
        ImagePreview.formatFileSize(file.size)
      }\n类型: ${file.type || "未知"}`;
      if (window.Modal) {
        window.Modal.show(`<pre>${fileInfo}</pre>`, "文件信息");
      }
      return [pathname, file];
    },
  },
  {
    name: "压缩图像",
    do: async (pathname, file) => {
      const selected = await SelectBox.show([
        { name: "image/webp (默认)", value: "image/webp", ext: ".webp" },
        { name: "image/jpeg", ext: ".jpg" },
        { name: "image/png", ext: ".png" },
      ], "选择文件类型");
      let size = await Prompt.show("最大尺寸 ( 整数 > 10 )", {
        default: "400",
        placeholder: "400, 800, 1200, ...",
      });
      const ft = selected?.value ?? selected?.name ?? "image/webp";
      const ext = selected?.ext ?? ".webp";
      if (size !== null) {
        size = Number(size);
        if (size > 10) {
          const resizer = await squish(file, size);
          const resized = await resizer.toBlob({ type: ft });
          const { dir, name } = format.parse_file_path(pathname);
          return [
            `${dir}${name}${ext}`,
            resized,
          ];
        } else {
          Modal.show(`${size}`, "错误的输入");
        }
      }

      return [pathname, file];
    },
  },
  {
    name: "哈希文件名",
    do: async (pathname, file) => {
      const { hash_name } = await calc_file_md5(file);
      const { dir, name, ext } = format.parse_file_path(pathname);
      const pure_name = name.replace(/_H[0-9a-zA-Z]_/g, "");
      return [
        `${dir}${pure_name}_H${hash_name}_${ext}`,
        file,
      ];
    },
  },
];

// 暴露到window对象
window.Modal = Modal;
window.Confirm = Confirm;
window.ImagePreview = ImagePreview;
window.SelectBox = SelectBox;
window.fileOperations = fileOperations;
window.format_file_size = format.file_size;
