import SwiftUI

// Shared pieces for the onboarding demos (ONBOARDING.md 3.0, 4): the 3D layer modifiers, the demo clock and Pip.
// Nothing here reads the store or calls the AI.

// MARK: 3D

/// A panel on its own tilted plane: perspective 0.6, layered shadow, entrance, then the idle float
/// (7 s loop, each layer offset 0.4 s, front layers move 1.3x per layer). Reduce Motion: fixed rest pose, no loop.
struct Tilted3D: ViewModifier {
    var degrees: Double = 10
    var layer = 0
    var lift = 0.0 // 0 to 1: the shadow grows as the card lifts
    @State private var entered = false
    @State private var up = false
    @Environment(\.accessibilityReduceMotion) private var reduce

    func body(content: Content) -> some View {
        let on = entered || reduce
        let swing = reduce ? 0.0 : (up ? 1.0 : -1.0)
        content
            .shadow(color: .black.opacity(on ? 0.06 + 0.02 * swing : 0), radius: 3, y: 2)
            .shadow(color: Color(hex: "3b2a5e").opacity(on ? 0.2 + 0.03 * swing + 0.05 * lift : 0), radius: 26 + 16 * lift, y: 18 + 10 * lift)
            .rotation3DEffect(.degrees(on ? degrees : degrees + 15), axis: (x: 1, y: 0.3, z: 0), perspective: 0.6)
            .rotation3DEffect(.degrees(swing * 1.5), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
            .offset(y: on ? swing * 5 * Self.parallax(layer) : 40)
            .opacity(on ? 1 : 0)
            .onAppear {
                guard !reduce else { return }
                withAnimation(Motion.tiltEntrance.delay(0.08 * Double(layer))) { entered = true }
                withAnimation(Motion.idleFloat.delay(0.9 + 0.4 * Double(layer))) { up = true }
            }
    }

    /// Front layers move 1.3x faster per layer.
    static func parallax(_ layer: Int) -> Double { pow(1.3, Double(layer)) }
}

/// A card that floats above its parent plane (which carries the tilt): shadow and idle float only.
struct FloatLayer: ViewModifier {
    var layer = 1
    @State private var up = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    func body(content: Content) -> some View {
        let swing = reduce ? 0.0 : (up ? 1.0 : -1.0)
        content
            .shadow(color: Color(hex: "3b2a5e").opacity(0.16 + 0.03 * swing), radius: 12 + 6 * Double(layer), y: 6 + 6 * Double(layer))
            .offset(y: swing * 5 * Tilted3D.parallax(layer))
            .onAppear { if !reduce { withAnimation(Motion.idleFloat.delay(0.9 + 0.4 * Double(layer))) { up = true } } }
    }
}

extension View {
    func tilted3D(_ degrees: Double = 10, layer: Int = 0, lift: Double = 0) -> some View { modifier(Tilted3D(degrees: degrees, layer: layer, lift: lift)) }
    func floatLayer(_ layer: Int = 1) -> some View { modifier(FloatLayer(layer: layer)) }
}

// MARK: Demo clock

/// Sleeps for the demo. Tests inject one that only adds up the time.
protocol DemoClock { func sleep(_ seconds: Double) async }
struct RealClock: DemoClock { func sleep(_ seconds: Double) async { try? await Task.sleep(for: .seconds(seconds)) } }

/// A demo's storyboard: `cues` are the seconds at which stage 1, 2, ... begin; `duration` is when it rests.
/// The view shows `stage` (0 = before the first cue); `cues.count` is the final frame.
struct DemoScript {
    let cues: [Double]
    let duration: Double
    var finalStage: Int { cues.count }

    /// Calls `fire(stage)` as each cue comes up and returns once the demo has rested.
    /// Under Reduce Motion it fires only the final stage, at once, and never sleeps.
    func run(clock: DemoClock = RealClock(), reduce: Bool, fire: (Int) -> Void) async {
        if reduce { fire(finalStage); return }
        var now = 0.0
        for (i, t) in cues.enumerated() {
            await clock.sleep(t - now); now = t
            if Task.isCancelled { return }
            fire(i + 1)
        }
        await clock.sleep(duration - now)
    }

    static let step2 = DemoScript(cues: [0.0, 1.2, 3.0, 4.0, 4.6], duration: 9.0)
    static let step3 = DemoScript(cues: [0.0, 1.0, 2.5, 4.5, 6.5], duration: 8.0)
    static let step4 = DemoScript(cues: [0.0, 1.0, 4.0, 5.0, 6.5], duration: 8.0)
    /// Step 5: panels, words stream, stop, the name fix, shimmer, card, hold (tilt).
    static let step5 = DemoScript(cues: [0.0, 1.0, 6.0, 6.8, 9.5, 11.0, 12.0], duration: 14.0)
    /// Step 6: panels, plop, pill, swing to Find (7.0 to `step6SwingEnd`), typing, thinking, card. Typing starts while the
    /// mindmap is still swinging away, so there is no empty beat.
    static let step6 = DemoScript(cues: [0.0, 1.0, 3.0, 7.0, step6TypingStart, 8.6, 9.4], duration: 16.0)
    static let step6SwingEnd = 7.8
    static let step6TypingStart = 7.2
}

// MARK: Pip

/// The guide character for steps 5 and 6: one of the 18 blobs, never Jordan's, never Aisha's (`indigo`), never the oldest
/// person's blob (replay only), first of the rest alphabetically, so it is stable.
enum Pip {
    static func pick(excludingBlobs: [String]) -> String {
        let banned = Set(excludingBlobs + [Blobs.name(for: "jordan-lee"), "indigo"])
        return Blobs.all.map(\.name).filter { !banned.contains($0) }.sorted().first ?? "lilac"
    }

    /// `people` is the store's list (empty on first run); the oldest is the one met first.
    static func pick(excluding people: [Person]) -> String {
        func met(_ p: Person) -> String { p.moments.map(\.date).min() ?? p.lastContacted }
        let oldest = people.min { met($0) < met($1) }
        return pick(excludingBlobs: oldest.map { [Blobs.name(for: $0.id)] } ?? [])
    }
}

/// Pip, 56pt with the 2pt white ring, and its speech line in a glass bubble.
struct PipView: View {
    let blob: String
    let line: String
    var body: some View {
        HStack(alignment: .bottom, spacing: 12) {
            ZStack {
                if let b = Blobs.all.first(where: { $0.name == blob })?.blob {
                    LinearGradient(colors: b.soft.map { Color(hex: $0) }, startPoint: .top, endPoint: .bottom)
                }
                if let img = Blobs.image(blob) { Image(uiImage: img).resizable().scaledToFill().scaleEffect(2.4) }
            }
            .frame(width: 56, height: 56).clipShape(Circle()).overlay(Circle().stroke(.white, lineWidth: 2))
            Text(line).font(Theme.font(15)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 14).padding(.vertical, 10).glass(18)
        }
        .accessibilityHidden(true) // decoration; the narration line is read
    }
}
