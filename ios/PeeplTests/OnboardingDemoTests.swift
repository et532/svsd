import XCTest
@testable import Peepl

/// Adds up the time instead of waiting.
private final class FakeClock: DemoClock {
    var total = 0.0
    func sleep(_ seconds: Double) async { total += seconds }
}

private final class StageLog { var seen: [Int] = [] }

final class OnboardingDemoTests: XCTestCase {
    private func person(_ id: String, date: String) -> Person {
        let place = Place(city: "X", lat: 0, lng: 0)
        return Person(id: id, name: id, context: "social", alsoContext: nil, profession: "", story: "", tags: [], from: place, met: place,
                      livesNow: place, lifeStage: nil, lastContacted: date, knows: [], mutualNotes: [:], closeness: nil)
    }

    func testPipNeverJordanNorIndigoAndIsStable() {
        let pick = Pip.pick(excluding: [])
        XCTAssertEqual(Blobs.all.count, 18)
        XCTAssertNotEqual(pick, Blobs.name(for: "jordan-lee"))
        XCTAssertNotEqual(pick, "indigo")
        XCTAssertEqual(pick, "apricot") // first alphabetically of the rest
        XCTAssertEqual(pick, Pip.pick(excluding: []))
    }

    func testPipSkipsTheOldestPersonsBlob() {
        let oldest = person("sofia-ramirez", date: "2020-01-01") // opal
        let newer = person("zara-ahmed", date: "2026-01-01")
        XCTAssertEqual(Pip.pick(excluding: [newer, oldest]), "apricot")
        let apricotOwner = person("omar-haddad", date: "2019-01-01") // apricot, and the oldest
        let pick = Pip.pick(excluding: [oldest, apricotOwner])
        XCTAssertEqual(pick, "aqua")
        XCTAssertNotEqual(pick, Blobs.name(for: apricotOwner.id))
    }

    func testTimelineDurations() async {
        for (script, total) in [(DemoScript.step2, 9.0), (.step3, 8.0), (.step4, 8.0), (.step5, 14.0), (.step6, 16.0)] {
            let clock = FakeClock(), stages = StageLog()
            await script.run(clock: clock, reduce: false) { stages.seen.append($0) }
            XCTAssertEqual(clock.total, total, accuracy: 0.3)
            XCTAssertEqual(stages.seen, Array(1...script.cues.count))
        }
    }

    func testReduceMotionShowsFinalFrameWithoutTimers() async {
        for script in [DemoScript.step2, .step3, .step4, .step5, .step6] {
            let clock = FakeClock(), stages = StageLog()
            await script.run(clock: clock, reduce: true) { stages.seen.append($0) }
            XCTAssertEqual(stages.seen, [script.finalStage])
            XCTAssertEqual(clock.total, 0)
        }
    }

    func testStep6TypingStartsBeforeTheMindmapIsGone() {
        let s = DemoScript.step6
        XCTAssertEqual(s.cues[3], 7.0) // the swing begins
        XCTAssertEqual(s.cues[4], DemoScript.step6TypingStart)
        XCTAssertLessThanOrEqual(s.cues[4], DemoScript.step6SwingEnd) // no empty beat
    }

    func testTheosReasonExplainsTheSFMatch() {
        XCTAssertTrue(Step6Copy.reason.contains("San Francisco"))
        XCTAssertFalse(Step6Copy.reason.contains("\u{2014}"))
        XCTAssertEqual(Step6Copy.query, "coffee in SF")
    }

    func testStep56HaveNoPhoneFrameAndEachPanelIsTilted() throws {
        let file = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Peepl/Screens/Onboarding/OnboardingDemos56.swift")
        let src = try String(contentsOf: file, encoding: .utf8).lowercased()
        for word in ["bezel", "phoneframe", "deviceframe", "peoplestore", "aiclient", "modelcontext"] { XCTAssertFalse(src.contains(word), word) }
        XCTAssertTrue(src.contains(".tilted3d(10, layer: 0)") && src.contains(".tilted3d(10, layer: 1)") && src.contains("layer: 2"))
        for small in ["font(10", "font(11", "font(12", "font(13", "font(14", "mono(1)", "mono(12", "mono(13", "mono(14"] { XCTAssertFalse(src.contains("theme." + small), small) }
    }

    func testScatterIsDeterministic() {
        XCTAssertEqual(Scatter.positions.count, 150)
        XCTAssertEqual(Scatter.positions.map(\.x), Scatter.positions.map(\.x))
        XCTAssertTrue(Scatter.positions.allSatisfy { hypot($0.x, $0.y) <= Scatter.radius })
    }

    func testDemosDoNotTouchTheStoreOrAI() throws {
        let file = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Peepl/Screens/Onboarding/OnboardingDemos.swift")
        let src = try String(contentsOf: file, encoding: .utf8)
        for word in ["PeopleStore", "AIClient", "ModelContext", "@Query", "SwiftData"] { XCTAssertFalse(src.contains(word), word) }
    }
}
