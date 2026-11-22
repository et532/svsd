import SwiftUI
import SwiftData
import UniformTypeIdentifiers

struct ConnectionsView: View {
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    @Query(sort: \Person.name) private var allPeople: [Person]
    @State private var sort = Sort.nameAZ
    @State private var intro = true   // the first-load stagger plays once, not on every scroll or filter change
    @Environment(\.accessibilityReduceMotion) private var reduce
    private enum Sort: String, CaseIterable {
        case nameAZ = "Name A–Z", nameZA = "Name Z–A", location = "Location", job = "Job", recent = "Recently in touch"
    }
    private var people: [Person] {
        var list = allPeople
        if let f = nav.showFilter { let ids = Set(f.ids); list = list.filter { ids.contains($0.id) } }
        func by(_ key: (Person) -> String) -> [Person] {
            list.sorted { (a, b) in
                let (x, y) = (key(a), key(b))
                if x.isEmpty != y.isEmpty { return !x.isEmpty } // blanks last
                return x == y ? a.name < b.name : x.localizedCaseInsensitiveCompare(y) == .orderedAscending
            }
        }
        switch sort {
        case .nameAZ: return list
        case .nameZA: return Array(list.reversed())
        case .location: return by { $0.livesNow.city == "Unknown" ? "" : $0.livesNow.city }
        case .job: return by { $0.profession }
        case .recent: return list.sorted { $0.lastContacted > $1.lastContacted }
        }
    }

    var body: some View {
        ScrollView {
                LazyVStack(spacing: 8) {
                    HStack {
                        Text("Connections")
                            .font(Theme.font(32, .regular))
                            .tracking(-1.28)
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        Menu {
                            Picker("Sort by", selection: $sort) {
                                ForEach(Sort.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                            }
                        } label: {
                            Image(systemName: "line.3.horizontal.decrease").font(Theme.font(18)).foregroundStyle(Theme.ink).frame(width: 44, height: 44).contentShape(.rect)
                        }
                        .buttonStyle(PressStyle(scale: 0.95))
                        .accessibilityLabel("Sort")
                    }
                    .padding(.bottom, 12)
                    if allPeople.isEmpty { EmptyPeople().padding(.top, 120).transition(.opacity.combined(with: .scale(scale: 0.96))) }
                    ForEach(Array(people.enumerated()), id: \.element.id) { i, p in
                        let row = Button { nav.push(.profile(p.id)) } label: { Row(person: p) }.buttonStyle(PressStyle(scale: 0.98))
                        if intro && i < 10 { row.appear(i) } else { row }
                    }
                }
                .animation(Motion.animation(Motion.smooth, reduce: reduce), value: people.map(\.id))
                .animation(Motion.animation(Motion.smooth, reduce: reduce), value: allPeople.isEmpty)
                .task { try? await Task.sleep(for: .seconds(1)); intro = false }
                .padding(.horizontal, 16)
                .padding(.top, 78)
                .padding(.bottom, 100)
            }
            .scrollEdgeEffectStyle(.soft, for: [.top, .bottom])
    }
}

private struct Row: View {
    let person: Person

    var body: some View {
        HStack(spacing: 12) {
            Avatar(id: person.id, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(person.name).font(Theme.font(16, .medium)).foregroundStyle(Theme.ink)
                Text(person.subtitle)
                    .font(Theme.font(13)).foregroundStyle(Theme.inkMuted).lineLimit(1)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right").font(Theme.font(13, .semibold)).foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 16)
        .frame(height: 70)
        .glass(20)
    }
}

/// Nobody yet (a new user, or everyone deleted): say so and offer the Add flow.
struct EmptyPeople: View {
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    var body: some View {
        VStack(spacing: 10) {
            Text("No one here yet").font(Theme.font(20, .medium)).foregroundStyle(Theme.ink)
            Text("Add the first person you want to remember:\nwho they are, where you met, their story.")
                .font(Theme.font(14)).foregroundStyle(Theme.inkMuted).multilineTextAlignment(.center)
            Button { nav.push(.add(mutualOf: nil)) } label: {
                Text("Add someone").font(Theme.font(15, .medium)).foregroundStyle(.white)
                    .padding(.horizontal, 18).frame(height: 44).background(Theme.night, in: .capsule)
            }
            .buttonStyle(PressStyle(scale: 0.95)).padding(.top, 6)
            Button { Seed.loadSamples(context) } label: {
                Text("Try with sample people").font(Theme.font(14)).foregroundStyle(Theme.inkMuted)
            }
            .buttonStyle(PressStyle(scale: 0.95)).padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
    }
}
