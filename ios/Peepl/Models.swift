import Foundation
import SwiftData

struct Place: Codable, Hashable {
    var city: String
    var lat: Double
    var lng: Double
    var hood: String?
    var context: String? // only used for where you met
}

@Model final class Todo {
    @Attribute(.unique) var id: String
    var text: String
    var done: Bool
    var person: Person?
    init(id: String, text: String, done: Bool = false) { self.id = id; self.text = text; self.done = done }
}

@Model final class Moment {
    @Attribute(.unique) var id: String
    var date: String // ISO day
    var title: String
    var text: String?
    var transcript: String?
    var seconds: Int?
    var firstMeeting: Bool
    var person: Person?
    init(id: String, date: String, title: String, text: String? = nil, transcript: String? = nil, seconds: Int? = nil, firstMeeting: Bool = false) {
        self.id = id; self.date = date; self.title = title; self.text = text
        self.transcript = transcript; self.seconds = seconds; self.firstMeeting = firstMeeting
    }
}

@Model final class Person {
    @Attribute(.unique) var id: String
    var name: String
    var context: String // work | social | community | family | unsorted
    var alsoContext: String?
    var profession: String
    var story: String
    var tags: [String]
    var from: Place
    var met: Place
    var livesNow: Place
    var lifeStage: String?
    var lastContacted: String
    var knows: [String]
    var mutualNotes: [String: String]
    var closeness: Int?
    @Relationship(deleteRule: .cascade, inverse: \Todo.person) var todos: [Todo] = []
    @Relationship(deleteRule: .cascade, inverse: \Moment.person) var moments: [Moment] = []

    init(id: String, name: String, context: String, alsoContext: String?, profession: String, story: String, tags: [String],
         from: Place, met: Place, livesNow: Place, lifeStage: String?, lastContacted: String, knows: [String],
         mutualNotes: [String: String], closeness: Int?) {
        self.id = id; self.name = name; self.context = context; self.alsoContext = alsoContext
        self.profession = profession; self.story = story; self.tags = tags
        self.from = from; self.met = met; self.livesNow = livesNow; self.lifeStage = lifeStage
        self.lastContacted = lastContacted; self.knows = knows; self.mutualNotes = mutualNotes; self.closeness = closeness
    }

    var firstName: String { name.split(separator: " ").first.map(String.init) ?? name }
    var initials: String {
        let p = name.split(separator: " ")
        return ((p.first?.first.map(String.init) ?? "") + (p.count > 1 ? String(p.last!.first!) : "")).uppercased()
    }
}
