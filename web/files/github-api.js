import { Octokit } from "https://esm.sh/octokit";

class GitHubAPI {
  constructor(config) {
    let { pat, owner, repo, branch, prefix } = config;
    this.octokit = new Octokit({ auth: pat });
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    if (prefix) {
      prefix = prefix.replace(/\/+/g, "/")
        .replace(/^\//, "");
      this.prefix = prefix ? prefix.replace(/\/?$/, "/") : "";
    } else {
      this.prefix = "";
    }
  }

  // 上传文件
  async uploadFile(path, file, message = "Update file") {
    try {
      const content = await this.readFileAsBase64(file);
      const requestData = {
        owner: this.owner,
        repo: this.repo,
        path: this.prefix + path,
        message: message,
        content: content,
      };

      // 添加 branch 参数
      if (this.branch) {
        requestData.branch = this.branch;
      }

      const response = await this.octokit.request(
        "PUT /repos/{owner}/{repo}/contents/{path}",
        requestData,
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error("Upload error:", error);
      return { success: false, error: error.message };
    }
  }

  // 读取文件为Base64
  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 删除文件
  async deleteFile(path, message = "Delete file") {
    try {
      const fileInfo = await this.getFileInfo(path);
      if (!fileInfo.success) {
        return fileInfo;
      }

      const requestData = {
        owner: this.owner,
        repo: this.repo,
        path: this.prefix + path,
        message: message,
        sha: fileInfo.data.sha,
      };

      // 添加 branch 参数
      if (this.branch) {
        requestData.branch = this.branch;
      }

      const response = await this.octokit.request(
        "DELETE /repos/{owner}/{repo}/contents/{path}",
        requestData,
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error("Delete error:", error);
      return { success: false, error: error.message };
    }
  }

  // 重命名文件
  async renameFile(oldPath, newPath, message = "Rename file") {
    try {
      const fileInfo = await this.getFileInfo(oldPath);
      if (!fileInfo.success) {
        return fileInfo;
      }

      const contentResponse = await fetch(fileInfo.data.download_url);
      const content = await contentResponse.text();

      const uploadResult = await this.uploadFileContent(
        newPath,
        content,
        message,
      );

      if (!uploadResult.success) {
        return uploadResult;
      }

      return await this.deleteFile(oldPath, message);
    } catch (error) {
      console.error("Rename error:", error);
      return { success: false, error: error.message };
    }
  }

  // 直接上传内容（用于重命名）
  async uploadFileContent(path, content, message = "Upload file") {
    try {
      const requestData = {
        owner: this.owner,
        repo: this.repo,
        path: this.prefix + path,
        message: message,
        content: btoa(unescape(encodeURIComponent(content))),
      };

      if (this.branch) {
        requestData.branch = this.branch;
      }

      const response = await this.octokit.request(
        "PUT /repos/{owner}/{repo}/contents/{path}",
        requestData,
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 获取文件信息
  async getFileInfo(path) {
    try {
      const requestParams = {
        owner: this.owner,
        repo: this.repo,
        path: this.prefix + path,
      };

      if (this.branch) {
        requestParams.ref = this.branch;
      }

      const response = await this.octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}",
        requestParams,
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 检查仓库访问权限
  async checkAccess() {
    try {
      await this.octokit.request("GET /repos/{owner}/{repo}", {
        owner: this.owner,
        repo: this.repo,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// 暴露到window对象
window.GitHubAPI = GitHubAPI;
