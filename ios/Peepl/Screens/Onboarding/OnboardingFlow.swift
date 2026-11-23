import SwiftUI

/// The onboarding shell (ONBOARDING.md 3.0): header with Back / act title / Skip, a three-segment progress bar,
/// the step on top of the ground, and a primary button that appears 1 s into each step.
/// `replay` is for Settings later: no done flag, no Restore, step 8 says "Done"; only step 7's answers are written.
struct OnboardingFlow: View {
    var replay = false
    var onFinish: () -> Void
    @State private var step = 1
    @State private var forward = true
    @State private var nextShown = false
    @State private var importing = false
    @State private var picks = MeetWhere.saved()
    @Environment(\.accessibilityReduceMotion) private var reduce
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver

    private var dark: Bool { step == 1 }
    private var primaryLabel: String { step == 1 ? "Get started" : step == OnboardingState.lastStep ? (replay ? "Done" : "Add your first friend") : "Next" }

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            if dark { ColdOpenBackground().transition(.opacity) } else { AuraBackground(light: true).transition(.opacity) }
            VStack(spacing: 0) {
                header.frame(height: 56).padding(.horizontal, 16)
                ScrollView {
                    Group {
                        if (2...6).contains(step) { OnboardingDemoStep(step: step) }
                        else { OnboardingStep(step: step, replay: replay, picks: $picks, restore: { importing = true }) }
                    }
                        .id(step)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 24).padding(.top, 24)
                        .transition(reduce ? .opacity : .asymmetric(insertion: .offset(x: forward ? 24 : -24).combined(with: .opacity), removal: .opacity))
                }
                .scrollBounceBehavior(.basedOnSize)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            ZStack {
                if nextShown {
                    Button(action: advance) {
                        Text(primaryLabel).font(Theme.font(17, .medium)).foregroundStyle(dark ? Theme.night : .white)
                            .frame(maxWidth: .infinity).frame(height: 56).background(dark ? Color.white : Theme.night, in: .capsule)
                    }
                    .buttonStyle(PressStyle(scale: 0.96)).accessibilityIdentifier("onboardingNext")
                    .transition(.opacity.combined(with: reduce ? .identity : .offset(y: 8)))
                }
            }
            .frame(height: 56).padding(.horizontal, 24).padding(.bottom, 16)
        }
        .animation(Motion.animation(Motion.ease, reduce: reduce), value: dark)
        .animation(Motion.animation(.smooth(duration: 0.5), reduce: reduce), value: step)
        .sensoryFeedback(.impact(weight: .light), trigger: step)
        .onChange(of: picks) { _, new in MeetWhere.save(new) } // the only write in replay mode
        .task(id: step) { // restarts on every step change, Back and replay
            if reduce || voiceOver { nextShown = true; return }
            try? await Task.sleep(for: .seconds(1))
            if !Task.isCancelled { withAnimation(Motion.ease) { nextShown = true } }
        }
        .gesture(DragGesture(minimumDistance: 20).onEnded { v in // swipe in from the left edge = Back
            if v.startLocation.x < 28, v.translation.width > 60, abs(v.translation.height) < v.translation.width { go(OnboardingState.back(step), canMove: OnboardingState.canBack(step)) }
        })
        .backupImporter(isPresented: $importing) { finish() }
        .accessibilityAddTraits(.isModal)
    }

    private func go(_ to: Int, canMove: Bool = true) {
        guard canMove, to != step else { return }
        forward = to > step; nextShown = false; step = to
    }
    private func advance() { step == OnboardingState.lastStep ? finish() : go(OnboardingState.next(step)) }
    private func finish() {
        OnboardingState.finish(replay: replay)
        onFinish()
    }

    private var header: some View {
        let fg = dark ? Color.white : Theme.night
        return HStack(spacing: 12) {
            Group {
                if OnboardingState.canBack(step) {
                    Button { go(OnboardingState.back(step)) } label: {
                        HStack(spacing: 2) { Image(systemName: "chevron.left").font(.system(size: 14, weight: .semibold)); Text("Back") }
                            .font(Theme.font(15, .medium)).foregroundStyle(fg).frame(minHeight: 44)
                    }
                    .buttonStyle(PressStyle()).accessibilityLabel("Back").accessibilityIdentifier("onboardingBack")
                }
            }
            .frame(width: 64, alignment: .leading)
            VStack(spacing: 8) {
                Text(OnboardingState.actTitle(step: step).uppercased()).font(Theme.mono(12)).tracking(1.2).foregroundStyle(fg.opacity(0.7))
                    .id(OnboardingState.actTitle(step: step)).transition(.opacity)
                    .animation(Motion.animation(Motion.ease, reduce: reduce), value: OnboardingState.actTitle(step: step))
                ProgressBar(step: step, color: fg)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Step \(step) of \(OnboardingState.lastStep), \(OnboardingState.actTitle(step: step))")
            .accessibilityIdentifier("onboardingProgress")
            Group {
                if OnboardingState.canSkip(step) {
                    Button { go(OnboardingState.skip(step)) } label: {
                        Text("Skip").font(Theme.font(15, .medium)).foregroundStyle(fg).frame(minHeight: 44)
                    }
                    .buttonStyle(PressStyle()).accessibilityLabel("Skip introduction").accessibilityIdentifier("onboardingSkip")
                }
            }
            .frame(width: 64, alignment: .trailing)
        }
    }
}

/// Three 4pt capsules, widths 4 : 2 : 2, each filled by its share of the act (scaleX from the left).
private struct ProgressBar: View {
    let step: Int
    let color: Color
    @Environment(\.accessibilityReduceMotion) private var reduce
    var body: some View {
        let fractions = OnboardingState.progressFractions(step: step), weights = OnboardingState.segmentWeights
        GeometryReader { geo in
            let room = geo.size.width - 8, total = weights.reduce(0, +)
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { i in
                    Capsule().fill(color.opacity(0.2))
                        .overlay(alignment: .leading) {
                            Capsule().fill(color).scaleEffect(x: fractions[i], anchor: .leading)
                                .animation(Motion.animation(Motion.easeSlow, reduce: reduce), value: fractions[i])
                        }
                        .frame(width: room * weights[i] / total)
                }
            }
        }
        .frame(height: 4)
    }
}

/// Wraps its children onto lines (headings word by word, chips).
struct WrapLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { arrange(proposal.width ?? .infinity, subviews).size }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (s, p) in zip(subviews, arrange(bounds.width, subviews).origins) { s.place(at: CGPoint(x: bounds.minX + p.x, y: bounds.minY + p.y), proposal: .unspecified) }
    }
    private func arrange(_ width: CGFloat, _ subviews: Subviews) -> (origins: [CGPoint], size: CGSize) {
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0, maxW: CGFloat = 0
        var origins: [CGPoint] = []
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width { x = 0; y += rowH + lineSpacing; rowH = 0 }
            origins.append(CGPoint(x: x, y: y)); x += size.width + spacing; rowH = max(rowH, size.height); maxW = max(maxW, x - spacing)
        }
        return (origins, CGSize(width: maxW, height: y + rowH))
    }
}

/// Step 1 ground: night with three blurred orbs drifting on 14 to 25 s loops (still under Reduce Motion).
struct ColdOpenBackground: View {
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var shown = false
    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduce)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            GeometryReader { geo in
                let w = geo.size.width, h = geo.size.height
                // yellow bottom-left, blue top-right, pink bottom-right
                ForEach(Array([("E8C22E", 0.1, 0.85, 14.0), ("2F4FD0", 0.9, 0.12, 19.0), ("D6347F", 0.88, 0.8, 25.0)].enumerated()), id: \.offset) { i, o in
                    Circle().fill(Color(hex: o.0)).frame(width: w * 0.8, height: w * 0.8)
                        .position(x: w * o.1 + (reduce ? 0 : sin(t / o.3 * 2 * .pi + Double(i)) * w * 0.12),
                                  y: h * o.2 + (reduce ? 0 : cos(t / (o.3 + 3) * 2 * .pi + Double(i)) * h * 0.06))
                        .blur(radius: 90)
                }
            }
        }
        .opacity(shown ? 1 : 0)
        .background(Theme.night)
        .ignoresSafeArea().accessibilityHidden(true).allowsHitTesting(false)
        .onAppear { withAnimation(reduce ? .linear(duration: 0.15) : Motion.easeSlow) { shown = true } }
    }
}
