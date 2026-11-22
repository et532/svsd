import XCTest

final class BuildInfoTests: XCTestCase {
    func testReleaseMetadata() {
        let info = Bundle.main.infoDictionary ?? [:]
        XCTAssertEqual(info["ITSAppUsesNonExemptEncryption"] as? Bool, false)
        XCTAssertEqual(info["CFBundleShortVersionString"] as? String, "0.9.0")
        XCTAssertEqual(info["CFBundleVersion"] as? String, "1")
    }
}
