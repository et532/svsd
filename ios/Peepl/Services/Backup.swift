import Foundation
import SwiftData
import SwiftUI

/// One JSON file with everyone, their moments and to-dos, and the saved name fixes. The web's exportBackup / importBackup.
struct BackupFile: Codable {
    struct T: Codable { var id: String; var text: String; var done: Bool; var order: Int? }
    struct M: Codable { var id: String; var date: String; var title: String; var text: String?; var transcript: String?; var seconds: Int?; var firstMeeting: Bool }
    struct P: Codable {
        var id, name, context: String; var alsoContext: String?; var profession, story: String; var tags: [String]
        var from, met, livesNow: Place; var lifeStage: String?; var lastContacted: String; var knows: [String]
        var mutualNotes: [String: String]; var closeness: Int?; var todos: [T]; var moments: [M]
    }
    struct Counts: Codable { var people: Int; var moments: Int }
    static let currentVersion = 1
    var version = BackupFile.currentVersion
    var exportedAt: String?  // optional so old files still decode
    var counts: Counts?
    var people: [P] = []
    var nameFixes: [String: String] = [:]

    init(people: [Person]) {
        self.people = people.map { p in
            P(id: p.id, name: p.name, context: p.context, alsoContext: p.alsoContext, profession: p.profession, story: p.story, tags: p.tags,
              from: p.from, met: p.met, livesNow: p.livesNow, lifeStage: p.lifeStage, lastContacted: p.lastContacted, knows: p.knows,
              mutualNotes: p.mutualNotes, closeness: p.closeness,
              todos: p.todos.map { T(id: $0.id, text: $0.text, done: $0.done, order: $0.order) },
              moments: p.moments.map { M(id: $0.id, date: $0.date, title: $0.title, text: $0.text, transcript: $0.transcript, seconds: $0.seconds, firstMeeting: $0.firstMeeting) })
        }
        exportedAt = ISO8601DateFormatter().string(from: Date())
        counts = Counts(people: self.people.count, moments: self.people.reduce(0) { $0 + $1.moments.count })
        nameFixes = NameFixes.store.dictionary(forKey: NameFixes.key) as? [String: String] ?? [:]
    }

    enum Mode { case merge, replace }
    struct Failure: LocalizedError { var errorDescription: String? }
    struct Result { var added = 0, updated = 0, total = 0 }

    /// Decode and check the WHOLE file; throws before anything on the phone is touched.
    static func read(_ data: Data) throws -> BackupFile {
        struct V: Codable { var version: Int? }
        guard let v = try? JSONDecoder().decode(V.self, from: data), let n = v.version else { throw Failure(errorDescription: "That isn't a Peepl backup file.") }
        if n > currentVersion { throw Failure(errorDescription: "This backup was made by a newer version of Peepl. Update the app to restore it.") }
        guard let f = try? JSONDecoder().decode(BackupFile.self, from: data) else { throw Failure(errorDescription: "That backup file is damaged.") }
        let ids = f.people.map(\.id)
        let inner = f.people.flatMap { p in p.todos.map(\.id) + p.moments.map(\.id) }
        guard !ids.contains(""), Set(ids).count == ids.count, !inner.contains(""), Set(inner).count == inner.count else {
            throw Failure(errorDescription: "That backup file is damaged (repeated or empty ids).")
        }
        return f
    }

    /// Write `Peepl backup YYYY-MM-DD.json` to a temp file, then re-read and validate it before it is shared.
    static func export(people: [Person]) throws -> URL {
        let file = BackupFile(people: people)
        let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        let day = DateFormatter(); day.locale = Locale(identifier: "en_US_POSIX"); day.dateFormat = "yyyy-MM-dd"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Peepl backup \(day.string(from: Date())).json")
        try enc.encode(file).write(to: url, options: .atomic)
        guard try read(Data(contentsOf: url)).people.count == people.count else { throw Failure(errorDescription: "The backup didn't check out.") }
        return url
    }

    private static func fill(_ p: Person, from d: P, context: ModelContext) {
        p.name = d.name; p.context = d.context; p.alsoContext = d.alsoContext; p.profession = d.profession; p.story = d.story; p.tags = d.tags
        p.from = d.from; p.met = d.met; p.livesNow = d.livesNow; p.lifeStage = d.lifeStage; p.lastContacted = d.lastContacted
        p.knows = d.knows; p.mutualNotes = d.mutualNotes; p.closeness = d.closeness
        Array(p.todos).forEach(context.delete); Array(p.moments).forEach(context.delete)
        p.todos = d.todos.enumerated().map { Todo(id: $1.id, text: $1.text, done: $1.done, order: $1.order ?? $0) }
        p.moments = d.moments.map { Moment(id: $0.id, date: $0.date, title: $0.title, text: $0.text, transcript: $0.transcript, seconds: $0.seconds, firstMeeting: $0.firstMeeting) }
    }

    /// Merge adds new ids and keeps the newer copy on a clash (newer lastContacted, then more moments, else the phone's); never deletes.
    /// Replace makes the phone match the file. One save at the end; any throw rolls everything back.
    @discardableResult
    func restore(into context: ModelContext, mode: Mode) throws -> Result {
        var r = Result(total: people.count)
        do {
            let mine = Dictionary(uniqueKeysWithValues: try context.fetch(FetchDescriptor<Person>()).map { ($0.id, $0) })
            for d in people {
                guard let p = mine[d.id] else {
                    let n = Person(id: d.id, name: d.name, context: d.context, alsoContext: d.alsoContext, profession: d.profession, story: d.story, tags: d.tags,
                                   from: d.from, met: d.met, livesNow: d.livesNow, lifeStage: d.lifeStage, lastContacted: d.lastContacted, knows: d.knows,
                                   mutualNotes: d.mutualNotes, closeness: d.closeness)
                    context.insert(n); Self.fill(n, from: d, context: context); r.added += 1; continue
                }
                let fileWins = mode == .replace || d.lastContacted > p.lastContacted || (d.lastContacted == p.lastContacted && d.moments.count > p.moments.count)
                if fileWins { Self.fill(p, from: d, context: context); r.updated += 1; continue }
                let haveM = Set(p.moments.map(\.id)), haveT = Set(p.todos.map(\.id))
                let m = d.moments.filter { !haveM.contains($0.id) }, t = d.todos.filter { !haveT.contains($0.id) }
                for x in m { p.moments.append(Moment(id: x.id, date: x.date, title: x.title, text: x.text, transcript: x.transcript, seconds: x.seconds, firstMeeting: x.firstMeeting)) }
                for x in t { p.addTodo(id: x.id, text: x.text) }
                if !m.isEmpty || !t.isEmpty { r.updated += 1 }
            }
            if mode == .replace {
                let keep = Set(people.map(\.id))
                for p in mine.values where !keep.contains(p.id) { context.delete(p) }
            }
            try context.save()
        } catch { context.rollback(); throw error }
        let have = NameFixes.store.dictionary(forKey: NameFixes.key) as? [String: String] ?? [:]
        NameFixes.store.set(mode == .replace ? nameFixes : nameFixes.merging(have) { _, mine in mine }, forKey: NameFixes.key)
        return r
    }
}

/// Shared by Settings and the empty list: pick a file, check it, ask Merge / Replace, apply, say what happened.
struct BackupImporter: ViewModifier {
    @Binding var isPresented: Bool
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    @State private var pending: BackupFile?
    @State private var mine = 0

    func body(content: Content) -> some View {
        content
            .fileImporter(isPresented: $isPresented, allowedContentTypes: [.json]) { result in
                do {
                    guard case .success(let url) = result, url.startAccessingSecurityScopedResource() else { throw BackupFile.Failure(errorDescription: "Couldn't read that file.") }
                    defer { url.stopAccessingSecurityScopedResource() }
                    let f = try BackupFile.read(Data(contentsOf: url))
                    mine = (try? context.fetchCount(FetchDescriptor<Person>())) ?? 0
                    pending = f
                } catch { nav.say(error.localizedDescription) }
            }
            .confirmationDialog("Restore from backup", isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } }), titleVisibility: .visible) {
                Button("Merge") { run(.merge) }
                Button("Replace everything", role: .destructive) { run(.replace) }
                Button("Cancel", role: .cancel) {}
            } message: { Text("File has \(pending?.people.count ?? 0) people, this phone has \(mine).") }
    }

    private func run(_ mode: BackupFile.Mode) {
        guard let f = pending else { return }
        do {
            let r = try f.restore(into: context, mode: mode)
            nav.say(mode == .replace ? "Restored \(r.total) people" : "Merged: \(r.added) added, \(r.updated) updated")
        } catch { nav.say("Couldn't restore: \(error.localizedDescription)") }
        pending = nil
    }
}

extension View { func backupImporter(isPresented: Binding<Bool>) -> some View { modifier(BackupImporter(isPresented: isPresented)) } }

/// System share sheet (Mail, AirDrop, Files) for the backup file.
struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [url], applicationActivities: nil) }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
extension URL: @retroactive Identifiable { public var id: String { absoluteString } }
