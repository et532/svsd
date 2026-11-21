import Foundation
import SwiftData

enum PeopleStore {
    /// Web createPerson: someone with the same name (case-insensitive) is reused, not duplicated.
    @discardableResult
    static func createPerson(_ draft: Draft, note: String, in context: ModelContext, mutualOf: String? = nil) -> (person: Person, existed: Bool) {
        let all = (try? context.fetch(FetchDescriptor<Person>())) ?? []
        let wanted = draft.name?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let same = wanted.flatMap { w in all.first { $0.name.lowercased() == w } }
        let person: Person
        if let same {
            person = same
        } else {
            let name = draft.name?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty ?? "New person"
            let taken = Set(all.map(\.id))
            var id = Capture.slug(name)
            while taken.contains(id) { id = "\(Capture.slug(name))-\(Capture.uid())" }
            let today = Capture.today()
            var met = Capture.place(nil, fallback: "New York")
            met.context = draft.met ?? "Somewhere"
            person = Person(
                id: id, name: name, context: draft.context ?? "unsorted", alsoContext: nil,
                profession: Capture.professionOf(draft), story: note.trimmingCharacters(in: .whitespacesAndNewlines),
                tags: Capture.tagsOf(draft), from: Capture.place(draft.from, fallback: "Unknown"), met: met,
                livesNow: Capture.place(draft.lives, fallback: "Unknown"), lifeStage: nil, lastContacted: today,
                knows: draft.knowsIds + (mutualOf.map { [$0] } ?? []), mutualNotes: [:], closeness: 1)
            context.insert(person)
            for text in Capture.dedupeTodos([draft.follow, draft.goal, draft.remember]) {
                person.addTodo(id: Capture.uid(), text: text)
            }
            person.moments.append(Moment(
                id: Capture.uid(), date: today, title: draft.met.map { "Met at \($0)" } ?? "First meeting",
                transcript: note.trimmingCharacters(in: .whitespacesAndNewlines), firstMeeting: true))
        }
        if let mutualOf, mutualOf != person.id, let other = all.first(where: { $0.id == mutualOf }) {
            if !person.knows.contains(other.id) { person.knows.append(other.id) }
            if !other.knows.contains(person.id) { other.knows.append(person.id) }
        }
        try? context.save()
        return (person, same != nil)
    }

    /// Web addMoment: moment, follow-up to-do, lastContacted = today, closeness +1 (max 3).
    @discardableResult
    static func addMoment(to person: Person, note: String, in context: ModelContext) -> Moment {
        let draft = Capture.parseMoment(note)
        let moment = Moment(id: Capture.uid(), date: Capture.today(), title: draft.what ?? "New moment",
                            transcript: note.trimmingCharacters(in: .whitespacesAndNewlines))
        person.moments.append(moment)
        if let f = draft.follow { person.addTodo(id: Capture.uid(), text: f) }
        person.lastContacted = Capture.today()
        person.closeness = min(3, (person.closeness ?? 1) + 1)
        try? context.save()
        return moment
    }

    /// Deletes people with their moments and to-dos (cascade), and the links other people have to them.
    static func delete(_ gone: [Person], in context: ModelContext) {
        let ids = Set(gone.map(\.id))
        for p in (try? context.fetch(FetchDescriptor<Person>())) ?? [] where !ids.contains(p.id) {
            if p.knows.contains(where: ids.contains) { p.knows.removeAll(where: ids.contains) }
            if p.mutualNotes.keys.contains(where: ids.contains) { p.mutualNotes = p.mutualNotes.filter { !ids.contains($0.key) } }
        }
        gone.forEach(context.delete)
        try? context.save()
    }
}

private extension String { var nonEmpty: String? { isEmpty ? nil : self } }
