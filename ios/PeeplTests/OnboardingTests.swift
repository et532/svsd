import XCTest
@testable import Peepl

final class OnboardingTests: XCTestCase {
    private func defaults() -> UserDefaults {
        let name = "onboarding-\(UUID().uuidString)"
        let d = UserDefaults(suiteName: name)!
        d.removePersistentDomain(forName: name)
        return d
    }

    func testEmptyAndUnsetShows() {
        XCTAssertTrue(OnboardingState.shouldShow(defaults: defaults(), peopleCount: 0))
    }

    func testPeopleHideAndSetDone() {
        let d = defaults()
        XCTAssertFalse(OnboardingState.shouldShow(defaults: d, peopleCount: 3))
        XCTAssertTrue(d.bool(forKey: OnboardingState.doneKey))
        XCTAssertFalse(OnboardingState.shouldShow(defaults: d, peopleCount: 0)) // everyone deleted later: still done
    }

    func testSkipFlagHidesWithoutSettingDone() {
        let d = defaults(); d.set(true, forKey: OnboardingState.skipKey)
        XCTAssertFalse(OnboardingState.shouldShow(defaults: d, peopleCount: 0))
        XCTAssertFalse(d.bool(forKey: OnboardingState.doneKey))
    }

    func testDoneFlagHidesAndPersists() {
        let d = defaults(); d.set(true, forKey: OnboardingState.doneKey)
        XCTAssertFalse(OnboardingState.shouldShow(defaults: d, peopleCount: 0))
    }

    func testProgressFractions() {
        XCTAssertEqual(OnboardingState.progressFractions(step: 1), [0.25, 0, 0])
        XCTAssertEqual(OnboardingState.progressFractions(step: 4), [1, 0, 0])
        XCTAssertEqual(OnboardingState.progressFractions(step: 5), [1, 0.5, 0])
        XCTAssertEqual(OnboardingState.progressFractions(step: 6), [1, 1, 0])
        XCTAssertEqual(OnboardingState.progressFractions(step: 7), [1, 1, 0.5])
        XCTAssertEqual(OnboardingState.progressFractions(step: 8), [1, 1, 1])
        XCTAssertEqual(OnboardingState.segmentWeights, [4, 2, 2])
    }

    func testActTitles() {
        XCTAssertEqual((1...8).map { OnboardingState.actTitle(step: $0) },
                       Array(repeating: "The story", count: 4) + Array(repeating: "Learn by doing", count: 2) + Array(repeating: "Make it yours", count: 2))
    }

    func testNavigation() {
        XCTAssertEqual(OnboardingState.skip(3), 8)
        XCTAssertEqual(OnboardingState.back(8), 7)
        XCTAssertEqual(OnboardingState.next(8), 8)
        XCTAssertFalse(OnboardingState.canBack(1)); XCTAssertFalse(OnboardingState.canSkip(1))
        XCTAssertTrue(OnboardingState.canBack(2)); XCTAssertTrue(OnboardingState.canSkip(2)); XCTAssertTrue(OnboardingState.canSkip(7))
        XCTAssertFalse(OnboardingState.canSkip(8)); XCTAssertTrue(OnboardingState.canBack(8))
    }

    func testMeetWhereStoresRawValues() {
        let d = defaults()
        MeetWhere.save([.coffee, .newcity], d)
        XCTAssertEqual(d.stringArray(forKey: OnboardingState.meetWhereKey), ["coffee", "newcity"])
        XCTAssertEqual(MeetWhere.saved(d), [.coffee, .newcity])
        XCTAssertEqual(MeetWhere.allCases.map(\.rawValue), ["events", "coffee", "campus", "community", "newcity"])
        XCTAssertEqual(MeetWhere.campus.addPlaceholder, "Who did you meet in class?")
        XCTAssertEqual(MeetWhere.newcity.findCard.shown, "Someone who knows this city")
    }
}
