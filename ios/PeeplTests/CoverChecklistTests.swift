import XCTest
@testable import Peepl

final class CoverChecklistTests: XCTestCase {
    private func defaults() -> UserDefaults {
        let name = "cover-\(UUID().uuidString)"
        let d = UserDefaults(suiteName: name)!
        d.removePersistentDomain(forName: name)
        return d
    }
    private let today = Date(timeIntervalSince1970: 1_795_000_000) // fixed, never Date()

    func testFiveOfSixTick() {
        let t = CoverTicks.update([], text: "Met Sam at Demo Day, three years ago. Founder at Acme. From Austin.", people: [], today: today)
        XCTAssertEqual(t, [.name, .when, .place, .from, .does])
        XCTAssertFalse(t.contains(.remember))
    }

    func testClearingTextKeepsTicks() {
        let t = CoverTicks.update([], text: "Met Sam at Demo Day. From Austin.", people: [], today: today)
        XCTAssertEqual(CoverTicks.update(t, text: "", people: [], today: today), t)
    }

    func testEndsAtThreePeople() {
        let d = defaults()
        XCTAssertFalse(OnboardingState.endCoverIfDone(peopleCount: 2, defaults: d))
        XCTAssertFalse(d.bool(forKey: OnboardingState.firstAddKey))
        XCTAssertTrue(OnboardingState.endCoverIfDone(peopleCount: 3, defaults: d))
        XCTAssertTrue(d.bool(forKey: OnboardingState.firstAddKey))
    }

    func testCoachOnlyEmptyOnceNotReplay() {
        let d = defaults()
        XCTAssertFalse(OnboardingState.shouldCoach(defaults: d, peopleCount: 1, layersEmpty: true))
        XCTAssertFalse(OnboardingState.shouldCoach(defaults: d, peopleCount: 0, layersEmpty: false))
        XCTAssertFalse(OnboardingState.shouldCoach(defaults: d, peopleCount: 0, layersEmpty: true, replay: true))
        XCTAssertTrue(OnboardingState.shouldCoach(defaults: d, peopleCount: 0, layersEmpty: true))
        d.set(true, forKey: OnboardingState.coachKey)
        XCTAssertFalse(OnboardingState.shouldCoach(defaults: d, peopleCount: 0, layersEmpty: true))
    }

    func testMicPrimerDecision() {
        XCTAssertEqual(MicPrimer.action(seen: false, undetermined: true, denied: false), .primer)
        XCTAssertEqual(MicPrimer.action(seen: true, undetermined: true, denied: false), .listen) // never again
        XCTAssertEqual(MicPrimer.action(seen: false, undetermined: false, denied: false), .listen) // only when undetermined
        XCTAssertEqual(MicPrimer.action(seen: true, undetermined: false, denied: true), .deniedLine)
    }
}
