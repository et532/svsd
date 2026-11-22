import XCTest
@testable import Peepl

final class StubProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (Int, Data))?
    static var requests = 0
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requests += 1
        do {
            let (code, body) = try Self.handler!(request)
            client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

final class AIClientTests: XCTestCase {
    override func tearDown() { AIClient.enabled = false }
    override func setUp() {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.protocolClasses = [StubProtocol.self]
        AIClient.session = URLSession(configuration: cfg)
        AIClient.reset()
        AIClient.enabled = true
        AppAttest.override = { "test-token" }
        StubProtocol.requests = 0
    }

    private func answer(_ obj: [String: Any?], note: String = "Met Dr. Sam Park at a climbing gym, he lives in Austin") async -> Draft? {
        StubProtocol.handler = { _ in (200, try JSONSerialization.data(withJSONObject: obj.mapValues { $0 ?? NSNull() })) }
        return await AIClient.parse(note)
    }

    func testGoodAnswerIsValidated() async {
        StubProtocol.handler = { req in
            XCTAssertEqual(req.httpMethod, "POST")
            XCTAssertTrue(req.url!.path.hasSuffix("/api/ai/parse"))
            XCTAssertEqual(req.value(forHTTPHeaderField: "content-type"), "application/json")
            return (200, try JSONSerialization.data(withJSONObject: ["name": "Dr. Sam Park", "lives": "Austin", "met": "at a climbing gym", "goal": "run a marathon", "does": NSNull()]))
        }
        let d = await AIClient.parse("Met Dr. Sam Park at a climbing gym, he lives in Austin")
        XCTAssertEqual(d?.name, "Sam Park")
        XCTAssertEqual(d?.lives, "Austin")
        XCTAssertEqual(d?.met, "climbing gym")
        XCTAssertEqual(d?.goal, "Wants to run a marathon")
        XCTAssertNil(d?.does)
    }

    func testMadeUpNameIsDropped() async {
        let d = await answer(["name": "Jamie Fox", "company": "Voltcell"])
        XCTAssertNil(d?.name)
        XCTAssertNil(d?.company)
    }

    func testInterestGetsLoves() async {
        let d = await answer(["remember": "rock climbing", "follow": "send the photos"])
        XCTAssertEqual(d?.remember, "Loves rock climbing")
        XCTAssertEqual(d?.follow, "send the photos")
        let e = await answer(["remember": "loves chess", "goal": "wants to teach"])
        XCTAssertEqual(e?.remember, "loves chess")
        XCTAssertEqual(e?.goal, "wants to teach")
    }

    func testLongFieldsAreCut() async {
        let d = await answer(["follow": String(repeating: "word ", count: 20)])
        XCTAssertLessThanOrEqual(d?.follow?.count ?? 99, 45)
        XCTAssertTrue(d?.follow?.hasSuffix("…") ?? false)
    }

    func test503StopsAsking() async {
        StubProtocol.handler = { _ in (503, Data("{}".utf8)) }
        let a = await AIClient.parse("hello there")
        let b = await AIClient.parse("hello again")
        XCTAssertNil(a); XCTAssertNil(b)
        XCTAssertEqual(StubProtocol.requests, 1)
    }

    func testNetworkErrorAndGarbageGiveNil() async {
        StubProtocol.handler = { _ in throw URLError(.timedOut) }
        let a = await AIClient.parse("hello")
        XCTAssertNil(a)
        StubProtocol.handler = { _ in (200, Data("not json".utf8)) }
        let b = await AIClient.parse("hello")
        XCTAssertNil(b)
        StubProtocol.handler = { _ in (500, Data("{}".utf8)) }
        let c = await AIClient.parse("hello")
        XCTAssertNil(c)
    }
}
