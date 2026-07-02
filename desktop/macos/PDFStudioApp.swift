import AppKit
import Darwin
import Network
import PDFKit
import UniformTypeIdentifiers
import WebKit

private func printDebugLog(_ event: String) {
    NSLog("[PDFStudioPrint] \(event)")
}

final class FileAwareWebView: WKWebView {
    var onDroppedFileURLs: (([URL]) -> Void)?

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let objects = sender.draggingPasteboard.readObjects(
            forClasses: [NSURL.self],
            options: [.urlReadingFileURLsOnly: true]
        ) as? [NSURL] ?? []
        let urls = objects.map { $0 as URL }
        if !urls.isEmpty { onDroppedFileURLs?(urls) }
        return super.performDragOperation(sender)
    }
}

final class LocalWebServer {
    typealias FileResponse = (data: Data, mimeType: String)

    private let listener: NWListener
    private let html: Data
    private let fileProvider: ((String) -> FileResponse?)?
    private let queue = DispatchQueue(label: "com.pdfstudio.local-server")
    private var didBecomeReady = false
    var onReady: ((URL) -> Void)?
    var onFailure: ((Error) -> Void)?

    init(html: Data, fileProvider: ((String) -> FileResponse?)? = nil) throws {
        self.html = html
        self.fileProvider = fileProvider
        listener = try NWListener(using: .tcp, on: .any)
    }

    func start() {
        listener.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready where !self.didBecomeReady:
                guard let port = self.listener.port else { return }
                self.didBecomeReady = true
                let url = URL(string: "http://127.0.0.1:\(port.rawValue)/index.html")!
                DispatchQueue.main.async { self.onReady?(url) }
            case .failed(let error):
                DispatchQueue.main.async { self.onFailure?(error) }
            default:
                break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            self?.serve(connection)
        }
        listener.start(queue: queue)
    }

    func stop() {
        listener.cancel()
    }

    private func serve(_ connection: NWConnection) {
        connection.start(queue: queue)
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { [weak self] data, _, _, _ in
            guard let self else {
                connection.cancel()
                return
            }
            let path = self.requestPath(from: data) ?? "/"
            let response: Data
            if path == "/" || path == "/index.html" {
                response = self.httpResponse(status: "200 OK", contentType: "text/html; charset=utf-8", body: self.html)
            } else if path.hasPrefix("/native-file/"),
                      let token = path.split(separator: "/").last.flatMap({ String($0).removingPercentEncoding }),
                      let file = self.fileProvider?(token) {
                response = self.httpResponse(status: "200 OK", contentType: file.mimeType, body: file.data)
            } else {
                response = self.httpResponse(status: "404 Not Found", contentType: "text/plain; charset=utf-8", body: Data("Not found".utf8))
            }
            connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
        }
    }

    private func requestPath(from data: Data?) -> String? {
        guard let data, let request = String(data: data, encoding: .utf8) else { return nil }
        let requestLine = request.split(separator: "\r\n", maxSplits: 1).first ?? ""
        let parts = requestLine.split(separator: " ")
        guard parts.count >= 2 else { return nil }
        return String(parts[1]).split(separator: "?", maxSplits: 1).first.map(String.init)
    }

    private func httpResponse(status: String, contentType: String, body: Data) -> Data {
        let header = "HTTP/1.1 \(status)\r\nContent-Type: \(contentType)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
        var response = Data(header.utf8)
        response.append(body)
        return response
    }
}

final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var window: NSWindow?
    var onToggleFullscreen: (() -> Void)?
    var onOpenTextColorPanel: ((String?) -> Void)?
    var onPrintHtml: ((String, @escaping (Any?, String?) -> Void) -> Void)?
    var onPrintPdf: ((Data, @escaping (Any?, String?) -> Void) -> Void)?
    private var fileURLs: [String: URL] = [:]
    private var pendingOpenURLs: [URL] = []
    private var pendingSaveData: [String: Data] = [:]
    private var pendingSaveSizes: [String: Int] = [:]
    private var pendingPrintHtml: [String: String] = [:]
    private var pendingPrintSizes: [String: Int] = [:]
    private var pendingPrintPdfData: [String: Data] = [:]
    private var pendingPrintPdfSizes: [String: Int] = [:]

    func registerSelectedFiles(_ urls: [URL]) {
        pendingOpenURLs = urls
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else {
            replyHandler(nil, "无效的请求")
            return
        }

        switch action {
        case "claimOpenFiles":
            claimOpenFiles(names: body["names"] as? [String] ?? [], replyHandler: replyHandler)
        case "requestSourceAccess":
            chooseSourceFileAccess(suggestedName: body["suggestedName"] as? String, replyHandler: replyHandler)
        case "saveAs":
            chooseSaveLocation(suggestedName: body["suggestedName"] as? String, replyHandler: replyHandler)
        case "saveBegin":
            beginChunkedSave(body: body, replyHandler: replyHandler)
        case "saveChunk":
            appendSaveChunk(body: body, replyHandler: replyHandler)
        case "saveEnd":
            finishChunkedSave(body: body, replyHandler: replyHandler)
        case "saveAbort":
            abortChunkedSave(body: body, replyHandler: replyHandler)
        case "saveSource":
            saveFile(body: body, replyHandler: replyHandler)
        case "save":
            saveFile(body: body, replyHandler: replyHandler)
        case "reportError":
            showFileError(message: body["message"] as? String, replyHandler: replyHandler)
        case "toggleFullscreen":
            onToggleFullscreen?()
            replyHandler(["ok": true], nil)
        case "openTextColorPanel":
            onOpenTextColorPanel?(body["color"] as? String)
            replyHandler(["ok": true], nil)
        case "copyImageToClipboard":
            copyImageToClipboard(body: body, replyHandler: replyHandler)
        case "printBegin":
            beginPrintHtml(body: body, replyHandler: replyHandler)
        case "printChunk":
            appendPrintHtml(body: body, replyHandler: replyHandler)
        case "printEnd":
            finishPrintHtml(body: body, replyHandler: replyHandler)
        case "printAbort":
            abortPrintHtml(body: body, replyHandler: replyHandler)
        case "printPdfBegin":
            beginPrintPdf(body: body, replyHandler: replyHandler)
        case "printPdfChunk":
            appendPrintPdf(body: body, replyHandler: replyHandler)
        case "printPdfEnd":
            finishPrintPdf(body: body, replyHandler: replyHandler)
        case "printPdfAbort":
            abortPrintPdf(body: body, replyHandler: replyHandler)
        default:
            replyHandler(nil, "未知操作")
        }
    }

    private func claimOpenFiles(names: [String], replyHandler: @escaping (Any?, String?) -> Void) {
        var available = pendingOpenURLs
        let handles = names.map { name -> [String: Any]? in
            guard !available.isEmpty else { return nil }
            let index = available.firstIndex { $0.lastPathComponent == name } ?? available.startIndex
            let url = available.remove(at: index)
            return registerFileURL(url, source: true)
        }
        pendingOpenURLs = []
        let serializedHandles: [Any] = handles.map { handle in
            if let handle { return handle }
            return NSNull()
        }
        replyHandler(["handles": serializedHandles], nil)
    }

    private func chooseSourceFileAccess(suggestedName: String?, replyHandler: @escaping (Any?, String?) -> Void) {
        let panel = NSOpenPanel()
        panel.title = "允许修改源文件"
        panel.message = "请选择原来的“\(suggestedName ?? "PDF 文件")”，PDF大编辑只会覆盖你选中的这个文件。"
        panel.prompt = "允许"
        panel.nameFieldStringValue = suggestedName ?? ""
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.pdf]

        let completion: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard response == .OK, let url = panel.url else {
                replyHandler(["cancelled": true], nil)
                return
            }
            if let suggestedName, !suggestedName.isEmpty, url.lastPathComponent != suggestedName {
                replyHandler(nil, "请选择原来的源文件：\(suggestedName)")
                return
            }
            guard let entry = self?.registerFileURL(url, source: true) else {
                replyHandler(nil, "无法登记源文件")
                return
            }
            replyHandler(["file": entry], nil)
        }

        if let window {
            panel.beginSheetModal(for: window, completionHandler: completion)
        } else {
            completion(panel.runModal())
        }
    }

    private func showFileError(message: String?, replyHandler: @escaping (Any?, String?) -> Void) {
        let alert = NSAlert()
        alert.messageText = "无法打开文件"
        alert.informativeText = message ?? "PDF 解析失败。"
        alert.alertStyle = .warning
        alert.addButton(withTitle: "好")
        if let window {
            alert.beginSheetModal(for: window) { _ in replyHandler(["ok": true], nil) }
        } else {
            alert.runModal()
            replyHandler(["ok": true], nil)
        }
    }

    private func copyImageToClipboard(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let dataUrl = body["dataUrl"] as? String,
            let commaIndex = dataUrl.firstIndex(of: ",")
        else {
            replyHandler(nil, "剪贴板图片数据不完整")
            return
        }
        let encoded = String(dataUrl[dataUrl.index(after: commaIndex)...])
        guard
            let data = Data(base64Encoded: encoded),
            let image = NSImage(data: data)
        else {
            replyHandler(nil, "剪贴板图片无法读取")
            return
        }
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        let ok = pasteboard.writeObjects([image])
        if ok {
            replyHandler(["ok": true], nil)
        } else {
            replyHandler(nil, "无法写入系统剪贴板")
        }
    }

    private func chooseSaveLocation(suggestedName: String?, replyHandler: @escaping (Any?, String?) -> Void) {
        let panel = NSSavePanel()
        panel.title = "保存 PDF"
        panel.prompt = "保存"
        panel.nameFieldStringValue = suggestedName ?? "整理后的文档.pdf"
        panel.allowedContentTypes = [.pdf]
        panel.canCreateDirectories = true

        let completion: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard response == .OK, let url = panel.url else {
                replyHandler(["cancelled": true], nil)
                return
            }
            guard let entry = self?.registerFileURL(url, source: false) else {
                replyHandler(nil, "无法登记保存位置")
                return
            }
            replyHandler(["file": entry], nil)
        }

        if let window {
            panel.beginSheetModal(for: window, completionHandler: completion)
        } else {
            completion(panel.runModal())
        }
    }

    private func saveFile(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let token = body["token"] as? String,
            let encoded = body["data"] as? String,
            let data = Data(base64Encoded: encoded)
        else {
            replyHandler(nil, "保存数据不完整")
            return
        }

        saveData(token: token, data: data, replyHandler: replyHandler)
    }

    private func beginChunkedSave(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let token = body["token"] as? String,
            fileURLs[token] != nil,
            let expectedSize = body["size"] as? Int,
            expectedSize >= 0,
            expectedSize <= 1_500_000_000
        else {
            replyHandler(nil, "保存请求无效")
            return
        }
        pendingSaveData[token] = Data(capacity: expectedSize)
        pendingSaveSizes[token] = expectedSize
        replyHandler(["ok": true], nil)
    }

    private func appendSaveChunk(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let token = body["token"] as? String,
            var pending = pendingSaveData[token],
            let encoded = body["data"] as? String,
            let chunk = Data(base64Encoded: encoded),
            let expectedSize = pendingSaveSizes[token],
            pending.count + chunk.count <= expectedSize
        else {
            replyHandler(nil, "保存分块无效")
            return
        }
        pending.append(chunk)
        pendingSaveData[token] = pending
        replyHandler(["ok": true], nil)
    }

    private func finishChunkedSave(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let token = body["token"] as? String,
            let data = pendingSaveData.removeValue(forKey: token),
            let expectedSize = pendingSaveSizes.removeValue(forKey: token),
            data.count == expectedSize
        else {
            replyHandler(nil, "保存数据不完整")
            return
        }
        saveData(token: token, data: data, replyHandler: replyHandler)
    }

    private func abortChunkedSave(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        if let token = body["token"] as? String {
            pendingSaveData.removeValue(forKey: token)
            pendingSaveSizes.removeValue(forKey: token)
        }
        replyHandler(["ok": true], nil)
    }

    private func beginPrintHtml(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let token = body["token"] as? String,
            let expectedSize = body["size"] as? Int,
            expectedSize >= 0,
            expectedSize <= 120_000_000
        else {
            replyHandler(nil, "打印请求无效")
            return
        }
        pendingPrintHtml[token] = ""
        pendingPrintSizes[token] = expectedSize
        replyHandler(["ok": true], nil)
    }

    private func appendPrintHtml(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let token = body["token"] as? String,
            var pending = pendingPrintHtml[token],
            let chunk = body["data"] as? String,
            let expectedSize = pendingPrintSizes[token],
            pending.count + chunk.count <= expectedSize
        else {
            replyHandler(nil, "打印数据无效")
            return
        }
        pending.append(chunk)
        pendingPrintHtml[token] = pending
        replyHandler(["ok": true], nil)
    }

    private func finishPrintHtml(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let token = body["token"] as? String,
            let html = pendingPrintHtml.removeValue(forKey: token),
            let expectedSize = pendingPrintSizes.removeValue(forKey: token),
            html.count == expectedSize
        else {
            replyHandler(nil, "打印数据不完整")
            return
        }
        guard let onPrintHtml else {
            replyHandler(["ok": false, "message": "打印窗口还没有准备好"], nil)
            return
        }
        onPrintHtml(html, replyHandler)
    }

    private func abortPrintHtml(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        if let token = body["token"] as? String {
            pendingPrintHtml.removeValue(forKey: token)
            pendingPrintSizes.removeValue(forKey: token)
        }
        replyHandler(["ok": true], nil)
    }

    private func beginPrintPdf(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let token = body["token"] as? String,
            let expectedSize = body["size"] as? Int,
            expectedSize > 0,
            expectedSize <= 1_500_000_000
        else {
            replyHandler(nil, "打印请求无效")
            return
        }
        pendingPrintPdfData[token] = Data(capacity: expectedSize)
        pendingPrintPdfSizes[token] = expectedSize
        replyHandler(["ok": true], nil)
    }

    private func appendPrintPdf(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let token = body["token"] as? String,
            var pending = pendingPrintPdfData[token],
            let encoded = body["data"] as? String,
            let chunk = Data(base64Encoded: encoded),
            let expectedSize = pendingPrintPdfSizes[token],
            pending.count + chunk.count <= expectedSize
        else {
            replyHandler(nil, "打印数据无效")
            return
        }
        pending.append(chunk)
        pendingPrintPdfData[token] = pending
        replyHandler(["ok": true], nil)
    }

    private func finishPrintPdf(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard
            let token = body["token"] as? String,
            let data = pendingPrintPdfData.removeValue(forKey: token),
            let expectedSize = pendingPrintPdfSizes.removeValue(forKey: token),
            data.count == expectedSize
        else {
            replyHandler(nil, "打印数据不完整")
            return
        }
        guard let onPrintPdf else {
            replyHandler(["ok": false, "message": "打印窗口还没有准备好"], nil)
            return
        }
        onPrintPdf(data, replyHandler)
    }

    private func abortPrintPdf(body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        if let token = body["token"] as? String {
            pendingPrintPdfData.removeValue(forKey: token)
            pendingPrintPdfSizes.removeValue(forKey: token)
        }
        replyHandler(["ok": true], nil)
    }

    @discardableResult
    func registerFileURL(_ url: URL, source: Bool) -> [String: Any] {
        let token = UUID().uuidString
        fileURLs[token] = url
        return [
            "token": token,
            "name": url.lastPathComponent,
            "source": source,
            "type": mimeType(for: url),
            "path": url.standardizedFileURL.path
        ]
    }

    func fileResponse(for token: String) -> LocalWebServer.FileResponse? {
        guard let url = fileURLs[token] else { return nil }
        let didAccess = url.startAccessingSecurityScopedResource()
        defer {
            if didAccess { url.stopAccessingSecurityScopedResource() }
        }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return (data, mimeType(for: url))
    }

    private func mimeType(for url: URL) -> String {
        let ext = url.pathExtension.lowercased()
        if ext == "pdf" { return "application/pdf" }
        if ext == "png" { return "image/png" }
        if ext == "jpg" || ext == "jpeg" { return "image/jpeg" }
        return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
    }

    func saveData(token: String, data: Data, replyHandler: @escaping (Any?, String?) -> Void) {
        guard let url = fileURLs[token] else {
            replyHandler(nil, "保存位置已失效")
            return
        }
        do {
            try writeReplacingFile(data, to: url)
            replyHandler(["ok": true], nil)
        } catch {
            requestWritePermission(for: url, token: token, data: data, originalError: error, replyHandler: replyHandler)
        }
    }

    private func writeReplacingFile(_ data: Data, to url: URL) throws {
        let didAccess = url.startAccessingSecurityScopedResource()
        defer {
            if didAccess { url.stopAccessingSecurityScopedResource() }
        }
        try data.write(to: url, options: [])
    }

    func claimFileTokenForTesting(_ url: URL) -> String? {
        registerSelectedFiles([url])
        var token: String?
        claimOpenFiles(names: [url.lastPathComponent]) { result, error in
            guard error == nil,
                  let response = result as? [String: Any],
                  let handles = response["handles"] as? [Any],
                  let entry = handles.first as? [String: Any]
            else { return }
            token = entry["token"] as? String
        }
        return token
    }

    func saveChunkedDataForTesting(token: String, data: Data) -> Bool {
        var succeeded = true
        let reply: (Any?, String?) -> Void = { _, error in
            if error != nil { succeeded = false }
        }
        beginChunkedSave(body: ["token": token, "size": data.count], replyHandler: reply)
        let chunkSize = 192 * 1024
        var offset = 0
        while succeeded && offset < data.count {
            let end = min(offset + chunkSize, data.count)
            let encoded = data.subdata(in: offset..<end).base64EncodedString()
            appendSaveChunk(body: ["token": token, "data": encoded], replyHandler: reply)
            offset = end
        }
        if succeeded {
            finishChunkedSave(body: ["token": token]) { result, error in
                succeeded = error == nil && (result as? [String: Bool])?["ok"] == true
            }
        }
        return succeeded
    }

    private func requestWritePermission(
        for url: URL,
        token: String,
        data: Data,
        originalError: Error,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.title = "允许修改源文件"
        panel.message = "PDF大编辑需要你重新选择“\(url.lastPathComponent)”，以获得写入权限。"
        panel.prompt = "允许"
        panel.directoryURL = url.deletingLastPathComponent()
        panel.nameFieldStringValue = url.lastPathComponent
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.pdf]

        let completion: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard response == .OK, let selected = panel.url else {
                replyHandler(nil, "PERMISSION_CANCELLED")
                return
            }
            guard selected.standardizedFileURL == url.standardizedFileURL else {
                replyHandler(nil, "请选择原来的源文件：\(url.lastPathComponent)")
                return
            }
            guard let self else {
                replyHandler(nil, "保存窗口已关闭")
                return
            }
            do {
                try self.writeReplacingFile(data, to: selected)
                self.fileURLs[token] = selected
                replyHandler(["ok": true], nil)
            } catch {
                replyHandler(nil, "保存失败：\(error.localizedDescription)；原始错误：\(originalError.localizedDescription)")
            }
        }
        if let window {
            panel.beginSheetModal(for: window, completionHandler: completion)
        } else {
            completion(panel.runModal())
        }
    }
}

fileprivate enum WebPrintJobSource {
    case html(String)
    case pdf(Data)
}

final class PDFPrintOptions: NSObject {
    @objc dynamic var autoRotate = true
    @objc dynamic var showNotes = false
    @objc dynamic var useExactScale = false
    @objc dynamic var scalePercent: Double = 100
    @objc dynamic var fillPaper = false
    @objc dynamic var pagesPerSheet = 1
}

final class PDFPrintView: NSView {
    private let document: PDFDocument
    private let fallbackPrintInfo: NSPrintInfo
    let options: PDFPrintOptions

    init(document: PDFDocument, printInfo: NSPrintInfo, options: PDFPrintOptions) {
        self.document = document
        self.fallbackPrintInfo = printInfo
        self.options = options
        super.init(frame: NSRect(origin: .zero, size: printInfo.paperSize))
    }

    required init?(coder: NSCoder) {
        nil
    }

    override var isFlipped: Bool { false }

    override func knowsPageRange(_ range: NSRangePointer) -> Bool {
        let info = currentPrintInfo()
        updateFrame(for: info)
        range.pointee = NSRange(location: 1, length: max(1, sheetCount))
        return true
    }

    override func rectForPage(_ page: Int) -> NSRect {
        let info = currentPrintInfo()
        updateFrame(for: info)
        let paper = info.paperSize
        return NSRect(x: 0, y: CGFloat(page - 1) * paper.height, width: paper.width, height: paper.height)
    }

    override func draw(_ dirtyRect: NSRect) {
        guard let operation = NSPrintOperation.current else { return }
        let info = operation.printInfo
        let sheetIndex = max(0, operation.currentPage - 1)
        drawSheet(index: sheetIndex, printInfo: info)
    }

    private var pagesPerSheet: Int {
        min(16, max(1, options.pagesPerSheet))
    }

    private var sheetCount: Int {
        Int(ceil(Double(max(1, document.pageCount)) / Double(pagesPerSheet)))
    }

    private func currentPrintInfo() -> NSPrintInfo {
        NSPrintOperation.current?.printInfo ?? fallbackPrintInfo
    }

    private func updateFrame(for printInfo: NSPrintInfo) {
        let paper = printInfo.paperSize
        frame = NSRect(x: 0, y: 0, width: paper.width, height: paper.height * CGFloat(sheetCount))
    }

    private func drawSheet(index sheetIndex: Int, printInfo: NSPrintInfo) {
        guard let context = NSGraphicsContext.current?.cgContext else { return }
        let paper = printInfo.paperSize
        let sheetRect = NSRect(x: 0, y: CGFloat(sheetIndex) * paper.height, width: paper.width, height: paper.height)
        NSColor.white.setFill()
        sheetRect.fill()

        let contentRect = printableContentRect(for: printInfo, in: sheetRect)
        let (columns, rows) = grid(for: pagesPerSheet, paper: paper)
        let gap: CGFloat = pagesPerSheet > 1 ? 8 : 0
        let slotWidth = (contentRect.width - CGFloat(columns - 1) * gap) / CGFloat(columns)
        let slotHeight = (contentRect.height - CGFloat(rows - 1) * gap) / CGFloat(rows)
        let firstPageIndex = sheetIndex * pagesPerSheet

        for slotIndex in 0..<pagesPerSheet {
            let pageIndex = firstPageIndex + slotIndex
            guard pageIndex < document.pageCount, let page = document.page(at: pageIndex) else { continue }
            let column = slotIndex % columns
            let row = rows - 1 - (slotIndex / columns)
            let slotRect = NSRect(
                x: contentRect.minX + CGFloat(column) * (slotWidth + gap),
                y: contentRect.minY + CGFloat(row) * (slotHeight + gap),
                width: slotWidth,
                height: slotHeight
            )
            draw(page: page, pageIndex: pageIndex, in: slotRect, context: context)
        }
    }

    private func printableContentRect(for printInfo: NSPrintInfo, in sheetRect: NSRect) -> NSRect {
        var rect = NSRect(
            x: sheetRect.minX + max(0, printInfo.leftMargin),
            y: sheetRect.minY + max(0, printInfo.bottomMargin),
            width: sheetRect.width - max(0, printInfo.leftMargin) - max(0, printInfo.rightMargin),
            height: sheetRect.height - max(0, printInfo.topMargin) - max(0, printInfo.bottomMargin)
        )
        if rect.width <= 0 || rect.height <= 0 {
            rect = sheetRect.insetBy(dx: 18, dy: 18)
        }
        return rect
    }

    private func grid(for count: Int, paper: NSSize) -> (Int, Int) {
        switch count {
        case 1:
            return (1, 1)
        case 2:
            return paper.width > paper.height ? (2, 1) : (1, 2)
        case 3, 4:
            return (2, 2)
        case 5, 6:
            return paper.width > paper.height ? (3, 2) : (2, 3)
        case 7...9:
            return (3, 3)
        default:
            return (4, 4)
        }
    }

    private func draw(page: PDFPage, pageIndex: Int, in slotRect: NSRect, context: CGContext) {
        let pageBox = page.bounds(for: .mediaBox)
        guard pageBox.width > 0, pageBox.height > 0, slotRect.width > 0, slotRect.height > 0 else { return }
        let shouldRotate = options.autoRotate && ((pageBox.width > pageBox.height) != (slotRect.width > slotRect.height))
        let sourceWidth = shouldRotate ? pageBox.height : pageBox.width
        let sourceHeight = shouldRotate ? pageBox.width : pageBox.height
        let fitScale = min(slotRect.width / sourceWidth, slotRect.height / sourceHeight)
        let fillScale = max(slotRect.width / sourceWidth, slotRect.height / sourceHeight)
        let scale: CGFloat
        if options.useExactScale {
            scale = max(0.05, min(4, CGFloat(options.scalePercent / 100.0)))
        } else {
            scale = options.fillPaper ? fillScale : fitScale
        }
        let drawWidth = sourceWidth * scale
        let drawHeight = sourceHeight * scale
        let targetRect = NSRect(
            x: slotRect.minX + (slotRect.width - drawWidth) / 2,
            y: slotRect.minY + (slotRect.height - drawHeight) / 2,
            width: drawWidth,
            height: drawHeight
        )

        context.saveGState()
        context.clip(to: slotRect)
        if shouldRotate {
            context.translateBy(x: targetRect.minX, y: targetRect.minY)
            context.translateBy(x: 0, y: drawHeight)
            context.rotate(by: -.pi / 2)
        } else {
            context.translateBy(x: targetRect.minX, y: targetRect.minY)
        }
        context.scaleBy(x: scale, y: scale)
        context.translateBy(x: -pageBox.minX, y: -pageBox.minY)
        page.draw(with: .mediaBox, to: context)
        context.restoreGState()

        if options.showNotes {
            drawNote("页码：\(pageIndex + 1)/\(document.pageCount)", below: slotRect)
        }
    }

    private func drawNote(_ text: String, below rect: NSRect) {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 9),
            .foregroundColor: NSColor.secondaryLabelColor,
        ]
        let attributed = NSAttributedString(string: text, attributes: attributes)
        let size = attributed.size()
        let noteRect = NSRect(x: rect.midX - size.width / 2, y: max(rect.minY - 14, 2), width: size.width, height: size.height)
        attributed.draw(in: noteRect)
    }
}

final class PrintPreviewAccessoryController: NSViewController, NSPrintPanelAccessorizing {
    private let options: PDFPrintOptions
    private weak var printInfo: NSPrintInfo?
    @objc dynamic var previewAutoRotate = true
    @objc dynamic var previewShowNotes = false
    @objc dynamic var previewUseExactScale = false
    @objc dynamic var previewScalePercent: Double = 100
    @objc dynamic var previewFillPaper = false
    @objc dynamic var previewPagesPerSheet = 1
    private let autoRotateButton = NSButton(checkboxWithTitle: "自动旋转", target: nil, action: nil)
    private let showNotesButton = NSButton(checkboxWithTitle: "显示备注", target: nil, action: nil)
    private let exactScaleButton = NSButton(radioButtonWithTitle: "缩放：", target: nil, action: nil)
    private let scaleToFitButton = NSButton(radioButtonWithTitle: "缩放以适合：", target: nil, action: nil)
    private let printWholeButton = NSButton(radioButtonWithTitle: "打印整个图像", target: nil, action: nil)
    private let fillPaperButton = NSButton(radioButtonWithTitle: "填满纸张", target: nil, action: nil)
    private let scaleField = NSTextField(string: "100")
    private let copiesField = NSTextField(string: "1")
    private let copiesStepper = NSStepper()
    var onChange: (() -> Void)?

    init(options: PDFPrintOptions, printInfo: NSPrintInfo) {
        self.options = options
        self.printInfo = printInfo
        self.previewAutoRotate = options.autoRotate
        self.previewShowNotes = options.showNotes
        self.previewUseExactScale = options.useExactScale
        self.previewScalePercent = options.scalePercent
        self.previewFillPaper = options.fillPaper
        self.previewPagesPerSheet = options.pagesPerSheet
        super.init(nibName: nil, bundle: nil)
        title = "预览"
    }

    required init?(coder: NSCoder) {
        nil
    }

    override func loadView() {
        let root = NSView(frame: NSRect(x: 0, y: 0, width: 560, height: 170))
        view = root

        autoRotateButton.frame = NSRect(x: 26, y: 126, width: 160, height: 24)
        showNotesButton.frame = NSRect(x: 300, y: 126, width: 150, height: 24)
        exactScaleButton.frame = NSRect(x: 26, y: 82, width: 92, height: 24)
        scaleField.frame = NSRect(x: 118, y: 82, width: 76, height: 24)
        scaleToFitButton.frame = NSRect(x: 26, y: 52, width: 130, height: 24)
        printWholeButton.frame = NSRect(x: 300, y: 52, width: 170, height: 24)
        fillPaperButton.frame = NSRect(x: 300, y: 24, width: 150, height: 24)

        let copiesLabel = NSTextField(labelWithString: "每页份数：")
        copiesLabel.frame = NSRect(x: 26, y: 12, width: 100, height: 22)
        copiesField.frame = NSRect(x: 126, y: 8, width: 120, height: 26)
        copiesStepper.frame = NSRect(x: 250, y: 8, width: 20, height: 26)
        copiesStepper.minValue = 1
        copiesStepper.maxValue = 16
        copiesStepper.increment = 1

        [autoRotateButton, showNotesButton, exactScaleButton, scaleField, scaleToFitButton, printWholeButton, fillPaperButton, copiesLabel, copiesField, copiesStepper].forEach {
            root.addSubview($0)
        }

        autoRotateButton.target = self
        autoRotateButton.action = #selector(controlChanged(_:))
        showNotesButton.target = self
        showNotesButton.action = #selector(controlChanged(_:))
        exactScaleButton.target = self
        exactScaleButton.action = #selector(selectExactScale(_:))
        scaleToFitButton.target = self
        scaleToFitButton.action = #selector(selectScaleToFit(_:))
        printWholeButton.target = self
        printWholeButton.action = #selector(selectPrintWhole(_:))
        fillPaperButton.target = self
        fillPaperButton.action = #selector(selectFillPaper(_:))
        scaleField.target = self
        scaleField.action = #selector(controlChanged(_:))
        copiesField.target = self
        copiesField.action = #selector(controlChanged(_:))
        copiesStepper.target = self
        copiesStepper.action = #selector(stepperChanged(_:))
        syncControls()
    }

    func localizedSummaryItems() -> [[NSPrintPanel.AccessorySummaryKey : String]] {
        let scaleText: String
        if options.useExactScale {
            scaleText = "\(Int(options.scalePercent.rounded()))%"
        } else {
            scaleText = options.fillPaper ? "填满纸张" : "打印整个图像"
        }
        return [
            [.itemName: "自动旋转", .itemDescription: options.autoRotate ? "开" : "关"],
            [.itemName: "缩放", .itemDescription: scaleText],
            [.itemName: "每页份数", .itemDescription: "\(options.pagesPerSheet)"],
        ]
    }

    func keyPathsForValuesAffectingPreview() -> Set<String> {
        [
            "previewAutoRotate",
            "previewShowNotes",
            "previewUseExactScale",
            "previewScalePercent",
            "previewFillPaper",
            "previewPagesPerSheet",
        ]
    }

    @objc private func selectExactScale(_ sender: Any?) {
        previewUseExactScale = true
        previewFillPaper = false
        applyAndRefresh()
    }

    @objc private func selectScaleToFit(_ sender: Any?) {
        previewUseExactScale = false
        previewFillPaper = false
        applyAndRefresh()
    }

    @objc private func selectPrintWhole(_ sender: Any?) {
        previewUseExactScale = false
        previewFillPaper = false
        applyAndRefresh()
    }

    @objc private func selectFillPaper(_ sender: Any?) {
        previewUseExactScale = false
        previewFillPaper = true
        applyAndRefresh()
    }

    @objc private func stepperChanged(_ sender: Any?) {
        copiesField.stringValue = "\(Int(copiesStepper.integerValue))"
        controlChanged(sender)
    }

    @objc private func controlChanged(_ sender: Any?) {
        previewAutoRotate = autoRotateButton.state == .on
        previewShowNotes = showNotesButton.state == .on
        if exactScaleButton.state == .on {
            previewUseExactScale = true
            previewFillPaper = false
        }
        let scale = scaleField.doubleValue
        previewScalePercent = min(400, max(5, scale.isFinite ? scale : 100))
        let pages = min(16, max(1, copiesField.integerValue))
        previewPagesPerSheet = pages
        copiesStepper.integerValue = pages
        applyAndRefresh()
    }

    private func applyAndRefresh() {
        copyPreviewSettingsToOptions()
        syncControls()
        applyToPrintInfo()
        willChangeValue(forKey: "localizedSummaryItems")
        didChangeValue(forKey: "localizedSummaryItems")
        onChange?()
    }

    private func syncControls() {
        autoRotateButton.state = previewAutoRotate ? .on : .off
        showNotesButton.state = previewShowNotes ? .on : .off
        exactScaleButton.state = previewUseExactScale ? .on : .off
        scaleToFitButton.state = previewUseExactScale ? .off : .on
        printWholeButton.state = (!previewUseExactScale && !previewFillPaper) ? .on : .off
        fillPaperButton.state = (!previewUseExactScale && previewFillPaper) ? .on : .off
        scaleField.isEnabled = previewUseExactScale
        scaleField.stringValue = "\(Int(previewScalePercent.rounded()))"
        copiesField.stringValue = "\(previewPagesPerSheet)"
        copiesStepper.integerValue = previewPagesPerSheet
    }

    private func copyPreviewSettingsToOptions() {
        options.autoRotate = previewAutoRotate
        options.showNotes = previewShowNotes
        options.useExactScale = previewUseExactScale
        options.scalePercent = previewScalePercent
        options.fillPaper = previewFillPaper
        options.pagesPerSheet = previewPagesPerSheet
    }

    private func applyToPrintInfo() {
        guard let printInfo else { return }
        printInfo.isHorizontallyCentered = true
        printInfo.isVerticallyCentered = true
        printInfo.horizontalPagination = options.useExactScale ? .automatic : .fit
        printInfo.verticalPagination = options.useExactScale ? .automatic : .fit
        printInfo.scalingFactor = CGFloat(options.scalePercent / 100.0)
        printInfo.dictionary()[NSPrintInfo.AttributeKey.headerAndFooter] = NSNumber(value: options.showNotes)
    }
}

final class WebPrintJob: NSObject, WKNavigationDelegate {
    private let webView: WKWebView
    private let source: WebPrintJobSource
    private let replyHandler: (Any?, String?) -> Void
    private let onFinish: () -> Void
    private var completed = false
    private var timeoutWorkItem: DispatchWorkItem?
    private var temporaryPrintURL: URL?
    private var accessoryController: PrintPreviewAccessoryController?
    private var pdfPrintView: PDFPrintView?

    fileprivate init(source: WebPrintJobSource, replyHandler: @escaping (Any?, String?) -> Void, onFinish: @escaping () -> Void) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        self.webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 900, height: 1200), configuration: configuration)
        self.source = source
        self.replyHandler = replyHandler
        self.onFinish = onFinish
        super.init()
        self.webView.navigationDelegate = self
    }

    func start() {
        printDebugLog("print-window-created")
        scheduleTimeout(message: "打印页面载入超时")
        switch source {
        case .html(let html):
            webView.loadHTMLString(html, baseURL: nil)
        case .pdf:
            timeoutWorkItem?.cancel()
            printDebugLog("print-window-did-finish-load")
            DispatchQueue.main.async { [weak self] in
                self?.runPrintOperation()
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        timeoutWorkItem?.cancel()
        printDebugLog("print-window-did-finish-load")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            self?.runPrintOperation()
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        finish(ok: false, message: "打印页面载入失败：\(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        finish(ok: false, message: "打印页面载入失败：\(error.localizedDescription)")
    }

    private func runPrintOperation() {
        guard !completed else { return }
        printDebugLog("print-called")
        let printInfo = NSPrintInfo.shared.copy() as? NSPrintInfo ?? NSPrintInfo()
        printInfo.leftMargin = 18
        printInfo.rightMargin = 18
        printInfo.topMargin = 18
        printInfo.bottomMargin = 18
        printInfo.horizontalPagination = .fit
        printInfo.verticalPagination = .fit
        let operation: NSPrintOperation
        let printPanel: NSPrintPanel
        switch source {
        case .pdf(let data):
            guard let document = PDFDocument(data: data) else {
                finish(ok: false, message: "打印文件无法读取")
                return
            }
            let options = PDFPrintOptions()
            let printView = PDFPrintView(document: document, printInfo: printInfo, options: options)
            let accessory = PrintPreviewAccessoryController(options: options, printInfo: printInfo)
            accessory.onChange = { [weak printView] in
                printView?.needsDisplay = true
            }
            pdfPrintView = printView
            accessoryController = accessory
            operation = NSPrintOperation(view: printView, printInfo: printInfo)
            printPanel = operation.printPanel
            printPanel.options = [.showsCopies, .showsPageRange, .showsPaperSize, .showsOrientation, .showsScaling, .showsPreview]
            printPanel.addAccessoryController(accessory)
        case .html:
            operation = webView.printOperation(with: printInfo)
            printPanel = operation.printPanel
            printPanel.options = [.showsCopies, .showsPageRange, .showsPaperSize, .showsOrientation, .showsScaling, .showsPreview]
        }
        operation.showsPrintPanel = true
        operation.showsProgressPanel = false
        let ok = operation.run()
        printDebugLog(ok ? "print-callback-success" : "print-callback-failure")
        finish(ok: ok, message: ok ? "打印任务已完成。" : "用户取消打印")
    }

    private func scheduleTimeout(message: String) {
        timeoutWorkItem?.cancel()
        let item = DispatchWorkItem { [weak self] in
            printDebugLog("print-timeout")
            self?.finish(ok: false, message: message)
        }
        timeoutWorkItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: item)
    }

    private func finish(ok: Bool, message: String) {
        guard !completed else { return }
        completed = true
        timeoutWorkItem?.cancel()
        webView.stopLoading()
        if let temporaryPrintURL {
            try? FileManager.default.removeItem(at: temporaryPrintURL.deletingLastPathComponent())
        }
        accessoryController = nil
        pdfPrintView = nil
        replyHandler(["ok": ok, "message": message], nil)
        printDebugLog("print-window-destroyed")
        onFinish()
    }
}

final class WebViewController: NSViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    let bridge = NativeBridge()
    private var webView: WKWebView!
    private var localServer: LocalWebServer?
    private var isPageReady = false
    private var pendingExternalOpenURLs: [URL] = []
    private var activePrintJob: WebPrintJob?
    private weak var observedFullscreenWindow: NSWindow?

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "pdfStudio")
        configuration.userContentController.addUserScript(WKUserScript(
            source: Self.nativeFileBridgeScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let fileAwareWebView = FileAwareWebView(frame: .zero, configuration: configuration)
        fileAwareWebView.onDroppedFileURLs = { [weak bridge] urls in
            bridge?.registerSelectedFiles(urls)
        }
        webView = fileAwareWebView
        webView.navigationDelegate = self
        webView.uiDelegate = self
        bridge.onToggleFullscreen = { [weak self] in
            self?.view.window?.toggleFullScreen(nil)
        }
        bridge.onOpenTextColorPanel = { [weak self] color in
            self?.openTextColorPanel(initialHex: color)
        }
        bridge.onPrintHtml = { [weak self] html, replyHandler in
            self?.printHtml(html, replyHandler: replyHandler)
        }
        bridge.onPrintPdf = { [weak self] data, replyHandler in
            self?.printPdf(data, replyHandler: replyHandler)
        }
        view = webView
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        bridge.window = view.window
        observeFullscreenWindow(view.window)
    }

    func loadApplication() {
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "app") else {
            let alert = NSAlert()
            alert.messageText = "无法启动 PDF大编辑"
            alert.informativeText = "应用资源不完整。"
            alert.runModal()
            return
        }
        do {
            let server = try LocalWebServer(html: Data(contentsOf: url), fileProvider: { [weak self] token in
                self?.bridge.fileResponse(for: token)
            })
            localServer = server
            server.onReady = { [weak self] applicationURL in
                self?.webView.load(URLRequest(url: applicationURL))
            }
            server.onFailure = { [weak self] error in
                let alert = NSAlert()
                alert.messageText = "无法启动 PDF大编辑"
                alert.informativeText = "本地阅读服务启动失败：\(error.localizedDescription)"
                if let window = self?.view.window {
                    alert.beginSheetModal(for: window)
                } else {
                    alert.runModal()
                }
            }
            server.start()
        } catch {
            let alert = NSAlert()
            alert.messageText = "无法启动 PDF大编辑"
            alert.informativeText = "本地阅读服务启动失败：\(error.localizedDescription)"
            alert.runModal()
        }
    }

    func openExternalFiles(_ urls: [URL]) {
        let supported = urls.filter { url in
            let ext = url.pathExtension.lowercased()
            return ["pdf", "png", "jpg", "jpeg"].contains(ext)
        }
        guard !supported.isEmpty else { return }
        pendingExternalOpenURLs.append(contentsOf: supported)
        flushExternalOpenFiles()
    }

    deinit {
        removeFullscreenObserver()
        localServer?.stop()
    }

    private func observeFullscreenWindow(_ window: NSWindow?) {
        guard observedFullscreenWindow !== window else { return }
        removeFullscreenObserver()
        guard let window else { return }
        observedFullscreenWindow = window
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowDidEnterFullScreen(_:)),
            name: NSWindow.didEnterFullScreenNotification,
            object: window
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowDidExitFullScreen(_:)),
            name: NSWindow.didExitFullScreenNotification,
            object: window
        )
    }

    private func removeFullscreenObserver() {
        guard let window = observedFullscreenWindow else { return }
        NotificationCenter.default.removeObserver(self, name: NSWindow.didEnterFullScreenNotification, object: window)
        NotificationCenter.default.removeObserver(self, name: NSWindow.didExitFullScreenNotification, object: window)
        observedFullscreenWindow = nil
    }

    @objc private func windowDidEnterFullScreen(_ notification: Notification) {
        notifyNativeFullscreenChanged(true)
    }

    @objc private func windowDidExitFullScreen(_ notification: Notification) {
        notifyNativeFullscreenChanged(false)
    }

    private func notifyNativeFullscreenChanged(_ active: Bool) {
        let value = active ? "true" : "false"
        webView.evaluateJavaScript(
            "window.pdfStudioNativeFullscreenChanged && window.pdfStudioNativeFullscreenChanged(\(value));",
            completionHandler: nil
        )
    }

    private func openTextColorPanel(initialHex: String?) {
        let panel = NSColorPanel.shared
        panel.showsAlpha = false
        panel.isContinuous = true
        if let color = nsColor(fromHex: initialHex) {
            panel.color = color
        }
        panel.setTarget(self)
        panel.setAction(#selector(textColorPanelChanged(_:)))
        panel.orderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func textColorPanelChanged(_ sender: NSColorPanel) {
        guard let hex = hexString(from: sender.color) else { return }
        webView.evaluateJavaScript(
            "window.pdfStudioReceivePickedTextColor && window.pdfStudioReceivePickedTextColor('\(hex)');",
            completionHandler: nil
        )
    }

    private func nsColor(fromHex hex: String?) -> NSColor? {
        guard var value = hex?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let intValue = Int(value, radix: 16) else { return nil }
        return NSColor(
            calibratedRed: CGFloat((intValue >> 16) & 0xff) / 255,
            green: CGFloat((intValue >> 8) & 0xff) / 255,
            blue: CGFloat(intValue & 0xff) / 255,
            alpha: 1
        )
    }

    private func hexString(from color: NSColor) -> String? {
        guard let converted = color.usingColorSpace(.sRGB) else { return nil }
        let red = Int(round(max(0, min(1, converted.redComponent)) * 255))
        let green = Int(round(max(0, min(1, converted.greenComponent)) * 255))
        let blue = Int(round(max(0, min(1, converted.blueComponent)) * 255))
        return String(format: "#%02x%02x%02x", red, green, blue)
    }

    private func printHtml(_ html: String, replyHandler: @escaping (Any?, String?) -> Void) {
        printDebugLog("print-start")
        guard activePrintJob == nil else {
            replyHandler(["ok": false, "message": "已有打印任务正在进行。"], nil)
            return
        }
        let job = WebPrintJob(source: .html(html), replyHandler: replyHandler) { [weak self] in
            self?.activePrintJob = nil
        }
        activePrintJob = job
        job.start()
    }

    private func printPdf(_ data: Data, replyHandler: @escaping (Any?, String?) -> Void) {
        printDebugLog("print-start")
        guard activePrintJob == nil else {
            replyHandler(["ok": false, "message": "已有打印任务正在进行。"], nil)
            return
        }
        let job = WebPrintJob(source: .pdf(data), replyHandler: replyHandler) { [weak self] in
            self?.activePrintJob = nil
        }
        activePrintJob = job
        job.start()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        preferences: WKWebpagePreferences,
        decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void
    ) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download, preferences)
        } else {
            decisionHandler(.allow, preferences)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isPageReady = true
        flushExternalOpenFiles()
    }

    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping (URL?) -> Void
    ) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.canCreateDirectories = true
        panel.begin { response in
            completionHandler(response == .OK ? panel.url : nil)
        }
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.allowedContentTypes = [.pdf, .png, .jpeg]
        panel.beginSheetModal(for: view.window!) { response in
            if response == .OK {
                self.bridge.registerSelectedFiles(panel.urls)
            }
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    func requestApplicationClose(completion: @escaping (Bool) -> Void) {
        guard webView.url != nil else {
            completion(true)
            return
        }
        Task { @MainActor in
            do {
                let value = try await webView.callAsyncJavaScript(
                    "return await window.pdfStudioBeforeAppClose();",
                    arguments: [:],
                    in: nil,
                    contentWorld: .page
                )
                completion(value as? Bool ?? false)
            } catch {
                completion(false)
            }
        }
    }

    private func flushExternalOpenFiles() {
        guard isPageReady, !pendingExternalOpenURLs.isEmpty else { return }
        let urls = pendingExternalOpenURLs
        pendingExternalOpenURLs.removeAll()
        let entries = urls.map { bridge.registerFileURL($0, source: true) }
        dispatchExternalOpenEntries(entries)
    }

    private func dispatchExternalOpenEntries(_ entries: [[String: Any]], attempt: Int = 0) {
        guard
            let jsonData = try? JSONSerialization.data(withJSONObject: entries),
            let json = String(data: jsonData, encoding: .utf8)
        else { return }
        let script = """
        (() => {
          if (!window.pdfStudioOpenNativeFiles || !window.pdfStudioOpenNativeHandles) return "not-ready";
          window.pdfStudioOpenNativeFiles(\(json), { newPdfTabs: true }).catch((error) => {
            const message = error?.message || String(error);
            if (window.pdfStudioReportNativeOpenError) {
              window.pdfStudioReportNativeOpenError(message);
            } else {
              console.error(message);
            }
          });
          return "queued";
        })();
        """
        webView.evaluateJavaScript(script) { [weak self] result, error in
            guard let self else { return }
            if error == nil, (result as? String) == "queued" { return }
            if attempt < 80 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    self.dispatchExternalOpenEntries(entries, attempt: attempt + 1)
                }
                return
            }
            let alert = NSAlert()
            alert.messageText = "无法打开文件"
            alert.informativeText = "PDF大编辑已经收到文件，但页面长时间没有准备好。请重新用“打开”按钮选择一次。"
            alert.alertStyle = .warning
            if let window = self.view.window {
                alert.beginSheetModal(for: window)
            } else {
                alert.runModal()
            }
        }
    }

    private static let nativeFileBridgeScript = #"""
    (() => {
      const handler = window.webkit?.messageHandlers?.pdfStudio;
      if (!handler) return;

      const bytesToBase64 = (bytes) => {
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
      };

      const toBytes = async (value) => {
        if (value instanceof Uint8Array) return value;
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
        return new Uint8Array(value);
      };

      const saveToken = async (token, value) => {
        const pending = await toBytes(value);
        const chunkSize = 192 * 1024;
        await handler.postMessage({ action: "saveBegin", token, size: pending.byteLength });
        for (let offset = 0; offset < pending.byteLength; offset += chunkSize) {
          const chunk = pending.subarray(offset, Math.min(offset + chunkSize, pending.byteLength));
          await handler.postMessage({ action: "saveChunk", token, data: bytesToBase64(chunk) });
        }
        await handler.postMessage({ action: "saveEnd", token });
      };

      const makeHandle = (entry) => ({
        __pdfStudioNativeToken: entry.token,
        __pdfStudioNativePath: entry.path || "",
        __pdfStudioSource: Boolean(entry.source),
        kind: "file",
        name: entry.name,
        getFile: async () => {
          const response = await fetch(`/native-file/${encodeURIComponent(entry.token)}`);
          if (!response.ok) throw new Error(`无法读取“${entry.name}”`);
          const blob = await response.blob();
          return new File([blob], entry.name, { type: entry.type || blob.type || "application/octet-stream" });
        },
        queryPermission: async () => "granted",
        requestPermission: async () => "granted",
        createWritable: async () => {
          let pending = null;
          return {
            write: async (blob) => { pending = await toBytes(blob); },
            close: async () => {
              if (!pending) return;
              try {
                await saveToken(entry.token, pending);
              } catch (error) {
                handler.postMessage({ action: "saveAbort", token: entry.token }).catch(() => {});
                if (String(error).includes("PERMISSION_CANCELLED")) {
                  throw new DOMException("用户取消了权限申请", "AbortError");
                }
                throw error;
              }
            }
          };
        }
      });

      window.pdfStudioSaveSourceFile = async (handle, bytes) => {
        const token = handle?.__pdfStudioNativeToken;
        if (!token) return { ok: false, unavailable: true };
        try {
          await saveToken(token, bytes);
          return { ok: true };
        } catch (error) {
          handler.postMessage({ action: "saveAbort", token }).catch(() => {});
          if (String(error).includes("PERMISSION_CANCELLED")) {
            throw new DOMException("用户取消了权限申请", "AbortError");
          }
          throw error;
        }
      };

      const textToken = () => {
        if (crypto?.randomUUID) return crypto.randomUUID();
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      };

      window.pdfStudioNativePrintPdf = async (bytes) => {
        const token = textToken();
        const pending = await toBytes(bytes);
        const chunkSize = 192 * 1024;
        try {
          await handler.postMessage({ action: "printPdfBegin", token, size: pending.byteLength });
          for (let offset = 0; offset < pending.byteLength; offset += chunkSize) {
            const chunk = pending.subarray(offset, Math.min(offset + chunkSize, pending.byteLength));
            await handler.postMessage({ action: "printPdfChunk", token, data: bytesToBase64(chunk) });
          }
          return await handler.postMessage({ action: "printPdfEnd", token });
        } catch (error) {
          handler.postMessage({ action: "printPdfAbort", token }).catch(() => {});
          throw error;
        }
      };

      window.pdfStudioGetRuntimeInfo = async () => ({
        platform: "darwin",
        packaged: true,
        nativeShell: true,
        portable: false,
        updateSupported: false,
        currentVersion: "0.3.3"
      });

      window.pdfStudioNativeToggleFullscreen = async () => {
        return await handler.postMessage({ action: "toggleFullscreen" });
      };

      window.pdfStudioOpenTextColorPanel = async (color) => {
        return await handler.postMessage({ action: "openTextColorPanel", color });
      };

      window.pdfStudioNativeCopyImageToClipboard = async (dataUrl) => {
        return await handler.postMessage({ action: "copyImageToClipboard", dataUrl });
      };

      window.pdfStudioNativePrintHtml = async (html) => {
        const token = textToken();
        const chunkSize = 96 * 1024;
        try {
          await handler.postMessage({ action: "printBegin", token, size: html.length });
          for (let offset = 0; offset < html.length; offset += chunkSize) {
            await handler.postMessage({ action: "printChunk", token, data: html.slice(offset, offset + chunkSize) });
          }
          return await handler.postMessage({ action: "printEnd", token });
        } catch (error) {
          handler.postMessage({ action: "printAbort", token }).catch(() => {});
          throw error;
        }
      };

      // WKWebView's native file input passes file bytes directly. Avoid routing
      // large PDFs through the script-message bridge, which can truncate data.
      window.showOpenFilePicker = undefined;

      window.pdfStudioClaimOpenFileHandles = async (files) => {
        const result = await handler.postMessage({ action: "claimOpenFiles", names: files.map((file) => file.name) });
        return (result?.handles || []).map((entry) => entry ? makeHandle(entry) : null);
      };

      window.pdfStudioOpenNativeFiles = async (entries, options = {}) => {
        if (!window.pdfStudioOpenNativeHandles) return false;
        const handles = (entries || []).map(makeHandle);
        return await window.pdfStudioOpenNativeHandles(handles, options);
      };

      window.pdfStudioRequestSourceFileHandle = async (suggestedName) => {
        const result = await handler.postMessage({ action: "requestSourceAccess", suggestedName });
        if (result?.cancelled) throw new DOMException("用户取消了权限申请", "AbortError");
        return makeHandle(result.file);
      };

      window.showSaveFilePicker = async (options = {}) => {
        const result = await handler.postMessage({ action: "saveAs", suggestedName: options.suggestedName });
        if (result?.cancelled) throw new DOMException("用户取消了操作", "AbortError");
        return makeHandle(result.file);
      };
    })();
    """#
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var window: NSWindow!
    private var controller: WebViewController!
    private var closeApproved = false
    private var closeRequestActive = false
    private var pendingOpenURLs: [URL] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        configureMenu()

        controller = WebViewController()
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "PDF大编辑"
        window.minSize = NSSize(width: 980, height: 640)
        window.contentViewController = controller
        window.delegate = self
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        controller.loadApplication()
        if !pendingOpenURLs.isEmpty {
            controller.openExternalFiles(pendingOpenURLs)
            pendingOpenURLs.removeAll()
        }
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        handleExternalOpen(urls)
    }

    func application(_ sender: NSApplication, openFile filename: String) -> Bool {
        handleExternalOpen([URL(fileURLWithPath: filename)])
        return true
    }

    func application(_ sender: NSApplication, openFiles filenames: [String]) {
        handleExternalOpen(filenames.map { URL(fileURLWithPath: $0) })
        sender.reply(toOpenOrPrint: .success)
    }

    private func handleExternalOpen(_ urls: [URL]) {
        if let controller {
            controller.openExternalFiles(urls)
            window?.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        } else {
            pendingOpenURLs.append(contentsOf: urls)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard !closeApproved else { return true }
        guard !closeRequestActive else { return false }
        closeRequestActive = true
        controller.requestApplicationClose { [weak self] shouldClose in
            guard let self else { return }
            self.closeRequestActive = false
            if shouldClose {
                self.closeApproved = true
                self.window.close()
            }
        }
        return false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard !closeApproved else { return .terminateNow }
        guard !closeRequestActive else { return .terminateLater }
        closeRequestActive = true
        controller.requestApplicationClose { [weak self] shouldClose in
            guard let self else { return }
            self.closeRequestActive = false
            self.closeApproved = shouldClose
            sender.reply(toApplicationShouldTerminate: shouldClose)
        }
        return .terminateLater
    }

    private func configureMenu() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于 PDF大编辑", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        let uninstallItem = appMenu.addItem(withTitle: "卸载 PDF大编辑…", action: #selector(uninstallApplication(_:)), keyEquivalent: "")
        uninstallItem.target = self
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出 PDF大编辑", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu
        NSApp.mainMenu = mainMenu
    }

    @objc private func uninstallApplication(_ sender: Any?) {
        let alert = NSAlert()
        alert.messageText = "卸载 PDF大编辑？"
        alert.informativeText = "应用、本地设置和“打开方式”缓存登记将被清理。你的 PDF 和图片文件不会被删除。"
        alert.alertStyle = .warning
        alert.addButton(withTitle: "卸载")
        alert.addButton(withTitle: "取消")
        guard alert.runModal() == .alertFirstButtonReturn else { return }

        do {
            try launchUninstallCleanup()
            closeApproved = true
            NSApp.terminate(nil)
        } catch {
            let failure = NSAlert()
            failure.messageText = "无法启动卸载"
            failure.informativeText = "请退出应用后，将 PDF大编辑从“应用程序”移到废纸篓。\n\(error.localizedDescription)"
            failure.runModal()
        }
    }

    private func launchUninstallCleanup() throws {
        let appPath = Bundle.main.bundleURL.path
        let scriptURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("uninstall-pdf-studio-\(UUID().uuidString).zsh")
        let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first
        let cleanupPaths = [
            library?.appendingPathComponent("WebKit/com.pdfstudio.desktop").path,
            library?.appendingPathComponent("Caches/com.pdfstudio.desktop").path,
            library?.appendingPathComponent("Saved Application State/com.pdfstudio.desktop.savedState").path,
            library?.appendingPathComponent("Preferences/com.pdfstudio.desktop.plist").path
        ].compactMap { $0 }
        let lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
        let cleanupCommands = cleanupPaths.map { "rm -rf \(shellQuoted($0))" }.joined(separator: "\n")
        let script = """
        #!/bin/zsh
        sleep 1.2
        \(shellQuoted(lsregister)) -u \(shellQuoted(appPath)) >/dev/null 2>&1 || true
        rm -rf \(shellQuoted(appPath))
        \(cleanupCommands)
        \(shellQuoted(lsregister)) -kill -r -domain local -domain system -domain user >/dev/null 2>&1 || true
        /usr/bin/killall Finder >/dev/null 2>&1 || true
        rm -f "$0"
        """
        try script.write(to: scriptURL, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: scriptURL.path)
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = [scriptURL.path]
        try process.run()
    }

    private func shellQuoted(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
    }
}

func runLocalServerSelfTest() -> Never {
    guard
        let resource = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "app"),
        let html = try? Data(contentsOf: resource),
        let server = try? LocalWebServer(html: html)
    else {
        print("SELF_TEST_RESOURCE_FAILED")
        exit(2)
    }
    server.onReady = { url in
        URLSession.shared.dataTask(with: url) { data, _, error in
            let content = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            if error == nil && content.contains("PDF大编辑") && content.contains("pdfJsSource") {
                print("SELF_TEST_OK")
                exit(0)
            }
            print("SELF_TEST_HTTP_FAILED: \(error?.localizedDescription ?? "invalid content")")
            exit(3)
        }.resume()
    }
    server.onFailure = { error in
        print("SELF_TEST_SERVER_FAILED: \(error.localizedDescription)")
        exit(4)
    }
    server.start()
    dispatchMain()
}

func runSourceSaveSelfTest() -> Never {
    let fileURL = FileManager.default.temporaryDirectory
        .appendingPathComponent("pdf-studio-source-save-\(UUID().uuidString).pdf")
    defer { try? FileManager.default.removeItem(at: fileURL) }
    do {
        try Data("old".utf8).write(to: fileURL)
        let bridge = NativeBridge()
        guard let token = bridge.claimFileTokenForTesting(fileURL) else {
            print("SOURCE_SAVE_TOKEN_FAILED")
            exit(5)
        }
        let expected = Data(repeating: 0x5A, count: 4_200_000)
        let saved = bridge.saveChunkedDataForTesting(token: token, data: expected)
        let actual = try Data(contentsOf: fileURL)
        guard saved, actual == expected else {
            print("SOURCE_SAVE_CONTENT_FAILED")
            exit(6)
        }
        print("SOURCE_SAVE_OK")
        exit(0)
    } catch {
        print("SOURCE_SAVE_FAILED: \(error.localizedDescription)")
        exit(7)
    }
}

if CommandLine.arguments.contains("--source-save-self-test") {
    runSourceSaveSelfTest()
} else if CommandLine.arguments.contains("--server-self-test") {
    runLocalServerSelfTest()
} else {
    let application = NSApplication.shared
    let delegate = AppDelegate()
    application.delegate = delegate
    application.run()
}
