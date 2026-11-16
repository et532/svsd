import SwiftUI

// Bottom bar: "Ask me about people" glass pill (-> Find) and a round add-person button (-> Add).
struct AskBar: View {
    @Environment(Nav.self) private var nav

    var body: some View {
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
        .padding(.horizontal, 16)
    }
}
