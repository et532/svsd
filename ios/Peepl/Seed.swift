import Foundation
import SwiftData

// The sample people, exported from the web app by scripts/export-ios-seed.ts (seed.json).
private struct PersonDTO: Decodable {
    struct TodoDTO: Decodable { var id: String; var text: String; var done: Bool }
    struct MomentDTO: Decodable {
        var id: String; var date: String; var title: String
        var text: String?; var transcript: String?; var seconds: Int?; var firstMeeting: Bool?
    }
    var id: String, name: String, context: String, alsoContext: String?, profession: String, story: String
    var tags: [String]; var from: Place; var met: Place; var livesNow: Place
    var lifeStage: String?; var lastContacted: String; var knows: [String]
    var mutualNotes: [String: String]?; var closeness: Int?
    var todos: [TodoDTO]?; var moments: [MomentDTO]?

    func model() -> Person {
        let p = Person(id: id, name: name, context: context, alsoContext: alsoContext, profession: profession, story: story,
                       tags: tags, from: from, met: met, livesNow: livesNow, lifeStage: lifeStage, lastContacted: lastContacted,
                       knows: knows, mutualNotes: mutualNotes ?? [:], closeness: closeness)
        p.todos = (todos ?? []).map { Todo(id: $0.id, text: $0.text, done: $0.done) }
        p.moments = (moments ?? []).map {
            Moment(id: $0.id, date: $0.date, title: $0.title, text: $0.text, transcript: $0.transcript, seconds: $0.seconds, firstMeeting: $0.firstMeeting ?? false)
        }
        return p
    }
}

enum Seed {
    static func loadIfEmpty(_ context: ModelContext) {
        guard (try? context.fetchCount(FetchDescriptor<Person>())) == 0,
              let url = Bundle.main.url(forResource: "seed", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let people = try? JSONDecoder().decode([PersonDTO].self, from: data) else { return }
        people.forEach { context.insert($0.model()) }
        try? context.save()
    }
}
