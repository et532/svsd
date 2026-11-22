import XCTest

final class OnboardingUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-PeeplInMemory", "YES", "-PeeplNoSeed", "YES", "-peepl.onboardingDone", "NO", "-PeeplAPIBase", "http://127.0.0.1:9"]
        app.launch()
        return app
    }

    func testGetStartedThroughToTheEmptyList() {
        let app = launch()
        let next = app.buttons["onboardingNext"]
        XCTAssertTrue(app.descendants(matching: .any)["onboardingProgress"].waitForExistence(timeout: 20))
        XCTAssertTrue(next.waitForExistence(timeout: 3))
        XCTAssertTrue(next.isHittable)
        XCTAssertFalse(app.buttons["onboardingBack"].exists); XCTAssertFalse(app.buttons["onboardingSkip"].exists)
        let progress = app.descendants(matching: .any)["onboardingProgress"]
        for n in 1..<8 {
            XCTAssertTrue(next.waitForExistence(timeout: 3))
            XCTAssertTrue(next.isHittable)
            next.tap()
            // wait for the step to change, so a fading old button is never tapped twice
            let moved = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label BEGINSWITH %@", "Step \(n + 1) of 8"), object: progress)
            XCTAssertEqual(XCTWaiter.wait(for: [moved], timeout: 5), .completed)
        }
        XCTAssertTrue(app.staticTexts["Voice notes are turned into text on your phone when your iPhone supports it."].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["onboardingSkip"].exists)
        XCTAssertTrue(next.waitForExistence(timeout: 3))
        XCTAssertEqual(next.label, "Add your first friend")
        next.tap()
        XCTAssertTrue(app.staticTexts["No one here yet"].waitForExistence(timeout: 10))
    }

    func testSkipFromStepTwoLandsOnStepEight() {
        let app = launch()
        let next = app.buttons["onboardingNext"]
        XCTAssertTrue(next.waitForExistence(timeout: 20)); next.tap()
        let skip = app.buttons["onboardingSkip"]
        XCTAssertTrue(skip.waitForExistence(timeout: 5)); skip.tap()
        XCTAssertTrue(app.staticTexts["Voice notes are turned into text on your phone when your iPhone supports it."].waitForExistence(timeout: 5))
        XCTAssertEqual(app.descendants(matching: .any)["onboardingProgress"].label, "Step 8 of 8, Make it yours")
        app.buttons["onboardingBack"].tap()
        XCTAssertTrue(app.staticTexts["Where do you meet people?"].waitForExistence(timeout: 5))
    }
}
