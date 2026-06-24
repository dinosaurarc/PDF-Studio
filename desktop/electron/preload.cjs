const { ipcRenderer, webUtils } = require("electron");

const pendingOpenEntries = [];
let nativeOpenTimer;
let nativeOpenDispatching = false;

function abortError(message) {
  return new DOMException(message || "用户取消了操作", "AbortError");
}

function nativeHandle(entry) {
  return {
    __pdfStudioNativeToken: entry.token,
    __pdfStudioNativePath: entry.sourcePath || null,
    kind: "file",
    name: entry.name,
    async getFile() {
      return new File([entry.data || new Uint8Array()], entry.name, { type: entry.type || "application/octet-stream" });
    },
    async queryPermission() {
      return "granted";
    },
    async requestPermission() {
      return "granted";
    },
    async createWritable() {
      let pendingData = null;
      return {
        async write(value) {
          const blob = value instanceof Blob ? value : new Blob([value]);
          pendingData = new Uint8Array(await blob.arrayBuffer());
        },
        async close() {
          if (!pendingData) return;
          const result = await ipcRenderer.invoke("pdf-studio:save-file", entry.token, pendingData);
          if (result?.cancelled) throw abortError("用户取消了权限申请");
          if (!result?.ok) throw new Error(result?.message || "保存失败");
        },
      };
    },
  };
}

function scheduleNativeOpenDispatch(attempt = 0) {
  clearTimeout(nativeOpenTimer);
  nativeOpenTimer = setTimeout(async () => {
    if (!pendingOpenEntries.length || nativeOpenDispatching) return;
    if (typeof window.pdfStudioOpenNativeHandles !== "function") {
      if (attempt < 120) scheduleNativeOpenDispatch(attempt + 1);
      return;
    }
    nativeOpenDispatching = true;
    const entries = pendingOpenEntries.splice(0);
    try {
      await window.pdfStudioOpenNativeHandles(entries.map(nativeHandle), { newPdfTabs: true });
    } catch (error) {
      if (typeof window.pdfStudioReportNativeOpenError === "function") {
        window.pdfStudioReportNativeOpenError(error?.message || String(error));
      } else {
        console.error(error);
      }
    } finally {
      nativeOpenDispatching = false;
      if (pendingOpenEntries.length) scheduleNativeOpenDispatch();
    }
  }, attempt ? 80 : 0);
}

ipcRenderer.on("pdf-studio:open-paths", (_event, entries) => {
  pendingOpenEntries.push(...(entries || []));
  scheduleNativeOpenDispatch();
});

window.addEventListener("DOMContentLoaded", () => scheduleNativeOpenDispatch());

async function saveNativeSourceFile(handle, value) {
  const token = handle?.__pdfStudioNativeToken;
  if (!token) return { ok: false, unavailable: true };
  const blob = value instanceof Blob ? value : new Blob([value]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const result = await ipcRenderer.invoke("pdf-studio:save-file", token, bytes);
  if (result?.cancelled) throw abortError("用户取消了权限申请");
  if (!result?.ok) throw new Error(result?.message || "保存失败");
  return { ok: true };
}

window.showOpenFilePicker = async () => {
  const result = await ipcRenderer.invoke("pdf-studio:open-files");
  if (result?.cancelled) throw abortError();
  return (result?.entries || []).map(nativeHandle);
};

window.showSaveFilePicker = async (options = {}) => {
  const result = await ipcRenderer.invoke("pdf-studio:choose-save-path", options.suggestedName);
  if (result?.cancelled) throw abortError();
  return nativeHandle(result.entry);
};

window.pdfStudioRequestSourceFileHandle = async (suggestedName) => {
  const result = await ipcRenderer.invoke("pdf-studio:request-source", suggestedName);
  if (result?.cancelled) throw abortError(result?.message);
  return nativeHandle(result.entry);
};

window.pdfStudioSaveSourceFile = saveNativeSourceFile;

window.pdfStudioClaimOpenFileHandles = async (files) => Promise.all(files.map(async (file) => {
  const filePath = webUtils.getPathForFile(file);
  if (!filePath) return null;
  const entry = await ipcRenderer.invoke("pdf-studio:register-path", filePath);
  return entry ? nativeHandle(entry) : null;
}));
