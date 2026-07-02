const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const packageJson = JSON.parse(read("desktop", "electron", "package.json"));
const plist = read("desktop", "macos", "Info.plist");
const serviceWorker = read("work", "web-deploy", "sw.js");
const main = read("desktop", "electron", "main.cjs");
const workflow = read(".github", "workflows", "windows-build.yml");

const plistVersion = plist.match(/CFBundleShortVersionString<\/key><string>([^<]+)/)?.[1];
const cacheVersion = serviceWorker.match(/pdf-studio-web-(\d+\.\d+\.\d+)/)?.[1];
const checks = [
  [packageJson.version === plistVersion, "Electron 与旧 macOS 兼容版本号不一致"],
  [packageJson.version === cacheVersion, "Electron 与网页离线缓存版本号不一致"],
  [Boolean(packageJson.dependencies?.["electron-updater"]), "package.json 缺少 electron-updater"],
  [packageJson.build?.publish?.[0]?.owner === "${env.GH_OWNER}", "GitHub owner 未使用当前仓库变量"],
  [packageJson.build?.publish?.[0]?.repo === "${env.GH_REPO}", "GitHub repo 未使用当前仓库变量"],
  [/isPortableBuild\(\)/.test(main) && /!isPortableBuild\(\)/.test(main), "Portable 自动更新保护缺失"],
  [/contextIsolation:\s*true/.test(main), "Electron 主窗口未启用 contextIsolation"],
  [/getPrintersAsync/.test(main) && /webContents\.print\(/.test(main) && /printToPDF/.test(main), "Electron 打印中心 IPC 缺失"],
  [/latest\.yml/.test(workflow), "Workflow 未上传 latest.yml"],
  [/latest-mac\.yml/.test(workflow), "Workflow 未上传 latest-mac.yml"],
  [/\.blockmap/.test(workflow), "Workflow 未上传 blockmap"],
  [/gh release (create|upload)/.test(workflow), "Workflow 未创建或更新 GitHub Release"],
  [!/branches:\s*\[main\]/.test(workflow), "桌面打包仍会在 main 普通提交时触发"],
  [/tags:\s*\["v\*"\]/.test(workflow), "桌面打包缺少版本标签触发"],
  [/if:\s*startsWith\(github\.ref,\s*'refs\/tags\/v'\)/.test(workflow), "Release 发布未限制为版本标签"],
];

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  failures.forEach((message) => console.error(`失败：${message}`));
  process.exit(1);
}

console.log(`发布配置检查通过：${packageJson.version}`);
