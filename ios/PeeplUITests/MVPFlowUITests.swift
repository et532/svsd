import XCTest

/// MVP-1 flows nobody had tapped through: the OpenAI consent sheet in Settings and the losing-touch nudge.
/// Same launch setup as M5FlowUITests: a throwaway store with the 201 sample people and an AI address nothing listens on.
/// Find's "Draft a message" (bubble, Copy Text, Share) is already driven by M5FlowUITests.testFindClimbingDraft.
final class MVPFlowUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-PeeplInMemory", "YES", "-PeeplAPIBase", "http://127.0.0.1:9", "-peepl.nameFixes.v1", "{}"] + extra
        app.launch()
        return app
    }

    func shot(_ name: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    func has(_ app: XCUIApplication, _ text: String, timeout: TimeInterval = 20) -> Bool {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch.waitForExistence(timeout: timeout)
    }

    /// A List toggle spans its whole row; tap the switch itself, at the right end.
    func flip(_ toggle: XCUIElement) { toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap() }

    // MARK: Settings: OpenAI switch asks for consent first

    func testOpenAISwitchAsksForConsent() {
        let app = launch(["-PeeplResetAI", "YES"]) // no consent and the switch off, whatever an earlier run left
        if app.buttons["Connections"].waitForExistence(timeout: 20) { app.buttons["Connections"].tap() }
        let settings = app.buttons["Settings"]
        XCTAssertTrue(settings.waitForExistence(timeout: 20))
        settings.tap()

        let toggle = app.switches["Use OpenAI"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 10))
        for _ in 0..<3 where !toggle.isHittable { app.swipeUp() } // the sheet opens at medium height
        XCTAssertEqual(toggle.value as? String, "0", "off by default")

        // On -> the consent sheet; Not now leaves it off
        flip(toggle)
        XCTAssertTrue(app.staticTexts["Use OpenAI?"].waitForExistence(timeout: 10), "consent sheet")
        shot("MVP-consent")
        app.buttons["Not now, keep OpenAI off"].tap()
        XCTAssertTrue(app.staticTexts["Use OpenAI?"].waitForNonExistence(timeout: 10))
        XCTAssertEqual(toggle.value as? String, "0", "Not now keeps it off")

        // On again -> the sheet again; Agree turns it on
        flip(toggle)
        XCTAssertTrue(app.staticTexts["Use OpenAI?"].waitForExistence(timeout: 10), "asked again, nothing was agreed")
        app.buttons["Agree and turn on OpenAI"].tap()
        XCTAssertTrue(app.staticTexts["Use OpenAI?"].waitForNonExistence(timeout: 10))
        XCTAssertEqual(toggle.value as? String, "1", "Agree turns it on")
        shot("MVP-openai-on")

        // Leave it off, so later UI tests in the same simulator don't run with OpenAI on
        flip(toggle)
        XCTAssertEqual(toggle.value as? String, "0")
        XCTAssertFalse(app.staticTexts["Use OpenAI?"].exists, "turning off needs no consent")
    }

    // MARK: Connections: losing-touch nudge

    /// Jordan Smith is always among the sample people (Diverse.keep) and was last in touch 2023-01-15 (closeness 1, 120 days),
    /// so he is the most overdue and tops "Reach out".
    func testReachOutAndTalkedToday() {
        let app = launch(["-peepl.nudgeSnooze", "{}"]) // no snoozes from earlier runs
        if app.buttons["Connections"].waitForExistence(timeout: 20) { app.buttons["Connections"].tap() }
        XCTAssertTrue(app.staticTexts["Reach out"].waitForExistence(timeout: 20), "the Reach out section")
        let due = NSPredicate(format: "label BEGINSWITH 'Jordan Smith' AND label CONTAINS 'Reach out'")
        let row = app.buttons.matching(due).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10), "Jordan Smith is due, with the dot")
        shot("MVP-reach-out")
        row.tap()

        XCTAssertTrue(app.buttons["More"].waitForExistence(timeout: 20), "his profile")
        XCTAssertTrue(has(app, "Haven't talked in"), "the losing-touch card")
        app.buttons["Talked today"].tap()
        XCTAssertTrue(has(app, "Marked as talked today"))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Haven't talked in")).firstMatch.waitForNonExistence(timeout: 10), "card gone")
        XCTAssertTrue(app.buttons["Talked today"].waitForNonExistence(timeout: 10), "hidden once it is today")
        shot("MVP-talked-today")

        app.buttons["Back"].tap()
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 20), "back on Connections")
        XCTAssertTrue(app.buttons.matching(due).firstMatch.waitForNonExistence(timeout: 10), "no longer due")
    }
}
