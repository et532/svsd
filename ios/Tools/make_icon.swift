import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
import Foundation
// swift ios/Tools/make_icon.swift <out.png>
let S = 1024, cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: S, height: S, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
func col(_ h: UInt32, _ a: CGFloat = 1) -> CGColor { CGColor(red: CGFloat(h >> 16 & 255)/255, green: CGFloat(h >> 8 & 255)/255, blue: CGFloat(h & 255)/255, alpha: a) }
ctx.setFillColor(col(0xf4f4f4)); ctx.fill(CGRect(x: 0, y: 0, width: S, height: S))
// y is up in CoreGraphics: top-left orb has high y
for (c, x, y, r) in [(0xd6347f, 260, 790, 520), (0xe8c22e, 800, 600, 480), (0x2f4fd0, 220, 250, 500), (0xec5a32, 780, 200, 500)] as [(UInt32, CGFloat, CGFloat, CGFloat)] {
    let g = CGGradient(colorsSpace: cs, colors: [col(c, 0.85), col(c, 0.0)] as CFArray, locations: [0, 1])!
    ctx.drawRadialGradient(g, startCenter: CGPoint(x: x, y: y), startRadius: 0, endCenter: CGPoint(x: x, y: y), endRadius: r, options: [])
}
let m = CGPoint(x: 512, y: 512), d: CGFloat = 1024 * 0.46
ctx.setFillColor(col(0xffffff, 0.85)); ctx.fillEllipse(in: CGRect(x: m.x - d/2, y: m.y - d/2, width: d, height: d))
ctx.setStrokeColor(col(0xffffff, 0.6)); ctx.setLineWidth(8); ctx.strokeEllipse(in: CGRect(x: m.x - d/2 - 14, y: m.y - d/2 - 14, width: d + 28, height: d + 28))
let dot: CGFloat = d * 0.3
ctx.setFillColor(col(0xffffff)); ctx.setShadow(offset: CGSize(width: 0, height: -6), blur: 18, color: col(0x000000, 0.18))
ctx.fillEllipse(in: CGRect(x: m.x - dot/2, y: m.y - dot/2, width: dot, height: dot))
let out = URL(fileURLWithPath: CommandLine.arguments[1])
let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil); CGImageDestinationFinalize(dest)
