import XCTest
import SwiftData
@testable import Peepl

final class AddFlowTests: XCTestCase {
    private struct P: Named { let id: String; let name: String }
    private let people = [P(id: "p", name: "Priya Menon"), P(id: "s", name: "Jordan Smith"), P(id: "l", name: "Jordan Lee")]

    func testTwoJordansAsk() {
        guard case .choose(let c) = AddPath.decide("Caught up with Jordan over lunch.", people: people) else { return XCTFail() }
        XCTAssertEqual(c.map(\.name), ["Jordan Smith", "Jordan Lee"])
    }
    func testOneMatchSavesMoment() {
        guard case .moment(let p) = AddPath.decide("Caught up with Priya over lunch.", people: people) else { return XCTFail() }
        XCTAssertEqual(p.id, "p")
    }
    func testNewPerson() {
        guard case .newPerson = AddPath.decide("Met Sam Rivera at a pickleball meetup", people: people) else { return XCTFail() }
    }

    func testListWording() {
        XCTAssertEqual(AddMany.list(["Maya", "Theo"]), "Maya and Theo")
        XCTAssertEqual(AddMany.list(["A", "B", "C"]), "A, B and C")
    }
    @MainActor func testTwoPersonNoteCreatesLinkedPeople() async throws {
        let ctx = ModelContext(try makeContainer())
        let notes = Capture.splitPeople("Dinner with Maya Chen and Theo Park. Maya is a designer at Kiln. Met at dinner.")
        XCTAssertEqual(notes.count, 2)
        let made = await AddMany.create(notes, people: [], in: ctx)
        XCTAssertEqual(made.count, 2)
        XCTAssertTrue(made[0].knows.contains(made[1].id) && made[1].knows.contains(made[0].id))
    }
}
