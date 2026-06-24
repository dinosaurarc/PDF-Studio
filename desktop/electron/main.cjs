const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { writeSourceFile } = require("./file-store.cjs");

const fileTokens = new Map();
const acceptedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const pendingExternalPaths = [];
let mainWindow;
let localServer;
let closeApproved = false;
let closeCheckActive = false;
let rendererReady = false;

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
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.webContents.on("did-finish-load", () => {
    rendererReady = true;
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
    registerIpcHandlers();
    await createWindow();
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    if (closeApproved && localServer) localServer.close();
  });
}
