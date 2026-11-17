import XCTest

/// M5: every flow of the web prototype, driven end to end. Each launch has its own throwaway store (the 201 sample
/// people) and an AI address nothing listens on, so the app uses its rules and templates and no test touches the network.
final class M5FlowUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-PeeplInMemory", "YES", "-PeeplAPIBase", "http://127.0.0.1:9", "-peepl.nameFixes.v1", "{}"] + extra
        app.launch()
        return app
    }

    func shot(_ name: String) {
        let png = XCUIScreen.main.screenshot()
        if let dir = ProcessInfo.processInfo.environment["M5_SHOT_DIR"] {
            try? png.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
        let a = XCTAttachment(screenshot: png); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    func has(_ app: XCUIApplication, _ text: String, timeout: TimeInterval = 20) -> Bool {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch.waitForExistence(timeout: timeout)
    }

    /// The composer of the screen on top (the screens under it keep theirs).
    func composer(_ app: XCUIApplication) -> XCUIElement {
        let all = app.textFields.matching(identifier: "composer")
        _ = all.firstMatch.waitForExistence(timeout: 20)
        return all.element(boundBy: all.count - 1)
    }

    /// Types into the composer and sends.
    func send(_ app: XCUIApplication, _ text: String) {
        let field = composer(app)
        XCTAssertTrue(field.waitForExistence(timeout: 20))
        field.tap(); _ = app.keyboards.firstMatch.waitForExistence(timeout: 10); sleep(1)
        field.typeText(text)
        app.buttons["Send"].tap()
    }

    /// Find's "open X" hands off to their profile.
    func openProfile(_ app: XCUIApplication, _ name: String) {
        send(app, "open \(name)")
        XCTAssertTrue(app.buttons["More"].waitForExistence(timeout: 20), "profile of \(name)")
    }

    // MARK: profile

    func testProfileTodoTagConnectionsDelete() {
        let app = launch(["-findQuery", "open Jordan Lee"]) // Find -> "Opening Jordan Lee…" -> profile
        XCTAssertTrue(app.buttons["More"].waitForExistence(timeout: 30))

        shot("M5-profile-top")
        // a to-do ticks off, and stays ticked
        let todo = app.buttons["Intro to someone in hardware"]
        XCTAssertEqual(todo.value as? String, "To do")
        todo.tap()
        XCTAssertEqual(todo.value as? String, "Done")

        // "Add something to do" turns into a field; Return saves
        app.buttons["Add something to do"].tap()
        let todoField = app.textFields["Something to do with Jordan"]
        XCTAssertTrue(todoField.waitForExistence(timeout: 10))
        todoField.typeText("Send the route map\n")
        XCTAssertTrue(app.buttons["Send the route map"].waitForExistence(timeout: 10))

        // "+ tag": ideas from other people's tags show, typing one saves it lower-cased
        app.buttons["Add tag"].tap()
        let tagField = app.textFields["New tag"]
        XCTAssertTrue(tagField.waitForExistence(timeout: 10))
        tagField.typeText("Bouldering\n")
        XCTAssertTrue(app.staticTexts["bouldering"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Add tag"].exists)
        shot("M5-profile")

        // moments: the first-meeting note opens and closes
        XCTAssertTrue(app.buttons["Add mutual"].exists)
        let moment = app.buttons.matching(NSPredicate(format: "value IN {'Open', 'Closed'}")).firstMatch
        XCTAssertTrue(moment.exists)
        let was = moment.value as? String
        moment.tap()
        XCTAssertNotEqual(moment.value as? String, was)
        shot("M5-profile-moments")

        // "View connections": the mindmap focused on Jordan, with a pill back to the profile
        app.buttons["View connections"].tap()
        XCTAssertTrue(app.buttons["Back to Jordan"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["View Jordan Lee"].waitForExistence(timeout: 10), "the mindmap's name pill")
        sleep(2); shot("M5-view-connections")
        app.buttons["View Jordan Lee"].tap() // the pill opens the profile
        XCTAssertTrue(app.buttons["More"].waitForExistence(timeout: 10))
        app.buttons["Back"].tap()
        app.buttons["Back to Jordan"].tap()
        XCTAssertTrue(app.buttons["More"].waitForExistence(timeout: 10))
        shot("M5-debug")
        XCTAssertEqual(app.buttons["Intro to someone in hardware"].value as? String, "Done")

        // ⋯ -> Delete person, with a confirmation
        app.buttons["More"].tap()
        XCTAssertTrue(app.buttons["Delete person"].waitForExistence(timeout: 10))
        shot("M5-delete-confirm")
        app.buttons["Delete person"].tap()
        XCTAssertTrue(has(app, "Jordan deleted"))
        XCTAssertFalse(app.buttons["More"].waitForExistence(timeout: 2), "the profile is gone")

        // gone from Find, and from the mutuals of the person who knew them
        XCTAssertTrue(app.textFields["Add a moment"].waitForNonExistence(timeout: 10), "the deleted profile has slid away")
        app.buttons["Ask me about people"].tap() // -findQuery makes every Find ask "open Jordan Lee" itself
        XCTAssertTrue(app.textFields["Add a moment"].waitForExistence(timeout: 20)) // a first name alone finds Jordan Smith, as on the web
        XCTAssertFalse(app.staticTexts["Jordan Lee"].exists, "Jordan Lee can't be opened any more")
        while app.buttons.matching(identifier: "Back").count > 0, !app.buttons["Connections"].isHittable { app.buttons["Back"].firstMatch.tap(); sleep(1) } // profile, then Find
        // links to the deleted person are removed from everyone else: PeopleStoreTests.testDeletePerson…
        shot("M5-deleted")
    }

    func testAddMutualLinksBothWays() {
        let app = launch(["-findQuery", "open Jordan Lee"])
        XCTAssertTrue(app.buttons["More"].waitForExistence(timeout: 30))
        app.buttons["Add mutual"].tap()
        XCTAssertTrue(app.staticTexts["Who does Jordan know?"].waitForExistence(timeout: 10))
        send(app, "Met Rae Okonjo at a dinner, designer at Kiln")
        let card = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Rae Okonjo'")).firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 30))
        card.tap()
        XCTAssertTrue(app.buttons["More"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Jordan Lee"].exists, "Jordan is Rae's mutual")
        app.swipeUp() // the mutuals sit below the composer until scrolled
        app.buttons["Jordan Lee"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)).tap() // XCUI reports the whole cell as not hittable
        XCTAssertTrue(app.buttons["Rae Okonjo"].waitForExistence(timeout: 10), "Rae is Jordan's mutual")
        shot("M5-add-mutual")
    }

    // MARK: Find

    func testFindClimbingDraft() {
        let app = launch(["-findQuery", "I want to find someone to go climbing with me"])
        let draft = app.buttons["Draft a message"].firstMatch
        XCTAssertTrue(draft.waitForExistence(timeout: 60))
        XCTAssertTrue(has(app, "Jordan Lee")); XCTAssertTrue(has(app, "Zara Ahmed"))
        draft.tap()
        let message = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Message' AND value CONTAINS 'Jordan'")).firstMatch
        XCTAssertTrue(message.waitForExistence(timeout: 20), "the draft, opened inline")
        message.tap(); message.typeText(" Tuesday?") // it is editable
        XCTAssertTrue((message.value as? String ?? "").contains("Tuesday?"))
        shot("M5-find-draft")
        app.buttons["Copy Text"].tap()
        XCTAssertTrue(has(app, "Draft for Jordan ready"))
        XCTAssertTrue(app.buttons["Share"].exists)
    }

    /// Copying a draft counts as sending it: the follow-up it answers is ticked off on the profile.
    func testCopyTicksTheTodoItCloses() {
        let app = launch(["-findQuery", "I just met a founder looking for a hardware engineer. Who can I introduce?"])
        let intro = app.buttons["Draft intro"].firstMatch
        XCTAssertTrue(intro.waitForExistence(timeout: 60))
        intro.tap()
        XCTAssertTrue(app.buttons["Copy Text"].waitForExistence(timeout: 20))
        sleep(1) // the draft is written (the template: nothing answers at the AI address)
        app.buttons["Copy Text"].tap()
        XCTAssertTrue(has(app, "Draft for Ana ready"))
        openProfile(app, "Jordan Lee")
        XCTAssertEqual(app.buttons["Intro to someone in hardware"].value as? String, "Done")
        shot("M5-find-closes-todo")
    }

    func testShowAllFiltersTheListAndTheMindmap() {
        let app = launch(["-findQuery", "I want to find someone to go climbing with me"])
        let show = app.buttons["Show all 2 in your list"]
        XCTAssertTrue(show.waitForExistence(timeout: 60))
        show.tap()
        XCTAssertTrue(app.buttons["Clear filter"].waitForExistence(timeout: 10))
        XCTAssertTrue(has(app, "· 2"), "the pill above the ask bar")
        let rows = app.buttons.matching(NSPredicate(format: "label CONTAINS ' · ' AND NOT label CONTAINS '· 2'"))
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Jordan Lee'")).firstMatch.exists)
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Zara Ahmed'")).firstMatch.exists)
        XCTAssertEqual(rows.count, 2, "only the two climbers are listed")
        shot("M5-show-all")
        app.buttons["Mindmap"].tap()
        XCTAssertTrue(app.buttons["Clear filter"].exists)
        sleep(2); shot("M5-show-all-mindmap")
        app.buttons["Connections"].tap()
        app.buttons["Clear filter"].tap()
        XCTAssertFalse(app.buttons["Clear filter"].exists)
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Adam Brodsky'")).firstMatch.waitForExistence(timeout: 10), "everyone is back")
    }

    func testNoMatchOffersClosestAndAdd() {
        let app = launch(["-findQuery", "portrait photographer in New York"])
        XCTAssertTrue(has(app, "so I won’t guess", timeout: 60))
        XCTAssertTrue(has(app, "CLOSEST, BUT NOT QUITE"))
        shot("M5-no-match")
        app.buttons["Add someone new"].tap()
        XCTAssertTrue(app.staticTexts["Tell me about a new person or moment"].waitForExistence(timeout: 10))
    }

    func testFindExampleCardAndHandOffToAdd() {
        let app = launch()
        app.buttons["Ask me about people"].tap()
        let card = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Someone to go climbing with'")).firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        card.tap()
        XCTAssertTrue(app.buttons["Draft a message"].firstMatch.waitForExistence(timeout: 60))
        send(app, "add someone new")
        XCTAssertTrue(app.staticTexts["Tell me about a new person or moment"].waitForExistence(timeout: 20))
    }

    func testAskBarMicListensInFind() {
        let app = launch(["-PeeplVoiceScript", "I want to find someone to go climbing with me"])
        app.buttons["Ask by voice"].tap()
        XCTAssertTrue(app.buttons["Send"].waitForExistence(timeout: 30), "what was heard is in the field, ready to send")
        app.buttons["Send"].tap()
        XCTAssertTrue(app.buttons["Draft a message"].firstMatch.waitForExistence(timeout: 60))
    }

    // MARK: Add

    func testTypedAddOutlinesNames() {
        let app = launch()
        app.buttons["Add person"].tap()
        let field = composer(app)
        XCTAssertTrue(field.waitForExistence(timeout: 20))
        field.tap()
        field.typeText("Just met Sally Gallagher, a founder at Voltcell, at a climbing gym. She studied at MIT, lives in Brooklyn.")
        XCTAssertTrue(has(app, "Names found: Sally Gallagher, Voltcell, MIT, Brooklyn"), "outlined while typing")
        shot("M5-add-outlines")
        app.buttons["Send"].tap()
        let card = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Sally Gallagher'")).firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 30))
        shot("M5-add-result")
        card.tap()
        XCTAssertTrue(app.buttons["Add something to do"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Things to do with Sally"].exists)
        XCTAssertTrue(app.buttons["Add mutual"].exists)
    }

    func testMomentWithSomeoneYouKnowOpensExpanded() {
        let app = launch()
        app.buttons["Add person"].tap()
        send(app, "Grabbed coffee with Jordan Smith. Need to send him the gym schedule.")
        XCTAssertTrue(has(app, "New moment saved"))
        XCTAssertTrue(app.buttons["More"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS 'Grabbed coffee with Jordan Smith' AND value == 'Open'")).firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Need to send him the gym schedule"].exists, "the follow-up became a to-do")
        shot("M5-moment-saved")
    }

    func testMicDeniedMessageShowsOverTypedText() {
        let app = launch(["-PeeplVoiceDenied", "YES"])
        app.buttons["Add person"].tap()
        let field = composer(app)
        XCTAssertTrue(field.waitForExistence(timeout: 20))
        field.tap(); field.typeText("Met Sam Rivera at a meetup")
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10)); sleep(1) // the typing has settled before the mic is tapped
        app.buttons["Voice"].tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'access is off'")).firstMatch.waitForExistence(timeout: 20))
        XCTAssertEqual(field.value as? String, "Met Sam Rivera at a meetup")
        shot("M5-mic-denied")
    }

    // MARK: nobody yet

    func testEmptyState() {
        let app = launch(["-PeeplNoSeed", "YES"])
        XCTAssertTrue(app.staticTexts["No one here yet"].waitForExistence(timeout: 20))
        shot("M5-empty-list")
        app.buttons["Mindmap"].tap()
        XCTAssertTrue(app.staticTexts["No one here yet"].waitForExistence(timeout: 10))
        shot("M5-empty-mindmap")
        app.buttons["Add someone"].tap()
        XCTAssertTrue(app.staticTexts["Tell me about a new person or moment"].waitForExistence(timeout: 10))
    }
}
