import XCTest
@testable import Peepl

final class LocalAIDraftTests: XCTestCase {
    var person: PersonInfo { PersonInfo.sample().first! }
    var action: Action { Action(kind: .message, label: "Draft a message", to: person.name, draft: "") }
    var template: String { "Hey \(person.firstName)! Hope you’re doing well. Want to catch up soon?" }

    override func tearDown() { AIClient.enabled = false }

    func testCleanDraft() {
        XCTAssertEqual(LocalAI.cleanDraft("  \"Hi Maya!\"\n"), "Hi Maya!")
        XCTAssertEqual(LocalAI.cleanDraft("“Hi Maya”"), "Hi Maya")
        XCTAssertEqual(LocalAI.cleanDraft("   "), "")
    }

    func testUnavailableGivesTemplate() async {
        AIClient.enabled = false
        if LocalAI.isAvailable { return }
        let d = await LocalAI.draft(person, action: action)
        XCTAssertNil(d)
        let m = await LocalAI.message(person, action: action)
        XCTAssertEqual(m, template)
    }

    func testModelReplyUsedWhenItNamesThePerson() async {
        AIClient.enabled = false
        let r = "\"Hey \(person.firstName), want to grab coffee?\""
        let m = await LocalAI.message(person, action: action, local: { p, a in await LocalAI.draft(p, action: a, model: { _, _ in r }) })
        XCTAssertEqual(m, "Hey \(person.firstName), want to grab coffee?")
    }

    func testWrongNameOrEmptyFallsBack() async {
        AIClient.enabled = false
        for r in ["Hey Zzyzx, coffee?", "", "  "] {
            let m = await LocalAI.message(person, action: action, local: { p, a in await LocalAI.draft(p, action: a, model: { _, _ in r }) })
            XCTAssertEqual(m, template)
        }
    }

    func testSwitchOnKeepsOpenAIPath() async {
        AIClient.enabled = true
        var local = 0
        let name = person.firstName
        let m = await LocalAI.message(person, action: action, openAI: { _, _ in "from openai" }, local: { _, _ in local += 1; return "x \(name)" })
        XCTAssertEqual(m, "from openai"); XCTAssertEqual(local, 0)
    }
}
