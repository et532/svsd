import XCTest
import SwiftData
@testable import Peepl

@MainActor
final class SeedTests: XCTestCase {
    /// A throwaway defaults, so the "already seeded" flags of the app hosting the tests don't count.
    func defaults() -> UserDefaults {
        let name = "peepl.tests.\(UUID().uuidString)"
        addTeardownBlock { UserDefaults().removePersistentDomain(forName: name) }
        return UserDefaults(suiteName: name)!
    }
    func people(_ c: ModelContext) throws -> [Person] { try c.fetch(FetchDescriptor<Person>()) }

    func testLoadsTheDiverse200AndIsIdempotent() throws {
        let context = ModelContext(try makeContainer()), d = defaults()
        Seed.loadIfEmpty(context, defaults: d)
        let all = try people(context), ids = Set(all.map(\.id))
        XCTAssertEqual(all.count, 201) // 200 + Jordan Lee
        XCTAssertTrue(ids.isSuperset(of: Diverse.keep.union(["jordan-lee"])))
        XCTAssertTrue(all.allSatisfy { $0.knows.allSatisfy(ids.contains) }, "a link to someone left out")
        Seed.loadIfEmpty(context, defaults: d)
        XCTAssertEqual(try context.fetchCount(FetchDescriptor<Person>()), 201)
    }

    func testDeletingEveryoneDoesNotReseed() throws {
        let context = ModelContext(try makeContainer()), d = defaults()
        Seed.loadIfEmpty(context, defaults: d)
        PeopleStore.delete(try people(context), in: context)
        Seed.loadIfEmpty(context, defaults: d)
        XCTAssertEqual(try context.fetchCount(FetchDescriptor<Person>()), 0)
    }

    /// An install from before M5 holds all 500: once, the untouched ones outside the 200 go; anyone you added to stays.
    func testTrimsAnOldInstallOnce() throws {
        let context = ModelContext(try makeContainer()), d = defaults()
        let data = try Data(contentsOf: XCTUnwrap(Bundle.main.url(forResource: "seed", withExtension: "json")))
        let infos = try JSONDecoder().decode([PersonInfo].self, from: data)
        let shown = Seed.shownIds(infos)
        for p in infos { // the old seed: everyone, with their real moment and to-do counts
            let m = Person(id: p.id, name: p.name, context: p.context, alsoContext: nil, profession: p.profession, story: p.story, tags: p.tags,
                           from: p.from, met: p.met, livesNow: p.livesNow, lifeStage: nil, lastContacted: p.lastContacted, knows: p.knows,
                           mutualNotes: [:], closeness: p.closeness)
            context.insert(m)
            m.todos = p.todos.map { Todo(id: $0.id, text: $0.text, done: $0.done) }
            m.moments = p.moments.map { Moment(id: $0.id, date: $0.date, title: $0.title) }
        }
        let mine = Person(id: "my-friend", name: "My Friend", context: "social", alsoContext: nil, profession: "", story: "", tags: [],
                          from: infos[0].from, met: infos[0].met, livesNow: infos[0].livesNow, lifeStage: nil, lastContacted: "2026-11-01",
                          knows: [], mutualNotes: [:], closeness: 1)
        context.insert(mine)
        let touched = try XCTUnwrap(try people(context).first { !shown.contains($0.id) })
        PeopleStore.addMoment(to: touched, note: "Caught up over coffee.", in: context)

        Seed.loadIfEmpty(context, defaults: d)
        let left = try people(context), ids = Set(left.map(\.id))
        XCTAssertEqual(ids, shown.union(["my-friend", touched.id]))
        XCTAssertTrue(left.allSatisfy { $0.knows.allSatisfy(ids.contains) })

        // only once: someone outside the 200 that you add back later is left alone
        context.insert(Person(id: infos.first { !shown.contains($0.id) && $0.id != touched.id }!.id, name: "Back Again", context: "social",
                              alsoContext: nil, profession: "", story: "", tags: [], from: infos[0].from, met: infos[0].met,
                              livesNow: infos[0].livesNow, lifeStage: nil, lastContacted: "2026-11-01", knows: [], mutualNotes: [:], closeness: 1))
        Seed.loadIfEmpty(context, defaults: d)
        XCTAssertEqual(try context.fetchCount(FetchDescriptor<Person>()), left.count + 1)
    }
}
