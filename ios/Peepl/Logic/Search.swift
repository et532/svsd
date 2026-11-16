import Foundation

/// Value snapshot of a person so search runs off the main actor and tests need no SwiftData.
struct PersonInfo: Decodable, Sendable, Identifiable, Hashable {
    struct TodoInfo: Decodable, Sendable, Hashable { var id: String; var text: String; var done: Bool }
    struct MomentInfo: Decodable, Sendable, Hashable {
        var id: String; var date: String; var title: String
        var text: String?; var transcript: String?; var firstMeeting: Bool?
    }
    var id: String, name: String, context: String, alsoContext: String?, profession: String, story: String
    var tags: [String]; var from: Place; var met: Place; var livesNow: Place
    var lifeStage: String?; var lastContacted: String; var knows: [String]; var closeness: Int?
    var todos: [TodoInfo] = []
    var moments: [MomentInfo] = [] // newest first: date desc, then id asc

    private enum CodingKeys: String, CodingKey {
        case id, name, context, alsoContext, profession, story, tags, from, met, livesNow, lifeStage, lastContacted, knows, closeness, todos, moments
    }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id); name = try c.decode(String.self, forKey: .name)
        context = try c.decode(String.self, forKey: .context); alsoContext = try c.decodeIfPresent(String.self, forKey: .alsoContext)
        profession = try c.decode(String.self, forKey: .profession); story = try c.decode(String.self, forKey: .story)
        tags = try c.decode([String].self, forKey: .tags)
        from = try c.decode(Place.self, forKey: .from); met = try c.decode(Place.self, forKey: .met); livesNow = try c.decode(Place.self, forKey: .livesNow)
        lifeStage = try c.decodeIfPresent(String.self, forKey: .lifeStage); lastContacted = try c.decode(String.self, forKey: .lastContacted)
        knows = try c.decode([String].self, forKey: .knows); closeness = try c.decodeIfPresent(Int.self, forKey: .closeness)
        todos = try c.decodeIfPresent([TodoInfo].self, forKey: .todos) ?? []
        moments = Self.newestFirst(try c.decodeIfPresent([MomentInfo].self, forKey: .moments) ?? [])
    }
    init(_ p: Person) {
        id = p.id; name = p.name; context = p.context; alsoContext = p.alsoContext; profession = p.profession; story = p.story
        tags = p.tags; from = p.from; met = p.met; livesNow = p.livesNow; lifeStage = p.lifeStage
        lastContacted = p.lastContacted; knows = p.knows; closeness = p.closeness
        todos = p.todos.map { TodoInfo(id: $0.id, text: $0.text, done: $0.done) }
        moments = Self.newestFirst(p.moments.map {
            MomentInfo(id: $0.id, date: $0.date, title: $0.title, text: $0.text, transcript: $0.transcript, firstMeeting: $0.firstMeeting)
        })
    }
    private static func newestFirst(_ m: [MomentInfo]) -> [MomentInfo] {
        m.sorted { $0.date != $1.date ? $0.date > $1.date : $0.id < $1.id }
    }

    /// The bundled seed.json (all 500), for tests.
    static func sample() -> [PersonInfo] {
        guard let url = Bundle.main.url(forResource: "seed", withExtension: "json"), let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([PersonInfo].self, from: data)) ?? []
    }
    var firstName: String { name.split(separator: " ").first.map(String.init) ?? name }
}

struct Hit: Sendable { var personId: String; var text: String; var from: String?; var sim: Float }
