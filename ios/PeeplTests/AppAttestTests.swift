import XCTest
@testable import Peepl

final class AppAttestTests: XCTestCase {
    override func tearDown() { AIClient.enabled = false }
    func testTokenIsReusedUntilFiveMinutesBeforeExpiry() {
        let now = Date()
        XCTAssertTrue(AppAttest.isFresh(now.addingTimeInterval(600), now: now))
        XCTAssertFalse(AppAttest.isFresh(now.addingTimeInterval(299), now: now))
        XCTAssertFalse(AppAttest.isFresh(now.addingTimeInterval(-1), now: now))
    }

    func testSendsBearerAndRetriesOnceOn401() async {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.protocolClasses = [StubProtocol.self]
        AIClient.session = URLSession(configuration: cfg)
        AIClient.reset()
        Consent.agree(); AIClient.enabled = true
        var n = 0
        AppAttest.override = { n += 1; return "t\(n)" }
        var seen: [String?] = []
        StubProtocol.handler = { req in
            seen.append(req.value(forHTTPHeaderField: "authorization"))
            return seen.count == 1 ? (401, Data("{}".utf8)) : (200, Data("{}".utf8))
        }
        let r = await AIClient.send("parse", [:], timeout: 5)
        XCTAssertEqual(r?.1.statusCode, 200)
        XCTAssertEqual(seen, ["Bearer t1", "Bearer t2"])
    }
}
