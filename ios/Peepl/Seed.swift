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
        p.todos = (todos ?? []).enumerated().map { Todo(id: $1.id, text: $1.text, done: $1.done, order: $0) }
        p.moments = (moments ?? []).map {
            Moment(id: $0.id, date: $0.date, title: $0.title, text: $0.text, transcript: $0.transcript, seconds: $0.seconds, firstMeeting: $0.firstMeeting ?? false)
        }
        return p
    }
}

enum Seed {
    /// What the app shows of the 500 sample people: the diverse 200 plus Jordan Lee, as on the web.
    static func shownIds(_ all: [PersonInfo]) -> Set<String> {
        Set(Diverse.pick(all.filter { $0.id != "jordan-lee" }, n: 200, keep: Diverse.keep).map(\.id)).union(["jordan-lee"])
    }

    /// First launch: the sample people. Never again after that, so someone who deletes everybody stays at zero.
    static func loadIfEmpty(_ context: ModelContext, defaults: UserDefaults = .standard) {
        #if !DEBUG
        return // shipping builds start empty; the empty state offers loadSamples
        #else
        // Launch arguments, UI tests only: -PeeplNoSeed YES starts with nobody; -PeeplInMemory YES (see PeeplApp) seeds every launch.
        let args = UserDefaults.standard, memory = args.bool(forKey: "PeeplInMemory")
        if args.bool(forKey: "PeeplNoSeed") { return }
        let count = (try? context.fetchCount(FetchDescriptor<Person>())) ?? 0
        let fresh = count == 0 && (memory || !defaults.bool(forKey: "peepl.seeded"))
        let trim = count > 0 && !defaults.bool(forKey: "peepl.diverse200")
        if !memory { defaults.set(true, forKey: "peepl.seeded"); defaults.set(true, forKey: "peepl.diverse200") }
        guard fresh || trim,
              let url = Bundle.main.url(forResource: "seed", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let people = try? JSONDecoder().decode([PersonDTO].self, from: data),
              let infos = try? JSONDecoder().decode([PersonInfo].self, from: data) else { return }
        let shown = shownIds(infos)
        if fresh {
            for dto in people where shown.contains(dto.id) {
                let p = dto.model()
                p.knows = p.knows.filter(shown.contains) // links to people left out are dropped
                context.insert(p)
            }
            try? context.save()
        } else {
            // Once, for an install seeded with all 500: the sample people left out go, unless you have added to them.
            let have = Dictionary(((try? context.fetch(FetchDescriptor<Person>())) ?? []).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
            PeopleStore.delete(people.compactMap { dto in
                guard !shown.contains(dto.id), let p = have[dto.id], p.lastContacted == dto.lastContacted,
                      p.moments.count == (dto.moments ?? []).count, p.todos.count == (dto.todos ?? []).count else { return nil }
                return p
            }, in: context)
        }
        #endif
    }

    /// Inserts the diverse-200 + Jordan Lee samples in any build; does nothing if anyone exists.
    /// The backup reminder's baseline moves to the new count, so the samples don't read as 200 people added since the last backup.
    static func loadSamples(_ context: ModelContext) {
        guard ((try? context.fetchCount(FetchDescriptor<Person>())) ?? 0) == 0,
              let url = Bundle.main.url(forResource: "seed", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let people = try? JSONDecoder().decode([PersonDTO].self, from: data),
              let infos = try? JSONDecoder().decode([PersonInfo].self, from: data) else { return }
        let shown = shownIds(infos)
        for dto in people where shown.contains(dto.id) {
            let p = dto.model()
            p.knows = p.knows.filter(shown.contains)
            context.insert(p)
        }
        try? context.save()
        BackupReminder.resetBaseline(count: (try? context.fetchCount(FetchDescriptor<Person>())) ?? 0)
    }
}
