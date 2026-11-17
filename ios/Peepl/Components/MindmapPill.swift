import SwiftUI

/// The glass name pill under the selected person (Figma "Profile" / map). Tapping it opens their profile.
struct MindmapPill: View {
    let person: Person
    @Environment(Nav.self) private var nav

    var body: some View {
        let sub = [person.profession, person.livesNow.city].filter { !$0.isEmpty && $0 != "Unknown" }.joined(separator: " · ")
        Button { nav.push(.profile(person.id)) } label: {
            HStack(spacing: 12) {
                Avatar(id: person.id, size: 36)
                VStack(alignment: .leading, spacing: 0) {
                    Text(person.name).font(.system(size: 14, weight: .medium)).tracking(-0.56).foregroundStyle(Theme.ink)
                    if !sub.isEmpty { Text(sub).font(.system(size: 12)).foregroundStyle(Theme.inkMuted) }
                }
                Image(systemName: "chevron.right").font(.system(size: 19)).foregroundStyle(Theme.inkMuted)
            }
            .padding(.vertical, 8).padding(.horizontal, 16)
            .background(.white.opacity(0.8), in: .capsule)
            .glassEffect(.regular, in: .capsule)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("View \(person.name)")
    }
}
