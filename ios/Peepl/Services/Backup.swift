import Foundation
import SwiftData
import SwiftUI
import UniformTypeIdentifiers

/// One JSON file with everyone, their moments and to-dos, and the saved name fixes. The web's exportBackup / importBackup.
struct BackupFile: FileDocument, Codable {
    static var readableContentTypes: [UTType] { [.json] }
    struct T: Codable { var id: String; var text: String; var done: Bool; var order: Int? }
    struct M: Codable { var id: String; var date: String; var title: String; var text: String?; var transcript: String?; var seconds: Int?; var firstMeeting: Bool }
    struct P: Codable {
        var id, name, context: String; var alsoContext: String?; var profession, story: String; var tags: [String]
        var from, met, livesNow: Place; var lifeStage: String?; var lastContacted: String; var knows: [String]
        var mutualNotes: [String: String]; var closeness: Int?; var todos: [T]; var moments: [M]
    }
    var version = 1
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
        nameFixes = NameFixes.store.dictionary(forKey: NameFixes.key) as? [String: String] ?? [:]
    }
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else { throw CocoaError(.fileReadCorruptFile) }
        self = try JSONDecoder().decode(BackupFile.self, from: data)
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        return FileWrapper(regularFileWithContents: try enc.encode(self))
    }

    /// Restore replaces everyone with the file's people. Returns how many were loaded.
    @discardableResult
    func restore(into context: ModelContext) -> Int {
        PeopleStore.delete((try? context.fetch(FetchDescriptor<Person>())) ?? [], in: context)
        for d in people {
            let p = Person(id: d.id, name: d.name, context: d.context, alsoContext: d.alsoContext, profession: d.profession, story: d.story, tags: d.tags,
                           from: d.from, met: d.met, livesNow: d.livesNow, lifeStage: d.lifeStage, lastContacted: d.lastContacted, knows: d.knows,
                           mutualNotes: d.mutualNotes, closeness: d.closeness)
            p.todos = d.todos.enumerated().map { Todo(id: $1.id, text: $1.text, done: $1.done, order: $1.order ?? $0) }
            p.moments = d.moments.map { Moment(id: $0.id, date: $0.date, title: $0.title, text: $0.text, transcript: $0.transcript, seconds: $0.seconds, firstMeeting: $0.firstMeeting) }
            context.insert(p)
        }
        try? context.save()
        NameFixes.store.set(nameFixes, forKey: NameFixes.key)
        return people.count
    }
}
