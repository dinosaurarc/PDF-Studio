const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appDir = path.join(root, "outputs", "pdf-page-studio");
const indexPath = path.join(appDir, "index.html");

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
          <button class="text-btn" id="printBtn" title="打印当前整理后的 PDF">
            <span>打印</span>
          </button>
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
            <h2>拖入 PDF、PNG 或 JPG</h2>
            <p>第二份 PDF 会自动接在第一份后面；图片会作为新页面加入 PDF。</p>
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
      <div id="loadingBar" class="loading-bar hidden" role="status" aria-live="polite">
        <div class="loading-bar-head"><span id="loadingText">正在载入文件</span><b id="loadingPercent">0%</b></div>
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
    <script type="module">
      const pdfJsSource = __PDF_JS__;
      const pdfWorkerSource = __PDF_WORKER__;
      const pdfJsUrl = URL.createObjectURL(new Blob([pdfJsSource], { type: "text/javascript" }));
      const pdfWorkerUrl = URL.createObjectURL(new Blob([pdfWorkerSource], { type: "text/javascript" }));
      const pdfjsLib = await import(pdfJsUrl);
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
