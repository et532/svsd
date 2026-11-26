import XCTest
@testable import Peepl

private struct FakeEmbedder: Embedder {
    func embed(_ texts: [String]) async throws -> [[Float]] { texts.map { _ in [1, 0, 0] } }
}

final class AIRankDraftTests: XCTestCase {
    override func tearDown() { AIClient.enabled = false }
    override func setUp() {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.protocolClasses = [StubProtocol.self]
        AIClient.session = URLSession(configuration: cfg)
        AIClient.reset()
        Consent.agree(); AIClient.enabled = true
        AppAttest.override = { "test-token" }
        StubProtocol.requests = 0
    }

    private func person(_ n: Int) -> PersonInfo {
        let place: [String: Any] = ["city": "Austin", "lat": 30.0, "lng": -97.0]
        let obj: [String: Any] = ["id": "id\(n)", "name": "Zed\(n) Quux\(n)", "context": "social", "profession": "Baker", "story": "Loves bread.",
            "tags": ["baking"], "from": place, "met": place, "livesNow": place, "lastContacted": "2026-01-01", "knows": []]
        return try! JSONDecoder().decode(PersonInfo.self, from: JSONSerialization.data(withJSONObject: obj))
    }
    private func ask(_ matches: [Match]) -> AskResult { .people(PeopleAnswer(title: "t", matches: matches)) }
    private func names(_ r: AskResult) -> [String] { if case .people(let a) = r { return a.matches.map(\.person.id) }; return [] }

    func testRankAddsFitsAfterRuleMatches() async throws {
        let people = (0..<20).map(person)
        let exact = Match(person: people[0], why: "rule")
        var body: [String: Any] = [:]
        StubProtocol.handler = { req in
            body = try JSONSerialization.jsonObject(with: req.bodyData) as! [String: Any]
            return (200, Data(#"{"results":[{"i":0,"fits":true,"why":"bakes"},{"i":1,"fits":false,"why":"no"}]}"#.utf8))
        }
        let out = await AIClient.rank("baker", result: ask([exact]), people: people, embedder: FakeEmbedder())
        guard case .people(let a) = out else { return XCTFail() }
        XCTAssertEqual(a.matches.count, 2)
        XCTAssertEqual(a.matches[0].person.id, "id0")
        XCTAssertEqual(a.matches[1].why, "bakes")
        XCTAssertEqual(a.matches[1].action?.label, "Draft a message")
        XCTAssertEqual(a.title, "2 people for “baker”")
        let cands = body["candidates"] as! [[String: Any]]
        XCTAssertEqual(cands.count, 19) // everyone but the exact match
        let sent = String(data: try JSONSerialization.data(withJSONObject: body), encoding: .utf8)!
        XCTAssertFalse(sent.contains("Zed"))
        XCTAssertFalse(sent.contains("\"id1\""))
    }

    func testRankJudgesEveryoneInBatches() async {
        let people = (0..<45).map(person)
        var sizes: [Int] = []
        let lock = NSLock()
        StubProtocol.handler = { req in
            let n = (try JSONSerialization.jsonObject(with: req.bodyData) as! [String: Any])["candidates"] as! [[String: Any]]
            lock.withLock { sizes.append(n.count) }
            let rows = n.indices.map { #"{"i":\#($0),"fits":true,"why":"bakes"}"# }.joined(separator: ",")
            return (200, Data("{\"results\":[\(rows)]}".utf8))
        }
        let out = await AIClient.rank("baker", result: ask([]), people: people, embedder: FakeEmbedder())
        XCTAssertEqual(sizes.sorted(), [5, 20, 20])
        XCTAssertEqual(Set(names(out)).count, 45) // each batch's answers land on its own people, none dropped
        guard case .people(let a) = out else { return XCTFail() }
        XCTAssertNil(a.note)

        StubProtocol.requests = 0
        StubProtocol.handler = { _ in
            StubProtocol.requests == 1 ? (200, Data(#"{"results":[{"i":0,"fits":true,"why":"bakes"}]}"#.utf8)) : (429, Data("{}".utf8))
        }
        let part = await AIClient.rank("baker", result: ask([]), people: people, embedder: FakeEmbedder())
        guard case .people(let b) = part else { return XCTFail() }
        XCTAssertEqual(b.note, "OpenAI could only check 1 of 45 people.")
    }

    func testRank503LeavesInputAndStopsAsking() async {
        let people = (0..<5).map(person)
        let r = ask([Match(person: people[0], why: "rule")])
        StubProtocol.handler = { _ in (503, Data("{}".utf8)) }
        let a = await AIClient.rank("baker", result: r, people: people, embedder: FakeEmbedder())
        let b = await AIClient.rank("baker", result: r, people: people, embedder: FakeEmbedder())
        XCTAssertEqual(a, r); XCTAssertEqual(b, r)
        XCTAssertEqual(StubProtocol.requests, 1)
    }

    func testRankBadJSONLeavesInput() async {
        let people = (0..<5).map(person)
        let r = ask([Match(person: people[0], why: "rule")])
        StubProtocol.handler = { _ in (200, Data("not json".utf8)) }
        let out = await AIClient.rank("baker", result: r, people: people, embedder: FakeEmbedder())
        XCTAssertEqual(out, r)
    }

    func testRankSkipsNonPeopleResults() async {
        StubProtocol.handler = { _ in (200, Data("{}".utf8)) }
        let out = await AIClient.rank("x", result: .add, people: (0..<3).map(person), embedder: FakeEmbedder())
        XCTAssertEqual(out, .add)
        XCTAssertEqual(StubProtocol.requests, 0)
    }

    func testDraftSuccessAndFallbacks() async {
        let p = person(1)
        let act = Action(kind: .message, label: "Draft", to: p.name, draft: "template")
        StubProtocol.handler = { _ in (200, Data(#"{"text":" Hi Zed1! "}"#.utf8)) }
        let ok = await AIClient.draft(p, action: act)
        XCTAssertEqual(ok, "Hi Zed1!")
        StubProtocol.handler = { _ in (500, Data("{}".utf8)) }
        let failed = await AIClient.draft(p, action: act)
        XCTAssertEqual(failed, "template")
        StubProtocol.handler = { _ in (200, Data(#"{"text":"  "}"#.utf8)) }
        let empty = await AIClient.draft(p, action: Action(kind: .message, label: "Draft", to: p.name, draft: ""))
        XCTAssertEqual(empty, "Hey Zed1! Hope you’re doing well. Want to catch up soon?")
    }
}

private extension URLRequest {
    /// URLProtocol sees the body as a stream.
    var bodyData: Data {
        if let b = httpBody { return b }
        guard let s = httpBodyStream else { return Data() }
        s.open(); defer { s.close() }
        var d = Data(); var buf = [UInt8](repeating: 0, count: 4096)
        while s.hasBytesAvailable { let n = s.read(&buf, maxLength: 4096); if n <= 0 { break }; d.append(buf, count: n) }
        return d
    }
}
