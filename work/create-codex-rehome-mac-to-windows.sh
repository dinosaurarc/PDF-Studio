#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/outputs"
STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="Codex-Rehome-Mac-to-Windows-$STAMP"
STAGE="/tmp/$NAME"
PACKAGE="$OUT_DIR/$NAME.zip"
PROJECT_SRC="$ROOT"
PROJECT_NAME="$(basename "$PROJECT_SRC")"

rm -rf "$STAGE"
mkdir -p "$STAGE/home" "$STAGE/projects" "$STAGE/metadata" "$OUT_DIR"

copy_codex_dir_filtered() {
  local src="$HOME/.codex"
  local dst="$STAGE/home/.codex"
  [[ -d "$src" ]] || return 0
  mkdir -p "$dst"
  /usr/bin/rsync -a "$src/" "$dst/" \
    --exclude 'auth.json' \
    --exclude 'config.toml' \
    --exclude 'installation_id' \
    --exclude 'models_cache.json' \
    --exclude 'chrome-native-hosts-v2.json' \
    --exclude '.tmp/' \
    --exclude 'tmp/' \
    --exclude 'computer-use/' \
    --exclude 'plugins/.plugin-appserver/' \
    --exclude 'process_manager/' \
    --exclude 'vendor_imports/' \
    --exclude 'logs_*.sqlite' \
    --exclude 'logs_*.sqlite-*' \
    --exclude 'sqlite/logs_*.sqlite' \
    --exclude 'sqlite/logs_*.sqlite-*' \
    --exclude 'logs/*.log' \
    --exclude '**/.DS_Store' \
    --exclude '**/node_modules/' \
    --exclude '**/*.sock' \
    --exclude '**/SingletonLock' \
    --exclude '**/SingletonCookie' \
    --exclude '**/SingletonSocket' \
    --exclude '**/.env' \
    --exclude '**/.env.*' \
    --exclude '**/*id_rsa*' \
    --exclude '**/*id_ed25519*' \
    --exclude '**/*.pem' \
    --exclude '**/*.key'
}

copy_project_filtered() {
  local dst="$STAGE/projects/$PROJECT_NAME"
  mkdir -p "$dst"
  /usr/bin/rsync -a "$PROJECT_SRC/" "$dst/" \
    --exclude '.git/' \
    --exclude '.DS_Store' \
    --exclude '**/.DS_Store' \
    --exclude 'node_modules/' \
    --exclude '**/node_modules/' \
    --exclude '.venv/' \
    --exclude '**/.venv/' \
    --exclude 'venv/' \
    --exclude '**/venv/' \
    --exclude '**/.env' \
    --exclude '**/.env.*' \
    --exclude '**/*id_rsa*' \
    --exclude '**/*id_ed25519*' \
    --exclude '**/*.pem' \
    --exclude '**/*.key' \
    --exclude 'desktop/electron/dist/' \
    --exclude 'desktop/electron/app/' \
    --exclude 'desktop/macos/build/' \
    --exclude 'desktop/macos/.module-cache/' \
    --exclude 'desktop/macos/.module-cache-v2/' \
    --exclude 'outputs/PDF大编辑.app/' \
    --exclude 'outputs/PDF-Studio-*-GitHub上传文件/' \
    --exclude 'outputs/*.dmg' \
    --exclude 'outputs/*.zip'
}

count_files() {
  local path="$1"
  local pattern="${2:-*}"
  if [[ -d "$path" ]]; then
    /usr/bin/find "$path" -type f -name "$pattern" 2>/dev/null | /usr/bin/wc -l | /usr/bin/tr -d ' '
  else
    echo 0
  fi
}

count_dirs() {
  local path="$1"
  if [[ -d "$path" ]]; then
    /usr/bin/find "$path" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | /usr/bin/wc -l | /usr/bin/tr -d ' '
  else
    echo 0
  fi
}

copy_codex_dir_filtered
copy_project_filtered

cat > "$STAGE/metadata/path_map.json" <<EOF
{
  "schema": 3,
  "source_os": "macOS",
  "target_os": "Windows",
  "source_home": "$HOME",
  "target_home": "%USERPROFILE%",
  "project_source": "$PROJECT_SRC",
  "project_target": "%USERPROFILE%\\\\Documents\\\\Codex-Restored-Projects\\\\$PROJECT_NAME",
  "mode": "standard"
}
EOF

cat > "$STAGE/README-RESTORE-WINDOWS.txt" <<EOF
Codex Rehome: Mac -> Windows 迁移包

迁移模式：standard

这个包包含：
- Mac 上的 Codex conversations/sessions、部分 SQLite 状态、memories/goals、skills/plugins、generated_images。
- 当前项目：$PROJECT_SRC
- Windows 恢复脚本：Restore-Codex-To-Windows.ps1

默认已排除：
- Codex 登录令牌、auth.json、config.toml、installation_id
- 浏览器 cookies / 登录数据库
- .env、私钥、pem/key 文件
- .git、node_modules、虚拟环境、构建缓存、旧安装包

Windows 恢复步骤：
1. 在 Windows 上先安装并登录 Codex Desktop。
2. 关闭 Codex。
3. 解压这个 zip。
4. PowerShell 打开解压后的文件夹。
5. 运行：

   Set-ExecutionPolicy -Scope Process Bypass
   .\\Restore-Codex-To-Windows.ps1 -RestoreProjects

6. 恢复后打开 Codex Desktop。如果项目没有自动出现在侧边栏，请手动打开：

   %USERPROFILE%\\Documents\\Codex-Restored-Projects\\$PROJECT_NAME

注意：
- 跨 Mac/Windows 后，旧对话可以作为历史上下文，但旧线程的工作目录句柄不一定能原样继续。
- 真正继续开发时，建议在 Windows 的恢复项目文件夹里重新打开一个新 Codex 对话。
- Windows 上需要重新安装系统相关依赖，例如 node_modules、Python 环境、Electron 依赖等。
EOF

cat > "$STAGE/Restore-Codex-To-Windows.ps1" <<'EOF'
param(
  [switch]$RestoreProjects,
  [string]$ProjectsDir = "$env:USERPROFILE\Documents\Codex-Restored-Projects",
  [switch]$ReplaceCodexHome
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceCodex = Join-Path $PackageRoot "home\.codex"
$TargetCodex = Join-Path $env:USERPROFILE ".codex"

Write-Host "Codex Rehome: restoring Mac package to Windows..." -ForegroundColor Cyan

if (!(Test-Path $SourceCodex)) {
  throw "Package is missing home\.codex."
}

New-Item -ItemType Directory -Force -Path $TargetCodex | Out-Null

$Preserve = @(
  "auth.json",
  "config.toml",
  "installation_id",
  "models_cache.json",
  "chrome-native-hosts-v2.json"
)

if ($ReplaceCodexHome) {
  $Backup = "$TargetCodex.backup-before-codex-rehome-$(Get-Date -Format yyyyMMdd-HHmmss)"
  if (Test-Path $TargetCodex) {
    Copy-Item $TargetCodex $Backup -Recurse -Force
  }
  Get-ChildItem $TargetCodex -Force | Where-Object { $Preserve -notcontains $_.Name } | Remove-Item -Recurse -Force
}

robocopy $SourceCodex $TargetCodex /E /XD process_manager vendor_imports /XF auth.json config.toml installation_id models_cache.json chrome-native-hosts-v2.json *.sock SingletonLock SingletonCookie SingletonSocket | Out-Null
if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with code $LASTEXITCODE"
}

if ($RestoreProjects) {
  $ProjectsSource = Join-Path $PackageRoot "projects"
  if (Test-Path $ProjectsSource) {
    New-Item -ItemType Directory -Force -Path $ProjectsDir | Out-Null
    robocopy $ProjectsSource $ProjectsDir /E /XD .git node_modules .venv venv dist build /XF .env .env.* *.pem *.key *id_rsa* *id_ed25519* | Out-Null
    if ($LASTEXITCODE -gt 7) {
      throw "project restore failed with robocopy code $LASTEXITCODE"
    }
    Get-ChildItem $ProjectsDir -Directory | ForEach-Object {
      $projectPath = $_.FullName
      try {
        codex app $projectPath | Out-Null
        Write-Host "Registered project in Codex: $projectPath"
      } catch {
        Write-Host "Please open this restored project manually in Codex Desktop: $projectPath" -ForegroundColor Yellow
      }
    }
  }
}

Write-Host "Restore copied files. Open Codex Desktop and check sessions/projects." -ForegroundColor Green
Write-Host "Run Verify-Codex-Windows-Restore.ps1 -Json for a basic count check."
EOF

cat > "$STAGE/Verify-Codex-Windows-Restore.ps1" <<'EOF'
param([switch]$Json)

$TargetCodex = Join-Path $env:USERPROFILE ".codex"
$ProjectsDir = Join-Path $env:USERPROFILE "Documents\Codex-Restored-Projects"

$result = [ordered]@{
  codex_home = $TargetCodex
  sessions = @(Get-ChildItem "$TargetCodex\sessions" -Recurse -Filter *.jsonl -ErrorAction SilentlyContinue).Count
  archived_sessions = @(Get-ChildItem "$TargetCodex\archived_sessions" -Recurse -Filter *.jsonl -ErrorAction SilentlyContinue).Count
  sqlite_files = @(Get-ChildItem $TargetCodex -Filter *.sqlite -ErrorAction SilentlyContinue).Count
  skills = @(Get-ChildItem "$TargetCodex\skills" -Directory -ErrorAction SilentlyContinue).Count
  plugin_manifests = @(Get-ChildItem "$TargetCodex\plugins" -Recurse -Filter plugin.json -ErrorAction SilentlyContinue).Count
  generated_images = @(Get-ChildItem "$TargetCodex\generated_images" -File -ErrorAction SilentlyContinue).Count
  restored_projects = @(Get-ChildItem $ProjectsDir -Directory -ErrorAction SilentlyContinue).Count
}

if ($Json) {
  $result | ConvertTo-Json -Depth 4
} else {
  $result.GetEnumerator() | ForEach-Object { "{0}: {1}" -f $_.Key, $_.Value }
}
EOF

cat > "$STAGE/MANIFEST.txt" <<EOF
Codex Rehome Migration Package
Created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Mode: standard
Direction: Mac -> Windows
Source home: $HOME
Project included: $PROJECT_SRC

Counts:
sessions=$(count_files "$STAGE/home/.codex/sessions" "*.jsonl")
archived_sessions=$(count_files "$STAGE/home/.codex/archived_sessions" "*.jsonl")
sqlite_files=$(count_files "$STAGE/home/.codex" "*.sqlite")
skills=$(count_dirs "$STAGE/home/.codex/skills")
plugin_manifests=$(count_files "$STAGE/home/.codex/plugins" "plugin.json")
generated_images=$(count_files "$STAGE/home/.codex/generated_images")
project_files=$(count_files "$STAGE/projects/$PROJECT_NAME")
EOF

(
  cd "$STAGE"
  /usr/bin/find . -type f -print0 | /usr/bin/sort -z | /usr/bin/xargs -0 /usr/bin/shasum -a 256 > SHA256SUMS.txt
  /usr/bin/zip -q -r -X "$PACKAGE" .
)

SIZE="$(/usr/bin/du -h "$PACKAGE" | /usr/bin/awk '{print $1}')"
echo "$PACKAGE"
echo "$SIZE"
cat "$STAGE/MANIFEST.txt"
