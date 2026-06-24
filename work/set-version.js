const fs = require("node:fs");
const path = require("node:path");

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error("用法：node work/set-version.js 0.3.1");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "desktop", "electron", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
packageJson.version = version;
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const serviceWorkerPath = path.join(root, "work", "web-deploy", "sw.js");
const serviceWorker = fs.readFileSync(serviceWorkerPath, "utf8")
  .replace(/pdf-studio-web-\d+\.\d+\.\d+/, `pdf-studio-web-${version}`);
fs.writeFileSync(serviceWorkerPath, serviceWorker);

const plistPath = path.join(root, "desktop", "macos", "Info.plist");
const plist = fs.readFileSync(plistPath, "utf8")
  .replace(
    /(<key>CFBundleShortVersionString<\/key><string>)[^<]+(<\/string>)/,
    `$1${version}$2`,
  );
fs.writeFileSync(plistPath, plist);

console.log(`PDF大编辑版本已更新为 ${version}`);
