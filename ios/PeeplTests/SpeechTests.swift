import XCTest
@testable import Peepl

private final class ThrowingRecognizer: SpeechRecognizer {
    var level: Float = 0
    func authorize() async -> Bool { true }
    func start(contextualStrings: [String]) throws -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { $0.finish(throwing: SpeechUnavailable()) }
    }
    func stop() {}
}

@MainActor
final class SpeechTests: XCTestCase {
    override func setUp() {
        let suite = UserDefaults(suiteName: "speech-tests")!
        suite.removePersistentDomain(forName: "speech-tests")
        NameFixes.store = suite
    }
    override func tearDown() { NameFixes.store = .standard }

    private func session(_ script: String, delay: Duration = .milliseconds(1), allowed: Bool = true) -> VoiceSession {
        VoiceSession(recognizer: ScriptedRecognizer(script: script, wordDelay: delay, allowed: allowed))
    }

    func testWordsStreamIntoReview() async {
        let s = session("met Sam at the gym")
        await s.start(names: [])
        XCTAssertEqual(s.state, .review)
        XCTAssertEqual(s.text, "met Sam at the gym")
    }

    func testSavedFixAppliedAndListed() async {
        NameFixes.saveFix(heard: "Jorden", meant: "Jordan")
        let s = session("met Jorden Lee today")
        await s.start(names: [])
        XCTAssertEqual(s.text, "met Jordan Lee today")
        XCTAssertEqual(s.fixed.map(\.heard), ["Jorden"])
        XCTAssertEqual(s.fixed.map(\.meant), ["Jordan"])
    }

    func testDenied() async {
        let s = session("hello", allowed: false)
        await s.start(names: [])
        XCTAssertEqual(s.state, .idle)
        XCTAssertEqual(s.message, "Microphone or speech access is off. Allow it in Settings, or type.")
    }

    func testRecognizerErrorWithNoWords() async {
        let s = VoiceSession(recognizer: ThrowingRecognizer())
        await s.start(names: [])
        XCTAssertEqual(s.state, .idle)
        XCTAssertEqual(s.message, "Voice is not working right now. Type instead.")
    }

    func testStopMidStream() async {
        let s = session("one two three four five six seven eight", delay: .milliseconds(40))
        let run = Task { await s.start(names: []) }
        try? await Task.sleep(for: .milliseconds(120))
        s.stop()
        await run.value
        XCTAssertEqual(s.state, .review)
        XCTAssertFalse(s.text.isEmpty)
        XCTAssertLessThan(s.text.split(separator: " ").count, 8)
    }

    func testReset() async {
        let s = session("hello there")
        await s.start(names: [])
        s.reset()
        XCTAssertEqual(s.state, .idle)
        XCTAssertEqual(s.text, "")
        XCTAssertTrue(s.fixed.isEmpty)
    }
}
