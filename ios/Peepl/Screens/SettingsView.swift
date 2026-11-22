import SwiftUI
import SwiftData
import UniformTypeIdentifiers

/// Glass round button at the top right of Connections; opens Settings.
struct SettingsButton: View {
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: "gearshape.fill").font(Theme.font(18)).foregroundStyle(Theme.ink)
                .frame(width: 54, height: 54).pastel(in: Circle())
        }
        .buttonStyle(PressStyle(scale: 0.92))
        .accessibilityLabel("Settings")
    }
}

struct SettingsView: View {
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Person.name) private var people: [Person]
    @State private var exporting = false
    @State private var importing = false
    private var version: String {
        let i = Bundle.main.infoDictionary
        return "\(i?["CFBundleShortVersionString"] as? String ?? "1.0") (\(i?["CFBundleVersion"] as? String ?? "1"))"
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Your data") {
                    Button("Back up") { exporting = true }
                    Button("Restore") { importing = true }
                    Text("Everyone you add stays on this device. Back up saves them to one file.").font(.footnote).foregroundStyle(.secondary)
                }
                Section("Notifications & permissions") {
                    Button("Open iOS Settings") { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } }
                }
                Section("About") {
                    LabeledContent("Version", value: version)
                    Text("Notes you add and questions you ask are sent to OpenAI to fill in profiles and find people. Nothing is shared with other users.").font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .fileExporter(isPresented: $exporting, document: BackupFile(people: people), contentType: .json, defaultFilename: "Peepl backup") { _ in }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                guard case .success(let url) = result, url.startAccessingSecurityScopedResource() else { nav.say("Couldn't read that file"); return }
                defer { url.stopAccessingSecurityScopedResource() }
                if let data = try? Data(contentsOf: url), let b = try? JSONDecoder().decode(BackupFile.self, from: data) {
                    nav.say("Restored \(b.restore(into: context)) people")
                } else { nav.say("Couldn't read that file") }
            }
        }
    }
}
