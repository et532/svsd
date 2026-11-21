import SwiftUI
import SwiftData
import UniformTypeIdentifiers

struct ConnectionsView: View {
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    @Query(sort: \Person.name) private var allPeople: [Person]
    @State private var exporting = false
    @State private var importing = false
    private var people: [Person] {
        guard let f = nav.showFilter else { return allPeople }
        let ids = Set(f.ids); return allPeople.filter { ids.contains($0.id) }
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
                            Button("Back up") { exporting = true }.accessibilityLabel("Back up")
                            Button("Restore") { importing = true }.accessibilityLabel("Restore")
                        } label: {
                            Image(systemName: "ellipsis").font(Theme.font(18)).foregroundStyle(Theme.ink).frame(width: 44, height: 44).contentShape(.rect)
                        }
                        .accessibilityLabel("More")
                    }
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
            .background(AuraBackground(light: true))
            .fileExporter(isPresented: $exporting, document: BackupFile(people: allPeople), contentType: .json, defaultFilename: "Peepl backup") { _ in }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                guard case .success(let url) = result, url.startAccessingSecurityScopedResource() else { nav.say("Couldn't read that file"); return }
                defer { url.stopAccessingSecurityScopedResource() }
                if let data = try? Data(contentsOf: url), let b = try? JSONDecoder().decode(BackupFile.self, from: data) {
                    nav.say("Restored \(b.restore(into: context)) people")
                } else { nav.say("Couldn't read that file") }
            }
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
            .buttonStyle(.plain).padding(.top, 6)
            Button { Seed.loadSamples(context) } label: {
                Text("Try with sample people").font(Theme.font(14)).foregroundStyle(Theme.inkMuted)
            }
            .buttonStyle(.plain).padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
    }
}
