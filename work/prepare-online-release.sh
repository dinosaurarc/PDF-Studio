#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUTS="$ROOT/outputs"
NODE="/Users/kuuga/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
VERSION="$("$NODE" -p "require('$ROOT/desktop/electron/package.json').version")"
STAGE="$(mktemp -d /tmp/pdf-studio-online-release.XXXXXX)"
UPLOAD_DIR="$OUTPUTS/PDF-Studio-${VERSION}-GitHub上传文件"
trap 'rm -rf "$STAGE"' EXIT

"$NODE" "$ROOT/work/build-standalone.js"

mkdir -p "$ROOT/desktop/electron/app" "$STAGE/web"
cp "$ROOT/outputs/pdf-page-studio/index.html" "$ROOT/desktop/electron/app/index.html"

cp "$ROOT/outputs/pdf-page-studio/index.html" "$STAGE/web/index.html"
cp "$ROOT/outputs/pdf-page-studio/index.html" "$STAGE/web/404.html"
cp "$ROOT/work/web-deploy/sw.js" "$STAGE/web/sw.js"
cp "$ROOT/work/web-deploy/manifest.webmanifest" "$STAGE/web/manifest.webmanifest"
cp "$ROOT/work/web-deploy/icon-192.png" "$STAGE/web/icon-192.png"
cp "$ROOT/work/web-deploy/icon-512.png" "$STAGE/web/icon-512.png"
cp "$ROOT/work/web-deploy/_headers" "$STAGE/web/_headers"
cp "$ROOT/work/web-deploy/README.txt" "$STAGE/web/README.txt"
touch "$STAGE/web/.nojekyll"

find "$OUTPUTS" -maxdepth 1 -mindepth 1 \( \
  -name 'PDF-Studio-*' -o \
  -name 'PDF大编辑-*' \
\) -exec rm -rf {} +

(cd "$STAGE/web" && /usr/bin/zip -q -r -X "$OUTPUTS/PDF-Studio-${VERSION}-Web.zip" .)

(cd "$ROOT" && /usr/bin/zip -q -r -X "$OUTPUTS/PDF-Studio-${VERSION}-网页与桌面发布源码.zip" \
  .github .gitignore README.md desktop/electron desktop/macos outputs/pdf-page-studio \
  work/build-standalone.js work/build-latest-release.sh work/build-distributions.sh \
  work/check-release-config.js work/prepare-online-release.sh work/set-version.js work/web-deploy \
  发布到网页和Windows软件说明.txt \
  -x 'desktop/electron/app/*' 'desktop/electron/dist/*' 'desktop/electron/node_modules/*' \
     'desktop/macos/build/*' 'desktop/macos/.module-cache/*' 'desktop/macos/.module-cache-v2/*' \
     '*.DS_Store')

mkdir -p "$UPLOAD_DIR"
/usr/bin/unzip -q "$OUTPUTS/PDF-Studio-${VERSION}-网页与桌面发布源码.zip" -d "$UPLOAD_DIR"
cat > "$UPLOAD_DIR/请先看-上传步骤.txt" <<EOF
PDF大编辑 ${VERSION} 上传步骤

1. 打开 GitHub 仓库 dinosaurarc/PDF-Studio。
2. 进入 main 分支，把本文件夹里的所有内容上传并提交。
   注意：.github 是隐藏文件夹，macOS Finder 如看不到，请按 Command + Shift + . 显示隐藏文件。
3. 提交到 main 后，网页版会自动发布。
4. 需要生成 Windows 和 macOS 安装包时，在 GitHub 网页创建标签 v${VERSION}。
   标签创建后，Actions 会自动生成 Release，并上传 Setup、Portable、DMG、更新 ZIP、latest.yml/latest-mac.yml 和 blockmap。
5. 只是修改 README、.gitignore 或说明文件时，不需要创建新标签，桌面安装包也不会自动生成。
EOF
(cd "$OUTPUTS" && /usr/bin/zip -q -r -X "PDF-Studio-${VERSION}-GitHub上传包.zip" "PDF-Studio-${VERSION}-GitHub上传文件")

cp "$ROOT/发布到网页和Windows软件说明.txt" "$OUTPUTS/PDF大编辑-${VERSION}-网页与桌面发布说明.txt"

(
  cd "$OUTPUTS"
  /usr/bin/shasum -a 256 \
    "PDF-Studio-${VERSION}-Web.zip" \
    "PDF-Studio-${VERSION}-网页与桌面发布源码.zip" \
    "PDF-Studio-${VERSION}-GitHub上传包.zip" \
    > "PDF-Studio-${VERSION}-SHA256SUMS.txt"
)

echo "$OUTPUTS/PDF-Studio-${VERSION}-Web.zip"
echo "$OUTPUTS/PDF-Studio-${VERSION}-网页与桌面发布源码.zip"
echo "$OUTPUTS/PDF-Studio-${VERSION}-GitHub上传包.zip"
echo "$UPLOAD_DIR"
echo "$OUTPUTS/PDF-Studio-${VERSION}-SHA256SUMS.txt"
echo "$OUTPUTS/PDF大编辑-${VERSION}-网页与桌面发布说明.txt"
