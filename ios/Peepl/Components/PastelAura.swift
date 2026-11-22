import SwiftUI

/// Soft pastel orbs that wander on 14-25 s loops (Add, Find, Profile). Static under Reduce Motion.
/// Equatable and fed only constants, so a parent re-rendering on scroll doesn't redraw it.
struct PastelAura: View, Equatable {
    struct Orb: Equatable { let color: String; let size, x, y: CGFloat }  // x / y: offset from the center

    static let rainbow = [Orb(color: "f5b5d3", size: 320, x: -120, y: -260), Orb(color: "ffe08a", size: 300, x: 140, y: -120),
                          Orb(color: "a9c4ff", size: 340, x: -140, y: 200), Orb(color: "ffb899", size: 280, x: 150, y: 300)]

    var orbs = PastelAura.rainbow
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    static func == (a: PastelAura, b: PastelAura) -> Bool { a.orbs == b.orbs }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { tl in
            Canvas { ctx, size in
                let t = reduceMotion ? 0 : tl.date.timeIntervalSinceReferenceDate
                for (i, o) in orbs.enumerated() {
                    let period = [14.0, 19, 22, 25][i % 4], ph = Double(i) * 1.7
                    let dx = sin(t / period * 2 * .pi + ph) * size.width * 0.2
                    let dy = cos(t / (period + 3) * 2 * .pi + ph) * size.height * 0.1
                    let c = CGPoint(x: size.width / 2 + o.x + dx, y: size.height / 2 + o.y + dy)
                    let r = o.size * 0.85  // the old blurred circle faded out a bit past its edge
                    let col = Color(hex: o.color)
                    ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)),
                             with: .radialGradient(Gradient(stops: [.init(color: col.opacity(0.6), location: 0), .init(color: col.opacity(0.35), location: 0.5), .init(color: col.opacity(0), location: 1)]),
                                                   center: c, startRadius: 0, endRadius: r))
                }
            }
        }
        .ignoresSafeArea().accessibilityHidden(true).allowsHitTesting(false)
    }
}
