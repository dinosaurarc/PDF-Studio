PDF大编辑 0.3.0 网页发布包

请把压缩包中的全部文件一起上传到 GitHub Pages、Cloudflare Pages、
Netlify、Vercel 或其他支持 HTTPS 的静态网站托管服务。

index.html 是主页面，sw.js 和 manifest.webmanifest 用于离线缓存。
用户首次在联网状态下打开网页后，浏览器会缓存应用；之后断网仍可继续使用。

PDF、图片和 Word 转换都在用户自己的浏览器中完成，文件不会自动上传到服务器。
