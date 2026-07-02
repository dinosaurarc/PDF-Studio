const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { autoUpdater } = require("electron-updater");
const { writeSourceFile } = require("./file-store.cjs");

const fileTokens = new Map();
const acceptedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const pendingExternalPaths = [];
let mainWindow;
let localServer;
let closeApproved = false;
let closeCheckActive = false;
let rendererReady = false;
let updateState = { status: "idle", currentVersion: app.getVersion(), percent: 0 };

const printTempFiles = new Set();
let activePrintWindow = null;

function isPortableBuild() {
  return process.platform === "win32" && Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
}

function isRunningFromMacDiskImage() {
  return process.platform === "darwin" && process.execPath.startsWith("/Volumes/");
}

function isUpdateSupported() {
  return app.isPackaged
    && ((process.platform === "darwin" && !isRunningFromMacDiskImage())
      || (process.platform === "win32" && !isPortableBuild()));
}

function publishUpdateState(nextState) {
  updateState = { ...updateState, ...nextState, currentVersion: app.getVersion() };
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("pdf-studio:update-state", updateState);
  }
  return updateState;
}

function readableUpdateError(error) {
  const message = error?.message || String(error || "");
  if (/ENOTFOUND|ECONN|network|timed? ?out|ERR_/i.test(message)) return "无法连接更新服务器，请检查网络后重试。";
  if (/404|latest\.yml|latest-mac\.yml|release/i.test(message)) return "GitHub Release 中缺少自动更新文件，请稍后再试。";
  if (/signature|code sign|not signed/i.test(message)) return "更新包签名验证失败，本次更新已停止。";
  return "检查更新失败，请稍后重试。";
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = console;

  autoUpdater.on("checking-for-update", () => publishUpdateState({ status: "checking", percent: 0 }));
  autoUpdater.on("update-available", (info) => publishUpdateState({
    status: "available",
    version: info.version,
    releaseName: info.releaseName || "",
    percent: 0,
  }));
  autoUpdater.on("update-not-available", () => publishUpdateState({
    status: "current",
    version: app.getVersion(),
    percent: 0,
  }));
  autoUpdater.on("download-progress", (progress) => publishUpdateState({
    status: "downloading",
    percent: progress.percent || 0,
    transferred: progress.transferred || 0,
    total: progress.total || 0,
  }));
  autoUpdater.on("update-downloaded", (info) => publishUpdateState({
    status: "downloaded",
    version: info.version,
    percent: 100,
  }));
  autoUpdater.on("error", (error) => publishUpdateState({
    status: "error",
    message: readableUpdateError(error),
    detail: error?.message || String(error || ""),
  }));
}

function mimeForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  return "image/jpeg";
}

function registerPath(filePath) {
  const token = crypto.randomUUID();
  const sourcePath = path.resolve(filePath);
  fileTokens.set(token, sourcePath);
  return { token, name: path.basename(sourcePath), type: mimeForFile(sourcePath), sourcePath };
}

async function entryForPath(filePath, includeData = true) {
  const entry = registerPath(filePath);
  if (includeData) entry.data = await fsp.readFile(filePath);
  return entry;
}

async function requestOriginalFile(filePath) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "允许修改源文件",
    message: `请重新选择“${path.basename(filePath)}”，以允许 PDF大编辑写入这个文件。`,
    buttonLabel: "允许",
    defaultPath: filePath,
    properties: ["openFile"],
    filters: [{ name: "PDF 文件", extensions: ["pdf"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return path.resolve(result.filePaths[0]) === path.resolve(filePath) ? result.filePaths[0] : null;
}

function externalPathsFromArguments(argv = []) {
  return argv
    .map((argument) => String(argument || "").replace(/^"(.*)"$/, "$1"))
    .filter((filePath) => acceptedExtensions.has(path.extname(filePath).toLowerCase()))
    .filter((filePath) => {
      try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
      } catch {
        return false;
      }
    })
    .map((filePath) => path.resolve(filePath));
}

function queueExternalPaths(filePaths) {
  const existing = new Set(pendingExternalPaths.map((filePath) => filePath.toLowerCase()));
  filePaths.forEach((filePath) => {
    const resolved = path.resolve(filePath);
    const key = resolved.toLowerCase();
    if (!acceptedExtensions.has(path.extname(resolved).toLowerCase()) || existing.has(key)) return;
    existing.add(key);
    pendingExternalPaths.push(resolved);
  });
}

async function dispatchExternalPaths() {
  if (!rendererReady || !mainWindow || mainWindow.isDestroyed() || !pendingExternalPaths.length) return;
  const filePaths = pendingExternalPaths.splice(0);
  try {
    const entries = await Promise.all(filePaths.map((filePath) => entryForPath(filePath)));
    mainWindow.webContents.send("pdf-studio:open-paths", entries);
  } catch (error) {
    dialog.showErrorBox("无法打开文件", error.message || "文件读取失败，请确认文件仍然存在。");
  }
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function printPreferencesPath() {
  return path.join(app.getPath("userData"), "print-preferences.json");
}

async function readPrintPreferences() {
  try {
    const raw = await fsp.readFile(printPreferencesPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function savePrintPreferences(settings = {}) {
  const allowed = {
    printerName: settings.printerName || "",
    paper: settings.paper || "default",
    orientation: settings.orientation || "auto",
    color: settings.color || "color",
    duplex: settings.duplex || "simplex",
    scaleMode: settings.scaleMode || "fit",
    scalePercent: Number(settings.scalePercent) || 100,
    marginMode: settings.marginMode || "default",
    margins: sanitizeMargins(settings.margins),
    pagesPerSheet: Number(settings.pagesPerSheet) || 1,
    printBackground: settings.printBackground !== false,
    dpi: settings.dpi || "default",
  };
  await fsp.mkdir(path.dirname(printPreferencesPath()), { recursive: true });
  await fsp.writeFile(printPreferencesPath(), JSON.stringify(allowed, null, 2));
  return allowed;
}

function sanitizeMargins(margins = {}) {
  return {
    top: clampNumber(margins.top, 0, 100, 10),
    right: clampNumber(margins.right, 0, 100, 10),
    bottom: clampNumber(margins.bottom, 0, 100, 10),
    left: clampNumber(margins.left, 0, 100, 10),
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizePrinter(printer) {
  const options = printer.options || {};
  return {
    name: printer.name,
    displayName: printer.displayName || printer.name,
    description: printer.description || "",
    status: printer.status || 0,
    isDefault: Boolean(printer.isDefault),
    duplexSupported: Boolean(options["printer-is-accepting-jobs"] !== "false" && options.Duplex),
    colorSupported: options["print-color-mode-supported"] || options["ColorModel"] || "",
    options,
  };
}

async function getPrintInfo() {
  if (!mainWindow || mainWindow.isDestroyed()) return { printers: [], preferences: {} };
  const printers = (await mainWindow.webContents.getPrintersAsync()).map(normalizePrinter);
  const preferences = await readPrintPreferences();
  if (preferences.printerName && !printers.some((printer) => printer.name === preferences.printerName)) {
    preferences.printerName = printers.find((printer) => printer.isDefault)?.name || printers[0]?.name || "";
  }
  return { printers, preferences };
}

async function writeTempPrintPdf(data) {
  const bytes = Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data));
  const dir = await fsp.mkdtemp(path.join(app.getPath("temp"), "pdf-studio-print-"));
  const filePath = path.join(dir, "print-document.pdf");
  await fsp.writeFile(filePath, bytes);
  printTempFiles.add(filePath);
  return filePath;
}

async function cleanupPrintFile(filePath) {
  if (!filePath) return;
  printTempFiles.delete(filePath);
  try {
    await fsp.rm(path.dirname(filePath), { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; temp folders are not part of user documents.
  }
}

async function cleanupAllPrintFiles() {
  await Promise.all([...printTempFiles].map((filePath) => cleanupPrintFile(filePath)));
}

function waitForWebContentsLoad(webContents) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("打印文档载入超时。")), 30000);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    webContents.once("did-finish-load", done);
    webContents.once("did-fail-load", (_event, _code, description) => {
      clearTimeout(timer);
      reject(new Error(description || "打印文档载入失败。"));
    });
  });
}

async function createPrintWindow(pdfPath) {
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  activePrintWindow = win;
  const loaded = waitForWebContentsLoad(win.webContents);
  await win.loadURL(pathToFileURL(pdfPath).href);
  await loaded;
  return win;
}

function destroyPrintWindow(win) {
  if (!win || win.isDestroyed()) return;
  if (activePrintWindow === win) activePrintWindow = null;
  win.destroy();
}

function buildElectronPrintOptions(settings = {}, { silent = true } = {}) {
  const copies = Math.round(clampNumber(settings.copies, 1, 999, 1));
  const pagesPerSheet = Math.round(clampNumber(settings.pagesPerSheet, 1, 16, 1));
  const scalePercent = clampNumber(settings.scalePercent, 10, 400, 100);
  const options = {
    silent,
    printBackground: settings.printBackground !== false,
    color: settings.color !== "gray",
    copies,
    collate: Boolean(settings.collate),
    pagesPerSheet,
  };

  if (settings.printerName && silent) options.deviceName = settings.printerName;
  if (settings.orientation === "landscape") options.landscape = true;
  if (settings.orientation === "portrait") options.landscape = false;
  if (settings.paper && settings.paper !== "default") options.pageSize = settings.paper;
  if (settings.duplex && settings.duplex !== "simplex") options.duplexMode = settings.duplex;
  if (settings.scaleMode === "custom") options.scaleFactor = scalePercent;
  if (settings.dpi && settings.dpi !== "default") {
    const dpi = Math.round(clampNumber(settings.dpi, 72, 2400, 300));
    options.dpi = { horizontal: dpi, vertical: dpi };
  }

  if (settings.marginMode === "none") {
    options.margins = { marginType: "none" };
  } else if (settings.marginMode === "printable") {
    options.margins = { marginType: "printableArea" };
  } else if (settings.marginMode === "custom") {
    const margins = sanitizeMargins(settings.margins);
    options.margins = {
      marginType: "custom",
      top: Math.round(margins.top * 1000),
      right: Math.round(margins.right * 1000),
      bottom: Math.round(margins.bottom * 1000),
      left: Math.round(margins.left * 1000),
    };
  } else {
    options.margins = { marginType: "default" };
  }
  return options;
}

function buildElectronPreviewOptions(settings = {}) {
  const options = {
    printBackground: settings.printBackground !== false,
    pagesPerSheet: Math.round(clampNumber(settings.pagesPerSheet, 1, 16, 1)),
  };
  if (settings.orientation === "landscape") options.landscape = true;
  if (settings.orientation === "portrait") options.landscape = false;
  if (settings.paper && settings.paper !== "default") options.pageSize = settings.paper;
  if (settings.scaleMode === "custom") options.scaleFactor = clampNumber(settings.scalePercent, 10, 400, 100);
  if (settings.marginMode === "none") {
    options.margins = { marginType: "none" };
  } else if (settings.marginMode === "printable") {
    options.margins = { marginType: "printableArea" };
  } else if (settings.marginMode === "custom") {
    const margins = sanitizeMargins(settings.margins);
    options.margins = {
      marginType: "custom",
      top: Math.round(margins.top * 1000),
      right: Math.round(margins.right * 1000),
      bottom: Math.round(margins.bottom * 1000),
      left: Math.round(margins.left * 1000),
    };
  } else {
    options.margins = { marginType: "default" };
  }
  return options;
}

function readablePrintError(error) {
  const message = error?.message || String(error || "");
  if (/timeout|超时/i.test(message)) return "打印文档载入超时，请稍后重试。";
  if (/invalid|settings|option/i.test(message)) return "打印设置无效，请检查纸张、页边距或缩放。";
  if (/printer|device/i.test(message)) return "打印机不可用，请刷新打印机后重试。";
  return message || "打印任务失败。";
}

function registerIpcHandlers() {
  ipcMain.handle("pdf-studio:open-files", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "打开 PDF 或图片",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "PDF 和图片", extensions: ["pdf", "png", "jpg", "jpeg"] },
        { name: "PDF 文件", extensions: ["pdf"] },
        { name: "图片", extensions: ["png", "jpg", "jpeg"] },
      ],
    });
    if (result.canceled) return { cancelled: true, entries: [] };
    return { cancelled: false, entries: await Promise.all(result.filePaths.map((filePath) => entryForPath(filePath))) };
  });

  ipcMain.handle("pdf-studio:register-path", async (_event, filePath) => {
    if (!filePath) return null;
    return registerPath(filePath);
  });

  ipcMain.handle("pdf-studio:request-source", async (_event, suggestedName) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "允许修改源文件",
      message: `请选择原来的“${suggestedName || "PDF 文件"}”。`,
      buttonLabel: "允许",
      properties: ["openFile"],
      filters: [{ name: "PDF 文件", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePaths[0]) return { cancelled: true };
    if (suggestedName && path.basename(result.filePaths[0]) !== suggestedName) {
      return { cancelled: true, message: `请选择原来的源文件“${suggestedName}”。` };
    }
    return { cancelled: false, entry: registerPath(result.filePaths[0]) };
  });

  ipcMain.handle("pdf-studio:choose-save-path", async (_event, suggestedName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "保存文件",
      buttonLabel: "保存",
      defaultPath: suggestedName || "整理后的文档.pdf",
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    return { cancelled: false, entry: registerPath(result.filePath) };
  });

  ipcMain.handle("pdf-studio:save-file", async (_event, token, data) => {
    const filePath = fileTokens.get(token);
    if (!filePath) return { ok: false, message: "保存位置已失效，请重新选择文件。" };
    try {
      await writeSourceFile(filePath, data);
      return { ok: true };
    } catch (error) {
      const selectedPath = await requestOriginalFile(filePath);
      if (!selectedPath) return { ok: false, cancelled: true };
      try {
        await writeSourceFile(selectedPath, data);
        fileTokens.set(token, selectedPath);
        return { ok: true };
      } catch (retryError) {
        return { ok: false, message: `保存失败：${retryError.message || error.message}` };
      }
    }
  });

  ipcMain.handle("pdf-studio:runtime-info", () => ({
    platform: process.platform,
    packaged: app.isPackaged,
    portable: isPortableBuild(),
    runningFromDiskImage: isRunningFromMacDiskImage(),
    updateSupported: isUpdateSupported(),
    currentVersion: app.getVersion(),
  }));

  ipcMain.handle("pdf-studio:check-update", async () => {
    if (!isUpdateSupported()) {
      return publishUpdateState({
        status: "unsupported",
        portable: isPortableBuild(),
        message: isPortableBuild()
          ? "免安装版不会自动安装更新，请前往 GitHub Release 手动下载新版。"
          : isRunningFromMacDiskImage()
            ? "请先将 PDF大编辑拖入“应用程序”文件夹，再使用自动更新。"
            : "当前开发版不支持自动安装更新。",
      });
    }
    publishUpdateState({ status: "checking", percent: 0, message: "" });
    try {
      await autoUpdater.checkForUpdates();
      return updateState;
    } catch (error) {
      return publishUpdateState({ status: "error", message: readableUpdateError(error), detail: error?.message || "" });
    }
  });

  ipcMain.handle("pdf-studio:download-update", async () => {
    if (!isUpdateSupported()) return publishUpdateState({ status: "unsupported", portable: isPortableBuild() });
    try {
      publishUpdateState({ status: "downloading", percent: 0 });
      await autoUpdater.downloadUpdate();
      return updateState;
    } catch (error) {
      return publishUpdateState({ status: "error", message: readableUpdateError(error), detail: error?.message || "" });
    }
  });

  ipcMain.handle("pdf-studio:install-update", () => {
    if (!isUpdateSupported() || updateState.status !== "downloaded") {
      return { ok: false, message: "更新尚未下载完成。" };
    }
    closeApproved = true;
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { ok: true };
  });

  ipcMain.handle("pdf-studio:uninstall", async () => uninstallApplication());

  ipcMain.handle("pdf-studio:get-printers", async () => getPrintInfo());

  ipcMain.handle("pdf-studio:save-print-preferences", async (_event, settings) => {
    try {
      const preferences = await savePrintPreferences(settings || {});
      return { ok: true, preferences };
    } catch (error) {
      return { ok: false, message: "打印偏好保存失败。" };
    }
  });

  ipcMain.handle("pdf-studio:cancel-print", async () => {
    if (activePrintWindow && !activePrintWindow.isDestroyed()) {
      destroyPrintWindow(activePrintWindow);
    }
    await cleanupAllPrintFiles();
    return { ok: true };
  });

  ipcMain.handle("pdf-studio:print-preview", async (_event, pdfBytes, settings) => {
    let pdfPath;
    let win;
    try {
      pdfPath = await writeTempPrintPdf(pdfBytes);
      win = await createPrintWindow(pdfPath);
      const previewBytes = await win.webContents.printToPDF(buildElectronPreviewOptions(settings));
      return { ok: true, data: new Uint8Array(previewBytes) };
    } catch (error) {
      return { ok: false, message: readablePrintError(error) };
    } finally {
      destroyPrintWindow(win);
      await cleanupPrintFile(pdfPath);
    }
  });

  ipcMain.handle("pdf-studio:print-document", async (_event, pdfBytes, settings) => {
    let pdfPath;
    let win;
    try {
      const printers = (await getPrintInfo()).printers;
      if (!printers.some((printer) => printer.name === settings?.printerName)) {
        return { ok: false, message: "打印机不可用，请刷新打印机后重试。" };
      }
      pdfPath = await writeTempPrintPdf(pdfBytes);
      win = await createPrintWindow(pdfPath);
      await savePrintPreferences(settings || {});
      const result = await new Promise((resolve) => {
        win.webContents.print(buildElectronPrintOptions(settings, { silent: true }), (success, failureReason) => {
          resolve(success
            ? { ok: true, message: "打印任务已发送。" }
            : { ok: false, message: failureReason || "打印任务失败。" });
        });
      });
      return result;
    } catch (error) {
      return { ok: false, message: readablePrintError(error) };
    } finally {
      destroyPrintWindow(win);
      await cleanupPrintFile(pdfPath);
    }
  });

  ipcMain.handle("pdf-studio:advanced-print", async (_event, pdfBytes, settings) => {
    let pdfPath;
    let win;
    try {
      pdfPath = await writeTempPrintPdf(pdfBytes);
      win = await createPrintWindow(pdfPath);
      const result = await new Promise((resolve) => {
        win.webContents.print(buildElectronPrintOptions(settings, { silent: false }), (success, failureReason) => {
          resolve(success
            ? { ok: true, message: "打印任务已发送。" }
            : { ok: false, message: failureReason || "打印任务已取消或失败。" });
        });
      });
      return result;
    } catch (error) {
      return { ok: false, message: readablePrintError(error) };
    } finally {
      destroyPrintWindow(win);
      await cleanupPrintFile(pdfPath);
    }
  });
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function appleScriptString(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function runAndWait(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(Object.assign(new Error(`卸载程序退出，代码 ${code}。`), { exitCode: code }));
    });
  });
}

function delayedWindowsCleanup(targets, executableToDelete = "") {
  const commands = [
    "timeout /t 2 /nobreak >NUL",
    ...targets.map((target) => `rmdir /s /q "${target}" 2>NUL`),
  ];
  if (executableToDelete) commands.push(`del /f /q "${executableToDelete}" 2>NUL`);
  const child = spawn("cmd.exe", ["/d", "/s", "/c", commands.join(" & ")], {
    detached: true,
    windowsHide: true,
    stdio: "ignore",
  });
  child.unref();
}

async function uninstallApplication() {
  try {
    if (process.platform === "win32") {
      if (isPortableBuild()) {
        delayedWindowsCleanup([app.getPath("userData")], process.env.PORTABLE_EXECUTABLE_FILE);
      } else {
        const installDirectory = path.dirname(process.execPath);
        const uninstaller = fs.readdirSync(installDirectory)
          .find((name) => /^uninstall.*\.exe$/i.test(name));
        if (!uninstaller) return { ok: false, message: "找不到卸载程序，请在 Windows“设置 > 应用”中卸载。" };
        const uninstallerPath = path.join(installDirectory, uninstaller);
        const child = spawn("cmd.exe", ["/d", "/s", "/c", `timeout /t 2 /nobreak >NUL & start "" "${uninstallerPath}" /S`], {
          detached: true,
          windowsHide: true,
          stdio: "ignore",
        });
        child.unref();
      }
    } else if (process.platform === "darwin") {
      const appBundle = path.resolve(path.dirname(process.execPath), "../..");
      const scriptPath = path.join(app.getPath("temp"), `uninstall-pdf-studio-${crypto.randomUUID()}.sh`);
      const launchServices = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
      const homeLibrary = path.join(app.getPath("home"), "Library");
      const script = `#!/bin/sh
set -e
${shellQuote(launchServices)} -u ${shellQuote(appBundle)} >/dev/null 2>&1 || true
rm -rf ${shellQuote(appBundle)}
rm -rf ${shellQuote(app.getPath("userData"))}
rm -rf ${shellQuote(path.join(homeLibrary, "Caches", "com.pdfstudio.desktop"))}
rm -rf ${shellQuote(path.join(homeLibrary, "Saved Application State", "com.pdfstudio.desktop.savedState"))}
rm -f ${shellQuote(path.join(homeLibrary, "Preferences", "com.pdfstudio.desktop.plist"))}
${shellQuote(launchServices)} -kill -r -domain local -domain system -domain user >/dev/null 2>&1 || true
killall Finder >/dev/null 2>&1 || true
rm -f "$0"
`;
      await fsp.writeFile(scriptPath, script, { mode: 0o700 });
      try {
        fs.accessSync(path.dirname(appBundle), fs.constants.W_OK);
        await runAndWait("/bin/sh", [scriptPath]);
      } catch {
        const command = `/bin/sh ${shellQuote(scriptPath)}`;
        try {
          await runAndWait("/usr/bin/osascript", [
            "-e",
            `do shell script "${appleScriptString(command)}" with administrator privileges`,
          ]);
        } catch (error) {
          if (error?.exitCode === 1) throw new Error("用户取消了系统授权，软件没有卸载。");
          throw error;
        }
      }
    } else {
      return { ok: false, message: "当前系统暂不支持应用内卸载。" };
    }
    closeApproved = true;
    setTimeout(() => app.quit(), 180);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: `无法启动卸载：${error.message || "未知错误"}` };
  }
}

async function startLocalServer() {
  const indexPath = path.join(__dirname, "app", "index.html");
  const html = await fsp.readFile(indexPath);
  localServer = http.createServer((request, response) => {
    const requestPath = new URL(request.url, "http://127.0.0.1").pathname;
    if (requestPath !== "/" && requestPath !== "/index.html") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": html.length,
      "Cache-Control": "no-store",
    });
    response.end(html);
  });
  await new Promise((resolve, reject) => {
    localServer.once("error", reject);
    localServer.listen(0, "127.0.0.1", resolve);
  });
  return localServer.address().port;
}

async function createWindow() {
  const port = await startLocalServer();
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: "PDF大编辑",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.webContents.on("did-finish-load", () => {
    rendererReady = true;
    publishUpdateState(updateState);
    dispatchExternalPaths();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("close", async (event) => {
    if (closeApproved) return;
    event.preventDefault();
    if (closeCheckActive) return;
    closeCheckActive = true;
    try {
      const shouldClose = await mainWindow.webContents.executeJavaScript(
        "window.pdfStudioBeforeAppClose ? window.pdfStudioBeforeAppClose() : true",
        true,
      );
      if (shouldClose) {
        closeApproved = true;
        mainWindow.close();
      }
    } finally {
      closeCheckActive = false;
    }
  });
  mainWindow.on("closed", () => {
    rendererReady = false;
    mainWindow = null;
  });
  await mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  queueExternalPaths(externalPathsFromArguments(process.argv));

  app.on("second-instance", (_event, argv) => {
    queueExternalPaths(externalPathsFromArguments(argv));
    focusMainWindow();
    dispatchExternalPaths();
  });

  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    queueExternalPaths([filePath]);
    focusMainWindow();
    dispatchExternalPaths();
  });

  app.whenReady().then(async () => {
    configureAutoUpdater();
    registerIpcHandlers();
    await createWindow();
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    if (closeApproved && localServer) localServer.close();
    destroyPrintWindow(activePrintWindow);
    cleanupAllPrintFiles();
  });
}
