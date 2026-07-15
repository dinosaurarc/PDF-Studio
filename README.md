# PDF大编辑 / PDF Studio

一个在本机处理文件的 PDF 页面整理与编辑工具，提供网页版、macOS 版和 Windows 版。

## 主要功能

- 打开和合并多个 PDF、PNG、JPG、JPEG 文件
- 自由调整页面顺序、旋转、复制、删除和多选页面
- 连续阅读、单页阅读、总览和缩略图导航
- 添加文字、图形、涂鸦和直线
- 导出 PDF、PNG、JPG
- 离线将 PDF 转为 Word
- Windows 与 macOS 桌面版可直接保存回源文件
- 关闭已修改文件或退出软件时提供“保存 / 不保存 / 取消”

PDF 和图片默认只在用户自己的设备中处理，不会自动上传到服务器。

## 在线网页

GitHub Pages 会通过 [pages.yml](.github/workflows/pages.yml) 自动构建和发布 HTTPS 网页。

首次联网打开公开网页后，浏览器会缓存应用；之后断网仍可继续使用大部分功能。

## Windows

[windows-build.yml](.github/workflows/windows-build.yml) 会在真实 Windows 环境生成：

- Windows 10/11 64 位安装版
- Windows 10/11 64 位免安装版
- SHA-256 文件校验值

安装版会注册 PDF 文件关联，支持从“打开方式”或双击 PDF 打开。软件使用单实例运行，多个文件会在同一窗口中建立标签页。

## 自动发布

推送到 `main` 后会自动更新 GitHub Pages 网页。

Windows 和 macOS 桌面安装包不会在普通提交时自动生成，避免说明文档或小改动反复创建 Release。桌面包只在以下两种情况生成：

- 推送新的版本标签，例如 `v0.3.5`
- 在 GitHub Actions 页面手动运行桌面打包流程

正式版本标签会自动创建 GitHub Release，并附加 Windows Setup、Portable、`latest.yml`、macOS DMG、更新 ZIP、`latest-mac.yml` 和 blockmap。

桌面安装版通过 `electron-updater` 从当前 GitHub 仓库的 Releases 获取更新。Windows Portable 只提示有新版，不会尝试自动安装。

## 发布新版本

先同步版本号：

```bash
node work/set-version.js 0.3.5
```

提交并推送到 `main` 后，网页会先自动发布。然后在 GitHub 网页创建并推送同名标签，例如 `v0.3.5`。标签推送后会创建对应 Release，并上传
Windows Setup、Portable、`latest.yml`、macOS DMG、更新 ZIP、`latest-mac.yml` 和 blockmap。

未配置签名资料时，自动流程仍会生成可手动下载的 macOS DMG/ZIP。
macOS 自动更新要可靠工作，需要使用 Apple Developer ID 签名，并在仓库的
`Settings > Secrets and variables > Actions` 中配置：

- `MAC_CSC_LINK`
- `MAC_CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

## 本地生成网页

需要 Node.js 22：

```bash
node work/build-standalone.js
```

生成文件位于：

```text
outputs/pdf-page-studio/index.html
```

## 发布说明

参见 [发布到网页和Windows软件说明.txt](发布到网页和Windows软件说明.txt)。
