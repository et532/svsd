import XCTest

final class PrivacyManifestTests: XCTestCase {
    func testManifestDeclaresOptionalOpenAIDataOnly() throws {
        let url = try XCTUnwrap(Bundle.main.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"))
        let m = try XCTUnwrap(PropertyListSerialization.propertyList(from: Data(contentsOf: url), format: nil) as? [String: Any])
        XCTAssertEqual(m["NSPrivacyTracking"] as? Bool, false)
        XCTAssertEqual((m["NSPrivacyTrackingDomains"] as? [Any])?.count, 0)
        let data = try XCTUnwrap(m["NSPrivacyCollectedDataTypes"] as? [[String: Any]])
        let other = try XCTUnwrap(data.first { $0["NSPrivacyCollectedDataType"] as? String == "NSPrivacyCollectedDataTypeOtherUserContent" })
        XCTAssertEqual(other["NSPrivacyCollectedDataTypeLinked"] as? Bool, false)
        XCTAssertEqual(other["NSPrivacyCollectedDataTypeTracking"] as? Bool, false)
        XCTAssertEqual(other["NSPrivacyCollectedDataTypePurposes"] as? [String], ["NSPrivacyCollectedDataTypePurposeAppFunctionality"])
        let apis = try XCTUnwrap(m["NSPrivacyAccessedAPITypes"] as? [[String: Any]])
        XCTAssertEqual(apis.first?["NSPrivacyAccessedAPIType"] as? String, "NSPrivacyAccessedAPICategoryUserDefaults")
        XCTAssertEqual(apis.first?["NSPrivacyAccessedAPITypeReasons"] as? [String], ["CA92.1"])
    }
}
