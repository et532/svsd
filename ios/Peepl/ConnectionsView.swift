import SwiftUI
import SwiftData

struct ConnectionsView: View {
    @Environment(Nav.self) private var nav
    @Query(sort: \Person.name) private var allPeople: [Person]
    private var people: [Person] {
        guard let f = nav.showFilter else { return allPeople }
        let ids = Set(f.ids); return allPeople.filter { ids.contains($0.id) }
    }

    var body: some View {
        ScrollView {
                LazyVStack(spacing: 8) {
                    Text("Connections")
                        .font(.system(size: 32, weight: .regular))
                        .tracking(-1.28)
                        .foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.bottom, 12)
                    if allPeople.isEmpty { EmptyPeople().padding(.top, 120) }
                    ForEach(people) { p in
                        Button { nav.push(.profile(p.id)) } label: { Row(person: p) }.buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 78)
                .padding(.bottom, 100)
            }
            .background(Theme.bg)
    }
}

private struct Row: View {
    let person: Person

    var body: some View {
        HStack(spacing: 12) {
            Avatar(id: person.id, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(person.name).font(.system(size: 16, weight: .medium)).foregroundStyle(Theme.ink)
                Text(person.subtitle)
                    .font(.system(size: 13)).foregroundStyle(Theme.inkMuted).lineLimit(1)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 16)
        .frame(height: 70)
        .glass(20)
    }
}

/// Nobody yet (a new user, or everyone deleted): say so and offer the Add flow.
struct EmptyPeople: View {
    @Environment(Nav.self) private var nav
    var body: some View {
        VStack(spacing: 10) {
            Text("No one here yet").font(.system(size: 20, weight: .medium)).foregroundStyle(Theme.ink)
            Text("Add the first person you want to remember:\nwho they are, where you met, their story.")
                .font(.system(size: 14)).foregroundStyle(Theme.inkMuted).multilineTextAlignment(.center)
            Button { nav.push(.add(mutualOf: nil)) } label: {
                Text("Add someone").font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                    .padding(.horizontal, 18).frame(height: 44).background(Theme.night, in: .capsule)
            }
            .buttonStyle(.plain).padding(.top, 6)
        }
        .frame(maxWidth: .infinity)
    }
}
