import XCTest
@testable import Peepl

final class LocalAINoteTests: XCTestCase {
    let note = "Met Maya Chen at the Kiln pottery night. She is a designer at Kiln, from Bogota, lives in Queens."

    override func tearDown() { AIClient.enabled = false }

    func testInventedFieldsDropped() {
        let d = LocalAI.validated(.init(name: "Maya Park", company: "Acme", does: "designer", from: "Lima", lives: "Queens", met: "at the Zoo"), note: note)
        XCTAssertNil(d.name); XCTAssertNil(d.company); XCTAssertNil(d.from); XCTAssertNil(d.met)
        XCTAssertEqual(d.lives, "Queens"); XCTAssertEqual(d.does, "designer")
    }

    func testLiteralFieldsKept() {
        let d = LocalAI.validated(.init(name: "maya chen", company: "Kiln", from: "Bogota", met: "at the Kiln pottery night", interest: "pottery"), note: note)
        XCTAssertEqual(d.name, "maya chen"); XCTAssertEqual(d.company, "Kiln"); XCTAssertEqual(d.from, "Bogota")
        XCTAssertEqual(d.met, "Kiln pottery night"); XCTAssertEqual(d.remember, "Loves pottery")
    }

    func testModelUnavailableGivesRegexResult() async {
        if LocalAI.isAvailable { return }
        let r = await LocalAI.parseNote(note)
        XCTAssertNil(r)
        let regex = Capture.parsePerson(note, people: [])
        XCTAssertEqual(regex.merged(with: r), regex)
    }

    func testSeamAndLongNote() async {
        let long = String(repeating: "word ", count: 3000) + "Maya Chen"
        var seen = 0
        let d = await LocalAI.parseNote(long, model: { t in seen = t.count; return .init(name: "Maya Chen") })
        XCTAssertLessThan(seen, 1600)
        XCTAssertNil(d?.name) // clipped away, so not in the text the model saw
        let ok = await LocalAI.parseNote(note, model: { _ in .init(name: "Maya Chen") })
        XCTAssertEqual(ok?.name, "Maya Chen")
    }

    func testSwitchOnOpenAIFailureTriesOnDeviceModel() async {
        Consent.agree(); AIClient.enabled = true
        var asked: [String] = []
        let d = await LocalAI.readNote(note, openAI: { _ in asked.append("openai"); return nil },
                                       local: { _ in asked.append("local"); var d = Draft(); d.name = "Maya Chen"; return d })
        XCTAssertEqual(asked, ["openai", "local"])
        XCTAssertEqual(d?.name, "Maya Chen")
    }

    func testSwitchOnOpenAIAnswerSkipsOnDeviceModel() async {
        Consent.agree(); AIClient.enabled = true
        var local = 0
        var o = Draft(); o.company = "Kiln"
        let d = await LocalAI.readNote(note, openAI: { _ in o }, local: { _ in local += 1; return nil })
        XCTAssertEqual(d?.company, "Kiln"); XCTAssertEqual(local, 0)
    }

    func testBothFailGivesRegexResult() async {
        Consent.agree(); AIClient.enabled = true
        let d = await LocalAI.readNote(note, openAI: { _ in nil }, local: { _ in nil })
        XCTAssertNil(d)
        let regex = Capture.parsePerson(note, people: [])
        XCTAssertEqual(regex.merged(with: d), regex)
    }

    func testSwitchOffNeverAsksOpenAI() async {
        AIClient.enabled = false
        var openAI = 0
        _ = await LocalAI.readNote(note, openAI: { _ in openAI += 1; return nil }, local: { _ in nil })
        XCTAssertEqual(openAI, 0)
    }

    func testOpenAISwitchDefaultsOff() {
        // AddView calls AIClient only when this is on, so with it off nothing leaves the phone.
        XCTAssertFalse(AIClient.enabled)
    }
}
