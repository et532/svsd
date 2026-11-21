import SwiftUI

/// The web's "Aura": four soft color orbs on a light grey ground that drift slowly (aura.ts, Figma "Disc study").
/// `light` is the Connections list (ground #f4f4f4, orbs 80% color); the mindmap draws its own orbs so they can move to groups.
struct AuraBackground: View {
    var light = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let ground = light ? Color(hex: "f4f4f4") : Color(hex: "ededed")
        TimelineView(.animation(paused: reduceMotion)) { tl in
            Canvas { ctx, size in
                let t = tl.date.timeIntervalSinceReferenceDate, s = size.width / 393
                for (i, o) in MindmapModel.aura.enumerated() {
                    // each orb wanders on its own 14-25 s loop, up to ~45% of the screen
                    let period = [14.0, 19, 22, 25][i], ph = Double(i) * 1.7
                    let dx = sin(t / period * 2 * .pi + ph) * size.width * 0.22
                    let dy = cos(t / (period + 3) * 2 * .pi + ph) * size.height * 0.12
                    let c = Color(hex: o.color).opacity(light ? 0.8 : 1)
                    let r = max(o.w, o.h) / 2 * s * 1.9
                    let center = CGPoint(x: o.x * s + dx, y: o.y * size.height / 852 + dy)
                    var g = ctx
                    g.translateBy(x: center.x, y: center.y)
                    g.scaleBy(x: o.w / max(o.w, o.h), y: o.h / max(o.w, o.h))
                    g.fill(Path(ellipseIn: CGRect(x: -r, y: -r, width: 2 * r, height: 2 * r)),
                           with: .radialGradient(Gradient(stops: [.init(color: c.opacity(0.55), location: 0), .init(color: c.opacity(0.3), location: 0.45), .init(color: c.opacity(0), location: 1)]),
                                                 center: .zero, startRadius: 0, endRadius: r))
                }
            }
        }
        .background(ground)
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}
