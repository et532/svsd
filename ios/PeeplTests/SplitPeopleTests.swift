import XCTest
@testable import Peepl

final class SplitPeopleTests: XCTestCase {
    func testTwoPeople() {
        let n = Capture.splitPeople("Dinner with Maya Chen and Theo Park. Maya is a designer at Kiln. Theo coaches climbing.")
        XCTAssertEqual(n.map(\.name), ["Maya Chen", "Theo Park"])
        XCTAssertEqual(n[0].text, "Maya Chen. Met at dinner. Maya is a designer at Kiln.")
        XCTAssertEqual(n[1].text, "Theo Park. Met at dinner. Theo coaches climbing.")
    }
    func testOnePersonIsEmpty() { XCTAssertEqual(Capture.splitPeople("Met Maya Chen at a party."), []) }
    func testThree() {
        let n = Capture.splitPeople("Met Ana, Ben and Cy at a meetup.")
        XCTAssertEqual(n.map(\.name), ["Ana", "Ben", "Cy"])
        XCTAssertEqual(n[0].text, "Ana. Met Ana at a meetup.")
    }
    func testAndInsideANameDoesNotSplit() { // the web regex split "Alexander" on its "and"
        XCTAssertEqual(Capture.splitPeople("Lunch with Alexander Grant and Sandra Lee.").map(\.name), ["Alexander Grant", "Sandra Lee"])
    }
}
