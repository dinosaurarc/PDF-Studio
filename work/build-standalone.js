const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appDir = path.join(root, "outputs", "pdf-page-studio");
const indexPath = path.join(appDir, "index.html");

const existingStandalone = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
if (
  existingStandalone.includes("PDF大编辑")
  && existingStandalone.includes('id="printBtn" title="打印"')
  && existingStandalone.includes('id="menuPrintBtn" class="narrow-print-item" role="menuitem">打印</button>')
) {
  console.log("Using checked-in PDF大编辑 standalone page.");
  process.exit(0);
}

const css = fs.readFileSync(path.join(appDir, "styles.css"), "utf8");
const pdfLib = fs.readFileSync(path.join(appDir, "vendor", "pdf-lib.min.js"), "utf8");
const lucide = fs.readFileSync(path.join(appDir, "vendor", "lucide.min.js"), "utf8");
const pdfJs = fs.readFileSync(path.join(appDir, "vendor", "pdf.min.mjs"), "utf8");
const pdfWorker = fs.readFileSync(path.join(appDir, "vendor", "pdf.worker.min.mjs"), "utf8");
const app = fs
  .readFileSync(path.join(appDir, "app.js"), "utf8")
  .replace('import * as pdfjsLib from "./vendor/pdf.min.mjs";', "")
  .replace('pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";', "");

const baseHtml = String.raw`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>PDF大编辑 - PDF Studio</title>
    <style>
__CSS__
    </style>
  </head>
  <body>
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">P</div>
          <h1>PDF大编辑</h1>
        </div>
        <div class="toolbar" role="toolbar" aria-label="PDF 工具栏">
          <button class="text-btn" id="openBtn" title="打开 PDF、PNG 或 JPG">
            <span>打开</span>
          </button>
          <button class="text-btn" id="savePdfBtn" title="保存到原文件">
            <span>保存</span>
          </button>
          <div class="export-menu-wrap">
            <button class="text-btn" id="exportBtn" title="导出页面" aria-haspopup="menu" aria-expanded="false">
              <span>导出</span>
            </button>
            <div id="exportMenu" class="export-menu hidden" role="menu">
              <button id="exportAllMenuBtn" role="menuitem">导出全部页面</button>
              <button id="exportSelectedMenuBtn" role="menuitem"><span id="exportSelectedMenuLabel">导出选中页</span></button>
            </div>
          </div>
          <div class="other-menu-wrap">
            <button class="text-btn" id="otherBtn" title="其他功能" aria-haspopup="menu" aria-expanded="false">
              <span>更多</span>
              <i data-lucide="chevron-down"></i>
            </button>
            <div id="otherMenu" class="export-menu other-menu hidden" role="menu">
              <button id="menuSearchBtn" class="narrow-search-item" role="menuitem">搜索文字</button>
              <button id="menuPrintBtn" role="menuitem">打印</button>
              <button id="menuFullScreenBtn" class="narrow-fullscreen-item" role="menuitem">全屏</button>
              <button id="menuZoomOutBtn" class="narrow-zoom-item" role="menuitem">缩小预览</button>
              <button id="menuZoomInBtn" class="narrow-zoom-item" role="menuitem">放大预览</button>
              <button id="menuFitBtn" class="narrow-zoom-item" role="menuitem">适合页面</button>
              <button id="menuContinuousBtn" class="narrow-mode-item" role="menuitem">连续阅读</button>
              <button id="menuSingleBtn" class="narrow-mode-item" role="menuitem">单页阅读</button>
              <button id="menuOverviewBtn" class="narrow-mode-item" role="menuitem">页面总览</button>
              <span class="menu-divider narrow-menu-divider"></span>
              <button id="checkUpdateBtn" class="desktop-menu-item hidden" role="menuitem">检查更新</button>
              <button id="uninstallBtn" class="desktop-menu-item danger-menu-item hidden" role="menuitem">卸载</button>
            </div>
          </div>
          <span class="toolbar-sep"></span>
          <div class="search-box" role="search">
            <input id="searchInput" type="search" placeholder="搜索文字" aria-label="搜索 PDF 文字">
            <button id="searchBtn" class="text-btn compact" title="搜索 PDF 文字">
              <span>搜索</span>
            </button>
          </div>
          <span class="toolbar-sep"></span>
          <button class="icon-btn" id="prevBtn" title="上一页">
            <i data-lucide="chevron-up"></i>
          </button>
          <div class="page-counter">
            <input id="pageNumber" type="number" min="1" value="0" aria-label="页码">
            <span>/</span>
            <span id="pageTotal">0</span>
          </div>
          <button class="icon-btn" id="nextBtn" title="下一页">
            <i data-lucide="chevron-down"></i>
          </button>
          <span class="toolbar-sep"></span>
          <div class="zoom-slider-control">
            <input id="zoomSlider" type="range" min="10" max="250" step="1" value="100" aria-label="预览大小" title="调整预览大小">
            <output id="zoomValue" for="zoomSlider">适宽</output>
            <span class="zoom-control-separator"></span>
            <button id="resetZoomBtn" class="zoom-reset-btn" title="回到适合当前页面的大小" aria-label="回到适合当前页面的大小"><i data-lucide="rotate-ccw"></i></button>
          </div>
          <div class="segmented" aria-label="阅读模式">
            <button id="continuousBtn" class="active">连续</button>
            <button id="singleBtn">单页</button>
            <button id="overviewBtn">总览</button>
          </div>
          <button class="text-btn" id="fullScreenBtn" title="进入全屏模式">
            <span>全屏</span>
          </button>
        </div>
      </header>

      <nav id="docTabs" class="doc-tabs" aria-label="已打开的 PDF 文件"></nav>

      <aside class="thumb-rail">
        <div class="rail-head">
          <strong>页面</strong>
          <div class="rail-head-actions">
            <button class="icon-btn small" id="addBtn" title="继续添加文件">
              <i data-lucide="plus"></i>
            </button>
          </div>
        </div>
        <div id="thumbList" class="thumb-list" aria-label="可拖动页面缩略图"></div>
      </aside>

      <button class="panel-edge-toggle left-edge-toggle" id="thumbRailToggle" title="收起页面栏" aria-label="收起页面栏" aria-expanded="true">
        <i data-lucide="chevron-left"></i>
      </button>

      <main class="viewer-wrap">
        <button class="text-btn compact overview-select-all hidden" id="selectAllBtn" title="选择全部页面">全选</button>
        <div id="dropZone" class="drop-zone">
          <div class="drop-card">
            <i data-lucide="file-up"></i>
            <h2>拖入文件</h2>
            <button id="emptyOpenBtn" class="primary-btn">选择文件</button>
          </div>
        </div>
        <div id="viewer" class="viewer" tabindex="0" aria-label="PDF 页面阅读区"></div>
        <div id="pageNavigator" class="page-navigator hidden" aria-label="当前页面导航">
          <canvas id="navigatorCanvas"></canvas>
          <div id="navigatorViewport" class="navigator-viewport" title="拖动查看页面其他位置"></div>
        </div>
      </main>

      <button class="panel-edge-toggle right-edge-toggle" id="sidePanelToggle" title="收起功能栏" aria-label="收起功能栏" aria-expanded="true">
        <i data-lucide="chevron-right"></i>
      </button>

      <aside class="side-panel">
        <section class="edit-section">
          <h2>页面编辑</h2>
          <div class="annotation-tools" role="toolbar" aria-label="页面编辑工具">
            <button id="selectToolBtn" class="icon-btn edit-tool" title="选中并移动页面内容" aria-pressed="false"><i data-lucide="mouse-pointer-2"></i></button>
            <button id="addTextBtn" class="icon-btn edit-tool" title="点击页面放置文字" aria-pressed="false"><i data-lucide="type"></i></button>
            <button id="addRectBtn" class="icon-btn edit-tool" title="加入方框"><i data-lucide="square"></i></button>
            <button id="addCircleBtn" class="icon-btn edit-tool" title="加入圆圈"><i data-lucide="circle"></i></button>
            <button id="drawBtn" class="icon-btn edit-tool" title="涂鸦或签字" aria-pressed="false"><i data-lucide="pencil"></i></button>
            <button id="lineBtn" class="icon-btn edit-tool" title="拉直线" aria-pressed="false"><i data-lucide="slash"></i></button>
            <button id="deleteAnnotationBtn" class="icon-btn edit-tool annotation-delete hidden" title="删除选中内容"><i data-lucide="trash-2"></i></button>
          </div>
          <div id="textEditor" class="annotation-editor hidden">
            <div class="editor-row">
              <select id="fontFamilySelect" class="compact-select" aria-label="字体">
                <option value="Source Han Sans CN">思源黑体 CN</option>
                <option value="Source Han Sans SC">思源黑体 SC</option>
                <option value="Source Han Sans">思源黑体</option>
                <option value="Source Han Serif SC">思源宋体</option>
                <option value="Noto Sans SC">Noto Sans SC</option>
                <option value="Noto Serif SC">Noto Serif SC</option>
                <option value="LXGW WenKai">霞鹜文楷</option>
                <option value="MiSans">MiSans</option>
                <option value="HarmonyOS Sans SC">HarmonyOS Sans</option>
                <option value="Alibaba PuHuiTi 3.0">阿里巴巴普惠体</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="PingFang SC">苹方</option>
                <option value="Microsoft YaHei">微软雅黑</option>
              </select>
              <button id="loadLocalFontsBtn" class="icon-btn small" title="读取本机字体"><i data-lucide="scan-text"></i></button>
            </div>
            <div class="editor-row text-style-row">
              <label class="number-control" title="字号"><input id="fontSizeInput" type="number" min="6" max="180" value="24"><span>pt</span></label>
              <label class="color-control" title="文字颜色"><input id="textColorInput" type="color" value="#202124"></label>
              <button id="boldBtn" class="style-toggle" title="粗体"><strong>B</strong></button>
              <button id="italicBtn" class="style-toggle" title="斜体"><em>I</em></button>
              <button id="underlineBtn" class="style-toggle" title="下划线"><u>U</u></button>
            </div>
            <div class="alignment-row" role="group" aria-label="文字对齐">
              <button data-align="left" title="左对齐"><i data-lucide="align-left"></i></button>
              <button data-align="center" title="居中"><i data-lucide="align-center"></i></button>
              <button data-align="right" title="右对齐"><i data-lucide="align-right"></i></button>
            </div>
          </div>
          <div id="shapeEditor" class="annotation-editor hidden">
            <div class="shape-style-grid">
              <label title="填充颜色"><span>填充</span><input id="shapeFillInput" type="color" value="#fff2ef"></label>
              <label title="边框颜色"><span>边框</span><input id="shapeBorderInput" type="color" value="#c94c36"></label>
            </div>
            <div class="editor-row">
              <label class="check-control"><input id="shapeFillEnabled" type="checkbox" checked><span>填充</span></label>
              <label class="number-control grow" title="边框粗细"><span>边框</span><input id="shapeBorderWidthInput" type="number" min="0" max="30" step="0.5" value="3"><span>pt</span></label>
            </div>
          </div>
          <div id="drawingEditor" class="annotation-editor hidden">
            <div class="drawing-style-row">
              <label class="drawing-color" title="画笔颜色"><span>颜色</span><input id="drawColorInput" type="color" value="#202124"></label>
              <label class="number-control grow" title="线条粗细"><span>粗细</span><input id="drawWidthInput" type="number" min="0.5" max="30" step="0.5" value="3"><span>pt</span></label>
            </div>
          </div>
          <div id="lineEditor" class="annotation-editor hidden">
            <div class="drawing-style-row">
              <label class="drawing-color" title="直线颜色"><span>颜色</span><input id="lineColorInput" type="color" value="#202124"></label>
              <label class="number-control grow" title="直线粗细"><span>粗细</span><input id="lineWidthInput" type="number" min="0.5" max="30" step="0.5" value="3"><span>pt</span></label>
            </div>
            <div class="drawing-dash-options" role="group" aria-label="直线样式">
              <button type="button" class="line-dash-btn active" data-dash="solid" title="实线" aria-label="实线"><span class="line-sample solid"></span></button>
              <button type="button" class="line-dash-btn" data-dash="dense" title="密虚线" aria-label="密虚线"><span class="line-sample dense"></span></button>
              <button type="button" class="line-dash-btn" data-dash="dashed" title="虚线" aria-label="虚线"><span class="line-sample dashed"></span></button>
              <button type="button" class="line-dash-btn" data-dash="sparse" title="疏虚线" aria-label="疏虚线"><span class="line-sample sparse"></span></button>
            </div>
          </div>
        </section>
        <section>
          <h2>页面操作</h2>
          <div class="action-grid">
            <button id="rotateLeftBtn" class="tool-btn"><i data-lucide="rotate-ccw"></i><span>左转</span></button>
            <button id="rotateRightBtn" class="tool-btn"><i data-lucide="rotate-cw"></i><span>右转</span></button>
            <button id="deleteBtn" class="tool-btn danger"><i data-lucide="trash-2"></i><span>删除</span></button>
            <button id="duplicateBtn" class="tool-btn"><i data-lucide="copy-plus"></i><span>复制</span></button>
          </div>
        </section>
        <section class="meta-section">
          <h2>文档信息</h2>
          <div class="meta-inline">
            <span><b id="metaPages">0</b> 页</span>
            <span><b id="metaFiles">0</b> 个文件</span>
            <span>已选 <b id="metaCurrent">0</b> 页</span>
          </div>
        </section>
      </aside>

      <input id="fileInput" class="file-input" type="file" accept="application/pdf,image/png,image/jpeg" multiple>
      <div id="closeDialog" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="closeDialogTitle">
        <div class="modal-card">
          <h2 id="closeDialogTitle">保存更改？</h2>
          <p id="closeDialogMessage">这个文件有未保存的改动。</p>
          <div class="modal-actions">
            <button id="closeSaveBtn" class="primary-btn">是，保存</button>
            <button id="closeDiscardBtn" class="wide-btn">否，直接关闭</button>
            <button id="closeCancelBtn" class="wide-btn">取消</button>
          </div>
        </div>
      </div>
      <div id="exportDialog" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="exportDialogTitle">
        <div class="modal-card export-dialog-card">
          <h2 id="exportDialogTitle">导出页面</h2>
          <p id="exportRangeSummary" class="export-range-summary">全部页面</p>
          <fieldset class="export-choice-group">
            <legend>保存格式</legend>
            <div class="export-choice-grid four">
              <label><input type="radio" name="exportFormat" value="pdf" checked><span>PDF</span></label>
              <label><input type="radio" name="exportFormat" value="png"><span>PNG</span></label>
              <label><input type="radio" name="exportFormat" value="jpeg"><span>JPG</span></label>
              <label><input type="radio" name="exportFormat" value="docx"><span>Word</span></label>
            </div>
          </fieldset>
          <fieldset id="exportQualityGroup" class="export-choice-group">
            <legend>保存质量</legend>
            <div class="export-choice-grid quality-grid">
              <label><input type="radio" name="exportQuality" value="original" checked><span><b>原始质量</b><small id="qualityEstimateOriginal">估算中</small></span></label>
              <label><input type="radio" name="exportQuality" value="high"><span><b>高质量</b><small id="qualityEstimateHigh">估算中</small></span></label>
              <label><input type="radio" name="exportQuality" value="balanced"><span><b>均衡</b><small id="qualityEstimateBalanced">估算中</small></span></label>
              <label><input type="radio" name="exportQuality" value="compact"><span><b>小体积</b><small id="qualityEstimateCompact">估算中</small></span></label>
            </div>
          </fieldset>
          <p id="exportDialogNote" class="export-dialog-note">预估大小会因页面内容有所浮动。下一步可在系统窗口中填写文件名并选择保存位置；多张图片会保存为 ZIP。</p>
          <div class="modal-actions">
            <button id="exportCancelBtn" class="wide-btn">取消</button>
            <button id="exportConfirmBtn" class="primary-btn">下一步</button>
          </div>
        </div>
      </div>
      <div id="updateDialog" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="updateDialogTitle">
        <div class="modal-card update-dialog-card">
          <h2 id="updateDialogTitle">软件更新</h2>
          <p id="updateDialogMessage">正在检查更新…</p>
          <div id="updateVersion" class="update-version hidden"></div>
          <div id="updateProgressWrap" class="update-progress hidden">
            <div><span>下载进度</span><b id="updateProgressText">0%</b></div>
            <progress id="updateProgress" max="100" value="0"></progress>
          </div>
          <div class="modal-actions">
            <button id="updateCloseBtn" class="wide-btn">关闭</button>
            <button id="updateActionBtn" class="primary-btn hidden">下载更新</button>
          </div>
        </div>
      </div>
      <div id="uninstallDialog" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="uninstallDialogTitle">
        <div class="modal-card">
          <h2 id="uninstallDialogTitle">卸载 PDF大编辑？</h2>
          <p>软件和本地设置将被删除，你的 PDF、图片和导出文件不会被删除。</p>
          <div class="modal-actions">
            <button id="uninstallCancelBtn" class="wide-btn">取消</button>
            <button id="uninstallConfirmBtn" class="primary-btn danger-primary">卸载并退出</button>
          </div>
        </div>
      </div>
      <div id="printDialog" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="printDialogTitle">
        <div class="modal-card print-dialog-card">
          <div class="print-dialog-head">
            <div>
              <h2 id="printDialogTitle">打印中心</h2>
              <p id="printStatusText">设置完成后直接发送到所选打印机。</p>
            </div>
            <span id="printPageSummary">0 页</span>
          </div>
          <div class="print-dialog-body">
            <form class="print-settings" id="printSettingsForm">
              <section>
                <div class="print-section-title"><b>打印机</b><button id="refreshPrintersBtn" type="button">刷新</button></div>
                <select id="printerSelect"></select>
                <p id="printerStatus" class="print-hint">正在读取打印机…</p>
              </section>
              <section>
                <b>页面范围</b>
                <select id="printRangeSelect">
                  <option value="all">全部页面</option>
                  <option value="current">当前页面</option>
                  <option value="selected">当前选中的页面</option>
                  <option value="custom">自定义页面</option>
                </select>
                <input id="customRangeInput" class="hidden" type="text" placeholder="例如 1-3,6,8-10">
                <p id="printRangeHint" class="print-hint">预计打印 0 页</p>
              </section>
              <section class="print-two-col">
                <label><span>份数</span><input id="copiesInput" type="number" min="1" max="999" value="1"></label>
                <label class="switch-label"><input id="collateInput" type="checkbox" checked><span>逐份打印</span></label>
              </section>
              <section class="print-two-col">
                <label><span>纸张</span><select id="paperSelect">
                  <option value="default">打印机默认</option>
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                  <option value="A5">A5</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                  <option value="Tabloid">Tabloid</option>
                </select></label>
                <label><span>方向</span><select id="orientationSelect">
                  <option value="auto">自动匹配</option>
                  <option value="portrait">纵向</option>
                  <option value="landscape">横向</option>
                </select></label>
              </section>
              <section class="print-two-col">
                <label><span>颜色</span><select id="colorSelect"><option value="color">彩色</option><option value="gray">灰度</option></select></label>
                <label><span>双面</span><select id="duplexSelect"><option value="simplex">单面</option><option value="longEdge">长边翻转</option><option value="shortEdge">短边翻转</option></select></label>
              </section>
              <section class="print-two-col">
                <label><span>缩放</span><select id="scaleSelect">
                  <option value="fit">适合可打印区域</option>
                  <option value="actual">实际大小 100%</option>
                  <option value="shrink">缩小过大页面</option>
                  <option value="custom">自定义百分比</option>
                </select></label>
                <label><span>百分比</span><input id="scalePercentInput" type="number" min="10" max="400" value="100" disabled></label>
              </section>
              <section class="print-two-col">
                <label><span>每张页数</span><select id="pagesPerSheetSelect"><option>1</option><option>2</option><option>4</option><option>6</option><option>9</option><option>16</option></select></label>
                <label><span>分辨率</span><select id="dpiSelect"><option value="default">默认</option><option value="300">300 DPI</option><option value="600">600 DPI</option></select></label>
              </section>
              <section>
                <b>页边距</b>
                <select id="marginSelect"><option value="default">默认</option><option value="none">无</option><option value="printable">打印机可打印区域</option><option value="custom">自定义</option></select>
                <div id="customMargins" class="custom-margins hidden">
                  <label>上<input id="marginTopInput" type="number" min="0" max="100" value="10"><span>mm</span></label>
                  <label>右<input id="marginRightInput" type="number" min="0" max="100" value="10"><span>mm</span></label>
                  <label>下<input id="marginBottomInput" type="number" min="0" max="100" value="10"><span>mm</span></label>
                  <label>左<input id="marginLeftInput" type="number" min="0" max="100" value="10"><span>mm</span></label>
                </div>
              </section>
              <section>
                <label class="switch-label"><input id="printBackgroundInput" type="checkbox" checked><span>打印页面背景和背景图片</span></label>
              </section>
            </form>
            <section class="print-preview-pane">
              <div class="print-preview-toolbar">
                <button id="previewPrevBtn" type="button">上一页</button>
                <span id="printPreviewPage">0 / 0</span>
                <button id="previewNextBtn" type="button">下一页</button>
                <span class="toolbar-sep"></span>
                <button id="previewZoomOutBtn" type="button">缩小</button>
                <button id="previewZoomInBtn" type="button">放大</button>
                <button id="previewFitBtn" type="button">适合页面</button>
                <button id="previewWidthBtn" type="button">适合宽度</button>
              </div>
              <div class="print-preview-stage">
                <iframe id="printPreviewFrame" title="打印预览"></iframe>
                <div id="printPreviewLoading" class="print-preview-loading hidden">正在生成预览…</div>
              </div>
            </section>
          </div>
          <div class="modal-actions">
            <button id="printCancelBtn" class="wide-btn">取消</button>
            <button id="advancedPrintBtn" class="wide-btn">系统高级打印…</button>
            <button id="printConfirmBtn" class="primary-btn">打印</button>
          </div>
        </div>
      </div>
      <div id="loadingBar" class="loading-bar hidden" role="status" aria-live="polite">
        <div class="loading-bar-head"><span id="loadingText">正在载入文件</span><b id="loadingPercent">0%</b><button id="loadingCancelBtn" class="loading-cancel hidden" type="button">取消</button></div>
        <progress id="loadingProgress" max="100" value="0"></progress>
      </div>
      <div id="searchStatus" class="search-status hidden" role="status" aria-live="polite"></div>
      <div id="dragPositionTip" class="drag-position-tip hidden" role="status" aria-live="polite"></div>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </div>

    <script>
__PDF_LIB__
    </script>
    <script>
__LUCIDE__
    </script>
    <script>
      const pdfJsSource = __PDF_JS__;
      const pdfWorkerSource = __PDF_WORKER__;
      const pdfJsUrl = URL.createObjectURL(new Blob([pdfJsSource], { type: "text/javascript" }));
      const pdfWorkerUrl = URL.createObjectURL(new Blob([pdfWorkerSource], { type: "text/javascript" }));
      let pdfjsLib = null;
      const pdfJsReady = import(pdfJsUrl)
        .then((lib) => {
          pdfjsLib = lib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
          return pdfjsLib;
        })
        .catch((error) => {
          console.error("PDF 阅读引擎载入失败", error);
          return null;
        });

__APP__
    </script>
  </body>
</html>`;

const standalone = baseHtml
  .replace("__CSS__", () => css)
  .replace("__PDF_LIB__", () => pdfLib.replaceAll("</script", "<\\/script"))
  .replace("__LUCIDE__", () => lucide.replaceAll("</script", "<\\/script"))
  .replace("__PDF_JS__", () => JSON.stringify(pdfJs))
  .replace("__PDF_WORKER__", () => JSON.stringify(pdfWorker))
  .replace("__APP__", () => app);

fs.writeFileSync(indexPath, standalone);
