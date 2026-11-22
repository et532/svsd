import XCTest
@testable import Peepl

final class LocalAIStatusTests: XCTestCase {
    func testAvailable() {
        let s = LocalAI.statusLine(reason: nil)
        XCTAssertEqual(s.title, "On")
        XCTAssertTrue(s.detail.contains("Nothing leaves your phone."))
    }

    func testEachReasonKeepsItsTextAndFallbackNote() {
        for r in ["This device can't run Apple Intelligence.", "Apple Intelligence is turned off in Settings.",
                  "Apple Intelligence is still downloading.", "Apple Intelligence isn't available right now.",
                  "This iOS version has no on-device model."] {
            let s = LocalAI.statusLine(reason: r)
            XCTAssertEqual(s.title, r)
            XCTAssertTrue(s.detail.hasPrefix(r))
            XCTAssertTrue(s.detail.hasSuffix("Peepl still works: search and notes use its built-in rules."))
        }
    }
}
