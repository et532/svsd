import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
import Foundation
// Peep icon (variant 3, brand/logo-proposals/peep-3.svg).
// swift ios/Tools/make_icon.swift <icon.png> [layers-dir]   (layers-dir gets bg.png, body.png, eyes.png for Icon Composer)
let S = 1024, cs = CGColorSpaceCreateDeviceRGB()
func col(_ h: UInt32, _ a: CGFloat = 1) -> CGColor { CGColor(red: CGFloat(h >> 16 & 255)/255, green: CGFloat(h >> 8 & 255)/255, blue: CGFloat(h & 255)/255, alpha: a) }
func render(_ layers: Set<String>, opaque: Bool) -> CGImage {
    let ctx = CGContext(data: nil, width: S, height: S, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                        bitmapInfo: opaque ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.translateBy(x: 0, y: CGFloat(S)); ctx.scaleBy(x: 1, y: -1) // draw in SVG coordinates (y down)
    if layers.contains("bg") {
        ctx.setFillColor(col(0xf4f4f4)); ctx.fill(CGRect(x: 0, y: 0, width: S, height: S))
        for (c, x, y, r) in [(0xd6347f, 260, 234, 520), (0xe8c22e, 800, 424, 480), (0x2f4fd0, 220, 774, 500), (0xec5a32, 780, 824, 500)] as [(UInt32, CGFloat, CGFloat, CGFloat)] {
            // eased (gaussian-like) falloff over 24 stops, wider orbs: a soft blur, no visible edge or hotspot
            let locs = (0...24).map { CGFloat($0) / 24 }
            let cols = locs.map { t in col(c, 0.8 * exp(-3.2 * t * t) * (1 - t * t * t)) }
            let g = CGGradient(colorsSpace: cs, colors: cols as CFArray, locations: locs)!
            ctx.drawRadialGradient(g, startCenter: CGPoint(x: x, y: y), startRadius: 0, endCenter: CGPoint(x: x, y: y), endRadius: r * 1.45, options: [])
        }
    }
    if layers.contains("body") {
        let p = CGMutablePath()
        p.move(to: CGPoint(x: 130, y: 1040))
        p.addCurve(to: CGPoint(x: 520, y: 535), control1: CGPoint(x: 130, y: 770), control2: CGPoint(x: 250, y: 545))
        p.addCurve(to: CGPoint(x: 894, y: 1040), control1: CGPoint(x: 780, y: 528), control2: CGPoint(x: 894, y: 760))
        p.closeSubpath()
        ctx.saveGState(); ctx.setShadow(offset: CGSize(width: 0, height: -8), blur: 28, color: col(0x2a1a40, 0.22))
        ctx.setFillColor(col(0xffffff, 0.92)); ctx.addPath(p); ctx.fillPath(); ctx.restoreGState()
    }
    if layers.contains("eyes") {
        for x: CGFloat in [410, 646] {
            ctx.setFillColor(col(0x1c1522)); ctx.fillEllipse(in: CGRect(x: x - 38, y: 647, width: 76, height: 76))
            ctx.setFillColor(col(0xffffff)); ctx.fillEllipse(in: CGRect(x: x + 11 - 11, y: 685 - 12 - 11, width: 22, height: 22))
        }
        // blush + small smile, so it reads friendly, not blank
        for x: CGFloat in [352, 704] { ctx.setFillColor(col(0xec5a32, 0.22)); ctx.fillEllipse(in: CGRect(x: x - 42, y: 770, width: 84, height: 52)) }
        ctx.setStrokeColor(col(0x1c1522)); ctx.setLineWidth(17); ctx.setLineCap(.round)
        ctx.move(to: CGPoint(x: 462, y: 782)); ctx.addQuadCurve(to: CGPoint(x: 594, y: 782), control: CGPoint(x: 528, y: 856)); ctx.strokePath()
    }
    return ctx.makeImage()!
}
func save(_ img: CGImage, _ path: String) {
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, img, nil); CGImageDestinationFinalize(d)
}
save(render(["bg", "body", "eyes"], opaque: true), CommandLine.arguments[1])
if CommandLine.arguments.count > 2 {
    let dir = CommandLine.arguments[2]
    try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
    save(render(["bg"], opaque: true), dir + "/bg.png")
    save(render(["body"], opaque: false), dir + "/body.png")
    save(render(["eyes"], opaque: false), dir + "/eyes.png")
}
