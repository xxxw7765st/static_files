function fileBrowser() {
  return {
    // 图标映射
    iconMap: {
      "txt": { icon: "fa-file-lines", color: "text-blue-600" },
      "jpg": { icon: "fa-file-image", color: "text-green-500" },
      "png": { icon: "fa-file-image", color: "text-green-500" },
      "default": { icon: "fa-file", color: "text-gray-500" },
    },

    // 文件集合配置
    fileCollections: [],

    // 合并后的文件夹数据
    folderData: {
      target_folder: "根目录",
      generated_at: new Date().toISOString(),
      files: [],
    },

    // 当前路径栈
    pathStack: [],
    currentFiles: [],
    detailItem: null,

    async load_init(nocache = false) {
      const CacheFetcher = window.Utils2?.CacheFetcher;
      const fetcher = await CacheFetcher.create();
      try {
        // 1. 加载图标映射
        try {
          const iconMapData = await fetcher.fetch_cache(
            {
              request: "./files_icon_map.jsonc",
              forceRefresh: nocache,
              responseType: "json",
            },
          );
          this.iconMap = {
            ...this.iconMap,
            ...iconMapData,
          };
        } catch (e) {
          console.warn("无法加载图标映射文件，使用默认图标");
        }

        // 2. 加载文件集合索引
        this.fileCollections = await fetcher.fetch_cache({
          request: "./files_info_collections.jsonc",
          forceRefresh: nocache,
          responseType: "json",
        });

        // 3. 加载所有文件集合
        const collectionPromises = this.fileCollections.map(
          async (collection) => {
            try {
              const data = await fetcher.fetch_cache({
                request: collection.url,
                forceRefresh: nocache,
              });

              const { web_prefix, path_prefix } = collection;

              // 将对象结构的children转换为数组结构
              if (
                data.children && typeof data.children === "object"
              ) {
                data.children = this.childrenObjectToArray(
                  data.children,
                  {
                    web_prefix,
                    path_prefix,
                  },
                );
              }

              // 添加集合信息
              data.collection = collection;

              return data;
            } catch (error) {
              console.error(
                `加载集合 ${collection.name} 失败:`,
                error,
              );
              return null;
            }
          },
        );

        const collectionsData = await Promise.all(
          collectionPromises,
        );

        // 4. 合并所有集合数据
        this.folderData.files = collectionsData.filter((item) => item !== null);

        // 5. 设置当前文件列表
        this.currentFiles = this.folderData.files;

        // 6. 为每个项目添加唯一ID
        this.assignIds(this.currentFiles);
      } catch (error) {
        console.error("初始化失败:", error);
        document.getElementById("file-list").innerHTML =
          '<div class="py-8 text-center text-red-500">加载文件列表失败，请刷新页面重试</div>';
      }
    },
    async init() {
      this.load_init();
    },

    get breadcrumbItems() {
      const items = [{ name: this.folderData.target_folder }];

      this.pathStack.forEach((item) => {
        items.push({ name: item.name });
      });

      return items;
    },

    get sortedFiles() {
      return [...this.currentFiles].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    },

    formatFileSize(bytes) {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) +
        " " + sizes[i];
    },

    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString("zh-CN") + " " +
        date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        });
    },
    _today_date: new Date(),
    formatShortDate(dateString) {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "";
      const t = d.getTime();
      const todayStart = new Date().setHours(0, 0, 0, 0);
      const dayMs = 86400000;
      return t >= todayStart && t < todayStart + dayMs
        ? `${d.getHours()}:${d.getMinutes()}`
        : t >= todayStart - dayMs && t < todayStart
        ? `昨天 ${d.getHours()}:${d.getMinutes()}`
        : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    },

    getFileIcon(filename) {
      const ext = filename.split(".").pop().toLowerCase();
      const icon = this.iconMap[ext] || this.iconMap["default"];
      return `${icon.icon} ${icon.color}`;
    },

    childrenObjectToArray(childrenObj, injects = {}) {
      if (!childrenObj) return [];
      return Object.values(childrenObj).map((item) => {
        if (item.type === "folder" && item.children) {
          item.children = this.childrenObjectToArray(
            item.children,
            injects,
          );
        }
        item = {
          ...injects,
          ...item,
        };
        return item;
      });
    },

    assignIds(items, parentId = "") {
      items.forEach((item, index) => {
        item.id = parentId ? `${parentId}-${index}` : `item-${index}`;
        if (item.children) {
          this.assignIds(item.children, item.id);
        }
      });
    },

    enterFolder(folder) {
      this.pathStack.push({
        name: folder.name,
        relative_path: folder.relative_path,
      });
      this.currentFiles = folder.children || [];
      this.showDetails(folder);
    },

    navigateToBreadcrumb(index) {
      if (index === 0) {
        this.pathStack = [];
        this.currentFiles = this.folderData.files;
        this.detailItem = null;
      } else {
        this.pathStack = this.pathStack.slice(0, index);

        const folder = this.getFolderAtPath(this.pathStack);
        this.currentFiles = folder?.children || [];
        this.detailItem = folder;
      }
    },

    getFolderAtPath(path) {
      let currentFolder = this.folderData;

      for (const pathItem of path) {
        const children = currentFolder.files ||
          currentFolder.children || [];
        const folder = children.find((f) =>
          f.type === "folder" && f.name === pathItem.name
        );
        if (folder) {
          currentFolder = folder;
        } else {
          break;
        }
      }
      return currentFolder;
    },

    showDetails(item) {
      this.detailItem = item;
    },

    getFileName(file) {
      const name = file.name || "???";
      return name.replace(/_H[0-9a-zA-Z]{8}_/g, "");
    },
    getFileWebPath(file) {
      return `${file.web_prefix || ""}${file.relative_path}`;
    },
    getFileRepoPath(file) {
      const path = `${file.path_prefix || ""}${file.relative_path}`;
      if (
        file.type === "folder" && path[path.length - 1] !== "/"
      ) {
        return path + "/";
      }
      return path;
    },
    getFileUrl(file) {
      const web_path = this.getFileWebPath(file);
      const { host, protocol, hostname, pathname } = location;
      if (
        hostname === "127.0.0.1" || hostname === "localhost" ||
        hostname?.startsWith?.("192.168.")
      ) {
        return `${protocol}//${host}/${this.getFileRepoPath(file)}`;
      }
      return `${protocol}//${host}${web_path}`;
    },

    async copyToClipboard(str) {
      if (typeof str !== "string" || !str) return;

      try {
        await navigator.clipboard.writeText(str);
        alert("链接已复制到剪贴板");
      } catch (err) {
        alert(`复制失败：${err.message}`);
      }
    },

    async onRefreshWithoutCache(){
      await this.load_init(true);
      this.navigateToBreadcrumb(0)
    },

    getFileHash(file) {
      return file.hash || "<unknown>Cm6h7jd6oBu5UGdWCPUkRhzT92aD39MN7nez5zoHlCG";
    },

    getFileCount(folder) {
      if (!folder.children) return 0;
      return folder.children.filter((item) => item.type === "file").length;
    },

    getFolderCount(folder) {
      if (!folder.children) return 0;
      return folder.children.filter((item) => item.type === "folder").length;
    },
  };
}
