import AppKit

let outputDirectory = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
let sizes: [(String, Int)] = [
    ("icon_16x16.png", 16), ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32), ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128), ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256), ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512), ("icon_512x512@2x.png", 1024)
]

for (name, pixels) in sizes {
    let size = NSSize(width: pixels, height: pixels)
    let image = NSImage(size: size)
    image.lockFocus()

    let inset = CGFloat(pixels) * 0.06
    let rect = NSRect(x: inset, y: inset, width: CGFloat(pixels) - inset * 2, height: CGFloat(pixels) - inset * 2)
    NSColor(calibratedRed: 0.79, green: 0.25, blue: 0.16, alpha: 1).setFill()
    NSBezierPath(roundedRect: rect, xRadius: CGFloat(pixels) * 0.19, yRadius: CGFloat(pixels) * 0.19).fill()

    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    let font = NSFont.systemFont(ofSize: CGFloat(pixels) * 0.50, weight: .heavy)
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor.white,
        .paragraphStyle: paragraph
    ]
    let textRect = NSRect(x: 0, y: CGFloat(pixels) * 0.19, width: CGFloat(pixels), height: CGFloat(pixels) * 0.62)
    ("P" as NSString).draw(in: textRect, withAttributes: attributes)
    image.unlockFocus()

    guard
        let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let png = bitmap.representation(using: .png, properties: [:])
    else { continue }
    try png.write(to: URL(fileURLWithPath: outputDirectory).appendingPathComponent(name))
}
