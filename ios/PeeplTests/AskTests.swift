import XCTest
@testable import Peepl

final class AskTests: XCTestCase {
    let people = PersonInfo.sample()
    var now: Date { ISO8601DateFormatter().date(from: "2026-11-16T12:00:00Z")! }
    func answer(_ q: String) -> PeopleAnswer {
        guard case .people(let a) = Ask.interpret(q, people: people, now: now) else { XCTFail("not people: \(q)"); return PeopleAnswer(title: "", matches: []) }
        return a
    }

    func testClimbingDemo() {
        let a = answer("I want to find someone to go climbing with me")
        XCTAssertEqual(a.matches.map(\.id), ["jordan-lee", "zara-ahmed"])
        XCTAssertEqual(a.matches[0].action?.label, "Draft a message")
    }
    func testSFTrip() {
        let a = answer("I’m traveling to SF next month. Who can I grab a coffee with?")
        XCTAssertGreaterThanOrEqual(a.matches.count, 3)
        for m in a.matches { XCTAssertEqual(Places.of(m.person)?.metro, "bay", m.person.name) }
        XCTAssertEqual(a.matches[0].action?.label, "Plan coffee")
    }
    func testHardwareIntro() {
        let a = answer("I just met a founder looking for a hardware engineer. Who can I introduce?")
        XCTAssertEqual(a.groups?[0].label, "You know directly")
        XCTAssertEqual(a.groups?[0].matches.first?.id, "ana-ruiz")
        XCTAssertTrue(a.matches.map(\.id).contains("aisha-khan"))
        XCTAssertTrue(a.groups?.first { $0.label == "One step away" }?.matches.map(\.id).contains("aisha-khan") ?? false)
    }
    func testIsSpecial() {
        for q in ["I want to find someone to go climbing with me", "I’m traveling to SF next month. Who can I grab a coffee with?",
                  "I just met a founder looking for a hardware engineer. Who can I introduce?"] {
            XCTAssertTrue(Ask.isSpecial(Ask.interpret(q, people: people, now: now)), q)
        }
        XCTAssertFalse(Ask.isSpecial(Ask.interpret("who knows about taxes", people: people, now: now)))
        XCTAssertFalse(Ask.isSpecial(.none(title: "x")))
    }
    func testActionsAndCatchUp() {
        guard case .profile(let p) = Ask.interpret("Open Aisha’s profile", people: people, now: now) else { return XCTFail("profile") }
        XCTAssertEqual(p.id, "aisha-khan")
        XCTAssertEqual(Ask.interpret("Add someone new I just met", people: people, now: now), .add)
        let a = answer("Who haven’t I talked to in a while?")
        XCTAssertEqual(a.matches.count, 5)
        XCTAssertTrue(a.matches.allSatisfy { $0.why.hasPrefix("Last talked") })
    }
    func testReasonFromMoment() {
        let a = answer("dumpling")
        XCTAssertTrue(a.generic)
        XCTAssertFalse(a.matches.isEmpty)
        let re = try! NSRegularExpression(pattern: "\\(.+, [A-Z][a-z]{2} \\d{4}\\)$")
        XCTAssertTrue(a.matches.contains { re.firstMatch(in: $0.why, range: NSRange($0.why.startIndex..., in: $0.why)) != nil }, a.matches.first?.why ?? "")
    }
    func testTimeSince() {
        XCTAssertEqual(Ask.timeSince("2026-11-16", now: now), "Today")
        XCTAssertEqual(Ask.timeSince("2026-11-01", now: now), "2w ago")
    }
}
