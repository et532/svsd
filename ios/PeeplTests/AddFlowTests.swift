import XCTest
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
}
