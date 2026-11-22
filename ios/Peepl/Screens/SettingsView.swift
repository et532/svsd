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

extension LocalAI {
    /// Settings line for the on-device model: `reason` is `unavailableReason`.
    static func statusLine(reason: String?) -> (title: String, detail: String) {
        guard let reason else {
            return ("On", "On. Peepl uses Apple Intelligence on this phone to read your questions and explain results. Nothing leaves your phone.")
        }
        return (reason, "\(reason) Peepl still works: search and notes use its built-in rules.")
    }
}

struct SettingsView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var aiReason = LocalAI.unavailableReason
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Person.name) private var people: [Person]
    @AppStorage(AIClient.enabledKey) private var openAI = false
    @State private var shareURL: URL?
    @State private var lastShared: URL?
    @State private var importing = false
    private var version: String {
        let i = Bundle.main.infoDictionary
        return "\(i?["CFBundleShortVersionString"] as? String ?? "1.0") (\(i?["CFBundleVersion"] as? String ?? "1"))"
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Your data") {
                    Button("Back up") {
                        do { shareURL = try BackupFile.export(people: people); lastShared = shareURL; BackupReminder.recordBackup(count: people.count) } catch { nav.say("Could not make the backup: \(error.localizedDescription)") }
                    }
                    Button("Restore") { importing = true }
                    Text("Everyone you add stays on this device. Back up saves them to one file.").font(.footnote).foregroundStyle(.secondary)
                }
                Section {
                    Text(LocalAI.statusLine(reason: aiReason).title)
                    if aiReason == "Apple Intelligence is turned off in Settings." {
                        Button("Open iOS Settings") { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } }
                    }
                } header: { Text("AI on this phone") } footer: {
                    Text(LocalAI.statusLine(reason: aiReason).detail)
                }
                Section {
                    Toggle("Use OpenAI", isOn: $openAI)
                } header: { Text("AI help from OpenAI") } footer: {
                    Text("Off: everything stays on this phone and Peepl uses its built-in search and templates. On: the notes you add, your search questions with a few facts about candidate people, and message drafts are sent to OpenAI. Names and ids of people are not sent for search, but notes you type can contain names. Nothing is shared with other users.")
                }
                Section("Notifications & permissions") {
                    Button("Open iOS Settings") { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } }
                }
                Section("About") {
                    LabeledContent("Version", value: version)
                    Text("Nothing leaves this phone unless you turn on AI help from OpenAI above. Nothing is shared with other users.").font(.footnote).foregroundStyle(.secondary)
                }
            }
            .onChange(of: scenePhase) { _, p in if p == .active { aiReason = LocalAI.unavailableReason } }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(item: $shareURL, onDismiss: { BackupReminder.cleanup(lastShared); lastShared = nil }) { ShareSheet(url: $0) }
            .backupImporter(isPresented: $importing)
        }
    }
}
