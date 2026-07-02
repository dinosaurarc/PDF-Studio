const { contextBridge, ipcRenderer, webUtils } = require("electron");

const pendingOpenEntries = [];
let openPathsCallback = null;
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

async function dispatchPendingOpenEntries() {
  if (!openPathsCallback || nativeOpenDispatching || !pendingOpenEntries.length) return;
  nativeOpenDispatching = true;
  const entries = pendingOpenEntries.splice(0);
  try {
    await openPathsCallback(entries.map(nativeHandle), { newPdfTabs: true });
  } catch (error) {
    console.error("无法打开外部文件", error);
  } finally {
    nativeOpenDispatching = false;
    if (pendingOpenEntries.length) dispatchPendingOpenEntries();
  }
}

ipcRenderer.on("pdf-studio:open-paths", (_event, entries) => {
  pendingOpenEntries.push(...(entries || []));
  dispatchPendingOpenEntries();
});

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

async function showOpenFilePicker() {
  const result = await ipcRenderer.invoke("pdf-studio:open-files");
  if (result?.cancelled) throw abortError();
  return (result?.entries || []).map(nativeHandle);
}

async function showSaveFilePicker(options = {}) {
  const result = await ipcRenderer.invoke("pdf-studio:choose-save-path", options.suggestedName);
  if (result?.cancelled) throw abortError();
  return nativeHandle(result.entry);
}

const desktopApi = {
  async requestSourceFileHandle(suggestedName) {
    const result = await ipcRenderer.invoke("pdf-studio:request-source", suggestedName);
    if (result?.cancelled) throw abortError(result?.message);
    return nativeHandle(result.entry);
  },
  saveSourceFile: saveNativeSourceFile,
  getRuntimeInfo: () => ipcRenderer.invoke("pdf-studio:runtime-info"),
  checkForUpdates: () => ipcRenderer.invoke("pdf-studio:check-update"),
  downloadUpdate: () => ipcRenderer.invoke("pdf-studio:download-update"),
  installUpdate: () => ipcRenderer.invoke("pdf-studio:install-update"),
  async uninstallApplication() {
    const result = await ipcRenderer.invoke("pdf-studio:uninstall");
    if (!result?.ok) throw new Error(result?.message || "无法启动卸载");
    return result;
  },
  onUpdateState(callback) {
    const listener = (_event, state) => callback(state || {});
    ipcRenderer.on("pdf-studio:update-state", listener);
    return () => ipcRenderer.removeListener("pdf-studio:update-state", listener);
  },
  async claimOpenFileHandles(files) {
    return Promise.all(files.map(async (file) => {
      const filePath = webUtils.getPathForFile(file);
      if (!filePath) return null;
      const entry = await ipcRenderer.invoke("pdf-studio:register-path", filePath);
      return entry ? nativeHandle(entry) : null;
    }));
  },
  onNativeOpenPaths(callback) {
    openPathsCallback = callback;
    dispatchPendingOpenEntries();
    return () => {
      if (openPathsCallback === callback) openPathsCallback = null;
    };
  },
  getPrinters: () => ipcRenderer.invoke("pdf-studio:get-printers"),
  savePrintPreferences: (settings) => ipcRenderer.invoke("pdf-studio:save-print-preferences", settings),
  printPreview: (pdfBytes, settings) => ipcRenderer.invoke("pdf-studio:print-preview", pdfBytes, settings),
  printDocument: (pdfBytes, settings) => ipcRenderer.invoke("pdf-studio:print-document", pdfBytes, settings),
  advancedPrint: (pdfBytes, settings) => ipcRenderer.invoke("pdf-studio:advanced-print", pdfBytes, settings),
  cancelPrint: () => ipcRenderer.invoke("pdf-studio:cancel-print"),
};

contextBridge.exposeInMainWorld("pdfStudioDesktop", desktopApi);
contextBridge.exposeInMainWorld("pdfStudioShowOpenFilePicker", showOpenFilePicker);
contextBridge.exposeInMainWorld("pdfStudioShowSaveFilePicker", showSaveFilePicker);
contextBridge.exposeInMainWorld("pdfStudioRequestSourceFileHandle", desktopApi.requestSourceFileHandle);
contextBridge.exposeInMainWorld("pdfStudioSaveSourceFile", desktopApi.saveSourceFile);
contextBridge.exposeInMainWorld("pdfStudioGetRuntimeInfo", desktopApi.getRuntimeInfo);
contextBridge.exposeInMainWorld("pdfStudioCheckForUpdates", desktopApi.checkForUpdates);
contextBridge.exposeInMainWorld("pdfStudioDownloadUpdate", desktopApi.downloadUpdate);
contextBridge.exposeInMainWorld("pdfStudioInstallUpdate", desktopApi.installUpdate);
contextBridge.exposeInMainWorld("pdfStudioUninstallApplication", desktopApi.uninstallApplication);
contextBridge.exposeInMainWorld("pdfStudioOnUpdateState", desktopApi.onUpdateState);
contextBridge.exposeInMainWorld("pdfStudioClaimOpenFileHandles", desktopApi.claimOpenFileHandles);
contextBridge.exposeInMainWorld("pdfStudioOnNativeOpenPaths", desktopApi.onNativeOpenPaths);
contextBridge.exposeInMainWorld("pdfStudioGetPrinters", desktopApi.getPrinters);
contextBridge.exposeInMainWorld("pdfStudioSavePrintPreferences", desktopApi.savePrintPreferences);
contextBridge.exposeInMainWorld("pdfStudioPrintPreview", desktopApi.printPreview);
contextBridge.exposeInMainWorld("pdfStudioPrintDocument", desktopApi.printDocument);
contextBridge.exposeInMainWorld("pdfStudioAdvancedPrint", desktopApi.advancedPrint);
contextBridge.exposeInMainWorld("pdfStudioCancelPrint", desktopApi.cancelPrint);
