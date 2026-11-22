import XCTest
@testable import Peepl

final class ConsentTests: XCTestCase {
    override func setUp() {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.protocolClasses = [StubProtocol.self]
        AIClient.session = URLSession(configuration: cfg)
        AIClient.reset()
        AppAttest.override = { "test-token" }
        StubProtocol.requests = 0
        StubProtocol.handler = { _ in (200, Data(#"{"name":"Sam"}"#.utf8)) }
        Consent.defaults = UserDefaults(suiteName: "consent-test")!
        Consent.defaults.removePersistentDomain(forName: "consent-test")
    }
    override func tearDown() {
        Consent.defaults.removePersistentDomain(forName: "consent-test")
        Consent.defaults = .standard
        AIClient.enabled = false
    }

    func testAgreeStoresVersion() {
        XCTAssertFalse(Consent.agreed)
        Consent.agree()
        XCTAssertTrue(Consent.agreed)
        XCTAssertEqual(Consent.defaults.integer(forKey: Consent.key), Consent.currentVersion)
    }

    func testOlderVersionIsNotAgreed() {
        Consent.defaults.set(Consent.currentVersion - 1, forKey: Consent.key)
        XCTAssertFalse(Consent.agreed)
    }

    func testSwitchOnWithoutConsentIsOffAndSendsNothing() async {
        AIClient.enabled = true
        XCTAssertFalse(AIClient.enabled)
        let parsed = await AIClient.parse("Met Sam Park at a gym")
        XCTAssertNil(parsed)
        XCTAssertEqual(StubProtocol.requests, 0)
    }

    func testConsentAndSwitchSendsRequest() async {
        Consent.agree()
        AIClient.enabled = true
        XCTAssertTrue(AIClient.enabled)
        _ = await AIClient.parse("Met Sam Park at a gym")
        XCTAssertEqual(StubProtocol.requests, 1)
    }
}
