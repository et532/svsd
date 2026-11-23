import XCTest

/// ONBOARDING.md 6d: after a save, "Add another" starts a fresh note and keeps the keyboard up.
final class AddAnotherUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    func testAddAnotherSavesTwoPeopleInARow() {
        let app = XCUIApplication()
        app.launchArguments = ["-PeeplInMemory", "YES", "-PeeplNoSeed", "YES", "-PeeplSkipOnboarding", "YES", "-PeeplAPIBase", "http://127.0.0.1:9", "-peepl.nameFixes.v1", "{}"]
        app.launch()
        app.buttons["Add someone"].tap()
        let field = app.textFields.matching(identifier: "composer").firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 20))
        field.tap(); _ = app.keyboards.firstMatch.waitForExistence(timeout: 10); sleep(1)
        field.typeText("Just met Sam Rivera, a founder at Acme, at a meetup.")
        app.buttons["Send"].tap()

        let another = app.buttons["addAnother"]
        XCTAssertTrue(another.waitForExistence(timeout: 30))
        XCTAssertTrue(app.buttons["openProfile"].exists)
        XCTAssertFalse(app.staticTexts["1 added"].exists, "the count starts at the second save")
        XCTAssertTrue(app.keyboards.firstMatch.exists, "the keyboard stays up")
        another.tap()
        XCTAssertTrue(app.staticTexts["Tell me about a new person or moment"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.keyboards.firstMatch.exists, "still up after Add another")

        field.typeText("Met Priya Nair at a pottery class, she is a nurse.")
        XCTAssertEqual(field.value as? String, "Met Priya Nair at a pottery class, she is a nurse.", "only the new note is in the box")
        app.buttons["Send"].tap()
        XCTAssertTrue(app.staticTexts["2 added"].waitForExistence(timeout: 30))
        XCTAssertTrue(another.exists)
        app.buttons["Back"].firstMatch.tap() // the X closes Add
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS 'Sam Rivera'")).firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS 'Priya Nair'")).firstMatch.exists)
    }
}
