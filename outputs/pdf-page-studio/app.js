import * as pdfjsLib from "./vendor/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";

const { PDFDocument, degrees } = PDFLib;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const EXPORT_QUALITY_PROFILES = {
  original: { pdfScale: 2.25, imageScale: 1, jpegQuality: 0.96, pngQuantize: 1, estimateRatio: 1 },
  high: { pdfScale: 1.8, imageScale: 0.82, jpegQuality: 0.9, pngQuantize: 4, estimateRatio: 0.58 },
  balanced: { pdfScale: 1.4, imageScale: 0.64, jpegQuality: 0.8, pngQuantize: 8, estimateRatio: 0.34 },
  compact: { pdfScale: 1.05, imageScale: 0.48, jpegQuality: 0.68, pngQuantize: 16, estimateRatio: 0.19 },
};

const state = {
  scale: "fit",
  mode: "continuous",
  draggingPageId: null,
  dragPreview: null,
  dropIndex: null,
  documents: [],
  activeDocId: null,
  selectedAnnotationId: null,
  textPlacementMode: false,
  selectionMode: false,
  drawingMode: false,
  brush: { color: "#202124", lineWidth: 3, dash: "solid" },
  lineMode: false,
  lineBrush: { color: "#202124", lineWidth: 3, dash: "solid" },
  exportScope: "all",
  update: { status: "idle", currentVersion: "", version: "", portable: false, supported: false },
  thumbRailCollapsed: false,
  sidePanelCollapsed: false,
  sidePanelWasNarrow: window.innerWidth < 1120,
  navigatorDragging: false,
  navigatorPageId: null,
  zooming: false,
  zoomPageId: null,
  zoomCenter: null,
  search: { query: "", total: 0, pageIndexes: [] },
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  docTabs: document.querySelector("#docTabs"),
  openBtn: document.querySelector("#openBtn"),
  emptyOpenBtn: document.querySelector("#emptyOpenBtn"),
  addBtn: document.querySelector("#addBtn"),
  selectAllBtn: document.querySelector("#selectAllBtn"),
  savePdfBtn: document.querySelector("#savePdfBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  exportMenu: document.querySelector("#exportMenu"),
  exportAllMenuBtn: document.querySelector("#exportAllMenuBtn"),
  exportSelectedMenuBtn: document.querySelector("#exportSelectedMenuBtn"),
  exportSelectedMenuLabel: document.querySelector("#exportSelectedMenuLabel"),
  printBtn: document.querySelector("#printBtn"),
  otherBtn: document.querySelector("#otherBtn"),
  otherMenu: document.querySelector("#otherMenu"),
  menuSearchBtn: document.querySelector("#menuSearchBtn"),
  menuPrintBtn: document.querySelector("#menuPrintBtn"),
  menuZoomOutBtn: document.querySelector("#menuZoomOutBtn"),
  menuZoomInBtn: document.querySelector("#menuZoomInBtn"),
  menuFitBtn: document.querySelector("#menuFitBtn"),
  menuContinuousBtn: document.querySelector("#menuContinuousBtn"),
  menuSingleBtn: document.querySelector("#menuSingleBtn"),
  menuOverviewBtn: document.querySelector("#menuOverviewBtn"),
  checkUpdateBtn: document.querySelector("#checkUpdateBtn"),
  uninstallBtn: document.querySelector("#uninstallBtn"),
  searchInput: document.querySelector("#searchInput"),
  searchBtn: document.querySelector("#searchBtn"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  zoomSlider: document.querySelector("#zoomSlider"),
  zoomValue: document.querySelector("#zoomValue"),
  resetZoomBtn: document.querySelector("#resetZoomBtn"),
  pageNumber: document.querySelector("#pageNumber"),
  pageTotal: document.querySelector("#pageTotal"),
  continuousBtn: document.querySelector("#continuousBtn"),
  singleBtn: document.querySelector("#singleBtn"),
  overviewBtn: document.querySelector("#overviewBtn"),
  appShell: document.querySelector(".app-shell"),
  thumbRailToggle: document.querySelector("#thumbRailToggle"),
  sidePanelToggle: document.querySelector("#sidePanelToggle"),
  dropZone: document.querySelector("#dropZone"),
  viewer: document.querySelector("#viewer"),
  pageNavigator: document.querySelector("#pageNavigator"),
  navigatorCanvas: document.querySelector("#navigatorCanvas"),
  navigatorViewport: document.querySelector("#navigatorViewport"),
  thumbList: document.querySelector("#thumbList"),
  rotateLeftBtn: document.querySelector("#rotateLeftBtn"),
  rotateRightBtn: document.querySelector("#rotateRightBtn"),
  deleteBtn: document.querySelector("#deleteBtn"),
  duplicateBtn: document.querySelector("#duplicateBtn"),
  selectToolBtn: document.querySelector("#selectToolBtn"),
  addTextBtn: document.querySelector("#addTextBtn"),
  addRectBtn: document.querySelector("#addRectBtn"),
  addCircleBtn: document.querySelector("#addCircleBtn"),
  drawBtn: document.querySelector("#drawBtn"),
  lineBtn: document.querySelector("#lineBtn"),
  deleteAnnotationBtn: document.querySelector("#deleteAnnotationBtn"),
  textEditor: document.querySelector("#textEditor"),
  shapeEditor: document.querySelector("#shapeEditor"),
  drawingEditor: document.querySelector("#drawingEditor"),
  lineEditor: document.querySelector("#lineEditor"),
  fontFamilySelect: document.querySelector("#fontFamilySelect"),
  loadLocalFontsBtn: document.querySelector("#loadLocalFontsBtn"),
  fontSizeInput: document.querySelector("#fontSizeInput"),
  textColorInput: document.querySelector("#textColorInput"),
  boldBtn: document.querySelector("#boldBtn"),
  italicBtn: document.querySelector("#italicBtn"),
  underlineBtn: document.querySelector("#underlineBtn"),
  alignmentButtons: [...document.querySelectorAll(".alignment-row button")],
  shapeFillInput: document.querySelector("#shapeFillInput"),
  shapeBorderInput: document.querySelector("#shapeBorderInput"),
  shapeFillEnabled: document.querySelector("#shapeFillEnabled"),
  shapeBorderWidthInput: document.querySelector("#shapeBorderWidthInput"),
  drawColorInput: document.querySelector("#drawColorInput"),
  drawWidthInput: document.querySelector("#drawWidthInput"),
  lineColorInput: document.querySelector("#lineColorInput"),
  lineWidthInput: document.querySelector("#lineWidthInput"),
  lineDashButtons: [...document.querySelectorAll(".line-dash-btn")],
  metaPages: document.querySelector("#metaPages"),
  metaFiles: document.querySelector("#metaFiles"),
  metaCurrent: document.querySelector("#metaCurrent"),
  closeDialog: document.querySelector("#closeDialog"),
  closeDialogMessage: document.querySelector("#closeDialogMessage"),
  closeSaveBtn: document.querySelector("#closeSaveBtn"),
  closeDiscardBtn: document.querySelector("#closeDiscardBtn"),
  closeCancelBtn: document.querySelector("#closeCancelBtn"),
  exportDialog: document.querySelector("#exportDialog"),
  exportRangeSummary: document.querySelector("#exportRangeSummary"),
  exportQualityGroup: document.querySelector("#exportQualityGroup"),
  wordModeGroup: document.querySelector("#wordModeGroup"),
  exportDialogNote: document.querySelector("#exportDialogNote"),
  qualityEstimateOriginal: document.querySelector("#qualityEstimateOriginal"),
  qualityEstimateHigh: document.querySelector("#qualityEstimateHigh"),
  qualityEstimateBalanced: document.querySelector("#qualityEstimateBalanced"),
  qualityEstimateCompact: document.querySelector("#qualityEstimateCompact"),
  exportConfirmBtn: document.querySelector("#exportConfirmBtn"),
  exportCancelBtn: document.querySelector("#exportCancelBtn"),
  updateDialog: document.querySelector("#updateDialog"),
  updateDialogMessage: document.querySelector("#updateDialogMessage"),
  updateVersion: document.querySelector("#updateVersion"),
  updateProgressWrap: document.querySelector("#updateProgressWrap"),
  updateProgress: document.querySelector("#updateProgress"),
  updateProgressText: document.querySelector("#updateProgressText"),
  updateCloseBtn: document.querySelector("#updateCloseBtn"),
  updateActionBtn: document.querySelector("#updateActionBtn"),
  uninstallDialog: document.querySelector("#uninstallDialog"),
  uninstallCancelBtn: document.querySelector("#uninstallCancelBtn"),
  uninstallConfirmBtn: document.querySelector("#uninstallConfirmBtn"),
  printDialog: document.querySelector("#printDialog"),
  printPreviewFrame: document.querySelector("#printPreviewFrame"),
  printPageSummary: document.querySelector("#printPageSummary"),
  printCancelBtn: document.querySelector("#printCancelBtn"),
  printConfirmBtn: document.querySelector("#printConfirmBtn"),
  loadingBar: document.querySelector("#loadingBar"),
  loadingText: document.querySelector("#loadingText"),
  loadingPercent: document.querySelector("#loadingPercent"),
  loadingProgress: document.querySelector("#loadingProgress"),
  searchStatus: document.querySelector("#searchStatus"),
  dragPositionTip: document.querySelector("#dragPositionTip"),
  toast: document.querySelector("#toast"),
};

let toastTimer;
let loadingHideTimer;
let sidePanelRenderTimer;
let zoomRenderTimer;
let zoomLiveFrame;
let zoomCommitToken = 0;
let gestureStartScale = null;
let navigatorUpdateFrame;
let exportEstimateToken = 0;
let renderToken = 0;
let pendingCloseChoice = null;
let printPreviewUrl = null;
const fileHandles = new WeakMap();
const nativeOpenKeys = new Set();
const localFontSources = new Map();
const loadedLocalFonts = new Set();
let fileInputMode = "open";

lucide.createIcons();
createDocument("未命名文档");
bindEvents();
syncSidePanelForViewport(true);
updateUi();
maybeLoadDemo();
enableOfflineWebApp();
configureDesktopFeatures();

function enableOfflineWebApp() {
  if (location.protocol !== "https:" || !("serviceWorker" in navigator)) return;
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "./manifest.webmanifest";
  document.head.appendChild(manifest);

  const theme = document.createElement("meta");
  theme.name = "theme-color";
  theme.content = "#f7f7f8";
  document.head.appendChild(theme);

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("离线缓存启用失败", error);
    });
  }, { once: true });
}

async function configureDesktopFeatures() {
  if (!window.pdfStudioGetRuntimeInfo) {
    document.body.classList.add("no-desktop-actions");
    return;
  }
  try {
    const info = await window.pdfStudioGetRuntimeInfo();
    state.update = { ...state.update, ...(info || {}), supported: Boolean(info?.updateSupported) };
    els.checkUpdateBtn.classList.remove("hidden");
    els.uninstallBtn.classList.remove("hidden");
    if (info?.portable) els.checkUpdateBtn.textContent = "检查更新（免安装版）";
    window.pdfStudioOnUpdateState?.(applyUpdateState);
  } catch (error) {
    console.warn("无法读取桌面版信息", error);
  }
}

function toggleOtherMenu() {
  const opening = els.otherMenu.classList.contains("hidden");
  els.otherMenu.classList.toggle("hidden", !opening);
  els.otherBtn.setAttribute("aria-expanded", String(opening));
  if (opening) closeExportMenu();
}

function closeOtherMenu() {
  els.otherMenu.classList.add("hidden");
  els.otherBtn.setAttribute("aria-expanded", "false");
}

function openCompactSearch() {
  closeOtherMenu();
  const searchBox = els.searchInput.closest(".search-box");
  searchBox.classList.add("compact-open");
  els.searchInput.focus();
}

function adjustZoomFromMenu(delta) {
  closeOtherMenu();
  if (!currentPage() || state.mode === "overview") return;
  els.zoomSlider.value = String(clamp(
    Number(els.zoomSlider.value) + delta,
    Number(els.zoomSlider.min),
    Number(els.zoomSlider.max),
  ));
  handleZoomSliderInput();
}

function setModeFromMenu(mode) {
  closeOtherMenu();
  setMode(mode);
}

async function checkForUpdates() {
  closeOtherMenu();
  openUpdateDialog();
  if (!window.pdfStudioCheckForUpdates) {
    applyUpdateState({ status: "unsupported", message: "网页版不需要安装更新，刷新网页即可使用最新版本。" });
    return;
  }
  applyUpdateState({
    status: "checking",
    currentVersion: state.update.currentVersion,
    message: state.update.portable ? "免安装版不会自动安装更新，正在检查是否有新版本…" : "正在检查更新…",
  });
  try {
    const result = await window.pdfStudioCheckForUpdates();
    if (result) applyUpdateState(result);
  } catch (error) {
    applyUpdateState({ status: "error", message: friendlyUpdateError(error) });
  }
}

function openUpdateDialog() {
  els.updateDialog.classList.remove("hidden");
  els.updateCloseBtn.focus();
}

function closeUpdateDialog() {
  els.updateDialog.classList.add("hidden");
}

function applyUpdateState(nextState = {}) {
  state.update = { ...state.update, ...nextState };
  const { status, currentVersion, version, portable, message } = state.update;
  els.updateDialogMessage.textContent = message || updateStatusMessage(status, portable);
  els.updateVersion.classList.toggle("hidden", !currentVersion && !version);
  els.updateVersion.textContent = version
    ? `当前版本 ${currentVersion || "未知"} · 新版本 ${version}`
    : currentVersion ? `当前版本 ${currentVersion}` : "";
  const progress = clamp(Number(nextState.percent ?? state.update.percent ?? 0), 0, 100);
  const showProgress = status === "downloading";
  els.updateProgressWrap.classList.toggle("hidden", !showProgress);
  els.updateProgress.value = progress;
  els.updateProgressText.textContent = `${Math.round(progress)}%`;
  els.updateActionBtn.classList.toggle("hidden", !["available", "downloaded"].includes(status) || portable);
  els.updateActionBtn.disabled = false;
  els.updateActionBtn.textContent = status === "downloaded" ? "重启并安装" : "下载更新";
  if (!els.updateDialog.classList.contains("hidden")) return;
  if (["available", "downloaded", "error"].includes(status)) openUpdateDialog();
}

function updateStatusMessage(status, portable) {
  if (portable && status === "available") return "发现新版本。免安装版不会自动安装，请前往 GitHub Release 手动下载。";
  const messages = {
    checking: "正在检查更新…",
    current: "当前已是最新版本。",
    available: "发现新版本，可以立即下载。",
    downloading: "正在下载更新，请不要关闭软件。",
    downloaded: "更新已下载完成，重启软件即可安装。",
    unsupported: "当前版本不支持自动安装更新。",
    error: "检查更新失败，请稍后重试。",
  };
  return messages[status] || "请选择要执行的操作。";
}

async function handleUpdateAction() {
  els.updateActionBtn.disabled = true;
  try {
    if (state.update.status === "available") {
      applyUpdateState({ status: "downloading", percent: 0 });
      await window.pdfStudioDownloadUpdate?.();
      return;
    }
    if (state.update.status === "downloaded") {
      const canClose = await window.pdfStudioBeforeAppClose();
      if (!canClose) return;
      await window.pdfStudioInstallUpdate?.();
    }
  } catch (error) {
    applyUpdateState({ status: "error", message: friendlyUpdateError(error) });
  } finally {
    els.updateActionBtn.disabled = false;
  }
}

function friendlyUpdateError(error) {
  const text = error?.message || String(error || "");
  if (/network|internet|ENOTFOUND|ECONN|timed? ?out|ERR_/i.test(text)) {
    return "无法连接更新服务器，请检查网络后重试。";
  }
  if (/404|release|latest\.yml|latest-mac\.yml/i.test(text)) {
    return "暂时找不到可用的正式版本，请确认 GitHub Release 已发布完整更新文件。";
  }
  if (/signature|code sign|not signed/i.test(text)) {
    return "更新包签名验证失败，为保护你的文件，本次更新已停止。";
  }
  return "检查更新失败，请稍后重试。";
}

function openUninstallDialog() {
  closeOtherMenu();
  els.uninstallDialog.classList.remove("hidden");
  els.uninstallCancelBtn.focus();
}

function closeUninstallDialog() {
  els.uninstallDialog.classList.add("hidden");
}

async function confirmUninstall() {
  closeUninstallDialog();
  if (!window.pdfStudioUninstallApplication) {
    showToast("网页版无需卸载，关闭网页即可。");
    return;
  }
  const canClose = await window.pdfStudioBeforeAppClose();
  if (!canClose) return;
  showLoading("正在卸载 PDF大编辑…", 40);
  try {
    const result = await window.pdfStudioUninstallApplication();
    if (result?.cancelled) hideLoading();
    else if (result?.message) showToast(result.message);
  } catch (error) {
    hideLoading();
    showToast(error?.message || "无法启动卸载，请稍后重试。");
  }
}

function bindEvents() {
  els.openBtn.addEventListener("click", openFiles);
  els.emptyOpenBtn.addEventListener("click", openFiles);
  els.addBtn.addEventListener("click", () => {
    fileInputMode = "append";
    els.fileInput.value = "";
    els.fileInput.click();
  });
  els.selectAllBtn.addEventListener("click", () => selectAllPages(false));

  els.fileInput.addEventListener("change", async (event) => {
    try {
      const files = [...event.target.files];
      await attachNativeFileHandles(files);
      await addFiles(files, { newPdfTabs: fileInputMode === "open" });
    } catch (error) {
      reportFileOpenError(error);
    }
    fileInputMode = "open";
    els.fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((name) => {
    document.addEventListener(name, (event) => {
      event.preventDefault();
      if (!isPageDrag(event)) els.dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((name) => {
    document.addEventListener(name, (event) => {
      event.preventDefault();
      if (name === "drop" && !isPageDrag(event)) {
        const files = [...event.dataTransfer.files];
        attachNativeFileHandles(files)
          .then(() => addFiles(files, { newPdfTabs: false }))
          .catch(reportFileOpenError);
      }
      els.dropZone.classList.remove("drag-over");
    });
  });

  els.savePdfBtn.addEventListener("click", saveFullPdf);
  els.exportBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleExportMenu();
  });
  els.exportAllMenuBtn.addEventListener("click", () => openExportDialog("all"));
  els.exportSelectedMenuBtn.addEventListener("click", () => openExportDialog("selected"));
  els.printBtn.addEventListener("click", printFullPdf);
  els.otherBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleOtherMenu();
  });
  els.menuPrintBtn.addEventListener("click", () => {
    closeOtherMenu();
    printFullPdf();
  });
  els.menuSearchBtn.addEventListener("click", openCompactSearch);
  els.menuZoomOutBtn.addEventListener("click", () => adjustZoomFromMenu(-10));
  els.menuZoomInBtn.addEventListener("click", () => adjustZoomFromMenu(10));
  els.menuFitBtn.addEventListener("click", () => {
    closeOtherMenu();
    resetZoomToFit();
  });
  els.menuContinuousBtn.addEventListener("click", () => setModeFromMenu("continuous"));
  els.menuSingleBtn.addEventListener("click", () => setModeFromMenu("single"));
  els.menuOverviewBtn.addEventListener("click", () => setModeFromMenu("overview"));
  els.checkUpdateBtn.addEventListener("click", checkForUpdates);
  els.uninstallBtn.addEventListener("click", openUninstallDialog);
  els.updateCloseBtn.addEventListener("click", closeUpdateDialog);
  els.updateActionBtn.addEventListener("click", handleUpdateAction);
  els.uninstallCancelBtn.addEventListener("click", closeUninstallDialog);
  els.uninstallConfirmBtn.addEventListener("click", confirmUninstall);
  els.printCancelBtn.addEventListener("click", closePrintPreview);
  els.printConfirmBtn.addEventListener("click", printPreviewDocument);
  els.searchBtn.addEventListener("click", searchText);
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchText();
  });
  els.searchInput.addEventListener("input", () => {
    if (!els.searchInput.value.trim()) clearSearch();
  });
  els.closeSaveBtn.addEventListener("click", () => resolveCloseChoice("save"));
  els.closeDiscardBtn.addEventListener("click", () => resolveCloseChoice("discard"));
  els.closeCancelBtn.addEventListener("click", () => resolveCloseChoice("cancel"));
  els.closeDialog.addEventListener("click", (event) => {
    if (event.target === els.closeDialog) resolveCloseChoice("cancel");
  });
  els.rotateLeftBtn.addEventListener("click", () => rotateSelected(-90));
  els.rotateRightBtn.addEventListener("click", () => rotateSelected(90));
  els.deleteBtn.addEventListener("click", deleteSelected);
  els.duplicateBtn.addEventListener("click", duplicateSelected);
  els.exportConfirmBtn.addEventListener("click", confirmExport);
  els.exportCancelBtn.addEventListener("click", closeExportDialog);
  els.exportDialog.querySelectorAll('input[name="exportFormat"]').forEach((input) => {
    input.addEventListener("change", () => {
      syncExportFormatControls();
      updateExportSizeEstimates();
    });
  });
  els.exportDialog.addEventListener("click", (event) => {
    if (event.target === els.exportDialog) closeExportDialog();
  });
  els.prevBtn.addEventListener("click", () => selectPage(Math.max(0, activeDoc().selectedIndex - 1), true));
  els.nextBtn.addEventListener("click", () => selectPage(Math.min(activeDoc().pages.length - 1, activeDoc().selectedIndex + 1), true));
  els.zoomSlider.addEventListener("input", handleZoomSliderInput);
  els.zoomSlider.addEventListener("change", commitZoomRender);
  els.resetZoomBtn.addEventListener("click", resetZoomToFit);
  els.pageNumber.addEventListener("change", () => {
    const index = Number(els.pageNumber.value) - 1;
    selectPage(clamp(index, 0, activeDoc().pages.length - 1), true);
  });
  els.continuousBtn.addEventListener("click", () => setMode("continuous"));
  els.singleBtn.addEventListener("click", () => setMode("single"));
  els.overviewBtn.addEventListener("click", () => setMode("overview"));
  els.thumbRailToggle.addEventListener("click", toggleThumbRail);
  els.sidePanelToggle.addEventListener("click", toggleSidePanel);
  els.addTextBtn.addEventListener("click", toggleTextPlacementMode);
  els.addRectBtn.addEventListener("click", () => addAnnotation("rect"));
  els.addCircleBtn.addEventListener("click", () => addAnnotation("circle"));
  els.drawBtn.addEventListener("click", toggleDrawingMode);
  els.lineBtn.addEventListener("click", toggleLineMode);
  els.selectToolBtn.addEventListener("click", toggleSelectionMode);
  els.deleteAnnotationBtn.addEventListener("click", deleteSelectedAnnotation);
  els.loadLocalFontsBtn.addEventListener("click", loadLocalFonts);
  bindAnnotationControls();
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".export-menu-wrap")) closeExportMenu();
    if (!event.target.closest(".other-menu-wrap")) closeOtherMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.exportMenu.classList.contains("hidden")) {
      event.preventDefault();
      closeExportMenu();
      return;
    }
    if (event.key === "Escape" && !els.exportDialog.classList.contains("hidden")) {
      event.preventDefault();
      closeExportDialog();
      return;
    }
    if (event.key === "Escape" && !els.otherMenu.classList.contains("hidden")) {
      event.preventDefault();
      closeOtherMenu();
      return;
    }
    if (event.key === "Escape" && !els.updateDialog.classList.contains("hidden")) {
      event.preventDefault();
      closeUpdateDialog();
      return;
    }
    if (event.key === "Escape" && !els.uninstallDialog.classList.contains("hidden")) {
      event.preventDefault();
      closeUninstallDialog();
      return;
    }
    if (event.key === "Escape" && !els.printDialog.classList.contains("hidden")) {
      event.preventDefault();
      closePrintPreview();
      return;
    }
    if (pendingCloseChoice && event.key === "Escape") {
      event.preventDefault();
      resolveCloseChoice("cancel");
      return;
    }
    if (event.key === "Escape" && (state.textPlacementMode || state.selectionMode || state.drawingMode || state.lineMode) && !isTypingTarget(event.target)) {
      event.preventDefault();
      setEditingMode(null);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoLast();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a" && !isTypingTarget(event.target)) {
      event.preventDefault();
      selectAllPages(true);
      return;
    }
    if (isDeleteKey(event) && !isTypingTarget(event.target)) {
      event.preventDefault();
      if (selectedAnnotation()) deleteSelectedAnnotation();
      else deleteSelected();
    }
  }, true);

  window.addEventListener("beforeunload", (event) => {
    if (!state.documents.some((doc) => doc.dirty)) return;
    event.preventDefault();
    event.returnValue = "";
  });

  bindReorderContainer(els.thumbList);
  bindReorderContainer(els.viewer);
  bindPageNavigator();

  els.viewer.addEventListener("scroll", throttle(syncCurrentFromScroll, 70), { passive: true });
  els.viewer.addEventListener("scroll", schedulePageNavigatorUpdate, { passive: true });
  els.viewer.addEventListener("wheel", handleViewerPinchZoom, { passive: false });
  els.viewer.addEventListener("gesturestart", handleGestureStart, { passive: false });
  els.viewer.addEventListener("gesturechange", handleGestureChange, { passive: false });
  els.viewer.addEventListener("gestureend", handleGestureEnd, { passive: false });
  window.addEventListener("resize", debounce(() => {
    const panelChanged = syncSidePanelForViewport();
    if (state.scale === "fit" && !panelChanged) renderAll({ keepScroll: true });
    schedulePageNavigatorUpdate();
  }, 160));
}

function createDocument(title, options = {}) {
  const doc = {
    id: makeId(),
    title,
    pages: [],
    selectedIndex: -1,
    selectedPageIds: [],
    selectionAnchorIndex: -1,
    sourceCount: 0,
    fileHandle: options.fileHandle || null,
    sourceFileExpected: Boolean(options.sourceFileExpected),
    sourceFileName: options.sourceFileName || title,
    undoStack: [],
    dirty: false,
  };
  state.documents.push(doc);
  state.activeDocId = doc.id;
  return doc;
}

function activeDoc() {
  if (!state.documents.length) return createDocument("未命名文档");
  return state.documents.find((doc) => doc.id === state.activeDocId) || state.documents[0];
}

function switchDocument(id) {
  state.activeDocId = id;
  state.selectedAnnotationId = null;
  els.searchInput.value = "";
  clearSearch();
  renderAll();
}

async function attachNativeFileHandles(files) {
  if (!window.pdfStudioClaimOpenFileHandles || !files.length) return;
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const handles = await window.pdfStudioClaimOpenFileHandles(files);
      let claimed = 0;
      files.forEach((file, index) => {
        if (handles[index]) {
          fileHandles.set(file, handles[index]);
          claimed += 1;
        }
      });
      if (claimed || attempt === 4) return;
      await wait(80);
    }
  } catch (error) {
    console.warn("无法取得源文件写入权限", error);
  }
}

window.pdfStudioOpenNativeHandles = async (handles, options = {}) => {
  if (!handles?.length) return false;
  const files = [];
  const claimedKeys = [];
  try {
    for (const handle of handles) {
      const key = handle.__pdfStudioNativePath || handle.__pdfStudioNativeToken || handle.name;
      if (key && nativeOpenKeys.has(key)) continue;
      if (key) {
        nativeOpenKeys.add(key);
        claimedKeys.push(key);
      }
      const file = await handle.getFile();
      fileHandles.set(file, handle);
      files.push(file);
    }
    if (!files.length) return true;
    await addFiles(files, { newPdfTabs: options.newPdfTabs !== false });
    return true;
  } catch (error) {
    claimedKeys.forEach((key) => nativeOpenKeys.delete(key));
    throw error;
  }
};

window.pdfStudioReportNativeOpenError = (message) => {
  reportFileOpenError(new Error(message || "无法打开文件"));
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function closeDocument(id) {
  const index = state.documents.findIndex((doc) => doc.id === id);
  if (index < 0) return;
  const doc = state.documents[index];
  if (doc.dirty) {
    const choice = await askCloseDirty(doc);
    if (choice === "cancel") return;
    if (choice === "save") {
      const result = await saveDocument(doc);
      if (result === "cancelled" || result === "failed") return;
    }
  }
  releaseNativeOpenKey(doc.fileHandle);
  state.documents.splice(index, 1);
  if (!state.documents.length) createDocument("未命名文档");
  state.activeDocId = state.documents[Math.max(0, index - 1)]?.id || state.documents[0].id;
  state.selectedAnnotationId = null;
  renderAll();
}

function releaseNativeOpenKey(handle) {
  if (!handle) return;
  const key = handle.__pdfStudioNativePath || handle.__pdfStudioNativeToken || handle.name;
  if (key) nativeOpenKeys.delete(key);
}

window.pdfStudioBeforeAppClose = async () => {
  if (pendingCloseChoice) return false;
  const dirtyDocuments = state.documents.filter((doc) => doc.dirty);
  for (const doc of dirtyDocuments) {
    const choice = await askCloseDirty(doc);
    if (choice === "cancel") return false;
    if (choice === "save") {
      const result = await saveDocument(doc);
      if (result === "cancelled" || result === "failed") return false;
    }
  }
  return true;
};

function askCloseDirty(doc) {
  return new Promise((resolve) => {
    pendingCloseChoice = resolve;
    els.closeDialogMessage.textContent = `“${doc.title}”有未保存的改动。`;
    els.closeDialog.classList.remove("hidden");
    els.closeSaveBtn.focus();
  });
}

function resolveCloseChoice(choice) {
  if (!pendingCloseChoice) return;
  const resolve = pendingCloseChoice;
  pendingCloseChoice = null;
  els.closeDialog.classList.add("hidden");
  resolve(choice);
}

function renderTabs() {
  els.docTabs.innerHTML = "";
  state.documents.forEach((doc) => {
    const tab = document.createElement("button");
    tab.className = "doc-tab";
    tab.classList.toggle("active", doc.id === activeDoc().id);
    tab.dataset.id = doc.id;
    tab.classList.toggle("dirty", doc.dirty);
    tab.innerHTML = `<span>${escapeHtml(shortName(doc.title, 22))}${doc.dirty ? " •" : ""}</span><b title="关闭">×</b>`;
    tab.addEventListener("click", (event) => {
      if (event.target.tagName === "B") {
        closeDocument(doc.id);
      } else {
        switchDocument(doc.id);
      }
    });
    els.docTabs.appendChild(tab);
  });
}

function recordUndo(label) {
  const doc = activeDoc();
  doc.undoStack.push({
    label,
    pages: doc.pages.map(clonePage),
    selectedIndex: doc.selectedIndex,
    selectedPageIds: [...doc.selectedPageIds],
    selectionAnchorIndex: doc.selectionAnchorIndex,
    sourceCount: doc.sourceCount,
    title: doc.title,
    sourceFileName: doc.sourceFileName,
    fileHandle: doc.fileHandle,
    sourceFileExpected: doc.sourceFileExpected,
    dirty: doc.dirty,
  });
  doc.dirty = true;
  if (doc.undoStack.length > 40) doc.undoStack.shift();
  renderTabs();
}

async function undoLast() {
  const doc = activeDoc();
  const snapshot = doc.undoStack.pop();
  if (!snapshot) return showToast("没有可撤销的操作。");
  doc.pages = snapshot.pages;
  doc.selectedIndex = snapshot.selectedIndex;
  doc.selectedPageIds = snapshot.selectedPageIds || [];
  doc.selectionAnchorIndex = snapshot.selectionAnchorIndex ?? doc.selectedIndex;
  doc.sourceCount = snapshot.sourceCount;
  doc.title = snapshot.title;
  doc.sourceFileName = snapshot.sourceFileName;
  doc.fileHandle = snapshot.fileHandle;
  doc.sourceFileExpected = snapshot.sourceFileExpected;
  doc.dirty = snapshot.dirty;
  state.selectedAnnotationId = null;
  showToast(`已撤销：${snapshot.label}`);
  await renderAll({ keepScroll: true });
}

async function openFiles() {
  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: "PDF 和图片",
            accept: {
              "application/pdf": [".pdf"],
              "image/png": [".png"],
              "image/jpeg": [".jpg", ".jpeg"],
            },
          },
        ],
      });
      const files = [];
      for (const handle of handles) {
        const file = await handle.getFile();
        fileHandles.set(file, handle);
        files.push(file);
      }
      await addFiles(files, { newPdfTabs: true });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  els.fileInput.value = "";
  fileInputMode = "open";
  els.fileInput.click();
}

async function addFiles(files, options = {}) {
  const accepted = files.filter((file) => isAcceptedFile(file));
  if (!accepted.length) {
    showToast("请选择 PDF、PNG 或 JPG 文件。");
    return;
  }
  showLoading("正在读取文件…", 2);
  try {
    const initialDoc = activeDoc();
    const firstFileIsPdf = accepted[0]?.type === "application/pdf" || /\.pdf$/i.test(accepted[0]?.name || "");
    const reusesPristineDocument = !options.newPdfTabs
      && firstFileIsPdf
      && initialDoc.pages.length === 0
      && initialDoc.title === "未命名文档"
      && state.documents.length === 1;
    let appendUndoRecorded = false;
    if (!options.newPdfTabs && !reusesPristineDocument) {
      recordUndo("加入文件");
      appendUndoRecorded = true;
    }

    for (let fileIndex = 0; fileIndex < accepted.length; fileIndex += 1) {
      if (!options.newPdfTabs && reusesPristineDocument && fileIndex > 0 && !appendUndoRecorded) {
        recordUndo("加入文件");
        appendUndoRecorded = true;
      }
      const file = accepted[fileIndex];
      updateLoading(`正在读取“${shortName(file.name, 28)}”`, 5 + (fileIndex / accepted.length) * 80);
      const bytes = await file.arrayBuffer();
      if (!bytes.byteLength) throw new Error(`“${file.name}”没有可读取的内容。`);
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const canReuseBlank = activeDoc().pages.length === 0 && activeDoc().title === "未命名文档" && state.documents.length === 1;
        const handle = fileHandles.get(file) || null;
        const previousDoc = activeDoc();
        const previousTitle = previousDoc.title;
        const previousSourceName = previousDoc.sourceFileName;
        const previousSourceExpected = previousDoc.sourceFileExpected;
        const doc = options.newPdfTabs && !canReuseBlank
          ? createDocument(file.name, { fileHandle: handle, sourceFileExpected: true, sourceFileName: file.name })
          : activeDoc();
        if (options.newPdfTabs || canReuseBlank) {
          doc.title = file.name;
          doc.sourceFileName = file.name;
          doc.sourceFileExpected = true;
        }
        if (options.newPdfTabs || canReuseBlank) doc.fileHandle = handle || doc.fileHandle;
        try {
          await addPdf(file, bytes, doc, (pageNumber, pageCount) => {
            const ratio = (fileIndex + pageNumber / pageCount) / accepted.length;
            updateLoading(`正在载入“${shortName(file.name, 24)}” 第 ${pageNumber} / ${pageCount} 页`, 5 + ratio * 80);
          });
        } catch (error) {
          if (doc.pages.length === 0 && doc !== previousDoc) {
            state.documents = state.documents.filter((item) => item.id !== doc.id);
            state.activeDocId = previousDoc.id;
          } else if (doc.pages.length === 0) {
            doc.title = previousTitle;
            doc.sourceFileName = previousSourceName;
            doc.sourceFileExpected = previousSourceExpected;
            doc.fileHandle = null;
          }
          renderTabs();
          throw new Error(`无法解析“${file.name}”：${error.message || "PDF 解析器没有返回页面"}`);
        }
      } else {
        if (options.newPdfTabs) recordUndo("加入图片");
        await addImage(file, bytes, activeDoc());
        updateLoading(`已载入“${shortName(file.name, 28)}”`, 5 + ((fileIndex + 1) / accepted.length) * 80);
      }
    }

    if (activeDoc().selectedIndex < 0 && activeDoc().pages.length) activeDoc().selectedIndex = 0;
    updateLoading("正在生成页面预览…", 90);
    await renderAll();
    showToast(`已加入 ${accepted.length} 个文件。`);
  } finally {
    hideLoading();
  }
}

async function addPdf(file, bytes, doc = activeDoc(), onProgress = () => {}) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  const pageCount = pdf.numPages;
  if (!pageCount) throw new Error("文件中没有页面");
  for (let i = 0; i < pageCount; i += 1) {
    const page = await pdf.getPage(i + 1);
    const viewport = page.getViewport({ scale: 1 });
    doc.pages.push({
      id: makeId(),
      type: "pdf",
      title: file.name,
      bytes,
      pdf,
      sourceIndex: i,
      width: viewport.width,
      height: viewport.height,
      rotation: 0,
      annotations: [],
    });
    onProgress(i + 1, pageCount);
  }
  doc.sourceCount += 1;
  if (doc.selectedIndex < 0 && doc.pages.length) doc.selectedIndex = 0;
}

function reportFileOpenError(error) {
  console.error(error);
  const message = error?.message || "文件读取失败，请确认文件没有损坏后重试。";
  showToast(message);
  const nativeHandler = window.webkit?.messageHandlers?.pdfStudio;
  if (nativeHandler) nativeHandler.postMessage({ action: "reportError", message }).catch(() => {});
}

async function addImage(file, bytes, doc = activeDoc()) {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: file.type }));
  doc.pages.push({
    id: makeId(),
    type: "image",
    title: file.name,
    bytes,
    mime: file.type || guessMime(file.name),
    width: bitmap.width,
    height: bitmap.height,
    rotation: 0,
    annotations: [],
  });
  doc.sourceCount += 1;
  if (doc.selectedIndex < 0 && doc.pages.length) doc.selectedIndex = 0;
  bitmap.close();
}

async function renderAll(options = {}) {
  const token = ++renderToken;
  const viewerScroll = options.keepScroll ? els.viewer.scrollTop : 0;
  const viewerScrollLeft = options.keepScroll ? els.viewer.scrollLeft : 0;
  const thumbScroll = options.keepScroll ? els.thumbList.scrollTop : 0;
  const viewerFragment = document.createDocumentFragment();
  const thumbFragment = document.createDocumentFragment();
  renderTabs();
  updateUi();
  els.viewer.classList.toggle("single-mode", state.mode === "single");
  els.viewer.classList.toggle("overview-mode", state.mode === "overview");

  for (let index = 0; index < activeDoc().pages.length; index += 1) {
    if (token !== renderToken) return;
    renderThumb(index, thumbFragment);
    await renderViewerPage(index, token, viewerFragment);
  }
  if (token !== renderToken) return;
  els.viewer.replaceChildren(viewerFragment);
  els.thumbList.replaceChildren(thumbFragment);
  if (options.keepScroll) {
    setScrollInstantly(els.viewer, viewerScroll, viewerScrollLeft);
    setScrollInstantly(els.thumbList, thumbScroll, 0);
  }
  updateUi();
  selectPage(clamp(activeDoc().selectedIndex, 0, activeDoc().pages.length - 1), false, "preserve");
}

function renderThumb(index, container = els.thumbList) {
  const page = activeDoc().pages[index];
  const item = document.createElement("div");
  item.className = "thumb-item";
  item.draggable = true;
  item.dataset.index = index;
  item.dataset.id = page.id;
  item.classList.toggle("selected", isPageSelected(page.id));
  item.classList.toggle("active", index === activeDoc().selectedIndex);
  item.innerHTML = `
    <div class="thumb-canvas-wrap"><canvas></canvas></div>
    <div class="thumb-label"><span>${index + 1}</span><span title="${escapeHtml(page.title)}">${escapeHtml(shortName(page.title))}</span></div>
  `;
  item.addEventListener("click", () => selectPage(Number(item.dataset.index), true, "replace"));
  item.addEventListener("dragstart", (event) => {
    state.draggingPageId = page.id;
    state.dragPreview = null;
    state.dropIndex = null;
    item.classList.add("dragging");
    event.dataTransfer.setData("text/plain", page.id);
    event.dataTransfer.effectAllowed = "move";
    setDragPreviewImage(event, item);
  });
  item.addEventListener("dragend", () => {
    item.classList.remove("dragging");
    state.draggingPageId = null;
    state.dragPreview = null;
    clearDropMarkers();
  });
  container.appendChild(item);
  renderPageToCanvas(page, item.querySelector("canvas"), 0.18, { includeAnnotations: true });
}

async function renderViewerPage(index, token, container = els.viewer) {
  const page = activeDoc().pages[index];
  const frame = document.createElement("div");
  frame.className = "page-frame";
  frame.draggable = state.mode === "overview";
  frame.dataset.index = index;
  frame.dataset.id = page.id;
  frame.classList.toggle("selected", isPageSelected(page.id));
  frame.innerHTML = `
    <span class="page-badge">${index + 1}</span>
    <div class="page-surface">
      <canvas></canvas>
      <div class="text-layer" aria-hidden="true"></div>
      <div class="annotation-layer" aria-label="页面编辑内容"></div>
    </div>
  `;
  frame.addEventListener("click", (event) => {
    const annotationTarget = event.target.closest(".annotation-item, .annotation-drawing");
    if (!annotationTarget) {
      state.selectedAnnotationId = null;
      updateAnnotationControls();
      refreshAnnotationSelection();
    }
    if (!annotationTarget) selectPage(Number(frame.dataset.index), false, selectionModeFromEvent(event));
  });
  frame.addEventListener("dblclick", () => {
    if (state.mode !== "overview") return;
    const currentIndex = Number(frame.dataset.index);
    activeDoc().selectedIndex = currentIndex;
    setMode("continuous", { focusIndex: currentIndex });
  });
  frame.addEventListener("dragstart", (event) => {
    if (state.mode === "single") return;
    state.draggingPageId = page.id;
    state.dropIndex = null;
    frame.classList.add("dragging");
    event.dataTransfer.setData("text/plain", page.id);
    event.dataTransfer.effectAllowed = "move";
    setDragPreviewImage(event, frame);
  });
  frame.addEventListener("dragend", () => {
    frame.classList.remove("dragging");
    state.draggingPageId = null;
    state.dragPreview = null;
    clearDropMarkers();
  });
  container.appendChild(frame);

  const canvas = frame.querySelector("canvas");
  const scale = getRenderScale(page);
  await renderPageToCanvas(page, canvas, scale, { includeAnnotations: state.mode === "overview" });
  frame.dataset.renderScale = String(scale);
  frame.dataset.renderWidth = String(parseFloat(canvas.style.width) || canvas.width);
  frame.dataset.renderHeight = String(parseFloat(canvas.style.height) || canvas.height);
  if (state.mode !== "overview") await renderTextLayer(page, frame.querySelector(".text-layer"), scale);
  if (state.mode !== "overview") renderAnnotationLayer(page, frame.querySelector(".annotation-layer"), scale);
  if (token !== renderToken) return;
}

async function renderPageToCanvas(page, canvas, scale, options = {}) {
  let width;
  let height;
  let ratio;
  if (page.type === "pdf") {
    const sourcePage = await page.pdf.getPage(page.sourceIndex + 1);
    const viewport = sourcePage.getViewport({ scale, rotation: normalizeRotation(sourcePage.rotate + page.rotation) });
    ratio = options.pixelRatio ?? (window.devicePixelRatio || 1);
    width = viewport.width;
    height = viewport.height;
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    await sourcePage.render({ canvasContext: ctx, viewport }).promise;
  } else {
    const bitmap = await createImageBitmap(new Blob([page.bytes], { type: page.mime }));
    ratio = options.pixelRatio ?? (window.devicePixelRatio || 1);
    const rotated = Math.abs(page.rotation % 180) === 90;
    width = (rotated ? page.height : page.width) * scale;
    height = (rotated ? page.width : page.height) * scale;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${Math.floor(width)}px`;
    canvas.style.height = `${Math.floor(height)}px`;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((page.rotation * Math.PI) / 180);
    ctx.drawImage(bitmap, -page.width * scale / 2, -page.height * scale / 2, page.width * scale, page.height * scale);
    ctx.restore();
    bitmap.close();
  }
  if (options.includeAnnotations && page.annotations?.length) {
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawAnnotations(ctx, page, width, height, scale);
  }
}

async function renderTextLayer(page, container, scale) {
  container.replaceChildren();
  if (page.type !== "pdf") return;
  try {
    const sourcePage = await page.pdf.getPage(page.sourceIndex + 1);
    const viewport = sourcePage.getViewport({ scale, rotation: normalizeRotation(sourcePage.rotate + page.rotation) });
    container.style.width = `${Math.floor(viewport.width)}px`;
    container.style.height = `${Math.floor(viewport.height)}px`;
    if (pdfjsLib.TextLayer) {
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: sourcePage.streamTextContent(),
        container,
        viewport,
      });
      await textLayer.render();
      highlightTextLayer(container, state.search.query);
      return;
    }
    const textContent = await sourcePage.getTextContent();
    pdfjsLib.renderTextLayer({ textContentSource: textContent, container, viewport });
    highlightTextLayer(container, state.search.query);
  } catch (error) {
    container.replaceChildren();
  }
}

function renderAnnotationLayer(page, container, scale) {
  container.replaceChildren();
  container.onpointerdown = null;
  container.classList.toggle("selection-mode", state.selectionMode);
  container.classList.toggle("text-placement-mode", state.textPlacementMode);
  const canDrawHere = (state.drawingMode || state.lineMode) && page === currentPage();
  container.classList.toggle("drawing-mode", canDrawHere);
  (page.annotations || []).forEach((annotation) => {
    if (annotation.type === "draw" || annotation.type === "line") {
      container.appendChild(createDrawingElement(annotation, scale));
      return;
    }
    const item = document.createElement("div");
    item.className = `annotation-item ${annotation.type === "text" ? "text-annotation" : "shape-annotation"}`;
    if (annotation.type === "circle") item.classList.add("circle-annotation");
    item.classList.toggle("selected", annotation.id === state.selectedAnnotationId);
    item.dataset.annotationId = annotation.id;
    item.style.left = `${annotation.x * 100}%`;
    item.style.top = `${annotation.y * 100}%`;
    item.style.width = `${annotation.width * 100}%`;
    item.style.height = `${annotation.height * 100}%`;
    item.classList.toggle("controls-below", annotation.y < 0.05);

    if (annotation.type === "text") {
      item.style.color = annotation.color;
      item.style.fontFamily = quoteFontFamily(annotation.fontFamily);
      item.style.fontSize = `${Math.max(6, annotation.fontSize * scale)}px`;
      item.style.fontWeight = annotation.bold ? "700" : "400";
      item.style.fontStyle = annotation.italic ? "italic" : "normal";
      item.style.textDecoration = annotation.underline ? "underline" : "none";
      const textContent = document.createElement("div");
      textContent.className = "annotation-text-content";
      textContent.setAttribute("contenteditable", state.selectionMode ? "false" : "plaintext-only");
      textContent.setAttribute("role", "textbox");
      textContent.setAttribute("aria-label", "页面文字");
      textContent.spellcheck = false;
      textContent.textContent = annotation.text;
      textContent.style.textAlign = annotation.align;
      textContent.style.justifyContent = annotation.align === "left" ? "flex-start" : annotation.align === "right" ? "flex-end" : "center";
      bindInlineTextEditing(textContent, annotation, page);
      item.appendChild(textContent);
    } else {
      item.style.background = annotation.fillEnabled ? annotation.fillColor : "transparent";
      item.style.borderColor = annotation.borderColor;
      item.style.borderWidth = `${Math.max(0, annotation.borderWidth * scale)}px`;
    }

    let moveHandle = null;
    if (annotation.type === "text") {
      moveHandle = document.createElement("span");
      moveHandle.className = "annotation-move-handle";
      moveHandle.title = "拖动文字位置";
      moveHandle.appendChild(lucide.createElement(lucide.icons.Move, { width: 14, height: 14, "stroke-width": 2 }));
      item.appendChild(moveHandle);
    }

    const resizeHandle = document.createElement("span");
    resizeHandle.className = "annotation-resize-handle";
    resizeHandle.title = "调整大小";
    item.appendChild(resizeHandle);
    bindAnnotationPointerEvents(item, annotation, container, resizeHandle, moveHandle);
    container.appendChild(item);
    if (annotation.type === "text") {
      requestAnimationFrame(() => autoExpandTextAnnotation(item.querySelector(".annotation-text-content"), annotation));
    }
  });
  if (state.textPlacementMode) bindTextPlacementLayer(page, container);
  else if (canDrawHere) bindDrawingLayer(page, container, scale);
}

function bindTextPlacementLayer(page, layer) {
  layer.onpointerdown = (event) => {
    if (!state.textPlacementMode || event.button !== 0 || event.target !== layer) return;
    event.preventDefault();
    event.stopPropagation();
    const pageIndex = activeDoc().pages.findIndex((candidate) => candidate.id === page.id);
    if (pageIndex < 0) return;
    selectPage(pageIndex, false, "replace");
    const rect = layer.getBoundingClientRect();
    const width = 0.38;
    const height = 0.085;
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1 - width);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1 - height);
    layer.addEventListener("click", (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
    }, { capture: true, once: true });
    placeTextAnnotation(page, x, y);
  };
}

function createDrawingElement(annotation, scale) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("annotation-drawing");
  svg.classList.toggle("selected", annotation.id === state.selectedAnnotationId);
  svg.dataset.annotationId = annotation.id;
  svg.setAttribute("viewBox", "0 0 1000 1000");
  svg.setAttribute("preserveAspectRatio", "none");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", annotation.type === "line" ? lineSvgPath(annotation.points) : drawingSvgPath(annotation.points));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", annotation.color);
  path.setAttribute("stroke-width", String(Math.max(0.5, annotation.lineWidth * scale)));
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  const dash = drawingDashPattern(annotation.dash, annotation.lineWidth * scale);
  if (dash.length) path.setAttribute("stroke-dasharray", dash.join(" "));
  svg.appendChild(path);
  svg.addEventListener("pointerdown", (event) => {
    if (state.drawingMode || state.lineMode) return;
    event.preventDefault();
    event.stopPropagation();
    const pageIndex = Number(svg.closest(".page-frame")?.dataset.index);
    if (Number.isInteger(pageIndex)) selectPage(pageIndex, false, "preserve");
    selectAnnotation(annotation.id);
    if (!state.selectionMode) return;
    const layer = svg.parentElement;
    const rect = layer.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originalPoints = annotation.points.map((point) => ({ ...point }));
    const minX = Math.min(...originalPoints.map((point) => point.x));
    const maxX = Math.max(...originalPoints.map((point) => point.x));
    const minY = Math.min(...originalPoints.map((point) => point.y));
    const maxY = Math.max(...originalPoints.map((point) => point.y));
    let changed = false;
    svg.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      let dx = (moveEvent.clientX - startX) / rect.width;
      let dy = (moveEvent.clientY - startY) / rect.height;
      if (!changed && Math.hypot(dx * rect.width, dy * rect.height) > 2) {
        recordUndo(annotation.type === "line" ? "移动直线" : "移动涂鸦");
        changed = true;
      }
      if (!changed) return;
      dx = clamp(dx, -minX, 1 - maxX);
      dy = clamp(dy, -minY, 1 - maxY);
      annotation.points = originalPoints.map((point) => ({ x: point.x + dx, y: point.y + dy }));
      path.setAttribute("d", annotation.type === "line" ? lineSvgPath(annotation.points) : drawingSvgPath(annotation.points));
    };
    const end = () => {
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", end);
      svg.removeEventListener("pointercancel", end);
    };
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  });
  return svg;
}

function drawingSvgPath(points = []) {
  if (!points.length) return "";
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x * 1000} ${point.y * 1000} l 0.01 0.01`;
  }
  let path = `M ${points[0].x * 1000} ${points[0].y * 1000}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    path += ` Q ${point.x * 1000} ${point.y * 1000} ${(point.x + next.x) * 500} ${(point.y + next.y) * 500}`;
  }
  const last = points[points.length - 1];
  return `${path} L ${last.x * 1000} ${last.y * 1000}`;
}

function lineSvgPath(points = []) {
  if (!points.length) return "";
  const start = points[0];
  const end = points[1] || start;
  return `M ${start.x * 1000} ${start.y * 1000} L ${end.x * 1000} ${end.y * 1000}`;
}

function drawingDashPattern(style, lineWidth) {
  const width = Math.max(1, lineWidth);
  if (style === "dense") return [width * 1.4, width * 1.5];
  if (style === "dashed") return [width * 4, width * 3];
  if (style === "sparse") return [width * 7, width * 5];
  return [];
}

function bindDrawingLayer(page, layer, scale) {
  layer.onpointerdown = (event) => {
    if ((!state.drawingMode && !state.lineMode) || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = layer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const isLine = state.lineMode;
    const brush = isLine ? state.lineBrush : state.brush;
    const startPoint = drawingPointFromEvent(event, rect);
    recordUndo(isLine ? "添加直线" : "添加涂鸦");
    const annotation = {
      id: makeId(),
      type: isLine ? "line" : "draw",
      points: isLine ? [startPoint, startPoint] : [startPoint],
      color: brush.color,
      lineWidth: brush.lineWidth,
      dash: isLine ? brush.dash : "solid",
    };
    page.annotations ||= [];
    page.annotations.push(annotation);
    state.selectedAnnotationId = annotation.id;
    const drawing = createDrawingElement(annotation, scale);
    layer.appendChild(drawing);
    const path = drawing.querySelector("path");
    let lastClientX = event.clientX;
    let lastClientY = event.clientY;
    layer.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      if (isLine) {
        annotation.points[1] = drawingPointFromEvent(moveEvent, rect);
        path.setAttribute("d", lineSvgPath(annotation.points));
        return;
      }
      if (Math.hypot(moveEvent.clientX - lastClientX, moveEvent.clientY - lastClientY) < 1.5) return;
      annotation.points.push(drawingPointFromEvent(moveEvent, rect));
      lastClientX = moveEvent.clientX;
      lastClientY = moveEvent.clientY;
      path.setAttribute("d", drawingSvgPath(annotation.points));
    };
    const end = () => {
      layer.removeEventListener("pointermove", move);
      layer.removeEventListener("pointerup", end);
      layer.removeEventListener("pointercancel", end);
      updateAnnotationControls();
    };
    layer.addEventListener("pointermove", move);
    layer.addEventListener("pointerup", end);
    layer.addEventListener("pointercancel", end);
  };
}

function drawingPointFromEvent(event, rect) {
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

function bindAnnotationPointerEvents(item, annotation, layer, resizeHandle, moveHandle) {
  item.addEventListener("pointerdown", (event) => {
    if (event.target === resizeHandle) return;
    const movingFromHandle = Boolean(moveHandle && event.target.closest(".annotation-move-handle"));
    if (event.target.closest(".annotation-text-content") && !state.selectionMode) return;
    event.preventDefault();
    event.stopPropagation();
    const pageIndex = Number(item.closest(".page-frame")?.dataset.index);
    if (Number.isInteger(pageIndex)) selectPage(pageIndex, false, "preserve");
    selectAnnotation(annotation.id);
    if (!state.selectionMode && !movingFromHandle) return;
    const rect = layer.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originalX = annotation.x;
    const originalY = annotation.y;
    let changed = false;
    item.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / rect.width;
      const dy = (moveEvent.clientY - startY) / rect.height;
      if (!changed && Math.hypot(dx * rect.width, dy * rect.height) > 2) {
        recordUndo("移动页面内容");
        changed = true;
      }
      if (!changed) return;
      annotation.x = clamp(originalX + dx, 0, 1 - annotation.width);
      annotation.y = clamp(originalY + dy, 0, 1 - annotation.height);
      item.style.left = `${annotation.x * 100}%`;
      item.style.top = `${annotation.y * 100}%`;
    };
    const end = () => {
      item.removeEventListener("pointermove", move);
      item.removeEventListener("pointerup", end);
      item.removeEventListener("pointercancel", end);
    };
    item.addEventListener("pointermove", move);
    item.addEventListener("pointerup", end);
    item.addEventListener("pointercancel", end);
  });

  resizeHandle.addEventListener("pointerdown", (event) => {
    if (!state.selectionMode && annotation.type !== "text") return;
    event.preventDefault();
    event.stopPropagation();
    selectAnnotation(annotation.id);
    const rect = layer.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originalWidth = annotation.width;
    const originalHeight = annotation.height;
    let changed = false;
    resizeHandle.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / rect.width;
      const dy = (moveEvent.clientY - startY) / rect.height;
      if (!changed && Math.hypot(dx * rect.width, dy * rect.height) > 2) {
        recordUndo("调整页面内容大小");
        changed = true;
      }
      if (!changed) return;
      annotation.width = clamp(originalWidth + dx, 0.04, 1 - annotation.x);
      annotation.height = annotation.type === "circle"
        ? clamp(annotation.width * rect.width / rect.height, 0.025, 1 - annotation.y)
        : clamp(originalHeight + dy, 0.025, 1 - annotation.y);
      item.style.width = `${annotation.width * 100}%`;
      item.style.height = `${annotation.height * 100}%`;
      if (annotation.type === "text") {
        autoExpandTextAnnotation(item.querySelector(".annotation-text-content"), annotation);
      }
    };
    const end = () => {
      resizeHandle.removeEventListener("pointermove", move);
      resizeHandle.removeEventListener("pointerup", end);
      resizeHandle.removeEventListener("pointercancel", end);
    };
    resizeHandle.addEventListener("pointermove", move);
    resizeHandle.addEventListener("pointerup", end);
    resizeHandle.addEventListener("pointercancel", end);
  });
}

function bindInlineTextEditing(editor, annotation, page) {
  let undoRecorded = false;
  const activate = (event) => {
    if (state.selectionMode) return;
    event.stopPropagation();
    const pageIndex = activeDoc().pages.findIndex((candidate) => candidate.id === page.id);
    if (pageIndex >= 0) selectPage(pageIndex, false, "preserve");
    selectAnnotation(annotation.id);
  };
  editor.addEventListener("pointerdown", activate);
  editor.addEventListener("focus", () => {
    const pageIndex = activeDoc().pages.findIndex((candidate) => candidate.id === page.id);
    if (pageIndex >= 0) selectPage(pageIndex, false, "preserve");
    selectAnnotation(annotation.id);
  });
  editor.addEventListener("beforeinput", () => {
    if (undoRecorded) return;
    recordUndo("修改文字");
    undoRecorded = true;
  });
  editor.addEventListener("input", () => {
    annotation.text = editor.innerText.replace(/\n$/, "");
    autoExpandTextAnnotation(editor, annotation);
  });
  editor.addEventListener("blur", () => {
    annotation.text = editor.innerText.replace(/\n$/, "");
    undoRecorded = false;
  });
  editor.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    editor.blur();
  });
}

function autoExpandTextAnnotation(editor, annotation) {
  const item = editor?.closest(".text-annotation");
  const layer = item?.closest(".annotation-layer");
  if (!editor || !item || !layer || !layer.clientHeight) return;
  const style = getComputedStyle(item);
  const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const requiredHeight = Math.ceil(editor.scrollHeight + padding);
  if (requiredHeight <= item.offsetHeight + 1) return;
  const nextHeight = clamp(requiredHeight / layer.clientHeight, annotation.height, 1 - annotation.y);
  if (nextHeight <= annotation.height) return;
  annotation.height = nextHeight;
  item.style.height = `${annotation.height * 100}%`;
}

function focusInlineTextEditor(annotationId, selectContents = false) {
  requestAnimationFrame(() => {
    const editor = document.querySelector(`.annotation-item[data-annotation-id="${annotationId}"] .annotation-text-content`);
    if (!editor) return;
    editor.focus();
    if (!selectContents) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

async function addAnnotation(type) {
  const page = currentPage();
  if (!page) return showToast("请先选中一页。");
  state.textPlacementMode = false;
  state.selectionMode = false;
  state.drawingMode = false;
  state.lineMode = false;
  if (state.mode === "overview") {
    state.mode = "continuous";
    els.continuousBtn.classList.add("active");
    els.overviewBtn.classList.remove("active");
    await renderAll({ keepScroll: true });
  }
  recordUndo("加入图形");
  const dimensions = visualPageDimensions(page);
  const circleHeight = 0.18 * dimensions.width / dimensions.height;
  const annotation = {
    id: makeId(), type, x: 0.28, y: 0.2, width: type === "circle" ? 0.18 : 0.24,
    height: type === "circle" ? circleHeight : 0.16, fillEnabled: true, fillColor: "#fff2ef", borderColor: "#c94c36", borderWidth: 3,
  };
  page.annotations ||= [];
  page.annotations.push(annotation);
  state.selectedAnnotationId = annotation.id;
  refreshCurrentAnnotationLayer();
  syncEditingLayerModes();
  updateAnnotationControls();
}

async function toggleTextPlacementMode() {
  if (!currentPage()) return showToast("请先选中一页。");
  if (state.mode === "overview") {
    state.mode = "continuous";
    els.continuousBtn.classList.add("active");
    els.overviewBtn.classList.remove("active");
    await renderAll({ keepScroll: true });
  }
  setEditingMode(state.textPlacementMode ? null : "text");
  if (state.textPlacementMode) showToast("请在页面上点击文字出现的位置。");
}

function placeTextAnnotation(page, x, y) {
  recordUndo("加入文字");
  const annotation = {
    id: makeId(), type: "text", text: "新文字", x, y, width: 0.38, height: 0.085,
    fontFamily: "Source Han Sans CN", fontSize: 24, color: "#202124", bold: false, italic: false,
    underline: false, align: "left",
  };
  page.annotations ||= [];
  page.annotations.push(annotation);
  state.textPlacementMode = false;
  state.selectedAnnotationId = annotation.id;
  refreshCurrentAnnotationLayer();
  syncEditingLayerModes();
  updateAnnotationControls();
  focusInlineTextEditor(annotation.id, true);
}

async function toggleDrawingMode() {
  if (!currentPage()) return showToast("请先选中一页。");
  if (state.mode === "overview") {
    state.mode = "continuous";
    els.continuousBtn.classList.add("active");
    els.overviewBtn.classList.remove("active");
    await renderAll({ keepScroll: true });
  }
  setEditingMode(state.drawingMode ? null : "draw");
}

async function toggleLineMode() {
  if (!currentPage()) return showToast("请先选中一页。");
  if (state.mode === "overview") {
    state.mode = "continuous";
    els.continuousBtn.classList.add("active");
    els.overviewBtn.classList.remove("active");
    await renderAll({ keepScroll: true });
  }
  setEditingMode(state.lineMode ? null : "line");
}

function toggleSelectionMode() {
  if (!currentPage()) return showToast("请先选中一页。");
  if (state.mode === "overview") return showToast("请先切换到连续或单页阅读模式。");
  setEditingMode(state.selectionMode ? null : "select");
}

function setEditingMode(mode) {
  state.textPlacementMode = mode === "text";
  state.selectionMode = mode === "select";
  state.drawingMode = mode === "draw";
  state.lineMode = mode === "line";
  if (mode) state.selectedAnnotationId = null;
  refreshCurrentAnnotationLayer();
  syncEditingLayerModes();
  updateAnnotationControls();
}

function syncEditingLayerModes() {
  document.querySelectorAll(".page-frame[data-index]").forEach((frame) => {
    const layer = frame.querySelector(".annotation-layer");
    const page = activeDoc().pages[Number(frame.dataset.index)];
    if (!layer || !page) return;
    layer.classList.toggle("selection-mode", state.selectionMode);
    layer.classList.toggle("text-placement-mode", state.textPlacementMode);
    layer.classList.toggle("drawing-mode", (state.drawingMode || state.lineMode) && page === currentPage());
    layer.onpointerdown = null;
    if (state.textPlacementMode) bindTextPlacementLayer(page, layer);
    else if ((state.drawingMode || state.lineMode) && page === currentPage()) bindDrawingLayer(page, layer, getRenderScale(page));
    layer.querySelectorAll(".annotation-text-content").forEach((editor) => {
      editor.setAttribute("contenteditable", state.selectionMode ? "false" : "plaintext-only");
    });
  });
}

function selectedAnnotation() {
  if (!state.selectedAnnotationId) return null;
  return currentPage()?.annotations?.find((annotation) => annotation.id === state.selectedAnnotationId) || null;
}

function selectAnnotation(id) {
  state.textPlacementMode = false;
  state.drawingMode = false;
  state.lineMode = false;
  state.selectedAnnotationId = id;
  syncEditingLayerModes();
  refreshAnnotationSelection();
  updateAnnotationControls();
}

function refreshAnnotationSelection() {
  document.querySelectorAll(".annotation-item, .annotation-drawing").forEach((item) => {
    item.classList.toggle("selected", item.dataset.annotationId === state.selectedAnnotationId);
  });
}

function refreshCurrentAnnotationLayer() {
  const page = currentPage();
  const frame = document.querySelector(`.page-frame[data-index="${activeDoc().selectedIndex}"]`);
  const layer = frame?.querySelector(".annotation-layer");
  if (page && layer) renderAnnotationLayer(page, layer, getRenderScale(page));
}

function deleteSelectedAnnotation() {
  const annotation = selectedAnnotation();
  if (!annotation) return;
  recordUndo("删除页面内容");
  currentPage().annotations = currentPage().annotations.filter((item) => item.id !== annotation.id);
  state.selectedAnnotationId = null;
  refreshCurrentAnnotationLayer();
  updateAnnotationControls();
}

function bindAnnotationControls() {
  bindAnnotationInput(els.fontFamilySelect, "fontFamily", (value) => value, "修改字体");
  bindAnnotationInput(els.fontSizeInput, "fontSize", (value) => clamp(Number(value) || 24, 6, 180), "修改字号");
  bindAnnotationInput(els.textColorInput, "color", (value) => value, "修改文字颜色");
  bindAnnotationInput(els.shapeFillInput, "fillColor", (value) => value, "修改填充颜色");
  bindAnnotationInput(els.shapeBorderInput, "borderColor", (value) => value, "修改边框颜色");
  bindAnnotationInput(els.shapeBorderWidthInput, "borderWidth", (value) => clamp(Number(value) || 0, 0, 30), "修改边框粗细");
  bindAnnotationInput(els.shapeFillEnabled, "fillEnabled", (_, input) => input.checked, "切换图形填充");
  bindDrawingInput(els.drawColorInput, "color", (value) => value, "修改画笔颜色");
  bindDrawingInput(els.drawWidthInput, "lineWidth", (value) => clamp(Number(value) || 3, 0.5, 30), "修改画笔粗细");
  bindLineInput(els.lineColorInput, "color", (value) => value, "修改直线颜色");
  bindLineInput(els.lineWidthInput, "lineWidth", (value) => clamp(Number(value) || 3, 0.5, 30), "修改直线粗细");
  els.lineDashButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const dash = button.dataset.dash;
      state.lineBrush.dash = dash;
      const annotation = selectedAnnotation();
      if (annotation?.type === "line" && annotation.dash !== dash) {
        recordUndo("修改直线线型");
        annotation.dash = dash;
        refreshCurrentAnnotationLayer();
      }
      updateAnnotationControls();
    });
  });

  [[els.boldBtn, "bold", "修改粗体"], [els.italicBtn, "italic", "修改斜体"], [els.underlineBtn, "underline", "修改下划线"]]
    .forEach(([button, field, label]) => {
      button.addEventListener("click", () => {
        const annotation = selectedAnnotation();
        if (!annotation) return;
        recordUndo(label);
        annotation[field] = !annotation[field];
        refreshCurrentAnnotationLayer();
        updateAnnotationControls();
      });
    });

  els.alignmentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const annotation = selectedAnnotation();
      if (!annotation) return;
      recordUndo("修改文字对齐");
      annotation.align = button.dataset.align;
      refreshCurrentAnnotationLayer();
      updateAnnotationControls();
    });
  });
  els.fontFamilySelect.addEventListener("change", () => loadLocalFontFace(els.fontFamilySelect.value));
}

function bindAnnotationInput(input, field, transform, label) {
  let editRecorded = false;
  const apply = () => {
    const annotation = selectedAnnotation();
    if (!annotation) return;
    if (!editRecorded) {
      recordUndo(label);
      editRecorded = true;
    }
    annotation[field] = transform(input.value, input);
    refreshCurrentAnnotationLayer();
  };
  input.addEventListener("input", apply);
  input.addEventListener("change", apply);
  input.addEventListener("blur", () => { editRecorded = false; });
}

function bindDrawingInput(input, field, transform, label) {
  let editRecorded = false;
  const apply = () => {
    const value = transform(input.value);
    state.brush[field] = value;
    const annotation = selectedAnnotation();
    if (!annotation || annotation.type !== "draw") return;
    if (!editRecorded) {
      recordUndo(label);
      editRecorded = true;
    }
    annotation[field] = value;
    refreshCurrentAnnotationLayer();
  };
  input.addEventListener("input", apply);
  input.addEventListener("change", apply);
  input.addEventListener("blur", () => { editRecorded = false; });
}

function bindLineInput(input, field, transform, label) {
  let editRecorded = false;
  const apply = () => {
    const value = transform(input.value);
    state.lineBrush[field] = value;
    const annotation = selectedAnnotation();
    if (!annotation || annotation.type !== "line") return;
    if (!editRecorded) {
      recordUndo(label);
      editRecorded = true;
    }
    annotation[field] = value;
    refreshCurrentAnnotationLayer();
  };
  input.addEventListener("input", apply);
  input.addEventListener("change", apply);
  input.addEventListener("blur", () => { editRecorded = false; });
}

function updateAnnotationControls() {
  const annotation = selectedAnnotation();
  const isText = annotation?.type === "text";
  const isShape = annotation?.type === "rect" || annotation?.type === "circle";
  const isDrawing = annotation?.type === "draw";
  const isLine = annotation?.type === "line";
  els.deleteAnnotationBtn.classList.toggle("hidden", !annotation);
  els.textEditor.classList.toggle("hidden", !isText);
  els.shapeEditor.classList.toggle("hidden", !isShape);
  els.drawingEditor.classList.toggle("hidden", !state.drawingMode && !isDrawing);
  els.lineEditor.classList.toggle("hidden", !state.lineMode && !isLine);
  els.addTextBtn.classList.toggle("active", state.textPlacementMode);
  els.addTextBtn.setAttribute("aria-pressed", String(state.textPlacementMode));
  els.selectToolBtn.classList.toggle("active", state.selectionMode);
  els.selectToolBtn.setAttribute("aria-pressed", String(state.selectionMode));
  els.drawBtn.classList.toggle("active", state.drawingMode);
  els.drawBtn.setAttribute("aria-pressed", String(state.drawingMode));
  els.lineBtn.classList.toggle("active", state.lineMode);
  els.lineBtn.setAttribute("aria-pressed", String(state.lineMode));
  if (state.drawingMode || isDrawing) {
    const source = isDrawing ? annotation : state.brush;
    els.drawColorInput.value = source.color;
    els.drawWidthInput.value = source.lineWidth;
  }
  if (state.lineMode || isLine) {
    const source = isLine ? annotation : state.lineBrush;
    els.lineColorInput.value = source.color;
    els.lineWidthInput.value = source.lineWidth;
    els.lineDashButtons.forEach((button) => button.classList.toggle("active", button.dataset.dash === source.dash));
  }
  if (!annotation) return;
  if (isText) {
    ensureFontOption(annotation.fontFamily);
    els.fontFamilySelect.value = annotation.fontFamily;
    els.fontSizeInput.value = annotation.fontSize;
    els.textColorInput.value = annotation.color;
    els.boldBtn.classList.toggle("active", annotation.bold);
    els.italicBtn.classList.toggle("active", annotation.italic);
    els.underlineBtn.classList.toggle("active", annotation.underline);
    els.alignmentButtons.forEach((button) => button.classList.toggle("active", button.dataset.align === annotation.align));
  } else if (isShape) {
    els.shapeFillInput.value = annotation.fillColor;
    els.shapeBorderInput.value = annotation.borderColor;
    els.shapeFillEnabled.checked = annotation.fillEnabled;
    els.shapeBorderWidthInput.value = annotation.borderWidth;
  }
}

async function loadLocalFonts() {
  if (!window.queryLocalFonts) return showToast("当前浏览器不支持读取本机字体，请使用最新版 Chrome 或 Edge。");
  try {
    const fonts = await window.queryLocalFonts();
    const families = [...new Set(fonts.map((font) => font.family).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    families.forEach(ensureFontOption);
    [...fonts].sort((a, b) => (a.fullName || a.family || "").localeCompare(b.fullName || b.family || "")).forEach((font) => {
      const faceName = font.fullName || font.postscriptName || font.family;
      if (!faceName) return;
      localFontSources.set(faceName, font);
      ensureFontOption(faceName, font.fullName || faceName);
    });
    showToast(`已列出 ${fonts.length} 个本机字体面，包含 ${families.length} 个字体家族。`);
  } catch (error) {
    if (error.name !== "AbortError") showToast("没有取得字体权限。");
  }
}

async function loadLocalFontFace(faceName) {
  const source = localFontSources.get(faceName);
  if (!source || loadedLocalFonts.has(faceName)) return;
  try {
    const blob = await source.blob();
    const fontFace = new FontFace(faceName, await blob.arrayBuffer());
    await fontFace.load();
    document.fonts.add(fontFace);
    loadedLocalFonts.add(faceName);
    refreshCurrentAnnotationLayer();
  } catch (error) {
    console.warn(`无法载入本机字体 ${faceName}`, error);
  }
}

function ensureFontOption(fontFamily, label = fontFamily) {
  if ([...els.fontFamilySelect.options].some((option) => option.value === fontFamily)) return;
  const option = document.createElement("option");
  option.value = fontFamily;
  option.textContent = label;
  els.fontFamilySelect.appendChild(option);
}

function quoteFontFamily(fontFamily) {
  return `"${String(fontFamily).replaceAll('"', "")}", sans-serif`;
}

function getRenderScale(page) {
  if (state.mode === "overview") {
    const rotated = Math.abs(page.rotation % 180) === 90;
    const pageWidth = rotated ? page.height : page.width;
    const pageHeight = rotated ? page.width : page.height;
    return Math.min(0.34, 190 / pageWidth, 136 / pageHeight);
  }
  if (state.scale !== "fit") return state.scale;
  const rotated = Math.abs(page.rotation % 180) === 90;
  const pageWidth = rotated ? page.height : page.width;
  const available = Math.max(360, els.viewer.clientWidth - 86);
  return Math.min(2.2, Math.max(0.2, available / pageWidth));
}

function visualPageDimensions(page) {
  const rotated = Math.abs(page.rotation % 180) === 90;
  return {
    width: rotated ? page.height : page.width,
    height: rotated ? page.width : page.height,
  };
}

function selectPage(index, scrollIntoView, selectionMode = "replace") {
  if (!activeDoc().pages.length) {
    activeDoc().selectedIndex = -1;
    activeDoc().selectedPageIds = [];
    updateUi();
    return;
  }
  const doc = activeDoc();
  const nextIndex = clamp(index, 0, activeDoc().pages.length - 1);
  if (nextIndex !== doc.selectedIndex) state.selectedAnnotationId = null;
  doc.selectedIndex = nextIndex;
  const pageId = doc.pages[nextIndex].id;
  const validIds = new Set(doc.pages.map((page) => page.id));
  doc.selectedPageIds = doc.selectedPageIds.filter((id) => validIds.has(id));

  if (selectionMode === "range") {
    const anchor = doc.selectionAnchorIndex >= 0 ? doc.selectionAnchorIndex : nextIndex;
    const start = Math.min(anchor, nextIndex);
    const end = Math.max(anchor, nextIndex);
    doc.selectedPageIds = doc.pages.slice(start, end + 1).map((page) => page.id);
  } else if (selectionMode === "toggle") {
    const selected = new Set(doc.selectedPageIds);
    if (selected.has(pageId) && selected.size > 1) selected.delete(pageId);
    else selected.add(pageId);
    doc.selectedPageIds = doc.pages.filter((page) => selected.has(page.id)).map((page) => page.id);
    doc.selectionAnchorIndex = nextIndex;
  } else if (selectionMode === "replace") {
    doc.selectedPageIds = [pageId];
    doc.selectionAnchorIndex = nextIndex;
  } else if (!doc.selectedPageIds.length) {
    doc.selectedPageIds = [pageId];
    doc.selectionAnchorIndex = nextIndex;
  }

  syncPageSelectionVisuals();
  if (state.textPlacementMode || state.drawingMode || state.lineMode) syncEditingLayerModes();
  if (scrollIntoView) {
    scrollPageIntoViewer(doc.selectedIndex);
    scrollThumbIntoView(doc.selectedIndex);
  }
  updateAnnotationControls();
  updateUi();
  schedulePageNavigatorUpdate();
}

function selectionModeFromEvent(event) {
  if (event.shiftKey) return "range";
  if (event.metaKey || event.ctrlKey) return "toggle";
  return "replace";
}

function syncPageSelectionVisuals() {
  const selected = new Set(activeDoc().selectedPageIds);
  document.querySelectorAll(".thumb-item, .page-frame").forEach((node) => {
    const pageId = node.dataset.id;
    node.classList.toggle("selected", selected.has(pageId));
    node.classList.toggle("active", Number(node.dataset.index) === activeDoc().selectedIndex);
  });
}

function isPageSelected(pageId) {
  return activeDoc().selectedPageIds.includes(pageId);
}

function selectedPageEntries() {
  const selected = new Set(activeDoc().selectedPageIds);
  const entries = activeDoc().pages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => selected.has(page.id));
  if (entries.length) return entries;
  const page = currentPage();
  return page ? [{ page, index: activeDoc().selectedIndex }] : [];
}

function selectedPages() {
  return selectedPageEntries().map(({ page }) => page);
}

function selectAllPages(forceSelect = false) {
  const doc = activeDoc();
  if (!doc.pages.length) return;
  const allSelected = doc.selectedPageIds.length === doc.pages.length;
  if (allSelected && forceSelect !== true) {
    const current = currentPage() || doc.pages[0];
    doc.selectedPageIds = [current.id];
    doc.selectionAnchorIndex = doc.selectedIndex;
  } else {
    doc.selectedPageIds = doc.pages.map((page) => page.id);
    doc.selectionAnchorIndex = 0;
  }
  syncPageSelectionVisuals();
  updateUi();
}

async function searchText() {
  els.searchInput.closest(".search-box")?.classList.remove("compact-open");
  const query = els.searchInput.value.trim();
  if (!query) {
    clearSearch();
    return showToast("请输入要搜索的文字。");
  }
  const doc = activeDoc();
  if (!doc.pages.length) return showToast("请先打开 PDF。");

  let pdfPageCount = 0;
  let total = 0;
  const pageIndexes = [];
  for (let index = 0; index < doc.pages.length; index += 1) {
    const page = doc.pages[index];
    if (page.type !== "pdf") continue;
    pdfPageCount += 1;
    const text = await extractPageText(page);
    const count = countOccurrences(text, query);
    if (count) {
      total += count;
      pageIndexes.push(index);
    }
  }

  if (!pdfPageCount) {
    setSearchResults(query, 0, []);
    showToast("当前文档都是图片页，图片本身没有可搜索文字。");
    return;
  }
  setSearchResults(query, total, pageIndexes);
  if (!total) {
    showToast("未找到文字；如果这是扫描件，需要 OCR 才能识别。");
    return;
  }
  selectPage(pageIndexes[0], true);
  showToast(`找到 ${total} 项，已跳到第 ${pageIndexes[0] + 1} 页。`);
}

function setSearchResults(query, total, pageIndexes) {
  state.search = { query, total, pageIndexes };
  document.querySelectorAll(".text-layer").forEach((layer) => highlightTextLayer(layer, query));
  els.searchStatus.textContent = `找到 ${total} 项`;
  els.searchStatus.classList.remove("hidden");
}

function clearSearch() {
  state.search = { query: "", total: 0, pageIndexes: [] };
  document.querySelectorAll(".search-hit").forEach((node) => node.classList.remove("search-hit"));
  els.searchStatus.classList.add("hidden");
  els.searchStatus.textContent = "";
}

function highlightTextLayer(container, query) {
  const needle = query.trim().toLocaleLowerCase();
  const spans = [...container.querySelectorAll("span")];
  spans.forEach((span) => span.classList.remove("search-hit"));
  if (!needle) return;

  let cursor = 0;
  const segments = spans.map((span) => {
    const start = cursor;
    cursor += span.textContent.length;
    const segment = { span, start, end: cursor };
    cursor += 1;
    return segment;
  });
  const combined = spans.map((span) => span.textContent).join(" ").toLocaleLowerCase();
  let offset = 0;
  while ((offset = combined.indexOf(needle, offset)) !== -1) {
    const end = offset + needle.length;
    segments.forEach((segment) => {
      if (segment.end > offset && segment.start < end) segment.span.classList.add("search-hit");
    });
    offset = end;
  }
}

function countOccurrences(text, query) {
  const haystack = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function scrollPageIntoViewer(index) {
  const frame = document.querySelector(`.page-frame[data-index="${index}"]`);
  if (!frame) return;
  const paddingTop = Number.parseFloat(getComputedStyle(els.viewer).paddingTop) || 0;
  setScrollInstantly(els.viewer, Math.max(0, frame.offsetTop - paddingTop), els.viewer.scrollLeft);
}

function setScrollInstantly(element, top, left = element.scrollLeft) {
  const previousBehavior = element.style.scrollBehavior;
  element.style.scrollBehavior = "auto";
  element.scrollTop = top;
  element.scrollLeft = left;
  element.style.scrollBehavior = previousBehavior;
}

function scrollThumbIntoView(index) {
  const thumb = document.querySelector(`.thumb-item[data-index="${index}"]`);
  if (!thumb) return;
  const top = thumb.offsetTop;
  const bottom = top + thumb.offsetHeight;
  if (top < els.thumbList.scrollTop) {
    els.thumbList.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
  } else if (bottom > els.thumbList.scrollTop + els.thumbList.clientHeight) {
    els.thumbList.scrollTo({ top: bottom - els.thumbList.clientHeight + 8, behavior: "smooth" });
  }
}

async function extractPageText(page) {
  try {
    const sourcePage = await page.pdf.getPage(page.sourceIndex + 1);
    const textContent = await sourcePage.getTextContent();
    return textContent.items.map((item) => item.str || "").join(" ");
  } catch (error) {
    return "";
  }
}

function syncCurrentFromScroll() {
  if (!activeDoc().pages.length || state.mode !== "continuous" || state.navigatorDragging || state.zooming) return;
  const frame = findMostVisiblePageFrame();
  if (!frame) return;
  const index = Number(frame.dataset.index);
  const pageId = frame.dataset.id;
  const doc = activeDoc();
  const hasMultipleSelection = doc.selectedPageIds.length > 1;
  const selectionMatches = doc.selectedPageIds.length === 1 && doc.selectedPageIds[0] === pageId;
  if (index === doc.selectedIndex && (hasMultipleSelection || selectionMatches)) return;
  selectPage(index, false, hasMultipleSelection ? "preserve" : "replace");
  scrollThumbIntoView(index);
}

function findMostVisiblePageFrame() {
  const viewerRect = getViewerViewportRect();
  let bestFrame = null;
  let bestVisibleArea = 0;
  document.querySelectorAll(".page-frame[data-index]").forEach((frame) => {
    const rect = frame.querySelector(".page-surface")?.getBoundingClientRect() || frame.getBoundingClientRect();
    const visibleWidth = Math.max(0, Math.min(viewerRect.right, rect.right) - Math.max(viewerRect.left, rect.left));
    const visibleHeight = Math.max(0, Math.min(viewerRect.bottom, rect.bottom) - Math.max(viewerRect.top, rect.top));
    const visibleArea = visibleWidth * visibleHeight;
    if (visibleArea > bestVisibleArea) {
      bestVisibleArea = visibleArea;
      bestFrame = frame;
    }
  });
  return bestFrame;
}

function schedulePageNavigatorUpdate() {
  cancelAnimationFrame(navigatorUpdateFrame);
  navigatorUpdateFrame = requestAnimationFrame(updatePageNavigator);
}

function updatePageNavigator() {
  const frame = state.navigatorDragging && state.navigatorPageId
    ? document.querySelector(`.page-frame[data-id="${state.navigatorPageId}"]`)
    : (state.mode === "continuous" ? findMostVisiblePageFrame() : null)
      || document.querySelector(`.page-frame[data-index="${activeDoc().selectedIndex}"]`);
  const surface = frame?.querySelector(".page-surface");
  const sourceCanvas = surface?.querySelector("canvas");
  if (!frame || !surface || !sourceCanvas || state.mode === "overview") {
    els.pageNavigator.classList.add("hidden");
    return;
  }

  const viewerRect = getViewerViewportRect();
  const surfaceRect = surface.getBoundingClientRect();
  const visibleWidth = Math.max(0, Math.min(viewerRect.right, surfaceRect.right) - Math.max(viewerRect.left, surfaceRect.left));
  const visibleHeight = Math.max(0, Math.min(viewerRect.bottom, surfaceRect.bottom) - Math.max(viewerRect.top, surfaceRect.top));
  const oversized = surfaceRect.width > viewerRect.width - 4 || surfaceRect.height > viewerRect.height - 4;
  if (!oversized || !visibleWidth || !visibleHeight) {
    els.pageNavigator.classList.add("hidden");
    return;
  }

  const navigatorScale = Math.min(170 / surfaceRect.width, 150 / surfaceRect.height);
  const navigatorWidth = Math.max(48, Math.round(surfaceRect.width * navigatorScale));
  const navigatorHeight = Math.max(48, Math.round(surfaceRect.height * navigatorScale));
  const renderKey = `${frame.dataset.id}:${sourceCanvas.width}x${sourceCanvas.height}:${navigatorWidth}:${navigatorHeight}`;
  if (els.pageNavigator.dataset.renderKey !== renderKey) {
    const ratio = window.devicePixelRatio || 1;
    els.navigatorCanvas.width = Math.round(navigatorWidth * ratio);
    els.navigatorCanvas.height = Math.round(navigatorHeight * ratio);
    els.navigatorCanvas.style.width = `${navigatorWidth}px`;
    els.navigatorCanvas.style.height = `${navigatorHeight}px`;
    const context = els.navigatorCanvas.getContext("2d", { alpha: false });
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, navigatorWidth, navigatorHeight);
    context.drawImage(sourceCanvas, 0, 0, navigatorWidth, navigatorHeight);
    els.pageNavigator.dataset.renderKey = renderKey;
  }

  const visibleX = clamp(viewerRect.left - surfaceRect.left, 0, surfaceRect.width);
  const visibleY = clamp(viewerRect.top - surfaceRect.top, 0, surfaceRect.height);
  const viewportWidth = Math.max(12, visibleWidth / surfaceRect.width * navigatorWidth);
  const viewportHeight = Math.max(12, visibleHeight / surfaceRect.height * navigatorHeight);
  els.navigatorViewport.style.left = `${visibleX / surfaceRect.width * navigatorWidth}px`;
  els.navigatorViewport.style.top = `${visibleY / surfaceRect.height * navigatorHeight}px`;
  els.navigatorViewport.style.width = `${Math.min(navigatorWidth, viewportWidth)}px`;
  els.navigatorViewport.style.height = `${Math.min(navigatorHeight, viewportHeight)}px`;
  els.pageNavigator.dataset.pageIndex = frame.dataset.index;
  els.pageNavigator.classList.remove("hidden");
}

function bindPageNavigator() {
  els.navigatorViewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const viewportRect = els.navigatorViewport.getBoundingClientRect();
    const offsetX = event.clientX - viewportRect.left;
    const offsetY = event.clientY - viewportRect.top;
    const pageIndex = Number(els.pageNavigator.dataset.pageIndex);
    state.navigatorDragging = true;
    state.navigatorPageId = activeDoc().pages[pageIndex]?.id || null;
    els.navigatorViewport.setPointerCapture(event.pointerId);
    els.viewer.style.scrollBehavior = "auto";

    const move = (moveEvent) => {
      const surface = document.querySelector(`.page-frame[data-id="${state.navigatorPageId}"] .page-surface`);
      if (!surface) return;
      const navigatorRect = els.navigatorCanvas.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const viewerRect = els.viewer.getBoundingClientRect();
      const viewportWidth = els.navigatorViewport.offsetWidth;
      const viewportHeight = els.navigatorViewport.offsetHeight;
      const left = clamp(moveEvent.clientX - navigatorRect.left - offsetX, 0, navigatorRect.width - viewportWidth);
      const top = clamp(moveEvent.clientY - navigatorRect.top - offsetY, 0, navigatorRect.height - viewportHeight);
      const targetX = left / navigatorRect.width * surfaceRect.width;
      const targetY = top / navigatorRect.height * surfaceRect.height;
      const currentX = clamp(viewerRect.left - surfaceRect.left, 0, surfaceRect.width);
      const currentY = clamp(viewerRect.top - surfaceRect.top, 0, surfaceRect.height);
      els.viewer.scrollLeft += targetX - currentX;
      els.viewer.scrollTop += targetY - currentY;
      updatePageNavigator();
    };
    const end = () => {
      els.navigatorViewport.removeEventListener("pointermove", move);
      els.navigatorViewport.removeEventListener("pointerup", end);
      els.navigatorViewport.removeEventListener("pointercancel", end);
      els.viewer.style.scrollBehavior = "";
      state.navigatorDragging = false;
      state.navigatorPageId = null;
      syncCurrentFromScroll();
      schedulePageNavigatorUpdate();
    };
    els.navigatorViewport.addEventListener("pointermove", move);
    els.navigatorViewport.addEventListener("pointerup", end);
    els.navigatorViewport.addEventListener("pointercancel", end);
  });
}

function setMode(mode, options = {}) {
  const previousMode = state.mode;
  const focusIndex = Number.isInteger(options.focusIndex)
    ? options.focusIndex
    : previousMode === "overview" && mode !== "overview"
      ? activeDoc().selectedIndex
      : null;
  if (mode === "overview") {
    state.textPlacementMode = false;
    state.selectionMode = false;
    state.drawingMode = false;
    state.lineMode = false;
    state.selectedAnnotationId = null;
    updateAnnotationControls();
  }
  state.mode = mode;
  els.continuousBtn.classList.toggle("active", mode === "continuous");
  els.singleBtn.classList.toggle("active", mode === "single");
  els.overviewBtn.classList.toggle("active", mode === "overview");
  els.viewer.classList.toggle("single-mode", mode === "single");
  els.viewer.classList.toggle("overview-mode", mode === "overview");
  renderAll({ keepScroll: true }).then(() => {
    if (Number.isInteger(focusIndex)) selectPage(focusIndex, true, "preserve");
  });
}

function toggleSidePanel() {
  setSidePanelCollapsed(!state.sidePanelCollapsed);
}

function toggleThumbRail() {
  setThumbRailCollapsed(!state.thumbRailCollapsed);
}

function setThumbRailCollapsed(collapsed) {
  state.thumbRailCollapsed = collapsed;
  els.appShell.classList.toggle("thumb-collapsed", collapsed);
  els.thumbRailToggle.title = collapsed ? "展开页面栏" : "收起页面栏";
  els.thumbRailToggle.setAttribute("aria-label", els.thumbRailToggle.title);
  els.thumbRailToggle.setAttribute("aria-expanded", String(!collapsed));
  els.thumbRailToggle.innerHTML = `<i data-lucide="${collapsed ? "chevron-right" : "chevron-left"}"></i>`;
  lucide.createIcons();
  scheduleFitRenderAfterPanelChange();
}

function setSidePanelCollapsed(collapsed) {
  state.sidePanelCollapsed = collapsed;
  els.appShell.classList.toggle("side-collapsed", collapsed);
  els.sidePanelToggle.title = collapsed ? "展开功能栏" : "收起功能栏";
  els.sidePanelToggle.setAttribute("aria-label", els.sidePanelToggle.title);
  els.sidePanelToggle.setAttribute("aria-expanded", String(!collapsed));
  els.sidePanelToggle.innerHTML = `<i data-lucide="${collapsed ? "chevron-left" : "chevron-right"}"></i>`;
  lucide.createIcons();
  scheduleFitRenderAfterPanelChange();
}

function scheduleFitRenderAfterPanelChange() {
  if (state.scale === "fit" && activeDoc().pages.length) {
    clearTimeout(sidePanelRenderTimer);
    sidePanelRenderTimer = setTimeout(() => renderAll({ keepScroll: true }), 180);
  }
}

function syncSidePanelForViewport(initial = false) {
  const narrow = window.innerWidth < 1120;
  if (initial || narrow !== state.sidePanelWasNarrow) {
    state.sidePanelWasNarrow = narrow;
    setSidePanelCollapsed(narrow);
    return true;
  }
  return false;
}

function rotateSelected(delta) {
  const pages = selectedPages();
  if (!pages.length) return;
  recordUndo(pages.length > 1 ? "旋转多个页面" : "旋转页面");
  pages.forEach((page) => {
    page.rotation = normalizeRotation(page.rotation + delta);
  });
  renderAll({ keepScroll: true });
}

function deleteSelected() {
  const entries = selectedPageEntries();
  if (!entries.length) return;
  recordUndo(entries.length > 1 ? "删除多个页面" : "删除页面");
  const deletedIds = new Set(entries.map(({ page }) => page.id));
  const nextIndex = Math.min(entries[0].index, activeDoc().pages.length - entries.length - 1);
  activeDoc().pages = activeDoc().pages.filter((page) => !deletedIds.has(page.id));
  activeDoc().selectedIndex = activeDoc().pages.length ? Math.max(0, nextIndex) : -1;
  activeDoc().selectedPageIds = activeDoc().selectedIndex >= 0 ? [activeDoc().pages[activeDoc().selectedIndex].id] : [];
  activeDoc().selectionAnchorIndex = activeDoc().selectedIndex;
  state.selectedAnnotationId = null;
  renderAll({ keepScroll: true });
}

function duplicateSelected() {
  const entries = selectedPageEntries();
  if (!entries.length) return;
  recordUndo(entries.length > 1 ? "复制多个页面" : "复制页面");
  const duplicates = entries.map(({ page }) => {
    const duplicate = clonePage(page);
    duplicate.id = makeId();
    duplicate.annotations = duplicate.annotations.map((annotation) => ({ ...annotation, id: makeId() }));
    return duplicate;
  });
  const insertAt = entries[entries.length - 1].index + 1;
  activeDoc().pages.splice(insertAt, 0, ...duplicates);
  activeDoc().selectedIndex = insertAt;
  activeDoc().selectedPageIds = duplicates.map((page) => page.id);
  activeDoc().selectionAnchorIndex = insertAt;
  state.selectedAnnotationId = null;
  renderAll({ keepScroll: true });
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clonePage(page) {
  return {
    ...page,
    annotations: (page.annotations || []).map((annotation) => ({
      ...annotation,
      points: annotation.points?.map((point) => ({ ...point })),
    })),
  };
}

function markDropPlacement(placement, event) {
  const { anchor, atEnd, index, rawSide, hoverTargetId } = placement;
  const changed = state.dragPreview?.index !== index;
  if (changed) {
    document.querySelectorAll(".drop-position, .drop-position-end").forEach((node) => {
      node.classList.remove("drop-position", "drop-position-end");
    });
    anchor.classList.add(atEnd ? "drop-position-end" : "drop-position");
  }
  state.dragPreview = { index, targetId: hoverTargetId, rawSide };
  state.dropIndex = index;
  els.dragPositionTip.textContent = `插入为第 ${index + 1} 页`;
  els.dragPositionTip.style.left = `${Math.min(event.clientX, window.innerWidth - 130)}px`;
  els.dragPositionTip.style.top = `${Math.min(event.clientY, window.innerHeight - 54)}px`;
  els.dragPositionTip.classList.remove("hidden");
}

function dropPlacementFor(container, event) {
  const nodes = orderedPageNodes(container).filter((node) => node.dataset.id !== state.draggingPageId);
  if (!nodes.length) return null;
  const target = dragTargetFor(container, event, nodes);
  if (!target) return null;
  const side = stableDropSide(target, event);
  const targetIndex = nodes.indexOf(target);
  const index = side === "before" ? targetIndex : targetIndex + 1;
  return {
    anchor: index < nodes.length ? nodes[index] : nodes[nodes.length - 1],
    atEnd: index === nodes.length,
    index,
    rawSide: side,
    hoverTargetId: target.dataset.id,
  };
}

function stableDropSide(item, event) {
  const rect = item.getBoundingClientRect();
  const horizontal = state.mode === "overview" && item.classList.contains("page-frame");
  const delta = horizontal
    ? event.clientX - (rect.left + rect.width / 2)
    : event.clientY - (rect.top + rect.height / 2);
  if (state.dragPreview?.targetId === item.dataset.id && Math.abs(delta) < 8) return state.dragPreview.rawSide;
  return delta < 0 ? "before" : "after";
}

function clearDropMarkers() {
  document.querySelectorAll(".drop-position, .drop-position-end").forEach((node) => {
    node.classList.remove("drop-position", "drop-position-end");
  });
  state.dragPreview = null;
  state.dropIndex = null;
  els.dragPositionTip.classList.add("hidden");
}

function bindReorderContainer(container) {
  container.addEventListener("dragover", (event) => {
    if (!isPageDrag(event)) return;
    if (container === els.viewer && state.mode === "single") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    autoScrollWhileReordering(container, event);
    const placement = dropPlacementFor(container, event);
    if (placement) markDropPlacement(placement, event);
  });

  container.addEventListener("drop", async (event) => {
    if (!isPageDrag(event)) return;
    if (container === els.viewer && state.mode === "single") return;
    event.preventDefault();
    event.stopPropagation();
    await finishReorder(container);
  });
}

function autoScrollWhileReordering(container, event) {
  const rect = container.getBoundingClientRect();
  const edge = Math.min(92, rect.height * 0.2);
  const distanceFromTop = event.clientY - rect.top;
  const distanceFromBottom = rect.bottom - event.clientY;
  let direction = 0;
  let strength = 0;
  if (distanceFromTop < edge) {
    direction = -1;
    strength = 1 - clamp(distanceFromTop / edge, 0, 1);
  } else if (distanceFromBottom < edge) {
    direction = 1;
    strength = 1 - clamp(distanceFromBottom / edge, 0, 1);
  }
  if (!direction) return;
  container.scrollTop += direction * (5 + 30 * strength * strength);
}

async function finishReorder(container) {
  const from = activeDoc().pages.findIndex((page) => page.id === state.draggingPageId);
  const to = state.dropIndex ?? from;
  const changed = from >= 0 && to >= 0 && from !== to;
  if (changed) recordUndo("调整页面顺序");
  if (changed) {
    const [page] = activeDoc().pages.splice(from, 1);
    activeDoc().pages.splice(to, 0, page);
    activeDoc().selectedIndex = to;
  }
  clearDropMarkers();
  state.draggingPageId = null;
  applyCurrentOrderToDom(els.thumbList);
  applyCurrentOrderToDom(els.viewer);
  refreshPreviewLabels(els.thumbList);
  refreshPreviewLabels(els.viewer);
  selectPage(activeDoc().selectedIndex, false, "preserve");
  updateUi();
}

function dragTargetFor(container, event, nodes = orderedPageNodes(container).filter((node) => node.dataset.id !== state.draggingPageId)) {
  const selector = container === els.thumbList ? ".thumb-item[data-id]" : ".page-frame[data-id]";
  const directTarget = event.target.closest?.(selector);
  if (directTarget && directTarget.dataset.id !== state.draggingPageId && container.contains(directTarget)) return directTarget;
  if (!nodes.length) return null;
  let best = nodes[0];
  let bestDistance = Infinity;
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = container === els.viewer && state.mode === "overview"
      ? Math.hypot(event.clientX - centerX, event.clientY - centerY)
      : Math.abs(event.clientY - centerY);
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  });
  return best;
}

function setDragPreviewImage(event, source) {
  if (!event.dataTransfer?.setDragImage) return;
  const ghost = source.cloneNode(true);
  ghost.style.position = "fixed";
  ghost.style.left = "-10000px";
  ghost.style.top = "-10000px";
  ghost.style.width = `${Math.min(180, source.getBoundingClientRect().width)}px`;
  ghost.style.opacity = "0.92";
  ghost.style.background = "#ffffff";
  ghost.style.boxShadow = "0 8px 24px rgba(0,0,0,.28)";
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, 24);
  requestAnimationFrame(() => ghost.remove());
}

function refreshPreviewLabels(container) {
  const nodes = orderedPageNodes(container);
  nodes.forEach((node, index) => {
    node.dataset.index = index;
    const thumbNumber = node.querySelector(".thumb-label span:first-child");
    if (thumbNumber) thumbNumber.textContent = index + 1;
    const badge = node.querySelector(".page-badge");
    if (badge) badge.textContent = index + 1;
  });
}

function applyCurrentOrderToDom(container) {
  const byId = new Map(orderedPageNodes(container).map((node) => [node.dataset.id, node]));
  activeDoc().pages.forEach((page) => {
    const node = byId.get(page.id);
    if (node) container.appendChild(node);
  });
}

function orderedPageNodes(container) {
  const selector = container === els.thumbList ? ".thumb-item[data-id]" : ".page-frame[data-id]";
  return [...container.querySelectorAll(selector)];
}

function isPageDrag(event) {
  return Boolean(state.draggingPageId || Array.from(event.dataTransfer.types || []).includes("text/plain"));
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isDeleteKey(event) {
  return event.key === "Delete"
    || event.key === "Backspace"
    || event.key === "Del"
    || event.code === "Delete"
    || event.code === "Backspace"
    || event.keyCode === 46
    || event.keyCode === 8;
}

function isAcceptedFile(file) {
  return /pdf|png|jpe?g/i.test(file.type) || /\.(pdf|png|jpe?g)$/i.test(file.name);
}

async function saveFullPdf() {
  if (!activeDoc().pages.length) return showToast("请先加入文件。");
  const result = await saveDocument(activeDoc());
  if (result === "source") {
    showToast("已保存到原文件。");
    return;
  }
  if (result === "savedAs") return showToast("已保存 PDF。");
  if (result === "downloaded") return showToast("已下载 PDF。");
  if (result === "failed") showToast("保存失败，请重试。");
}

async function saveDocument(doc) {
  if (!doc.pages.length) return "failed";
  const accessResult = await ensureSourceHandle(doc);
  if (accessResult === "cancelled" || accessResult === "failed") return accessResult;
  showLoading("正在准备保存…", 2);
  try {
    const bytes = await buildPdfBytes(doc.pages, (completed, total) => {
      updateLoading(`正在整理第 ${completed} / ${total} 页`, 5 + (completed / total) * 82);
    });
    updateLoading("正在写入文件…", 92);
    const sourceResult = await saveBytesToSource(bytes, doc);
    if (sourceResult === "saved") {
      doc.dirty = false;
      renderTabs();
      return "source";
    }
    if (sourceResult === "cancelled" || sourceResult === "failed") return sourceResult;
    if (doc.sourceFileExpected) return "failed";

    const suggestedName = fileStem(doc.sourceFileName || doc.title || "整理后的文档") + "-已编辑.pdf";
    const pickerResult = await saveBytesWithPicker(bytes, suggestedName);
    if (pickerResult === "saved") {
      doc.dirty = false;
      renderTabs();
      return "savedAs";
    }
    if (pickerResult === "cancelled" || pickerResult === "failed") return pickerResult;

    downloadBlob(bytes, suggestedName, "application/pdf");
    return "downloaded";
  } finally {
    hideLoading("保存完成");
  }
}

async function saveAsPdf() {
  if (!activeDoc().pages.length) return showToast("请先加入文件。");
  showLoading("正在准备另存为…", 2);
  try {
    const bytes = await buildPdfBytes(activeDoc().pages, (completed, total) => {
      updateLoading(`正在整理第 ${completed} / ${total} 页`, 5 + (completed / total) * 82);
    });
    const suggestedName = fileStem(activeDoc().sourceFileName || activeDoc().title || "整理后的文档") + "-另存为.pdf";
    const pickerResult = await saveBytesWithPicker(bytes, suggestedName);
    if (pickerResult === "saved") {
      activeDoc().dirty = false;
      renderTabs();
      showToast("已另存为 PDF。");
      return;
    }
    if (pickerResult === "cancelled") return;
    if (pickerResult === "failed") return showToast("另存为失败，请重试。");
    downloadBlob(bytes, suggestedName, "application/pdf");
    activeDoc().dirty = false;
    renderTabs();
    showToast("已下载另存 PDF。");
  } finally {
    hideLoading("另存为完成");
  }
}

async function saveBytesWithPicker(bytes, suggestedName) {
  if (!window.showSaveFilePicker) return "unsupported";
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(new Blob([bytes], { type: "application/pdf" }));
    await writable.close();
    return "saved";
  } catch (error) {
    return error.name === "AbortError" ? "cancelled" : "failed";
  }
}

async function saveBytesToSource(bytes, doc = activeDoc()) {
  const accessResult = await ensureSourceHandle(doc);
  if (accessResult === "cancelled" || accessResult === "failed") return accessResult;
  const nativeResult = await saveBytesToNativeSource(bytes, doc);
  if (nativeResult !== "unavailable") return nativeResult;
  const handle = doc.fileHandle;
  if (!handle || !handle.createWritable) return "unavailable";
  try {
    if (handle.queryPermission) {
      let permission = await handle.queryPermission({ mode: "readwrite" });
      if (permission !== "granted" && handle.requestPermission) {
        permission = await handle.requestPermission({ mode: "readwrite" });
      }
      if (permission !== "granted") return "cancelled";
    }
    const writable = await handle.createWritable();
    await writable.write(new Blob([bytes], { type: "application/pdf" }));
    await writable.close();
    return "saved";
  } catch (error) {
    console.warn("保存到源文件失败", error);
    return error.name === "AbortError" ? "cancelled" : "failed";
  }
}

async function saveBytesToNativeSource(bytes, doc) {
  if (!window.pdfStudioSaveSourceFile || !doc.fileHandle) return "unavailable";
  try {
    const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const result = await window.pdfStudioSaveSourceFile(doc.fileHandle, payload, {
      suggestedName: doc.sourceFileName || doc.title || "PDF 文件.pdf",
    });
    if (result === true || result === "saved" || result?.ok) return "saved";
    if (result?.cancelled) return "cancelled";
    return result?.unavailable ? "unavailable" : "failed";
  } catch (error) {
    console.warn("原文件直写失败", error);
    return error.name === "AbortError" ? "cancelled" : "failed";
  }
}

async function ensureSourceHandle(doc) {
  if (doc.fileHandle || !doc.sourceFileExpected) return "ready";
  try {
    let handle;
    if (window.pdfStudioRequestSourceFileHandle) {
      handle = await window.pdfStudioRequestSourceFileHandle(doc.sourceFileName);
    } else if (window.showOpenFilePicker) {
      const handles = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "原 PDF 文件", accept: { "application/pdf": [".pdf"] } }],
      });
      handle = handles[0];
      if (!handle || handle.name !== doc.sourceFileName) {
        showToast(`请选择原来的源文件“${doc.sourceFileName}”。`);
        return "cancelled";
      }
    } else {
      showToast("当前浏览器无法取得源文件写入权限，请使用最新版 Chrome 或 Edge 打开本页。");
      return "failed";
    }
    doc.fileHandle = handle;
    return "ready";
  } catch (error) {
    return error.name === "AbortError" ? "cancelled" : "failed";
  }
}

function toggleExportMenu() {
  const opening = els.exportMenu.classList.contains("hidden");
  els.exportMenu.classList.toggle("hidden", !opening);
  els.exportBtn.setAttribute("aria-expanded", String(opening));
  if (opening) {
    const count = selectedPageEntries().length;
    els.exportSelectedMenuLabel.textContent = `导出选中页（${count}）`;
  }
}

function closeExportMenu() {
  els.exportMenu.classList.add("hidden");
  els.exportBtn.setAttribute("aria-expanded", "false");
}

function openExportDialog(scope) {
  if (!activeDoc().pages.length) return showToast("请先加入文件。");
  closeExportMenu();
  state.exportScope = scope;
  const count = selectedPageEntries().length;
  els.exportRangeSummary.textContent = scope === "all" ? `全部页面（${activeDoc().pages.length} 页）` : `选中页（${count} 页）`;
  syncExportFormatControls();
  updateExportSizeEstimates();
  els.exportDialog.classList.remove("hidden");
  els.exportConfirmBtn.focus();
}

function closeExportDialog() {
  els.exportDialog.classList.add("hidden");
}

async function confirmExport() {
  const scope = state.exportScope;
  const format = els.exportDialog.querySelector('input[name="exportFormat"]:checked')?.value || "pdf";
  const quality = els.exportDialog.querySelector('input[name="exportQuality"]:checked')?.value || "original";
  const wordMode = els.exportDialog.querySelector('input[name="wordMode"]:checked')?.value || "fidelity";
  const entries = scope === "selected"
    ? selectedPageEntries()
    : activeDoc().pages.map((page, index) => ({ page, index }));
  if (!entries.length) return showToast("请先选择要导出的页面。");
  els.exportConfirmBtn.disabled = true;
  const originalText = els.exportConfirmBtn.textContent;
  els.exportConfirmBtn.textContent = "正在准备…";
  try {
    closeExportDialog();
    await exportPageEntries(entries, format, scope, quality, wordMode);
  } catch (error) {
    console.error("导出失败", error);
    showToast(format === "docx" ? "Word 转换失败，请重试。" : "导出失败，请重试。");
  } finally {
    els.exportConfirmBtn.disabled = false;
    els.exportConfirmBtn.textContent = originalText;
  }
}

async function exportPageEntries(entries, format, scope, quality, wordMode = "fidelity") {
  const fileName = suggestedExportFileName(format, entries);
  if (format === "docx") {
    showLoading("正在提取页面文字…", 2);
    let wordFile;
    try {
      wordFile = await buildWordDocument(entries, wordMode);
    } finally {
      hideLoading();
    }
    const result = await saveExportData(wordFile, fileName, DOCX_MIME, ".docx", "Word 文档");
    if (result === "saved") showToast("Word 文档已生成。");
    return result;
  }

  if (format === "pdf") {
    const pages = entries.map(({ page }) => page);
    const bytes = quality === "original" ? await buildPdfBytes(pages) : await buildCompressedPdfBytes(pages, quality);
    const result = await saveExportData(bytes, fileName, "application/pdf", ".pdf", "PDF 文档");
    if (result === "saved") showToast("PDF 已导出。");
    return result;
  }

  const ext = format === "jpeg" ? "jpg" : "png";
  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  if (entries.length === 1) {
    const blob = await pageImageBlob(entries[0].page, format, quality);
    const result = await saveExportData(blob, fileName, mime, `.${ext}`, `${ext.toUpperCase()} 图片`);
    if (result === "saved") showToast(`${ext.toUpperCase()} 已导出。`);
    return result;
  }

  showToast("正在整理图片，请稍等。");
  const files = [];
  for (const { page, index } of entries) {
    const blob = await pageImageBlob(page, format, quality);
    files.push({
      name: `page-${String(index + 1).padStart(3, "0")}.${ext}`,
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mime,
    });
  }
  const zip = makeZip(files);
  const result = await saveExportData(zip, fileName, "application/zip", ".zip", "ZIP 压缩包");
  if (result === "saved") showToast(`${entries.length} 页图片已导出。`);
  return result;
}

async function saveExportData(data, suggestedName, mime, extension, description) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept: { [mime]: [extension] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if (error.name === "AbortError") return "cancelled";
      console.warn("系统保存窗口不可用，改用浏览器下载。", error);
    }
  }
  downloadBlob(blob, suggestedName, mime);
  return "saved";
}

function exportEntriesForCurrentScope() {
  return state.exportScope === "selected"
    ? selectedPageEntries()
    : activeDoc().pages.map((page, index) => ({ page, index }));
}

function suggestedExportFileName(format, entries) {
  const stem = fileStem(activeDoc().sourceFileName || activeDoc().title || "PDF大编辑");
  const rangeName = state.exportScope === "all" ? "全部页面" : `选中${entries.length}页`;
  if (format === "pdf") return `${stem}-${rangeName}.pdf`;
  if (format === "docx") return `${stem}-${rangeName}.docx`;
  const ext = format === "jpeg" ? "jpg" : "png";
  return entries.length === 1 ? `${stem}-第${entries[0].index + 1}页.${ext}` : `${stem}-${rangeName}-${ext}.zip`;
}

function syncExportFormatControls() {
  const format = els.exportDialog.querySelector('input[name="exportFormat"]:checked')?.value || "pdf";
  const isWord = format === "docx";
  els.exportQualityGroup.classList.toggle("hidden", isWord);
  els.wordModeGroup.classList.toggle("hidden", !isWord);
  els.exportDialogNote.textContent = isWord
    ? "默认“保留原版式”会把每页以高清版式放入 Word，间距、字号、颜色和排版最接近原 PDF；“可编辑文字”适合继续修改。"
    : "预估大小会因页面内容有所浮动。下一步可在系统窗口中填写文件名并选择保存位置；多张图片会保存为 ZIP。";
  els.exportConfirmBtn.textContent = isWord ? "转换并保存" : "下一步";
}

async function updateExportSizeEstimates() {
  const token = ++exportEstimateToken;
  const entries = exportEntriesForCurrentScope();
  const format = els.exportDialog.querySelector('input[name="exportFormat"]:checked')?.value || "pdf";
  const targets = {
    original: els.qualityEstimateOriginal,
    high: els.qualityEstimateHigh,
    balanced: els.qualityEstimateBalanced,
    compact: els.qualityEstimateCompact,
  };
  Object.values(targets).forEach((element) => { element.textContent = "估算中"; });
  if (format === "docx") return;

  if (format === "pdf") {
    try {
      const estimates = await estimatePdfExportBytes(entries);
      if (token !== exportEstimateToken) return;
      Object.entries(targets).forEach(([quality, element]) => {
        element.textContent = `约 ${formatBytes(estimates[quality])}`;
      });
    } catch (error) {
      console.warn("PDF 大小采样失败，使用保守估算。", error);
      if (token !== exportEstimateToken) return;
      const base = estimateOriginalExportBytes(entries, format);
      Object.entries(targets).forEach(([quality, element]) => {
        element.textContent = `约 ${formatBytes(base * EXPORT_QUALITY_PROFILES[quality].estimateRatio)}`;
      });
    }
    return;
  }

  try {
    const estimates = await estimateImageExportBytes(entries, format);
    if (token !== exportEstimateToken) return;
    Object.entries(targets).forEach(([quality, element]) => {
      element.textContent = `约 ${formatBytes(estimates[quality])}`;
    });
  } catch (error) {
    console.warn("图片大小采样失败，使用保守估算。", error);
    if (token !== exportEstimateToken) return;
    const base = estimateOriginalExportBytes(entries, format);
    Object.entries(targets).forEach(([quality, element]) => {
      element.textContent = `约 ${formatBytes(base * EXPORT_QUALITY_PROFILES[quality].estimateRatio)}`;
    });
  }
}

async function estimatePdfExportBytes(entries) {
  if (!entries.length) return { original: 0, high: 0, balanced: 0, compact: 0 };
  const pages = entries.map(({ page }) => page);
  const [originalBytes, imageEstimates] = await Promise.all([
    buildPdfBytes(pages),
    estimateImageExportBytes(entries, "jpeg", ["high", "balanced", "compact"]),
  ]);
  const pdfOverhead = 3200 + entries.length * 1100;
  return {
    original: originalBytes.byteLength,
    high: imageEstimates.high + pdfOverhead,
    balanced: imageEstimates.balanced + pdfOverhead,
    compact: imageEstimates.compact + pdfOverhead,
  };
}

async function estimateImageExportBytes(entries, format, qualities = Object.keys(EXPORT_QUALITY_PROFILES)) {
  if (!entries.length) return { original: 0, high: 0, balanced: 0, compact: 0 };
  const sampleIndexes = [...new Set([0, Math.floor((entries.length - 1) / 2), entries.length - 1])];
  const samples = sampleIndexes.map((index) => entries[index]);
  const exponent = format === "png" ? 0.94 : 0.9;
  const estimates = {};

  for (const quality of qualities) {
    const profile = EXPORT_QUALITY_PROFILES[quality];
    const rates = [];
    for (const { page } of samples) {
      const dimensions = visualPageDimensions(page);
      const fullScale = page.type === "image" ? profile.imageScale : profile.pdfScale;
      const fullWidth = Math.max(1, Math.round(dimensions.width * fullScale));
      const fullHeight = Math.max(1, Math.round(dimensions.height * fullScale));
      const sampleFactor = Math.min(1, 520 / Math.max(fullWidth, fullHeight));
      const sampleScale = fullScale * sampleFactor;
      const sampleWidth = Math.max(1, Math.round(dimensions.width * sampleScale));
      const sampleHeight = Math.max(1, Math.round(dimensions.height * sampleScale));
      const blob = await encodePageImage(page, format, profile, sampleScale);
      rates.push(blob.size / Math.pow(sampleWidth * sampleHeight, exponent));
    }
    const averageRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    estimates[quality] = entries.reduce((total, { page }) => {
      const dimensions = visualPageDimensions(page);
      const scale = page.type === "image" ? profile.imageScale : profile.pdfScale;
      const pixels = Math.max(1, Math.round(dimensions.width * scale)) * Math.max(1, Math.round(dimensions.height * scale));
      return total + averageRate * Math.pow(pixels, exponent);
    }, entries.length > 1 ? entries.length * 140 : 0);
  }
  return estimates;
}

function estimateOriginalExportBytes(entries, format) {
  if (!entries.length) return 0;
  if (format === "pdf") {
    return entries.reduce((total, { page }) => {
      const pageBytes = page.type === "pdf" ? page.bytes.byteLength / Math.max(1, page.pdf?.numPages || 1) : page.bytes.byteLength;
      return total + pageBytes + (page.annotations?.length || 0) * 24000;
    }, 0) * 1.05;
  }
  const bytesPerPixel = format === "jpeg" ? 0.32 : 0.9;
  return entries.reduce((total, { page }) => total + page.width * page.height * bytesPerPixel, 0);
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

async function exportAllPdf() {
  if (!activeDoc().pages.length) return showToast("请先加入文件。");
  const bytes = await buildPdfBytes(activeDoc().pages);
  downloadBlob(bytes, "全部页面.pdf", "application/pdf");
  showToast("已导出全部页面 PDF。");
}

async function printFullPdf() {
  if (!activeDoc().pages.length) return showToast("请先加入文件。");
  showLoading("正在准备打印预览…", 2);
  try {
    const bytes = await buildPdfBytes(activeDoc().pages, (completed, total) => {
      updateLoading(`正在准备第 ${completed} / ${total} 页`, 5 + (completed / total) * 88);
    });
    closePrintPreview();
    printPreviewUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    els.printPreviewFrame.src = printPreviewUrl;
    els.printPageSummary.textContent = `${activeDoc().pages.length} 页`;
    els.printDialog.classList.remove("hidden");
    els.printConfirmBtn.focus();
  } catch (error) {
    console.error(error);
    showToast("无法生成打印预览，请重试。");
  } finally {
    hideLoading("打印预览已准备");
  }
}

function printPreviewDocument() {
  const target = els.printPreviewFrame.contentWindow;
  if (!target) return showToast("打印预览尚未准备好。");
  target.focus();
  target.print();
}

function closePrintPreview() {
  els.printDialog.classList.add("hidden");
  els.printPreviewFrame.removeAttribute("src");
  if (printPreviewUrl) URL.revokeObjectURL(printPreviewUrl);
  printPreviewUrl = null;
}

async function exportSelectedPagePdf() {
  const page = currentPage();
  if (!page) return showToast("请先选中一页。");
  const bytes = await buildPdfBytes([page]);
  downloadBlob(bytes, fileStem(page.title) + `-第${activeDoc().selectedIndex + 1}页.pdf`, "application/pdf");
}

async function exportSelectedPageImage(kind) {
  const page = currentPage();
  if (!page) return showToast("请先选中一页。");
  const type = kind === "jpeg" ? "image/jpeg" : "image/png";
  const blob = await pageImageBlob(page, kind);
  downloadBlob(blob, fileStem(page.title) + `-第${activeDoc().selectedIndex + 1}页.${kind === "jpeg" ? "jpg" : "png"}`, type);
}

async function exportAllPageImages(kind) {
  if (!activeDoc().pages.length) return showToast("请先加入文件。");
  showToast("正在打包图片，请稍等。");
  const ext = kind === "jpeg" ? "jpg" : "png";
  const mime = kind === "jpeg" ? "image/jpeg" : "image/png";
  const files = [];
  for (let i = 0; i < activeDoc().pages.length; i += 1) {
    const blob = await pageImageBlob(activeDoc().pages[i], kind);
    files.push({
      name: `page-${String(i + 1).padStart(3, "0")}.${ext}`,
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mime,
    });
  }
  const zip = makeZip(files);
  downloadBlob(zip, `全部页面-${ext}.zip`, "application/zip");
  showToast(`已导出全部页面 ${ext.toUpperCase()} 图片。`);
}

async function pageImageBlob(page, kind, quality = "original") {
  const profile = EXPORT_QUALITY_PROFILES[quality] || EXPORT_QUALITY_PROFILES.original;
  const renderScale = page.type === "image" ? profile.imageScale : profile.pdfScale;
  return encodePageImage(page, kind, profile, renderScale);
}

async function encodePageImage(page, kind, profile, renderScale) {
  const canvas = document.createElement("canvas");
  await renderPageToCanvas(page, canvas, renderScale, { includeAnnotations: true, pixelRatio: 1 });
  if (kind === "png" && profile.pngQuantize > 1) quantizeCanvasColors(canvas, profile.pngQuantize);
  const type = kind === "jpeg" ? "image/jpeg" : "image/png";
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("图片编码失败，请尝试较低质量档位。"));
    }, type, profile.jpegQuality);
  });
}

function quantizeCanvasColors(canvas, step) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    data[index] = Math.min(255, Math.round(data[index] / step) * step);
    data[index + 1] = Math.min(255, Math.round(data[index + 1] / step) * step);
    data[index + 2] = Math.min(255, Math.round(data[index + 2] / step) * step);
  }
  context.putImageData(image, 0, 0);
}

async function buildCompressedPdfBytes(pages, quality = "balanced") {
  const profile = EXPORT_QUALITY_PROFILES[quality] || EXPORT_QUALITY_PROFILES.balanced;
  const out = await PDFDocument.create();
  for (const page of pages) {
    const canvas = document.createElement("canvas");
    const renderScale = page.type === "image" ? profile.imageScale : profile.pdfScale;
    await renderPageToCanvas(page, canvas, renderScale, { includeAnnotations: true, pixelRatio: 1 });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", profile.jpegQuality));
    const image = await out.embedJpg(await blob.arrayBuffer());
    const dimensions = {
      width: Math.max(1, parseFloat(canvas.style.width) / renderScale),
      height: Math.max(1, parseFloat(canvas.style.height) / renderScale),
    };
    const pdfPage = out.addPage([dimensions.width, dimensions.height]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: dimensions.width, height: dimensions.height });
  }
  return out.save({ useObjectStreams: true });
}

async function buildPdfBytes(pages, onProgress = () => {}) {
  const out = await PDFDocument.create();
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (page.type === "pdf") {
      const source = await PDFDocument.load(page.bytes);
      const [copied] = await out.copyPages(source, [page.sourceIndex]);
      const finalRotation = normalizeRotation((copied.getRotation().angle || 0) + page.rotation);
      copied.setRotation(degrees(finalRotation));
      out.addPage(copied);
      const mediaWidth = copied.getWidth();
      const mediaHeight = copied.getHeight();
      const rotated = Math.abs(finalRotation % 180) === 90;
      await addAnnotationOverlay(out, copied, page, rotated ? mediaHeight : mediaWidth, rotated ? mediaWidth : mediaHeight, finalRotation);
    } else {
      const image = page.mime.includes("png") ? await out.embedPng(page.bytes) : await out.embedJpg(page.bytes);
      const rotated = Math.abs(page.rotation % 180) === 90;
      const visualWidth = rotated ? page.height : page.width;
      const visualHeight = rotated ? page.width : page.height;
      const pdfPage = out.addPage([visualWidth, visualHeight]);
      const placement = imagePlacement(page);
      pdfPage.drawImage(image, {
        x: placement.x,
        y: placement.y,
        width: page.width,
        height: page.height,
        rotate: degrees(page.rotation),
      });
      await addAnnotationOverlay(out, pdfPage, page, visualWidth, visualHeight, 0);
    }
    onProgress(index + 1, pages.length);
    if (index % 3 === 2) await wait(0);
  }
  return out.save({ useObjectStreams: true });
}

function drawAnnotations(ctx, page, width, height, scale) {
  (page.annotations || []).forEach((annotation) => {
    if (annotation.type === "draw" || annotation.type === "line") {
      drawCanvasStroke(ctx, annotation, width, height, scale);
      return;
    }
    const x = annotation.x * width;
    const y = annotation.y * height;
    const boxWidth = annotation.width * width;
    const boxHeight = annotation.height * height;
    ctx.save();
    if (annotation.type === "text") {
      ctx.beginPath();
      ctx.rect(x, y, boxWidth, boxHeight);
      ctx.clip();
      const fontSize = Math.max(6, annotation.fontSize * scale);
      const fontStyle = `${annotation.italic ? "italic " : ""}${annotation.bold ? "700 " : "400 "}${fontSize}px ${quoteFontFamily(annotation.fontFamily)}`;
      ctx.font = fontStyle;
      ctx.fillStyle = annotation.color;
      ctx.textBaseline = "top";
      ctx.textAlign = annotation.align;
      const lines = wrapCanvasText(ctx, annotation.text, Math.max(4, boxWidth - 8 * scale));
      const lineHeight = fontSize * 1.2;
      const textY = y + 4 * scale;
      const textX = annotation.align === "left"
        ? x + 4 * scale
        : annotation.align === "right" ? x + boxWidth - 4 * scale : x + boxWidth / 2;
      lines.forEach((line, index) => {
        const lineY = textY + index * lineHeight;
        ctx.fillText(line, textX, lineY, Math.max(1, boxWidth - 8 * scale));
        if (annotation.underline && line) {
          const lineWidth = Math.min(ctx.measureText(line).width, boxWidth - 8 * scale);
          const underlineX = annotation.align === "left"
            ? textX
            : annotation.align === "right" ? textX - lineWidth : textX - lineWidth / 2;
          ctx.beginPath();
          ctx.lineWidth = Math.max(1, fontSize / 18);
          ctx.moveTo(underlineX, lineY + fontSize + 1);
          ctx.lineTo(underlineX + lineWidth, lineY + fontSize + 1);
          ctx.strokeStyle = annotation.color;
          ctx.stroke();
        }
      });
    } else {
      const borderWidth = Math.max(0, annotation.borderWidth * scale);
      ctx.beginPath();
      if (annotation.type === "circle") {
        ctx.ellipse(x + boxWidth / 2, y + boxHeight / 2, Math.max(1, boxWidth / 2 - borderWidth / 2), Math.max(1, boxHeight / 2 - borderWidth / 2), 0, 0, Math.PI * 2);
      } else {
        ctx.rect(x + borderWidth / 2, y + borderWidth / 2, Math.max(1, boxWidth - borderWidth), Math.max(1, boxHeight - borderWidth));
      }
      if (annotation.fillEnabled) {
        ctx.fillStyle = annotation.fillColor;
        ctx.fill();
      }
      if (borderWidth > 0) {
        ctx.lineWidth = borderWidth;
        ctx.strokeStyle = annotation.borderColor;
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}

function drawCanvasStroke(ctx, annotation, width, height, scale) {
  const points = annotation.points || [];
  if (!points.length) return;
  ctx.save();
  ctx.strokeStyle = annotation.color;
  ctx.fillStyle = annotation.color;
  ctx.lineWidth = Math.max(0.5, annotation.lineWidth * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(drawingDashPattern(annotation.dash, annotation.lineWidth * scale));
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x * width, points[0].y * height, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x * width, points[0].y * height);
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    ctx.quadraticCurveTo(point.x * width, point.y * height, (point.x + next.x) * width / 2, (point.y + next.y) * height / 2);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x * width, last.y * height);
  ctx.stroke();
  ctx.restore();
}

function wrapCanvasText(ctx, text, maxWidth) {
  const lines = [];
  String(text).split("\n").forEach((paragraph) => {
    if (!paragraph) {
      lines.push("");
      return;
    }
    let line = "";
    Array.from(paragraph).forEach((character) => {
      const candidate = line + character;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    lines.push(line);
  });
  return lines.length ? lines : [""];
}

async function addAnnotationOverlay(pdf, pdfPage, sourcePage, visualWidth, visualHeight, rotation) {
  if (!sourcePage.annotations?.length) return;
  const overlayBytes = await makeAnnotationOverlay(sourcePage, visualWidth, visualHeight);
  const overlay = await pdf.embedPng(overlayBytes);
  switch (normalizeRotation(rotation)) {
    case 90:
      pdfPage.drawImage(overlay, { x: 0, y: visualWidth, width: visualWidth, height: visualHeight, rotate: degrees(-90) });
      break;
    case 180:
      pdfPage.drawImage(overlay, { x: visualWidth, y: visualHeight, width: visualWidth, height: visualHeight, rotate: degrees(-180) });
      break;
    case 270:
      pdfPage.drawImage(overlay, { x: visualHeight, y: 0, width: visualWidth, height: visualHeight, rotate: degrees(90) });
      break;
    default:
      pdfPage.drawImage(overlay, { x: 0, y: 0, width: visualWidth, height: visualHeight });
  }
}

async function makeAnnotationOverlay(page, width, height) {
  const pixelRatio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * pixelRatio));
  canvas.height = Math.max(1, Math.ceil(height * pixelRatio));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawAnnotations(ctx, page, width, height, 1);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

function imagePlacement(page) {
  switch (normalizeRotation(page.rotation)) {
    case 90:
      return { x: page.height, y: 0 };
    case 180:
      return { x: page.width, y: page.height };
    case 270:
      return { x: 0, y: page.width };
    default:
      return { x: 0, y: 0 };
  }
}

async function maybeLoadDemo() {
  if (!new URLSearchParams(location.search).has("demo")) return;
  const demoPdf = await PDFDocument.create();
  const colors = [
    [0.79, 0.3, 0.21],
    [0.18, 0.42, 0.87],
    [0.16, 0.51, 0.35],
  ];
  colors.forEach((color, index) => {
    const page = demoPdf.addPage([595, 842]);
    page.drawRectangle({ x: 54, y: 672, width: 487, height: 92, color: PDFLib.rgb(...color) });
    page.drawText(`Demo PDF Page ${index + 1}`, { x: 72, y: 704, size: 28, color: PDFLib.rgb(0.1, 0.1, 0.12) });
    page.drawText("PDF Studio render test", { x: 72, y: 626, size: 14, color: PDFLib.rgb(0.25, 0.26, 0.3) });
  });
  await addPdf(new File([await demoPdf.save()], "demo.pdf", { type: "application/pdf" }), await demoPdf.save());

  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#faf9f6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#2a825a";
  ctx.fillRect(60, 60, 780, 120);
  ctx.fillStyle = "#ffffff";
  ctx.font = "42px sans-serif";
  ctx.fillText("JPG page added to PDF", 90, 132);
  ctx.strokeStyle = "#c94c36";
  ctx.lineWidth = 8;
  ctx.strokeRect(100, 260, 700, 210);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.96));
  await addImage(new File([blob], "demo-photo.jpg", { type: "image/jpeg" }), await blob.arrayBuffer());
  activeDoc().sourceCount = 2;
  activeDoc().selectedIndex = 0;
  await renderAll();
  showToast("已载入演示文档。");
}

function handleZoomSliderInput() {
  const pageId = prepareCurrentPageForZoom();
  const percent = Number(els.zoomSlider.value);
  setZoomScale(percent / 100, pageId);
}

function prepareCurrentPageForZoom() {
  if (!state.zooming || !state.zoomPageId) {
    syncCurrentFromScroll();
    state.zoomPageId = currentPage()?.id || null;
    state.zoomCenter = capturePageCenter(state.zoomPageId);
  }
  return state.zoomPageId;
}

function setZoomScale(scale, pageId = state.zoomPageId) {
  const nextScale = clamp(scale, 0.1, 2.5);
  zoomCommitToken += 1;
  renderToken += 1;
  state.scale = nextScale;
  const percent = Math.round(nextScale * 100);
  els.zoomSlider.value = String(percent);
  els.zoomValue.textContent = `${percent}%`;
  applyLiveZoom(nextScale, pageId);
  clearTimeout(zoomRenderTimer);
  zoomRenderTimer = setTimeout(commitZoomRender, 140);
}

function applyLiveZoom(targetScale, pageId = state.zoomPageId) {
  if (state.mode === "overview") return;
  state.zooming = true;
  cancelAnimationFrame(zoomLiveFrame);
  zoomLiveFrame = requestAnimationFrame(() => {
    document.querySelectorAll(".page-frame[data-render-scale]").forEach((frame) => {
      const renderedScale = Number(frame.dataset.renderScale);
      const renderedWidth = Number(frame.dataset.renderWidth);
      const renderedHeight = Number(frame.dataset.renderHeight);
      if (!renderedScale || !renderedWidth || !renderedHeight) return;
      const factor = targetScale / renderedScale;
      const surface = frame.querySelector(".page-surface");
      frame.style.width = `${renderedWidth * factor}px`;
      frame.style.height = `${renderedHeight * factor}px`;
      surface.style.transformOrigin = "top left";
      surface.style.transform = `scale(${factor})`;
    });
    restorePageCenter(pageId, state.zoomCenter);
    schedulePageNavigatorUpdate();
  });
}

async function commitZoomRender() {
  clearTimeout(zoomRenderTimer);
  zoomRenderTimer = null;
  cancelAnimationFrame(zoomLiveFrame);
  const pageId = state.zoomPageId || prepareCurrentPageForZoom();
  const token = ++zoomCommitToken;
  state.zooming = true;
  try {
    await renderAll({ keepScroll: true });
    if (token !== zoomCommitToken) return;
    await nextAnimationFrame();
    if (token !== zoomCommitToken) return;
    restorePageCenter(pageId, state.zoomCenter);
    await nextAnimationFrame();
    if (token !== zoomCommitToken) return;
    restorePageCenter(pageId, state.zoomCenter);
    schedulePageNavigatorUpdate();
  } finally {
    if (token === zoomCommitToken) {
      state.zooming = false;
      state.zoomPageId = null;
      state.zoomCenter = null;
    }
  }
}

async function resetZoomToFit() {
  const pageId = prepareCurrentPageForZoom();
  const index = activeDoc().pages.findIndex((page) => page.id === pageId);
  const page = activeDoc().pages[index];
  if (!page || state.mode === "overview") return;
  clearTimeout(zoomRenderTimer);
  zoomRenderTimer = null;
  cancelAnimationFrame(zoomLiveFrame);
  const token = ++zoomCommitToken;
  renderToken += 1;
  state.zooming = true;
  state.scale = getBestPageScale(page);
  try {
    await renderAll();
    if (token !== zoomCommitToken) return;
    await nextAnimationFrame();
    if (token !== zoomCommitToken) return;
    selectPage(index, false, "preserve");
    centerPageById(pageId);
    await nextAnimationFrame();
    if (token !== zoomCommitToken) return;
    centerPageById(pageId);
    schedulePageNavigatorUpdate();
  } finally {
    if (token === zoomCommitToken) {
      state.zooming = false;
      state.zoomPageId = null;
      state.zoomCenter = null;
    }
  }
}

function capturePageCenter(pageId) {
  const surface = document.querySelector(`.page-frame[data-id="${pageId}"] .page-surface`);
  if (!surface) return null;
  const rect = surface.getBoundingClientRect();
  return {
    screenX: rect.left + rect.width / 2,
    screenY: rect.top + rect.height / 2,
  };
}

function restorePageCenter(pageId, center) {
  if (!center) return;
  const surface = document.querySelector(`.page-frame[data-id="${pageId}"] .page-surface`);
  if (!surface) return;
  const rect = surface.getBoundingClientRect();
  setViewerScrollInstant(
    els.viewer.scrollLeft + rect.left + rect.width / 2 - center.screenX,
    els.viewer.scrollTop + rect.top + rect.height / 2 - center.screenY,
  );
}

function centerPageById(pageId) {
  const surface = document.querySelector(`.page-frame[data-id="${pageId}"] .page-surface`);
  if (!surface) return;
  const viewerRect = getViewerViewportRect();
  const surfaceRect = surface.getBoundingClientRect();
  setViewerScrollInstant(
    els.viewer.scrollLeft + surfaceRect.left + surfaceRect.width / 2 - (viewerRect.left + viewerRect.width / 2),
    els.viewer.scrollTop + surfaceRect.top + surfaceRect.height / 2 - (viewerRect.top + viewerRect.height / 2),
  );
}

function getViewerViewportRect() {
  const rect = els.viewer.getBoundingClientRect();
  const left = rect.left + els.viewer.clientLeft;
  const top = rect.top + els.viewer.clientTop;
  return {
    left,
    top,
    width: els.viewer.clientWidth,
    height: els.viewer.clientHeight,
    right: left + els.viewer.clientWidth,
    bottom: top + els.viewer.clientHeight,
  };
}

function setViewerScrollInstant(left, top) {
  const maxLeft = Math.max(0, els.viewer.scrollWidth - els.viewer.clientWidth);
  const maxTop = Math.max(0, els.viewer.scrollHeight - els.viewer.clientHeight);
  const previousBehavior = els.viewer.style.scrollBehavior;
  els.viewer.style.scrollBehavior = "auto";
  els.viewer.scrollLeft = clamp(left, 0, maxLeft);
  els.viewer.scrollTop = clamp(top, 0, maxTop);
  els.viewer.style.scrollBehavior = previousBehavior;
}

function handleViewerPinchZoom(event) {
  if (!event.ctrlKey || gestureStartScale !== null || !currentPage() || state.mode === "overview") return;
  event.preventDefault();
  const pageId = prepareCurrentPageForZoom();
  const page = activeDoc().pages.find((candidate) => candidate.id === pageId) || currentPage();
  const scale = state.scale === "fit" ? getRenderScale(page) : state.scale;
  const factor = Math.exp(-event.deltaY * 0.0025);
  setZoomScale(scale * factor, pageId);
}

function handleGestureStart(event) {
  if (!currentPage() || state.mode === "overview") return;
  event.preventDefault();
  const pageId = prepareCurrentPageForZoom();
  const page = activeDoc().pages.find((candidate) => candidate.id === pageId) || currentPage();
  gestureStartScale = state.scale === "fit" ? getRenderScale(page) : state.scale;
}

function handleGestureChange(event) {
  if (gestureStartScale === null || !currentPage() || state.mode === "overview") return;
  event.preventDefault();
  setZoomScale(gestureStartScale * event.scale, state.zoomPageId);
}

function handleGestureEnd(event) {
  if (gestureStartScale === null) return;
  event.preventDefault();
  gestureStartScale = null;
  commitZoomRender();
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function getBestPageScale(page) {
  const dimensions = visualPageDimensions(page);
  const availableWidth = Math.max(120, els.viewer.clientWidth - 86);
  const availableHeight = Math.max(120, els.viewer.clientHeight - 70);
  return clamp(Math.min(availableWidth / dimensions.width, availableHeight / dimensions.height), 0.1, 2.5);
}

function syncZoomControl() {
  const page = currentPage();
  const hasPage = Boolean(page);
  els.zoomSlider.disabled = !hasPage || state.mode === "overview";
  els.resetZoomBtn.disabled = !hasPage || state.mode === "overview";
  if (!page) {
    els.zoomSlider.value = "100";
    els.zoomValue.textContent = "100%";
    return;
  }
  const scale = state.scale === "fit" ? getRenderScale(page) : state.scale;
  const percent = clamp(Math.round(scale * 100), Number(els.zoomSlider.min), Number(els.zoomSlider.max));
  els.zoomSlider.value = String(percent);
  els.zoomValue.textContent = state.mode === "overview" ? "总览" : `${percent}%`;
}

function updateUi() {
  renderTabs();
  const total = activeDoc().pages.length;
  els.dropZone.classList.toggle("hidden", total > 0);
  els.pageTotal.textContent = total;
  els.pageNumber.value = total ? activeDoc().selectedIndex + 1 : 0;
  els.pageNumber.max = Math.max(1, total);
  els.metaPages.textContent = total;
  els.metaFiles.textContent = activeDoc().sourceCount;
  els.metaCurrent.textContent = total ? selectedPageEntries().length : 0;
  els.selectAllBtn.textContent = total && activeDoc().selectedPageIds.length === total ? "取消全选" : "全选";
  els.selectAllBtn.classList.toggle("hidden", state.mode !== "overview");
  const hasPage = total > 0;
  syncZoomControl();
  [
    els.savePdfBtn,
    els.exportBtn,
    els.printBtn,
    els.menuPrintBtn,
    els.menuSearchBtn,
    els.menuZoomOutBtn,
    els.menuZoomInBtn,
    els.menuFitBtn,
    els.menuContinuousBtn,
    els.menuSingleBtn,
    els.menuOverviewBtn,
    els.searchInput,
    els.searchBtn,
    els.prevBtn,
    els.nextBtn,
    els.rotateLeftBtn,
    els.rotateRightBtn,
    els.deleteBtn,
    els.duplicateBtn,
    els.addTextBtn,
    els.addRectBtn,
    els.addCircleBtn,
    els.selectToolBtn,
    els.drawBtn,
    els.lineBtn,
    els.selectAllBtn,
    els.exportAllMenuBtn,
    els.exportSelectedMenuBtn,
  ].forEach((button) => {
    button.disabled = !hasPage;
  });
}

async function buildWordDocument(entries, mode = "fidelity") {
  const encoder = new TextEncoder();
  const mediaFiles = [];
  const imageRelationships = [];
  const bodyParts = [];
  let imageId = 0;

  for (let position = 0; position < entries.length; position += 1) {
    const { page, index } = entries[position];
    updateLoading(`正在转换第 ${position + 1} / ${entries.length} 页`, 5 + ((position + 1) / entries.length) * 86);
    const textLines = await extractWordTextLines(page);
    const editableCharacters = textLines.reduce((total, line) => total + line.text.replace(/\s/g, "").length, 0);
    const usePageImage = mode === "fidelity" || page.type === "image" || editableCharacters < 8;

    if (usePageImage) {
      imageId += 1;
      const image = await renderWordPageImage(page);
      const fileName = `image${imageId}.png`;
      const relationshipId = `rIdImage${imageId}`;
      mediaFiles.push({ name: `word/media/${fileName}`, bytes: image.bytes });
      imageRelationships.push(
        `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fileName}"/>`,
      );
      const hiddenText = mode === "fidelity" ? textLines.map((line) => line.text).join("\n") : "";
      bodyParts.push(wordImageParagraphXml(relationshipId, image.width, image.height, imageId, index + 1, hiddenText));
    } else {
      const medianSize = median(textLines.map((line) => line.fontSize).filter(Boolean)) || 11;
      textLines.forEach((line) => {
        bodyParts.push(wordParagraphXml(line.text, {
          fontSize: line.fontSize,
          bold: line.bold || (line.fontSize > medianSize * 1.28 && line.text.length < 100),
          after: line.after,
        }));
      });
      wordAnnotationParagraphs(page).forEach((paragraph) => bodyParts.push(paragraph));
    }

    if (position < entries.length - 1) bodyParts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  }

  const title = fileStem(activeDoc().sourceFileName || activeDoc().title || "PDF大编辑");
  const createdAt = new Date().toISOString();
  const files = [
    {
      name: "[Content_Types].xml",
      bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`),
    },
    {
      name: "_rels/.rels",
      bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`),
    },
    {
      name: "word/document.xml",
      bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${bodyParts.join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="425" w:footer="425" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`),
    },
    {
      name: "word/styles.xml",
      bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`),
    },
    {
      name: "word/_rels/document.xml.rels",
      bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${imageRelationships.join("\n  ")}
</Relationships>`),
    },
    {
      name: "docProps/core.xml",
      bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${wordXmlEscape(title)}</dc:title>
  <dc:creator>PDF大编辑</dc:creator>
  <cp:lastModifiedBy>PDF大编辑</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>
</cp:coreProperties>`),
    },
    {
      name: "docProps/app.xml",
      bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>PDF大编辑</Application>
  <AppVersion>1.0</AppVersion>
</Properties>`),
    },
    ...mediaFiles,
  ];

  updateLoading("正在生成 Word 文件…", 96);
  return makeZip(files, DOCX_MIME);
}

async function extractWordTextLines(page) {
  if (page.type !== "pdf") return [];
  try {
    const sourcePage = await page.pdf.getPage(page.sourceIndex + 1);
    const content = await sourcePage.getTextContent();
    const fragments = content.items
      .filter((item) => typeof item.str === "string" && item.str.trim())
      .map((item) => {
        const transform = item.transform || [];
        const fontSize = Math.max(6, item.height || Math.hypot(transform[2] || 0, transform[3] || 0) || 11);
        return {
          text: item.str,
          x: transform[4] || 0,
          y: transform[5] || 0,
          width: Math.max(0, item.width || 0),
          fontSize,
          bold: /bold|black|heavy|semibold/i.test(item.fontName || ""),
        };
      })
      .sort((a, b) => Math.abs(b.y - a.y) > 1 ? b.y - a.y : a.x - b.x);
    const lines = [];

    fragments.forEach((fragment) => {
      const previousLine = lines[lines.length - 1];
      const tolerance = Math.max(2.5, Math.min(7, fragment.fontSize * 0.42));
      if (!previousLine || Math.abs(previousLine.y - fragment.y) > tolerance) {
        lines.push({ y: fragment.y, items: [fragment] });
      } else {
        previousLine.items.push(fragment);
        previousLine.y = (previousLine.y * (previousLine.items.length - 1) + fragment.y) / previousLine.items.length;
      }
    });

    return lines.map((line, lineIndex) => {
      line.items.sort((a, b) => a.x - b.x);
      const text = mergeWordLineFragments(line.items);
      const fontSize = median(line.items.map((item) => item.fontSize)) || 11;
      const nextLine = lines[lineIndex + 1];
      const verticalGap = nextLine ? Math.abs(line.y - nextLine.y) : fontSize;
      return {
        text,
        fontSize: clamp(fontSize, 8, 36),
        bold: line.items.filter((item) => item.bold).length > line.items.length / 2,
        after: verticalGap > fontSize * 1.75 ? 180 : 45,
      };
    }).filter((line) => line.text.trim());
  } catch (error) {
    console.warn("无法提取页面文字，将保留页面图像。", error);
    return [];
  }
}

function mergeWordLineFragments(items) {
  let text = "";
  let previous = null;
  items.forEach((item) => {
    if (previous) {
      const gap = item.x - (previous.x + previous.width);
      const fontSize = Math.max(previous.fontSize, item.fontSize);
      if (gap > fontSize * 2.2) {
        text += "\t";
      } else if (wordFragmentsNeedSpace(previous.text, item.text, gap, fontSize)) {
        text += " ";
      }
    }
    text += item.text;
    previous = item;
  });
  return text.trim();
}

function wordFragmentsNeedSpace(previousText, nextText, gap, fontSize) {
  if (gap <= fontSize * 0.08) return false;
  const previous = Array.from(previousText).at(-1) || "";
  const next = Array.from(nextText)[0] || "";
  if (/[\u3400-\u9fff]/u.test(previous) && /[\u3400-\u9fff]/u.test(next)) return false;
  if (/[(\[{"“‘《（【]/u.test(previous) || /[.,!?;:)\]}"”’。，！？；：》）】]/u.test(next)) return false;
  if (/[\p{L}\p{N}]/u.test(previous) && /[\p{L}\p{N}]/u.test(next)) return true;
  return gap > fontSize * 0.32;
}

function wordAnnotationParagraphs(page) {
  return (page.annotations || [])
    .filter((annotation) => annotation.type === "text" && annotation.text?.trim())
    .flatMap((annotation) => String(annotation.text).split("\n").map((line) => wordParagraphXml(line, {
      fontFamily: annotation.fontFamily,
      fontSize: annotation.fontSize,
      color: annotation.color,
      bold: annotation.bold,
      italic: annotation.italic,
      underline: annotation.underline,
      align: annotation.align,
      after: 80,
    })));
}

async function renderWordPageImage(page) {
  const dimensions = visualPageDimensions(page);
  const renderScale = clamp(2200 / Math.max(dimensions.width, dimensions.height), 0.35, 2.6);
  const canvas = document.createElement("canvas");
  await renderPageToCanvas(page, canvas, renderScale, { includeAnnotations: true, pixelRatio: 1 });
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("无法生成页面图像")), "image/png");
  });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: Math.max(1, canvas.width),
    height: Math.max(1, canvas.height),
  };
}

function wordParagraphXml(text, options = {}) {
  const fontSize = clamp(Number(options.fontSize) || 11, 6, 72);
  const halfPoints = Math.round(fontSize * 2);
  const fontFamily = wordXmlEscape(options.fontFamily || "Arial");
  const color = String(options.color || "#202124").replace("#", "").toUpperCase();
  const align = ["left", "center", "right"].includes(options.align) ? options.align : "left";
  const runProperties = [
    `<w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}" w:eastAsia="${fontFamily}"/>`,
    `<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`,
    `<w:color w:val="${/^[0-9A-F]{6}$/.test(color) ? color : "202124"}"/>`,
    options.bold ? "<w:b/><w:bCs/>" : "",
    options.italic ? "<w:i/><w:iCs/>" : "",
    options.underline ? '<w:u w:val="single"/>' : "",
  ].join("");
  const runs = String(text).split("\t").map((part, index) => {
    const tab = index ? "<w:tab/>" : "";
    return `<w:r><w:rPr>${runProperties}</w:rPr>${tab}<w:t xml:space="preserve">${wordXmlEscape(part)}</w:t></w:r>`;
  }).join("");
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${Math.max(0, Math.round(options.after ?? 80))}" w:line="${Math.max(240, Math.round(fontSize * 25))}" w:lineRule="auto"/></w:pPr>${runs || "<w:r><w:t></w:t></w:r>"}</w:p>`;
}

function wordImageParagraphXml(relationshipId, width, height, imageId, pageNumber, hiddenText = "") {
  const maxWidth = 6.45 * 914400;
  const maxHeight = 9.35 * 914400;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const cx = Math.max(1, Math.round(width * scale));
  const cy = Math.max(1, Math.round(height * scale));
  return `<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
  <w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
    <wp:extent cx="${cx}" cy="${cy}"/>
    <wp:docPr id="${imageId}" name="Page ${pageNumber}"/>
    <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <pic:pic>
        <pic:nvPicPr><pic:cNvPr id="${imageId}" name="Page ${pageNumber}"/><pic:cNvPicPr/></pic:nvPicPr>
        <pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
        <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
      </pic:pic>
    </a:graphicData></a:graphic>
  </wp:inline></w:drawing></w:r>
  ${hiddenText ? `<w:r><w:rPr><w:vanish/></w:rPr><w:t xml:space="preserve">${wordXmlEscape(hiddenText)}</w:t></w:r>` : ""}
</w:p>`;
}

function wordXmlEscape(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function makeZip(files, mime = "application/zip") {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((now.getSeconds() / 2) & 31);
  const dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const local = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(file.bytes.length), u32(file.bytes.length), u16(name.length), u16(0), name, file.bytes,
    ]);
    const central = concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(file.bytes.length), u32(file.bytes.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  });

  const central = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0),
  ]);
  return new Blob([concatBytes([...localParts, central, end])], { type: mime });
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 255];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function u16(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function u32(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function currentPage() {
  return activeDoc().pages[activeDoc().selectedIndex];
}

function normalizeRotation(value) {
  return ((value % 360) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function guessMime(name) {
  return /\.png$/i.test(name) ? "image/png" : "image/jpeg";
}

function fileStem(name) {
  return name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-") || "page";
}

function shortName(name, limit = 18) {
  return name.length > limit ? `${name.slice(0, Math.max(6, limit - 10))}...${name.slice(-7)}` : name;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function downloadBlob(data, name, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showLoading(message, progress = 0) {
  clearTimeout(loadingHideTimer);
  els.loadingBar.classList.remove("hidden");
  updateLoading(message, progress);
}

function updateLoading(message, progress) {
  const value = clamp(Math.round(progress), 0, 100);
  els.loadingText.textContent = message;
  els.loadingPercent.textContent = `${value}%`;
  els.loadingProgress.value = value;
}

function hideLoading(message = "载入完成") {
  updateLoading(message, 100);
  clearTimeout(loadingHideTimer);
  loadingHideTimer = setTimeout(() => els.loadingBar.classList.add("hidden"), 320);
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function throttle(fn, wait) {
  let lastRun = 0;
  let trailingTimer = null;
  return (...args) => {
    const remaining = wait - (Date.now() - lastRun);
    if (remaining <= 0) {
      clearTimeout(trailingTimer);
      trailingTimer = null;
      lastRun = Date.now();
      fn(...args);
      return;
    }
    if (trailingTimer) return;
    trailingTimer = setTimeout(() => {
      trailingTimer = null;
      lastRun = Date.now();
      fn(...args);
    }, remaining);
  };
}
