import SwiftUI

// Bottom bar: "Ask me about people" glass pill (-> Find) and a round add-person button (-> Add).
struct AskBar: View {
    @Environment(Nav.self) private var nav

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let f = nav.showFilter {
                HStack(spacing: 8) {
                    Text("\(f.label) · \(f.ids.count)").font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.ink)
                    Button { nav.showFilter = nil } label: {
                        Image(systemName: "xmark").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink)
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
            Button { nav.push(.find) } label: {
                HStack {
                    Text("Ask me about people").font(.system(size: 16)).foregroundStyle(Theme.inkMuted)
                    Spacer()
                    Image(systemName: "mic").font(.system(size: 20)).foregroundStyle(Theme.ink)
                }
                .padding(.horizontal, 20)
                .frame(height: 56)
                .glassEffect(.regular, in: .capsule)
            }
            .buttonStyle(.plain)
            Button { nav.push(.add(mutualOf: nil)) } label: {
                Image(systemName: "person.badge.plus").font(.system(size: 20)).foregroundStyle(Theme.ink)
                    .frame(width: 56, height: 56)
                    .glassEffect(.regular, in: .circle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add person")
        }
    }
}
