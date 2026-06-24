#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUTS="$ROOT/outputs"
NODE="/Users/kuuga/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
VERSION="$("$NODE" -p "require('$ROOT/desktop/electron/package.json').version")"
STAGE="$(mktemp -d /tmp/pdf-studio-online-release.XXXXXX)"
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

find "$OUTPUTS" -maxdepth 1 -type f \( \
  -name 'PDF-Studio-*-Web.zip' -o \
  -name 'PDF-Studio-*-完整发布源码.zip' -o \
  -name 'PDF-Studio-*-网页与Windows发布源码.zip' -o \
  -name 'PDF-Studio-*-SHA256SUMS.txt' -o \
  -name 'PDF大编辑-*-网页与Windows发布说明.txt' \
\) -delete

(cd "$STAGE/web" && /usr/bin/zip -q -r -X "$OUTPUTS/PDF-Studio-${VERSION}-Web.zip" .)

(cd "$ROOT" && /usr/bin/zip -q -r -X "$OUTPUTS/PDF-Studio-${VERSION}-网页与Windows发布源码.zip" \
  .github .gitignore desktop/electron outputs/pdf-page-studio \
  work/build-standalone.js work/prepare-online-release.sh work/web-deploy \
  发布到网页和Windows软件说明.txt \
  -x 'desktop/electron/app/*' 'desktop/electron/dist/*' 'desktop/electron/node_modules/*' \
     '*.DS_Store')

cp "$ROOT/发布到网页和Windows软件说明.txt" "$OUTPUTS/PDF大编辑-${VERSION}-网页与Windows发布说明.txt"

(
  cd "$OUTPUTS"
  /usr/bin/shasum -a 256 \
    "PDF-Studio-${VERSION}-Web.zip" \
    "PDF-Studio-${VERSION}-网页与Windows发布源码.zip" \
    > "PDF-Studio-${VERSION}-SHA256SUMS.txt"
)

echo "$OUTPUTS/PDF-Studio-${VERSION}-Web.zip"
echo "$OUTPUTS/PDF-Studio-${VERSION}-网页与Windows发布源码.zip"
echo "$OUTPUTS/PDF-Studio-${VERSION}-SHA256SUMS.txt"
echo "$OUTPUTS/PDF大编辑-${VERSION}-网页与Windows发布说明.txt"
