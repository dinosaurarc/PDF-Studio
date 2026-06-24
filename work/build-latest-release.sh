#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Web/source packages are produced locally. Signed, auto-updatable Windows and
# macOS installers are produced by GitHub Actions on a version tag.
exec "$ROOT/work/prepare-online-release.sh"
