import SwiftUI

/// Step content (ONBOARDING.md 3.1, 3.7, 3.8). Steps 2 to 6 are placeholders that show only their heading until T2.
struct OnboardingStep: View {
    let step: Int
    let replay: Bool
    @Binding var picks: [MeetWhere]
    let restore: () -> Void

    var body: some View {
        switch step {
        case 1: ColdOpen(replay: replay, restore: restore)
        case 7: MeetWhereStep(picks: $picks)
        case 8: PrivacyStep()
        default: Heading(text: Self.placeholders[step] ?? "").appear(0)
        }
    }

    private static let placeholders = [2: "You meet Jordan.", 3: "You can only hold about 150 people.", 4: "Peepl keeps the story.", 5: "Capture", 6: "Connect and ask"]
}

private struct Heading: View {
    let text: String
    var body: some View {
        Text(text).font(Theme.font(32)).tracking(-1.28).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Fades in `after` seconds (storyboard times); at once under Reduce Motion.
private struct FadeIn: ViewModifier {
    let after: Double
    var duration = 0.5
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    func body(content: Content) -> some View {
        content.opacity(shown ? 1 : 0)
            .task { try? await Task.sleep(for: .seconds(reduce ? 0 : after)); withAnimation(Motion.animation(.timingCurve(0.42, 0, 0.58, 1, duration: duration), reduce: reduce)) { shown = true } }
    }
}
private extension View { func fadeIn(_ after: Double, _ duration: Double = 0.5) -> some View { modifier(FadeIn(after: after, duration: duration)) } }

// MARK: Step 1

private struct ColdOpen: View {
    let replay: Bool
    let restore: () -> Void
    private let words = "Every person you meet has a story.".split(separator: " ").map(String.init)

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Peepl").font(Theme.font(20, .semibold)).foregroundStyle(.white).fadeIn(1.6, 0.4)
            WrapLayout(spacing: 10, lineSpacing: 4) {
                ForEach(Array(words.enumerated()), id: \.offset) { i, w in
                    Word(text: w, delay: 0.3 + 0.12 * Double(i))
                }
            }
            .padding(.top, 24)
            .accessibilityElement(children: .ignore).accessibilityLabel(words.joined(separator: " ")).accessibilityAddTraits(.isHeader)
            Text("Peepl keeps it for you.").font(Theme.font(20)).foregroundStyle(.white.opacity(0.7)).fadeIn(1.3)
            if !replay {
                Button(action: restore) {
                    Text("Restore a backup").font(Theme.font(15)).foregroundStyle(.white.opacity(0.7)).frame(minHeight: 44)
                }
                .buttonStyle(PressStyle(scale: 0.95)).padding(.top, 8).fadeIn(1.3)
                .accessibilityIdentifier("onboardingRestore")
            }
        }
    }

    private struct Word: View {
        let text: String
        let delay: Double
        @State private var shown = false
        @Environment(\.accessibilityReduceMotion) private var reduce
        var body: some View {
            Text(text).font(Theme.font(40)).tracking(-1.6).foregroundStyle(.white)
                .opacity(shown ? 1 : 0).offset(y: shown || reduce ? 0 : 6)
                .task { try? await Task.sleep(for: .seconds(reduce ? 0 : delay)); withAnimation(Motion.animation(.timingCurve(0.42, 0, 0.58, 1, duration: 0.35), reduce: reduce)) { shown = true } }
        }
    }
}

// MARK: Step 7

private struct MeetWhereStep: View {
    @Binding var picks: [MeetWhere]
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Heading(text: "Where do you meet people?").appear(0)
            Text("Pick any. This only tunes the examples you see. It stays on your phone.").font(Theme.font(17)).foregroundStyle(Theme.inkMuted)
                .fixedSize(horizontal: false, vertical: true).appear(1)
            WrapLayout(spacing: 10, lineSpacing: 10) {
                ForEach(Array(MeetWhere.allCases.enumerated()), id: \.element) { i, c in
                    let on = picks.contains(c)
                    Button { withAnimation(Motion.snap) { if on { picks.removeAll { $0 == c } } else { picks.append(c) } } } label: {
                        HStack(spacing: 6) {
                            if on { Image(systemName: "checkmark").font(.system(size: 13, weight: .semibold)).transition(.scale) }
                            Text(c.chip).font(Theme.font(15, .medium))
                        }
                        .foregroundStyle(on ? .white : Theme.ink).padding(.horizontal, 16).frame(minHeight: 48)
                        .background { if on { Capsule().fill(Theme.night) } }
                        .pastel(in: Capsule(), tint: on ? .clear : Color(hex: "faf7ff").opacity(0.92))
                    }
                    .buttonStyle(PressStyle(scale: 0.96))
                    .accessibilityAddTraits(on ? [.isSelected] : [])
                    .accessibilityIdentifier("chip-\(c.rawValue)")
                    .appear(i + 2)
                }
            }
            .sensoryFeedback(.impact(weight: .light), trigger: picks)
        }
    }
}

// MARK: Step 8

private struct PrivacyStep: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Heading(text: "Your notes on people. No one else sees them.").appear(0)
            row("iphone", "Everything stays on this phone", "Your people and notes are stored on this device only.").appear(1)
            row("person.crop.circle.badge.xmark", "No account", "Nothing to sign up for.").appear(2)
            row("switch.2", "LLM help is off", "Turn it on in Settings if you want smarter search and drafts.").appear(3)
            // REQUIRED: voice may leave the phone where on-device recognition is unsupported (spec 3.8). Do not remove.
            Text("Voice notes are turned into text on your phone when your iPhone supports it.").font(Theme.mono(12)).foregroundStyle(Theme.inkMuted)
                .fadeIn(0.9, 0.4)
            Text("Moving to a new phone? Back up from Settings and restore the file there.").font(Theme.mono(12)).foregroundStyle(Theme.inkMuted)
                .padding(.top, 8).fadeIn(1.4, 0.4)
        }
    }

    private func row(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol).font(.system(size: 18)).foregroundStyle(Theme.ink).frame(width: 26).padding(.top, 2)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.font(17, .medium)).foregroundStyle(Theme.ink)
                Text(detail).font(Theme.font(15)).foregroundStyle(Theme.inkMuted)
            }
            .fixedSize(horizontal: false, vertical: true)
        }
    }
}
