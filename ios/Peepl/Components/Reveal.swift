import SwiftUI

/// Add and Find grow out of the button that opened them, as a circle (web: clip-path circle from the tap point).
struct CircleReveal: Shape {
    var progress: Double
    var origin: UnitPoint
    var animatableData: Double { get { progress } set { progress = newValue } }
    func path(in r: CGRect) -> Path {
        let c = CGPoint(x: r.width * origin.x, y: r.height * origin.y)
        let far = max(hypot(c.x, c.y), hypot(r.width - c.x, c.y), hypot(c.x, r.height - c.y), hypot(r.width - c.x, r.height - c.y))
        let radius = 24 + (far * 1.25 - 24) * progress
        return Path(ellipseIn: CGRect(x: c.x - radius, y: c.y - radius, width: radius * 2, height: radius * 2))
    }
}

struct RevealTransition: Transition {
    var origin: UnitPoint
    func body(content: Content, phase: TransitionPhase) -> some View {
        content.clipShape(CircleReveal(progress: phase.isIdentity ? 1 : 0, origin: origin))
    }
}
