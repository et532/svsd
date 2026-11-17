import XCTest
@testable import Peepl

final class QueryTests: XCTestCase {
    func testBushwickFashionParty() {
        let c = Query.parse("someone for me to invite to a house party in Bushwick that is like fashion themed")
        XCTAssertEqual(c.intent, "plan")
        XCTAssertEqual(c.activityId, "house-party")
        XCTAssertEqual(c.place?.name, "Bushwick")
        XCTAssertTrue(c.named)
        XCTAssertEqual(c.theme, ["fashion"])
        XCTAssertTrue(c.groups.flatMap { $0 }.contains("stylist"))
        XCTAssertEqual(c.contexts["social"], 1)
    }
    func testGatesPlanToHome() {
        let c = Query.parse("someone to play pickleball with")
        XCTAssertEqual(c.intent, "plan")
        XCTAssertEqual(c.place?.id, "new-york")
        XCTAssertFalse(c.named)
        XCTAssertTrue(c.theme.contains("pickleball"))
    }
    func testKnowledgeNotGated() {
        let c = Query.parse("who knows about taxes")
        XCTAssertEqual(c.intent, "knowledge")
        XCTAssertNil(c.place)
        XCTAssertEqual(c.theme, ["taxes"])
    }
    func testLifeStageAndPlace() {
        let c = Query.parse("college friends who moved to New York")
        XCTAssertEqual(c.stage, "college")
        XCTAssertEqual(c.place?.id, "new-york")
        XCTAssertEqual(c.theme, [])
    }
    func testPlaces() {
        XCTAssertEqual(Places.resolve("dinner in SF next month")?.place.metro, "bay")
        let oak = Places.lookup("Oakland"), sf = Places.lookup("San Francisco")
        XCTAssertNotNil(oak); XCTAssertNotNil(sf)
        XCTAssertTrue(Places.sameMetro(oak!, sf))
        let zara = PersonInfo.sample().first { $0.id == "zara-ahmed" }
        XCTAssertNotNil(zara.flatMap(Places.of))
    }
}
