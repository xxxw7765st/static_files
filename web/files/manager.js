// Alpine.js应用
function githubFileManager() {
  return {
    // 状态管理
    configPanelOpen: false,
    activeTab: "upload",
    tabs: [
      { id: "upload", name: "上传" },
      { id: "delete", name: "删除" },
      { id: "rename", name: "重命名" },
      { id: "history", name: "历史" },
    ],

    // 配置数据
    config: {
      pat: "",
      owner: "",
      repo: "",
      branch: "",
      prefix: "",
    },

    // 上传文件列表
    uploadFiles: [],
    fileIdCounter: 0,

    // 删除和重命名数据
    deletePath: "",
    renameOldPath: "",
    renameNewPath: "",

    // 历史记录相关状态
    history: [],
    historyOpenIndex: null,

    // 计算属性
    get isConfigValid() {
      if (this.config.prefix && !this.config.prefix.endsWith("/")) {
        this.config.prefix = this.config.prefix + "/";
      }
      return this.config.owner && this.config.repo && this.config.pat &&
        this.config.branch;
    },

    // 初始化
    init() {
      this.loadConfig();
      this.loadHistory();
    },

    // 配置面板方法
    toggleConfigPanel() {
      this.configPanelOpen = !this.configPanelOpen;
    },

    async saveConfig() {
      const validation = await this.validateConfig();
      if (!validation.valid) {
        if (
          !await window.Confirm.show(
            `配置验证失败: ${validation.message}，是否仍然保存？`,
          )
        ) {
          return;
        }
      }

      localStorage.setItem("githubConfig", JSON.stringify(this.config));
      window.Modal.show(
        validation.valid ? "配置验证并保存成功" : "配置已保存（但验证失败）",
        validation.valid ? "success" : "warning",
      );
    },

    openGithub() {
      let { owner, repo, branch, prefix } = this.config;
      let url = "https://github.com";
      if (repo && owner) {
        url = `${url}/${owner}/${repo}`;
        if (branch || prefix) {
          branch ??= "main";
          url = `${url}/tree/${branch}/${prefix}`;
        }
      }
      open(url, "_blank", "noopener,noreferrer,popup");
    },

    loadConfig() {
      const saved = localStorage.getItem("githubConfig");
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    },

    async clearConfig() {
      if (await window.Confirm.show("确定要清除所有配置吗？")) {
        localStorage.removeItem("githubConfig");
        this.config = { owner: "", repo: "", pat: "", branch: "", prefix: "" };
        window.Modal.show("配置已清除", "success");
      }
    },

    async validateConfig() {
      if (!this.isConfigValid) {
        return { valid: false, message: "请完善所有配置项" };
      }

      try {
        const github = new window.GitHubAPI(
          { ...this.config },
        );
        const result = await github.checkAccess();

        if (result.success) {
          return { valid: true, message: "配置验证成功" };
        } else {
          return { valid: false, message: `仓库访问失败: ${result.error}` };
        }
      } catch (error) {
        return { valid: false, message: `验证失败: ${error.message}` };
      }
    },

    // 文件上传方法
    addFiles(event) {
      const files = Array.from(event.target.files);
      files.forEach((file) => {
        this.uploadFiles.push({
          id: this.fileIdCounter++,
          origin_file: file,
          file: file,
          name: file.name,
        });
      });
      event.target.value = "";
    },

    removeFile(index) {
      this.uploadFiles.splice(index, 1);
    },

    resetFile(index) {
      this.uploadFiles[index].name = this.uploadFiles[index].origin_file.name;
      this.uploadFiles[index].file = this.uploadFiles[index].origin_file;
    },

    async showFileOperations(index) {
      try {
        if (!window.SelectBox) {
          window.Modal.show("操作组件未加载", "error");
          return;
        }

        // 使用全局的 fileOperations
        const operation = await window.SelectBox.show(
          window.fileOperations,
          "选择文件操作",
        );

        if (operation && operation.do) {
          const fileObj = this.uploadFiles[index];
          try {
            // 执行操作，确保传递正确的参数
            const [newFilename, newFile] = await operation.do(
              fileObj.name,
              fileObj.file,
            );

            // 更新文件名和文件对象（如果操作返回了修改）
            if (newFilename !== fileObj.name) {
              fileObj.name = newFilename;
            }
            if (newFile !== fileObj.file) {
              fileObj.file = newFile;
            }
          } catch (error) {
            console.error("文件操作错误:", error);
            window.Modal.show(`操作失败: ${error.message}`, "error");
          }
        }
      } catch (error) {
        console.error("SelectBox 错误:", error);
        window.Modal.show("操作选择失败", "error");
      }
    },
    formatFileSize(bytes) {
      return window.format_file_size?.(bytes) ?? "? B";
    },

    async uploadAllFiles() {
      if (!this.isConfigValid) {
        window.Modal.show("请先完善配置信息", "error");
        return;
      }

      const github = new window.GitHubAPI(
        { ...this.config },
      );
      const accessCheck = await github.checkAccess();
      if (!accessCheck.success) {
        window.Modal.show(`仓库访问失败: ${accessCheck.error}`, "error");
        return;
      }

      if (
        !await window.Confirm.show(
          `确定要上传 ${this.uploadFiles.length} 个文件吗？`,
        )
      ) {
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const [index, fileObj] of this.uploadFiles.entries()) {
        try {
          const result = await github.uploadFile(
            fileObj.name,
            fileObj.file,
            `Upload ${fileObj.name}`,
          );

          if (result.success) {
            successCount++;
            this.recordHistory("upload", {
              path: fileObj.name,
              size: fileObj.size,
              success: true,
            });

            fileObj.status = "success";
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          errorCount++;
          this.recordHistory("upload", {
            path: fileObj.name,
            size: fileObj.size,
            success: false,
            error: error.message,
          });

          fileObj.status = "error";
          fileObj.error = error.message;

          window.Modal.show(
            `文件 ${fileObj.name} 上传失败: ${error.message}`,
            "error",
          );
        }
      }

      if (errorCount === 0) {
        window.Modal.show(
          `所有文件上传完成！成功: ${successCount}个`,
          "success",
        );
      } else {
        window.Modal.show(
          `上传完成！成功: ${successCount}个, 失败: ${errorCount}个`,
          "warning",
        );
      }

      setTimeout(() => {
        this.uploadFiles = this.uploadFiles.filter((file) =>
          file.status === "error"
        );
      }, 3000);
    },

    // 删除文件方法
    async deleteFile() {
      if (!this.deletePath) {
        window.Modal.show("请输入要删除的文件路径", "error");
        return;
      }

      if (
        !await window.Confirm.show(
          `确定要删除文件 ${this.deletePath} 吗？此操作不可逆！`,
        )
      ) {
        return;
      }

      try {
        const github = new window.GitHubAPI(
          { ...this.config },
        );
        const result = await github.deleteFile(
          this.deletePath,
          `Delete ${this.deletePath}`,
        );

        if (result.success) {
          window.Modal.show("文件删除成功", "success");
          this.recordHistory("delete", {
            path: this.deletePath,
            success: true,
          });
          this.deletePath = "";
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        window.Modal.show(`删除失败: ${error.message}`, "error");
        this.recordHistory("delete", {
          path: this.deletePath,
          success: false,
          error: error.message,
        });
      }
    },

    // 重命名文件方法
    async renameFile() {
      if (!this.renameOldPath || !this.renameNewPath) {
        window.Modal.show("请输入原文件路径和新文件路径", "error");
        return;
      }

      if (
        !await window.Confirm.show(
          `确定要将 ${this.renameOldPath} 重命名为 ${this.renameNewPath} 吗？`,
        )
      ) {
        return;
      }

      try {
        const github = new window.GitHubAPI(
          { ...this.config },
        );
        const result = await github.renameFile(
          this.renameOldPath,
          this.renameNewPath,
          `Rename ${this.renameOldPath} to ${this.renameNewPath}`,
        );

        if (result.success) {
          window.Modal.show("文件重命名成功", "success");
          this.recordHistory("rename", {
            old_path: this.renameOldPath,
            path: this.renameNewPath,
            success: true,
          });
          this.renameOldPath = "";
          this.renameNewPath = "";
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        window.Modal.show(`重命名失败: ${error.message}`, "error");
        this.recordHistory("rename", {
          old_path: this.renameOldPath,
          path: this.renameNewPath,
          success: false,
          error: error.message,
        });
      }
    },

    // 历史记录方法
    loadHistory() {
      const saved = localStorage.getItem("githubHistory");
      if (saved) {
        this.history = JSON.parse(saved);
      }
    },

    recordHistory(action, data) {
      const safe_config = { ...this.config };
      delete safe_config["pat"];
      const record = {
        action,
        data,
        timestamp: new Date().toISOString(),
        config: { ...safe_config },
      };

      this.history.unshift(record);

      if (this.history.length > 100) {
        this.history = this.history.slice(0, 100);
      }

      localStorage.setItem("githubHistory", JSON.stringify(this.history));
    },

    async clearHistory() {
      if (
        await window.Confirm.show("确定要清除所有历史记录吗？此操作不可逆！")
      ) {
        this.history = [];
        localStorage.removeItem("githubHistory");
        window.Modal.show("历史记录已清除", "success");
      }
    },

    toggleHistoryDetail(index) {
      this.historyOpenIndex = this.historyOpenIndex === index ? null : index;
    },

    getHistoryBadgeClass(action) {
      const classes = {
        upload: "bg-green-100 text-green-800",
        delete: "bg-red-100 text-red-800",
        rename: "bg-blue-100 text-blue-800",
      };
      return classes[action] || "bg-gray-100 text-gray-800";
    },

    getActionText(action) {
      const texts = {
        upload: "上传",
        delete: "删除",
        rename: "重命名",
      };
      return texts[action] || action;
    },

    getHistoryTitle(record) {
      let prefix = record.config?.prefix || "";
      const pathReg = /^.*[^\/]\/([^\/]+)\/?$/;
      prefix = prefix.replace(pathReg, ".../$1/");
      const path = record.data?.path || "???";
      if (record.action === "rename") {
        let old = record.data?.old_path ?? "???";
        return `${prefix}/${old} → ${path}`;
      }
      return `${prefix}${path}`;
    },

    formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString("zh-CN");
    },
  };
}

// app.js - 添加组件可用性检查
function checkComponents() {
  const requiredComponents = [
    "Modal",
    "Confirm",
    "ImagePreview",
    "SelectBox",
    "GitHubAPI",
  ];
  const missing = requiredComponents.filter((comp) => !window[comp]);

  if (missing.length > 0) {
    console.error("缺少组件:", missing);
    // 显示错误信息
    const errorDiv = document.createElement("div");
    errorDiv.className =
      "fixed top-0 left-0 right-0 bg-red-500 text-white text-center p-2 z-50";
    errorDiv.textContent = `组件加载失败: ${
      missing.join(", ")
    }。请刷新页面重试。`;
    document.body.appendChild(errorDiv);

    setTimeout(() => errorDiv.remove(), 5000);
    return false;
  }
  return true;
}

// 在 Alpine 初始化前检查组件
document.addEventListener("alpine:init", () => {
  if (!checkComponents()) {
    return;
  }

  Alpine.data("githubFileManager", githubFileManager);
});

// 确保组件在页面加载后可用
window.addEventListener("DOMContentLoaded", () => {
  if (!window.Alpine) {
    console.error("Alpine.js未加载");
  }
});
