import XCTest
@testable import Peepl

@MainActor
final class NavTests: XCTestCase {
    func testDoubleTapDoesNotStackTheSameScreenTwice() {
        let nav = Nav()
        nav.push(.profile("abby-lin-chen")); nav.push(.profile("abby-lin-chen"))
        XCTAssertEqual(nav.layers, [.profile("abby-lin-chen")])
    }

    func testSameProfileFurtherDownIsAllowed() { // A -> B -> A is a normal trail of mutuals
        let nav = Nav()
        nav.push(.profile("a")); nav.push(.profile("b")); nav.push(.profile("a"))
        XCTAssertEqual(nav.layers.count, 3)
    }
}
