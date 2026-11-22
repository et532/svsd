import XCTest
import SwiftData
@testable import Peepl

@MainActor
final class NudgesTests: XCTestCase {
    let today = "2026-11-22"
    var defaults: UserDefaults!

    override func setUp() {
        defaults = UserDefaults(suiteName: "nudges-test")!
        defaults.removePersistentDomain(forName: "nudges-test")
    }

    func ago(_ n: Int) -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Calendar.current.date(byAdding: .day, value: -n, to: f.date(from: today)!)!)
    }

    func person(_ id: String = "a", closeness: Int?, days: Int, last: String? = nil) -> Person {
        Person(id: id, name: id, context: "x", alsoContext: nil, profession: "", story: "", tags: [],
               from: Capture.place(nil, fallback: "X"), met: Capture.place(nil, fallback: "X"),
               livesNow: Capture.place(nil, fallback: "X"), lifeStage: nil, lastContacted: last ?? ago(days),
               knows: [], mutualNotes: [:], closeness: closeness)
    }

    func isDue(_ c: Int?, _ days: Int) -> Bool {
        !Nudges.due([person(closeness: c, days: days)], today: today, snoozed: [:]).isEmpty
    }

    func testThresholds() {
        for (c, t) in [(3, 30), (2, 60), (1, 120), (nil, 120)] as [(Int?, Int)] {
            XCTAssertFalse(isDue(c, t - 1)); XCTAssertTrue(isDue(c, t)); XCTAssertTrue(isDue(c, t + 1))
        }
    }

    func testUnparseableNotDue() {
        XCTAssertTrue(Nudges.due([person(closeness: 3, days: 0, last: "soon")], today: today, snoozed: [:]).isEmpty)
    }

    func testMostOverdueFirst() {
        let list = [person("a", closeness: 3, days: 40), person("b", closeness: 3, days: 90)]
        XCTAssertEqual(Nudges.due(list, today: today, snoozed: [:]).map(\.id), ["b", "a"])
    }

    func testSnoozeHidesThenExpires() {
        let p = person(closeness: 3, days: 100)
        Nudges.snooze("a", today: today, defaults)
        let s = Nudges.load(defaults)
        XCTAssertEqual(s["a"], "2026-12-22")
        XCTAssertTrue(Nudges.due([p], today: "2026-12-22", snoozed: s).isEmpty)
        XCTAssertFalse(Nudges.due([p], today: "2026-12-23", snoozed: s).isEmpty)
        Nudges.clearSnooze("a", defaults)
        XCTAssertTrue(Nudges.load(defaults).isEmpty)
    }

    func testTalkedTodayAndAddMomentClearSnooze() throws {
        let ctx = ModelContext(try makeContainer())
        for id in ["t", "m"] {
            let p = person(id, closeness: 2, days: 400); ctx.insert(p)
            Nudges.snooze(id)
            XCTAssertNotNil(Nudges.load()[id])
            if id == "t" { PeopleStore.talkedToday(p, in: ctx) } else { PeopleStore.addMoment(to: p, note: "Coffee", in: ctx) }
            XCTAssertNil(Nudges.load()[id])
            XCTAssertEqual(p.lastContacted, Capture.today())
            XCTAssertTrue(Nudges.due([p], today: Capture.today(), snoozed: [:]).isEmpty)
            if id == "t" { XCTAssertEqual(p.closeness, 2) }
        }
    }
}
