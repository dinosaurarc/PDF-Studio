#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DESKTOP="$ROOT/desktop/macos"
BUILD="$DESKTOP/build"
APP="$BUILD/PDF大编辑.app"
DMG_ROOT="$BUILD/dmg"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$DESKTOP/Info.plist")"
OUTPUT="$ROOT/outputs/PDF大编辑-${VERSION}-macOS-通用版.dmg"
ZIP_OUTPUT="$ROOT/outputs/PDF大编辑-${VERSION}-macOS-通用版.zip"

rm -rf "$BUILD"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/app" "$BUILD/AppIcon.iconset" "$DMG_ROOT"
export CLANG_MODULE_CACHE_PATH="$DESKTOP/.module-cache-v2"
export SWIFT_MODULECACHE_PATH="$DESKTOP/.module-cache-v2"

xcrun swiftc -target arm64-apple-macosx12.0 "$DESKTOP/PDFStudioApp.swift" \
  -framework AppKit -framework Network -framework WebKit \
  -o "$BUILD/PDFStudio-arm64"
xcrun swiftc -target x86_64-apple-macosx12.0 "$DESKTOP/PDFStudioApp.swift" \
  -framework AppKit -framework Network -framework WebKit \
  -o "$BUILD/PDFStudio-x86_64"
lipo -create "$BUILD/PDFStudio-arm64" "$BUILD/PDFStudio-x86_64" \
  -output "$APP/Contents/MacOS/PDFStudio"

cp "$DESKTOP/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/outputs/pdf-page-studio/index.html" "$APP/Contents/Resources/app/index.html"

xcrun swiftc "$DESKTOP/MakeIcon.swift" -framework AppKit -o "$BUILD/make-icon"
"$BUILD/make-icon" "$BUILD/AppIcon.iconset"
PYTHON="/Users/kuuga/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
"$PYTHON" -c 'from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2], format="ICNS")' \
  "$BUILD/AppIcon.iconset/icon_512x512@2x.png" "$APP/Contents/Resources/AppIcon.icns"

xattr -cr "$APP"
codesign --force --deep --sign - "$APP"
cp -R "$APP" "$DMG_ROOT/"
ln -s /Applications "$DMG_ROOT/Applications"
cp "$DESKTOP/安装更新卸载说明.txt" "$DMG_ROOT/安装更新卸载说明.txt"
rm -f "$OUTPUT"
hdiutil makehybrid -hfs -hfs-volume-name "PDF大编辑" -o "$OUTPUT" "$DMG_ROOT"
rm -f "$ZIP_OUTPUT"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP_OUTPUT"

echo "$OUTPUT"
echo "$ZIP_OUTPUT"
