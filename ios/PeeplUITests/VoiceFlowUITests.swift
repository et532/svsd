import XCTest

final class VoiceFlowUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    func shot(_ name: String) {
        let png = XCUIScreen.main.screenshot()
        if let dir = ProcessInfo.processInfo.environment["M4_SHOT_DIR"] {
            try? png.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
        let a = XCTAttachment(screenshot: png); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    func testScriptedVoiceOutlines() {
        let app = XCUIApplication()
        // the empty fixes argument hides the Jorden -> Jordan fix an earlier run saved, which would rewrite the script
        app.launchArguments = ["-PeeplVoiceScript", "Just met Jorden Lee at a climbing gym. Founder at Voltcell, studied at MIT, lives in Brooklyn.",
                               "-peepl.nameFixes.v1", "{}"]
        app.launch()
        app.buttons["Add person"].tap()
        app.buttons["Voice"].tap()
        XCTAssertTrue(app.buttons["Stop"].waitForExistence(timeout: 20))
        usleep(1_500_000); shot("M4-recording")
        // the script (~19 words at 150 ms) may already have finished by itself
        if app.buttons["Stop"].exists { app.buttons["Stop"].tap() }
        for n in ["Jorden", "Lee", "Voltcell", "MIT", "Brooklyn"] {
            XCTAssertTrue(app.buttons["Fix the name \(n)"].waitForExistence(timeout: 20), n)
        }
        shot("M4-outlines")
        app.buttons["Fix the name Jorden"].tap()
        app.typeText("Jordan\n")
        XCTAssertTrue(app.buttons["Fix the name Jordan"].waitForExistence(timeout: 20))
    }

    func testSeveralPeople() {
        let app = XCUIApplication()
        app.launch()
        app.buttons["Add person"].tap()
        let field = app.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 20))
        field.tap()
        field.typeText("Dinner with Mira Solberg and Theo Varga. Mira is a designer at Kiln. Met at dinner.")
        app.buttons["Send"].tap()
        let together = app.staticTexts.containing(NSPredicate(format: "label CONTAINS 'were met together'")).firstMatch
        XCTAssertTrue(together.waitForExistence(timeout: 30))
        XCTAssertTrue(app.staticTexts["Mira Solberg"].exists)
        XCTAssertTrue(app.staticTexts["Theo Varga"].exists)
        shot("M4-several")
    }

    func testSpeechPermissionPrompt() {
        let app = XCUIApplication()
        app.resetAuthorizationStatus(for: .microphone)
        app.launch()
        app.buttons["Add person"].tap()
        app.buttons["Voice"].tap()
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        var seen = false, denied = false
        for round in 1...2 {
            let alert = sb.alerts.firstMatch
            guard alert.waitForExistence(timeout: 5) else { break }
            seen = true
            if round == 1 { shot("M4-permission") }
            print("M4 ALERT \(round): \(alert.label) | buttons: \(alert.buttons.allElementsBoundByIndex.map(\.label))")
            let deny = alert.buttons.matching(NSPredicate(format: "label IN {'Don’t Allow', 'Don\\'t Allow'}")).firstMatch
            if deny.exists { deny.tap(); denied = true } else { break }
        }
        if !seen { print("M4 ALERT: no alert"); shot("M4-permission") }
        let hit = NSPredicate(format: "label CONTAINS 'access is off' OR placeholderValue CONTAINS 'access is off'")
        let el = app.descendants(matching: .any).matching(hit).firstMatch
        let found = el.waitForExistence(timeout: 10)
        print("M4 COMPOSER: found=\(found) \(found ? el.label + " / " + (el.placeholderValue ?? "") : app.textFields.firstMatch.placeholderValue ?? "?")")
        // speech status can't be reset, so a simulator that already answered may show no alert: only assert after our own Don't Allow
        if denied { XCTAssertTrue(found) }
    }
}
