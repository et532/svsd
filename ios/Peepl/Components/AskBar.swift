import SwiftUI

// Bottom bar: "Ask me about people" glass pill (-> Find) and a round add-person button (-> Add).
struct AskBar: View {
    @Environment(Nav.self) private var nav

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
                .buttonStyle(.plain)
                .accessibilityLabel("Back to \(f.name)")
            }
            if let f = nav.showFilter {
                HStack(spacing: 8) {
                    Text("\(f.label) · \(f.ids.count)").font(Theme.font(14, .medium)).foregroundStyle(Theme.ink)
                    Button { nav.showFilter = nil } label: {
                        Image(systemName: "xmark").font(Theme.font(12, .semibold)).foregroundStyle(Theme.ink)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear filter")
                }
                .padding(.horizontal, 16).frame(height: 36)
                .glassEffect(.regular, in: .capsule)
            }
            bar
        }
        .padding(.horizontal, 16)
    }

    private var bar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 0) {
                Button { nav.focus = nil; nav.revealOrigin = UnitPoint(x: 0.4, y: 0.95); nav.push(.find()) } label: {
                    Text("Ask me about people").font(Theme.font(16)).foregroundStyle(Theme.inkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading).frame(height: 56).padding(.leading, 20).contentShape(.rect)
                }
                .buttonStyle(.plain)
                Button { nav.focus = nil; nav.revealOrigin = UnitPoint(x: 0.4, y: 0.95); nav.push(.find(voice: true)) } label: {
                    Image(systemName: "mic").font(Theme.font(20)).foregroundStyle(Theme.ink).frame(width: 60, height: 56).contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Ask by voice")
            }
            .glassEffect(.regular, in: .capsule)
            Button { nav.revealOrigin = UnitPoint(x: 0.92, y: 0.95); nav.push(.add(mutualOf: nil)) } label: {
                Image(systemName: "person.badge.plus").font(Theme.font(20)).foregroundStyle(Theme.ink)
                    .frame(width: 56, height: 56)
                    .glassEffect(.regular, in: .circle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add person")
        }
    }
}
