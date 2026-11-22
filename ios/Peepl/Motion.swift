import SwiftUI

enum Motion {
    static let snap   = Animation.snappy(duration: 0.28)                         // toggles, chips, small state
    static let smooth = Animation.smooth(duration: 0.4)                          // content swaps, expand/collapse
    static let pop    = Animation.spring(response: 0.45, dampingFraction: 0.72)  // pop-ins, blob, toast
    static let layer  = Animation.spring(response: 0.5, dampingFraction: 0.9)    // screen push/pop
    static let ease     = Animation.timingCurve(0.42, 0, 0.58, 1, duration: 0.4)  // ease-in-out for things that move
    static let easeSlow = Animation.timingCurve(0.42, 0, 0.58, 1, duration: 0.6)
    static let easeFast = Animation.timingCurve(0.42, 0, 0.58, 1, duration: 0.25)
    // Motion spec table (ONBOARDING.md section 4)
    static let entrance = Animation.timingCurve(0.05, 0.7, 0.1, 1, duration: 0.45)  // emphasized decelerate
    static let exit     = Animation.timingCurve(0.3, 0, 0.8, 0.15, duration: 0.3)    // emphasized accelerate
    static let page     = Animation.smooth(duration: 0.5)                            // step to step
    static let tiltEntrance = Animation.smooth(duration: 0.9, extraBounce: 0.05)     // 3D panel comes in
    static let idleFloat = Animation.easeInOut(duration: 3.5).repeatForever(autoreverses: true) // 7 s loop

    /// Stagger delay for the i-th item of a list entrance.
    static func stagger(_ i: Int, step: Double = 0.04, cap: Int = 10) -> Animation {
        smooth.delay(Double(min(i, cap)) * step)
    }

    /// Under Reduce Motion every animation becomes a short linear fade.
    static func animation(_ a: Animation, reduce: Bool) -> Animation? {
        reduce ? .linear(duration: 0.15) : a
    }
}

/// Replaces `.buttonStyle(.plain)` on anything tappable.
struct PressStyle: ButtonStyle {
    var scale = 0.94
    func makeBody(configuration c: Configuration) -> some View {
        c.label
            .scaleEffect(c.isPressed ? scale : 1)
            .opacity(c.isPressed ? 0.88 : 1)
            .animation(.snappy(duration: 0.18), value: c.isPressed)
    }
}

/// Entrance for one item of a stagger: use with `.appear(i)`.
struct AppearModifier: ViewModifier {
    let index: Int
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    func body(content: Content) -> some View {
        content
            .opacity(shown || reduce ? 1 : 0)
            .offset(y: shown || reduce ? 0 : 12)
            .onAppear { withAnimation(Motion.stagger(index)) { shown = true } }
    }
}
extension View { func appear(_ i: Int) -> some View { modifier(AppearModifier(index: i)) } }
