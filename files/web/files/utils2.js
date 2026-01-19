import JSON5 from "https://esm.sh/json5";

export class CacheFetcher {
  static DB_NAME = "Fetch_Cache_DB";
  static STORE_NAME = "responses";
  static DB_VERSION = 1;
  static instance = null;

  #db = null;

  constructor(db) {
    this.#db = db;
  }

  static async create() {
    if (this.instance) {
      return this.instance;
    }
    this.instance = await new Promise((resolve, reject) => {
      const request = indexedDB.open(
        this.DB_NAME,
        this.DB_VERSION,
      );

      request.onerror = () => reject(request.error);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      request.onsuccess = () => {
        resolve(new CacheFetcher(request.result));
      };
    });
    return this.instance;
  }

  #normalizeKey(key) {
    if (typeof key === "string") return key;
    if (key instanceof Request) return key.url;
    if (key.url) return key.url;
    return String(key);
  }

  #parseResponse(response, type) {
    const contentType = response.headers.get("content-type") || "";

    if (
      type === "json" || /application\/(json|jsonc|json5)/.test(contentType)
    ) {
      return response.text().then((text) => {
        try {
          if (
            !contentType.contains("json5") && !contentType.contains("jsonc")
          ) {
            return JSON.parse(text);
          }
        } catch {}
        return JSON5.parse(text);
      });
    }

    if (type === "text" || contentType.startsWith("text/")) {
      return response.text();
    }

    return response.blob();
  }

  async fetch_data({ request, opts = {}, key, responseType }) {
    const response = await fetch(request, opts);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const data = await this.#parseResponse(response, responseType);
    const cacheKey = this.#normalizeKey(key || request);

    await this.#put(cacheKey, {
      data,
      url: response.url,
      timestamp: Date.now(),
    });

    return data;
  }

  async fetch_cache(
    { request, opts = {}, key, responseType, forceRefresh = false },
  ) {
    const cacheKey = this.#normalizeKey(key || request);

    if (!forceRefresh) {
      const cached = await this.#get(cacheKey);
      if (cached) return cached.data;
    }

    return this.fetch_data({ request, opts, key: cacheKey, responseType });
  }

  async clear_cache() {
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(this.constructor.STORE_NAME, "readwrite");
      const store = tx.objectStore(this.constructor.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async remove_cache(keyOrRequest) {
    const cacheKey = this.#normalizeKey(keyOrRequest);
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(this.constructor.STORE_NAME, "readwrite");
      const store = tx.objectStore(this.constructor.STORE_NAME);
      const request = store.delete(cacheKey);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async #get(key) {
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(this.constructor.STORE_NAME, "readonly");
      const store = tx.objectStore(this.constructor.STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async #put(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(this.constructor.STORE_NAME, "readwrite");
      const store = tx.objectStore(this.constructor.STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

window.Utils2 = {
  CacheFetcher: CacheFetcher,
};
