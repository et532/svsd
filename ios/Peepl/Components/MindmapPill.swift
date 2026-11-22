import SwiftUI

/// The glass name pill under the selected person (Figma "Profile" / map). Tapping it opens their profile.
struct MindmapPill: View {
    let person: Person
    @Environment(Nav.self) private var nav
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var shown = false

    var body: some View {
        let sub = [person.profession, person.livesNow.city].filter { !$0.isEmpty && $0 != "Unknown" }.joined(separator: " · ")
        Button { nav.push(.profile(person.id)) } label: {
            HStack(spacing: 12) {
                Avatar(id: person.id, size: 36)
                VStack(alignment: .leading, spacing: 0) {
                    Text(person.name).font(Theme.font(14, .medium)).tracking(-0.56).foregroundStyle(Theme.ink)
                    if !sub.isEmpty { Text(sub).font(Theme.font(12)).foregroundStyle(Theme.inkMuted) }
                }
                Image(systemName: "chevron.right").font(Theme.font(19)).foregroundStyle(Theme.inkMuted)
            }
            .padding(.vertical, 8).padding(.horizontal, 16)
            .background(.white.opacity(0.8), in: .capsule)
            .pastel(in: Capsule())
        }
        .buttonStyle(PressStyle(scale: 0.96))
        .scaleEffect(shown || reduce ? 1 : 0.92, anchor: .top)
        .opacity(shown ? 1 : 0)
        .onAppear { withAnimation(Motion.animation(Motion.pop, reduce: reduce)) { shown = true } }
        .accessibilityLabel("View \(person.name)")
    }
}
