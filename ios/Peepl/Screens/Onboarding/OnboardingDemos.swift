import SwiftUI

// Auto-playing demos for steps 2 to 4 (ONBOARDING.md 3.2 to 3.4). Hard-coded data only: nothing here touches the
// people store or the AI. Timings live in `DemoScript` (OnboardingKit.swift) so tests can check them.

struct OnboardingDemoStep: View {
    let step: Int
    var body: some View {
        switch step {
        case 2: DemoStage(script: .step2) { Step2Demo(stage: $0) }
        case 3: DemoStage(script: .step3) { Step3Demo(stage: $0) }
        case 5: DemoStage(script: .step5) { Step5Demo(stage: $0) }
        case 6: DemoStage(script: .step6) { Step6Demo(stage: $0) }
        default: DemoStage(script: .step4) { Step4Demo(stage: $0) }
        }
    }
}

/// Runs a script and hands the current stage to its content; under Reduce Motion it is the final frame at once.
struct DemoStage<Content: View>: View {
    let script: DemoScript
    @ViewBuilder let content: (Int) -> Content
    @State private var stage = 0
    @Environment(\.accessibilityReduceMotion) private var reduce
    var body: some View {
        content(reduce ? script.finalStage : stage)
            .task { await script.run(reduce: reduce) { stage = $0 } }
    }
}

private struct DemoHeading: View {
    let text: String
    var body: some View {
        Text(text).font(Theme.font(32)).tracking(-1.28).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading).accessibilityAddTraits(.isHeader)
    }
}

private struct Narration: View {
    let text: String
    var body: some View {
        Text(text).font(Theme.font(17)).foregroundStyle(Theme.inkMuted).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Designed at 340pt wide; scales down on narrower screens. Type is capped so a big Dynamic Type size can't overflow it.
struct DemoPanel<Content: View>: View {
    let height: CGFloat
    let label: String
    @ViewBuilder let content: Content
    @State private var k: CGFloat = 1
    var body: some View {
        content
            .frame(width: 340, height: height)
            .dynamicTypeSize(...DynamicTypeSize.xxLarge)
            .scaleEffect(k, anchor: .top)
            .frame(maxWidth: .infinity).frame(height: height * k, alignment: .top)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { k = min(1, $0 / 340) }
            .accessibilityElement(children: .ignore).accessibilityLabel(label)
    }
}

private let chipWords = ["Voltcell", "battery recycling", "from Seattle", "lives in Brooklyn", "climbs Tuesdays", "hardware intro"]

private struct WordChip: View {
    let text: String
    var body: some View {
        Text(text).font(Theme.font(15, .medium)).foregroundStyle(Theme.ink)
            .padding(.horizontal, 12).padding(.vertical, 7).pastel(in: Capsule())
    }
}

// MARK: Step 2

private struct Step2Demo: View {
    let stage: Int
    @State private var typed = ""
    @Environment(\.accessibilityReduceMotion) private var reduce
    private static let name = "Jordan Lee"
    private static let order = [3, 0, 5, 2, 1, 4] // the chips dissolve in this fixed "random" order

    private func chipAnimation(_ i: Int) -> Animation? {
        Motion.animation(stage >= 5 ? .easeInOut(duration: 0.8).delay(0.2 * Double(Self.order[i])) : Motion.ease.delay(0.15 * Double(i)), reduce: reduce)
    }

    var body: some View {
        let gone = stage >= 5
        VStack(alignment: .leading, spacing: 16) {
            DemoHeading(text: stage >= 4 ? "Three weeks later, it is gone." : "You meet Jordan.")
                .id(stage >= 4).transition(.opacity)
                .animation(Motion.animation(.easeInOut(duration: 0.6), reduce: reduce), value: stage >= 4)
            DemoPanel(height: 330, label: "Jordan Lee, founder at Voltcell. Three weeks later the details have faded and only his name is left.") {
                VStack(spacing: 14) {
                    VStack(spacing: 0) {
                        ProfileHero(id: "jordan-lee", name: reduce || stage >= 2 ? Self.name : typed, subtitle: "Founder @ Voltcell", met: "Met at Demo Day",
                                    avatarSize: 60, topInset: 24, dim: gone ? 0.35 : 1, avatarSaturation: gone ? 0.2 : 1)
                            .scaleEffect(stage >= 1 ? 1 : 0.6)
                            .animation(Motion.animation(Motion.pop, reduce: reduce), value: stage >= 1)
                            .animation(Motion.animation(.easeInOut(duration: 3.6), reduce: reduce), value: gone)
                        WrapLayout(spacing: 8, lineSpacing: 8) {
                            ForEach(Array(chipWords.enumerated()), id: \.offset) { i, w in
                                let shown = stage >= 2 && !gone
                                WordChip(text: w).floatLayer(1 + i % 2)
                                    .opacity(shown ? 1 : 0).blur(radius: gone ? 8 : 0).offset(y: stage < 2 ? 12 : gone ? -20 : 0)
                                    .animation(chipAnimation(i), value: stage)
                            }
                        }
                        .padding(16).frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading).glass(20).padding(.top, 14)
                    }
                    .tilted3D(10)
                    Text(stage >= 4 ? "Three weeks later" : "Demo Day, Oct").font(Theme.mono(12)).foregroundStyle(Theme.inkMuted)
                        .id(stage >= 4).transition(.opacity).opacity(stage >= 3 ? 1 : 0)
                        .animation(Motion.animation(.easeInOut(duration: 0.6), reduce: reduce), value: stage)
                }
            }
            Narration(text: "You remember the feeling, not the details.")
        }
        .task(id: stage >= 1) { // the name types in, 45 ms a character
            guard stage >= 1, !reduce else { return }
            for n in 1...Self.name.count { typed = String(Self.name.prefix(n)); try? await Task.sleep(for: .milliseconds(45)) }
        }
    }
}

// MARK: Step 3

private struct ScatterDot { let x, y: Double; let ring: Int }

enum Scatter {
    static let count = 150, inner = 30, jordan = 5, angela = 140
    static let radius = 135.0
    /// 150 dots in a loose disc, the same every time (golden-angle spiral with a seeded wobble).
    fileprivate static let dots: [ScatterDot] = {
        var s: UInt64 = 150
        func rnd() -> Double { s = s &* 6364136223846793005 &+ 1442695040888963407; return Double(s >> 33) / Double(1 << 31) }
        return (0..<count).map { i in
            let r = (Double(i) + 0.5).squareRoot() / Double(count).squareRoot() * (0.94 + 0.06 * rnd())
            let a = Double(i) * 2.399963 + (rnd() - 0.5) * 0.5
            return ScatterDot(x: cos(a) * r * radius, y: sin(a) * r * radius, ring: Int(r * 40))
        }
    }()
    static var positions: [CGPoint] { dots.map { CGPoint(x: $0.x, y: $0.y) } }
}

private struct Step3Demo: View {
    let stage: Int
    @Environment(\.accessibilityReduceMotion) private var reduce

    private func dotOpacity(_ i: Int) -> Double {
        if i == Scatter.jordan || stage < 2 { return 0 }
        if i == Scatter.angela && stage >= 4 { return 1 }
        return stage >= 3 && i >= Scatter.inner ? 0.2 : 1
    }
    private func dotAnimation(_ ring: Int) -> Animation? {
        Motion.animation(stage == 2 ? Motion.ease.delay(0.012 * Double(ring)) : .easeInOut(duration: stage == 3 ? 2 : 0.5), reduce: reduce)
    }

    var body: some View {
        let jd = Scatter.dots[Scatter.jordan], ang = Scatter.dots[Scatter.angela]
        VStack(alignment: .leading, spacing: 16) {
            DemoHeading(text: "You can only hold about 150 people.")
            Narration(text: "Researchers say we keep about 150 meaningful relationships. The people on the outer edge are the ones worth remembering.")
            DemoPanel(height: 400, label: "150 dots, the outer ones fading") {
                ZStack {
                    ZStack {
                        ZStack {
                            ForEach(0..<Scatter.count, id: \.self) { i in
                                let d = Scatter.dots[i]
                                ZStack {
                                    if i < Scatter.inner { Circle().fill(.white.opacity(0.55)).frame(width: 26, height: 26) }
                                    Circle().fill(.white).frame(width: 10, height: 10).shadow(color: Theme.ink.opacity(0.18), radius: 2, y: 1)
                                    if i == Scatter.angela {
                                        Circle().stroke(Theme.ink, lineWidth: 1.5).frame(width: 24, height: 24).scaleEffect(stage >= 4 ? 1 : 0.4).opacity(stage >= 4 ? 1 : 0)
                                    }
                                }
                                .opacity(dotOpacity(i)).offset(x: d.x, y: d.y).animation(dotAnimation(d.ring), value: stage)
                            }
                            Avatar(id: "jordan-lee", size: 40).scaleEffect(stage >= 1 ? 0.3 : 1)
                                .offset(x: stage >= 1 ? jd.x : 0, y: stage >= 1 ? jd.y : 0)
                                .animation(Motion.animation(Motion.ease.speed(0.4 / 0.9), reduce: reduce), value: stage >= 1)
                        }
                        .scaleEffect(stage >= 3 ? 0.82 : 1)
                        .animation(Motion.animation(.easeInOut(duration: 2), reduce: reduce), value: stage >= 3)
                        Text("Angela Lee").font(Theme.mono(12)).foregroundStyle(Theme.ink)
                            .offset(x: ang.x * 0.82, y: ang.y * 0.82 - 22).opacity(stage >= 4 ? 1 : 0)
                            .animation(Motion.animation(.easeInOut(duration: 0.5), reduce: reduce), value: stage >= 4)
                    }
                    .frame(width: 340, height: 300).tilted3D(12)
                    .frame(maxHeight: .infinity, alignment: .top)
                    Text("Angela Lee, someone from the edge. She introduced you to your next hire.")
                        .font(Theme.font(15)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                        .padding(14).glass(16).floatLayer(1)
                        .opacity(stage >= 4 ? 1 : 0).offset(y: stage >= 4 ? 0 : 10)
                        .animation(Motion.animation(.easeInOut(duration: 0.5), reduce: reduce), value: stage >= 4)
                        .frame(maxHeight: .infinity, alignment: .bottom)
                }
            }
        }
    }
}

// MARK: Step 4

private struct Step4Demo: View {
    let stage: Int
    @Environment(\.accessibilityReduceMotion) private var reduce
    // where each chip starts (around the card, at different depths) and where it flies to
    private static let from: [(x: Double, y: Double)] = [(-120, -170), (110, -180), (-125, 40), (120, 110), (-40, 190), (95, -30)]
    private static let to: [(x: Double, y: Double)] = [(-60, -150), (60, -150), (-60, -40), (60, -40), (0, 90), (0, 160)]

    private func piece(_ i: Int, @ViewBuilder _ v: () -> some View) -> some View {
        v().opacity(stage >= 2 ? 1 : 0).offset(y: stage >= 2 ? 0 : 14)
            .animation(Motion.animation(Motion.ease.delay(0.3 + 0.2 * Double(i)), reduce: reduce), value: stage >= 2)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            DemoHeading(text: "Peepl keeps the story.")
            Narration(text: "Say it out loud once. Peepl keeps it, in your words.")
            DemoPanel(height: 430, label: "Jordan Lee's profile: founder at Voltcell in Brooklyn, met at Demo Day. Battery recycling for e-bikes. Climbs Tuesdays. To do: intro Jordan to a hardware engineer.") {
                ZStack {
                    VStack(spacing: 12) {
                        piece(0) { ProfileHero(id: "jordan-lee", name: "Jordan Lee", subtitle: "Founder @ Voltcell, Brooklyn", met: "Met Oct 2026", avatarSize: 60, topInset: 24) }
                        piece(1) { ProfileSummaryCard(story: "Met Jordan at Demo Day. Battery recycling for e-bikes. Climbs Tuesdays.", tags: ["founder", "climbing"]) }
                        piece(2) {
                            TodoRowLabel(text: "Intro Jordan to a hardware engineer", done: stage >= 4)
                                .animation(Motion.animation(Motion.snap, reduce: reduce), value: stage >= 4).glass(16)
                        }
                        piece(3) { MomentRowLabel(date: "Oct 22", title: "Met at Demo Day").padding(14).glass(16) }
                    }
                    .tilted3D(stage >= 3 ? 4 : 10, lift: stage >= 3 ? 1 : 0)
                    .animation(Motion.animation(.easeInOut(duration: 1), reduce: reduce), value: stage >= 3)
                    ForEach(Array(chipWords.enumerated()), id: \.offset) { i, w in
                        let flying = stage >= 2
                        WordChip(text: w).floatLayer(1 + i % 3).scaleEffect(1 - 0.08 * Double(i % 3))
                            .offset(x: flying ? Self.to[i].x : Self.from[i].x, y: flying ? Self.to[i].y : Self.from[i].y)
                            .opacity(stage == 1 ? 0.9 : 0)
                            .animation(Motion.animation(stage >= 2 ? Motion.ease.delay(0.2 * Double(i)) : Motion.ease, reduce: reduce), value: stage)
                    }
                }
            }
            .sensoryFeedback(.impact(weight: .light), trigger: stage >= 4) // the to-do ticks itself
        }
    }
}
