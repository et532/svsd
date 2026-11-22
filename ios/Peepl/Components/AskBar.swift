import SwiftUI

// Bottom bar: "Ask me about people" glass pill (-> Find) and a round add-person button (-> Add).
struct AskBar: View {
    @Environment(Nav.self) private var nav
    @Environment(\.accessibilityReduceMotion) private var reduce
    // Add / Find cover the bar; fading it in with the layer's timing means it is already arriving as the reveal shrinks away.
    private var covered: Bool { nav.layers.contains { if case .profile = $0 { false } else { true } } }
    private var slide: AnyTransition { reduce ? .opacity : .move(edge: .bottom).combined(with: .opacity) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let f = nav.focus {
                Button { nav.focus = nil; nav.push(.profile(f.id)) } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.left").font(Theme.font(12, .semibold))
                        Text(f.name).font(Theme.font(13, .medium))
                    }
                    .foregroundStyle(.white).padding(.leading, 10).padding(.trailing, 14).frame(height: 34).background(Theme.night, in: .capsule)
                }
                .buttonStyle(PressStyle(scale: 0.95))
                .accessibilityLabel("Back to \(f.name)")
                .transition(slide)
            }
            if let f = nav.showFilter {
                HStack(spacing: 8) {
                    Text("\(f.label) · \(f.ids.count)").font(Theme.font(14, .medium)).foregroundStyle(Theme.ink)
                    Button { nav.showFilter = nil } label: {
                        Image(systemName: "xmark").font(Theme.font(12, .semibold)).foregroundStyle(Theme.ink)
                    }
                    .buttonStyle(PressStyle(scale: 0.85))
                    .accessibilityLabel("Clear filter")
                }
                .padding(.horizontal, 16).frame(height: 36)
                .pastel(in: Capsule())
                .transition(slide)
            }
            bar
        }
        .padding(.horizontal, 16)
        .background(alignment: .bottom) {
            LinearGradient(colors: [.clear, Color(hex: "3b2a5e").opacity(0.45)], startPoint: .top, endPoint: .bottom)
                .frame(height: 170).ignoresSafeArea(edges: .bottom).allowsHitTesting(false)
        }
        .opacity(covered ? 0 : 1).offset(y: covered && !reduce ? 24 : 0).allowsHitTesting(!covered)
        .animation(Motion.animation(Motion.layer, reduce: reduce), value: covered)
        .animation(Motion.animation(Motion.snap, reduce: reduce), value: nav.focus?.id)
        .animation(Motion.animation(Motion.snap, reduce: reduce), value: nav.showFilter)
    }

    private var bar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 0) {
                Button { nav.focus = nil; nav.revealOrigin = UnitPoint(x: 0.4, y: 0.95); nav.push(.find()) } label: {
                    Text("Ask me about people").font(Theme.font(16)).foregroundStyle(Theme.inkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading).frame(minHeight: 56).padding(.leading, 20).contentShape(.rect)
                }
                .buttonStyle(PressStyle(scale: 0.98))
                Button { nav.focus = nil; nav.revealOrigin = UnitPoint(x: 0.4, y: 0.95); nav.push(.find(voice: true)) } label: {
                    Image(systemName: "mic").font(Theme.font(20)).foregroundStyle(Theme.ink).frame(width: 60, height: 56).contentShape(.rect)
                }
                .buttonStyle(PressStyle(scale: 0.9))
                .accessibilityLabel("Ask by voice")
            }
            .pastel(in: Capsule())
            Button { nav.revealOrigin = UnitPoint(x: 0.92, y: 0.95); nav.push(.add(mutualOf: nil)) } label: {
                Image(systemName: "person.badge.plus").font(Theme.font(20)).foregroundStyle(Theme.ink)
                    .frame(width: 56, height: 56)
                    .pastel(in: Circle())
            }
            .buttonStyle(PressStyle(scale: 0.92))
            .accessibilityLabel("Add person")
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }
}
