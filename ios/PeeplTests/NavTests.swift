import XCTest
@testable import Peepl

@MainActor
final class NavTests: XCTestCase {
    func testDoubleTapDoesNotStackTheSameScreenTwice() {
        let nav = Nav()
        nav.push(.profile("abby-lin-chen")); nav.push(.profile("abby-lin-chen"))
        XCTAssertEqual(nav.layers, [.profile("abby-lin-chen")])
    }

    func testBannerEdgeFollowsTheScrollUntilItIsTheBar() {
        var pin = HeroPin(height: 228, top: 62, scrolled: -40) // travel 228 - 62 - 56 - 18 = 92
        XCTAssertEqual(pin.lift, 0)
        pin.scrolled = 46; XCTAssertEqual(pin.progress, 0.5)
        pin.scrolled = 500; XCTAssertEqual(pin.lift, 92); XCTAssertEqual(pin.progress, 1)
        pin.height = 0; XCTAssertEqual(pin.progress, 0) // not measured yet
    }

    func testSameProfileFurtherDownIsAllowed() { // A -> B -> A is a normal trail of mutuals
        let nav = Nav()
        nav.push(.profile("a")); nav.push(.profile("b")); nav.push(.profile("a"))
        XCTAssertEqual(nav.layers.count, 3)
    }

    func testReopenedScreenGetsAFreshKey() { // a reused key kept a swiped-away profile's off-screen offset
        let nav = Nav()
        nav.push(.profile("a")); let first = nav.keys
        nav.pop(); nav.push(.profile("a"))
        XCTAssertEqual(nav.keys.count, 1)
        XCTAssertNotEqual(nav.keys, first)
        nav.layers = []; XCTAssertEqual(nav.keys, [])
    }
}
