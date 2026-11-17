import XCTest
import SwiftData
@testable import Peepl

@MainActor
final class PeopleStoreTests: XCTestCase {
    let note = "Met Sam Rivera at a pickleball meetup, designer at Kiln, loves trail running"

    func make(_ ctx: ModelContext) -> (person: Person, existed: Bool) {
        PeopleStore.createPerson(Capture.parsePerson(note, people: []), note: note, in: ctx)
    }

    func testSubtitleDropsWhatANewPersonLacks() throws {
        let ctx = ModelContext(try makeContainer())
        let p = make(ctx).person
        XCTAssertFalse(p.subtitle.contains("Unknown"))
        p.profession = "Unknown"; p.livesNow.city = ""
        XCTAssertEqual(p.subtitle, "")
        p.profession = "Designer"; XCTAssertEqual(p.subtitle, "Designer")
        p.livesNow.city = "Queens"; XCTAssertEqual(p.subtitle, "Designer · Queens")
    }

    func testCreatePerson() throws {
        let ctx = ModelContext(try makeContainer())
        let (p, existed) = make(ctx)
        XCTAssertFalse(existed)
        XCTAssertEqual(p.name, "Sam Rivera")
        XCTAssertEqual(p.profession, "Designer @ Kiln")
        XCTAssertEqual(p.met.context, "pickleball meetup")
        XCTAssertTrue(Set(["designer", "trail running", "pickleball"]).isSubset(of: p.tags))
        XCTAssertEqual(p.todos.map(\.text), ["Loves trail running"])
        XCTAssertEqual(p.moments.count, 1)
        XCTAssertTrue(p.moments[0].firstMeeting)
        XCTAssertEqual(p.moments[0].title, "Met at pickleball meetup")
    }

    func testPersistsAcrossRelaunch() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("peepl-\(UUID().uuidString).store")
        defer { for s in ["", "-shm", "-wal"] { try? FileManager.default.removeItem(atPath: url.path + s) } }
        do {
            let c = try makeContainer(at: url)
            _ = make(ModelContext(c))
        }
        let ctx = ModelContext(try makeContainer(at: url))
        let all = try ctx.fetch(FetchDescriptor<Person>())
        let sam = try XCTUnwrap(all.first { $0.name == "Sam Rivera" })
        XCTAssertEqual(sam.todos.map(\.text), ["Loves trail running"])
        XCTAssertEqual(sam.moments.map(\.title), ["Met at pickleball meetup"])
    }

    func testSameNameTwiceIsNotDuplicated() throws {
        let ctx = ModelContext(try makeContainer())
        _ = make(ctx)
        let (_, existed) = make(ctx)
        XCTAssertTrue(existed)
        XCTAssertEqual(try ctx.fetchCount(FetchDescriptor<Person>()), 1)
    }

    func testAddMoment() throws {
        let ctx = ModelContext(try makeContainer())
        let (p, _) = make(ctx)
        let m = PeopleStore.addMoment(to: p, note: "Caught up with Sam over coffee. Need to send him the trail map.", in: ctx)
        XCTAssertEqual(m.title, "Caught up with Sam over coffee")
        XCTAssertTrue(p.todos.contains { $0.text == "Need to send him the trail map" })
        XCTAssertEqual(p.closeness, 2)
        XCTAssertEqual(p.lastContacted, Capture.today())
        XCTAssertEqual(p.moments.count, 2)
    }

    func testMutualOfLinksBothWays() throws {
        let ctx = ModelContext(try makeContainer())
        let (sam, _) = make(ctx)
        let n = "Met Lena Ortiz at a book club"
        let (lena, _) = PeopleStore.createPerson(Capture.parsePerson(n, people: []), note: n, in: ctx, mutualOf: sam.id)
        XCTAssertEqual(lena.knows, [sam.id])
        XCTAssertEqual(sam.knows, [lena.id])
    }

    func testDeletePersonTakesTheirThingsAndEveryLinkToThem() throws {
        let ctx = ModelContext(try makeContainer())
        let (sam, _) = make(ctx)
        PeopleStore.addMoment(to: sam, note: "Caught up with Sam. Need to send him the map.", in: ctx)
        let noteB = "Met Bea Ortiz at a book club, editor at Kiln"
        let bea = PeopleStore.createPerson(Capture.parsePerson(noteB, people: []), note: noteB, in: ctx, mutualOf: sam.id).person
        bea.mutualNotes[sam.id] = "from the pickleball meetup"
        XCTAssertEqual(bea.knows, [sam.id]); XCTAssertEqual(sam.knows, [bea.id])

        PeopleStore.delete([sam], in: ctx)
        XCTAssertEqual(try ctx.fetch(FetchDescriptor<Person>()).map(\.name), ["Bea Ortiz"])
        XCTAssertEqual(bea.knows, []); XCTAssertEqual(bea.mutualNotes, [:])
        XCTAssertEqual(try ctx.fetchCount(FetchDescriptor<Moment>()), 1) // only Bea's first meeting
        XCTAssertEqual(try ctx.fetchCount(FetchDescriptor<Todo>()), 0)
    }
}
