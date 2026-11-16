import XCTest
import SwiftData
@testable import Peepl

@MainActor
final class PeopleStoreTests: XCTestCase {
    let note = "Met Sam Rivera at a pickleball meetup, designer at Kiln, loves trail running"

    func make(_ ctx: ModelContext) -> (person: Person, existed: Bool) {
        PeopleStore.createPerson(Capture.parsePerson(note, people: []), note: note, in: ctx)
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
}
