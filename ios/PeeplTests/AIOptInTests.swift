import XCTest
@testable import Peepl

private struct ZeroEmbedder: Embedder {
    func embed(_ texts: [String]) async throws -> [[Float]] { texts.map { _ in [1, 0, 0] } }
}

final class AIOptInTests: XCTestCase {
    override func setUp() {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.protocolClasses = [StubProtocol.self]
        AIClient.session = URLSession(configuration: cfg)
        AIClient.reset()
        AIClient.enabled = false
        AppAttest.override = { "test-token" }
        StubProtocol.requests = 0
        StubProtocol.handler = { _ in (200, Data(#"{"name":"Sam","text":"from ai","results":[]}"#.utf8)) }
    }
    override func tearDown() { AIClient.enabled = false }

    func testDefaultIsOff() {
        UserDefaults.standard.removeObject(forKey: AIClient.enabledKey)
        XCTAssertFalse(AIClient.enabled)
    }

    func testOffSendsNothing() async throws {
        var tokenCalls = 0
        AppAttest.override = { tokenCalls += 1; return "t" }
        let parsed = await AIClient.parse("Met Sam Park at a gym")
        XCTAssertNil(parsed)
        let place: [String: Any] = ["city": "A", "lat": 0.0, "lng": 0.0]
        let obj: [String: Any] = ["id": "a", "name": "Zed Quux", "context": "social", "profession": "Baker", "story": "",
            "tags": [], "from": place, "met": place, "livesNow": place, "lastContacted": "2026-01-01", "knows": []]
        let p = try JSONDecoder().decode(PersonInfo.self, from: JSONSerialization.data(withJSONObject: obj))
        let r = AskResult.people(PeopleAnswer(title: "t", matches: [Match(person: p, why: "w")]))
        let out = await AIClient.rank("baker", result: r, people: [p], embedder: ZeroEmbedder())
        if case .people(let a) = out { XCTAssertEqual(a.title, "t") } else { XCTFail() }
        let tpl = await AIClient.draft(p, action: Action(kind: .message, label: "Draft", to: p.name, draft: "template"))
        XCTAssertEqual(tpl, "template")
        let plain = await AIClient.draft(p, action: Action(kind: .message, label: "Draft", to: p.name, draft: ""))
        XCTAssertEqual(plain, "Hey Zed! Hope you’re doing well. Want to catch up soon?")
        XCTAssertEqual(StubProtocol.requests, 0)
        XCTAssertEqual(tokenCalls, 0)
    }

    func testOnSendsRequest() async {
        AIClient.enabled = true
        _ = await AIClient.parse("Met Sam Park at a gym")
        XCTAssertEqual(StubProtocol.requests, 1)
    }
}
