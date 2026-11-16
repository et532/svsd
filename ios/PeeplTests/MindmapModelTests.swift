import XCTest
@testable import Peepl

final class MindmapModelTests: XCTestCase {
    let size = CGSize(width: 393, height: 852)

    func make() -> MindmapModel {
        let m = MindmapModel()
        let ids = ["a", "b", "c", "d", "e"]
        m.sync(ids: ids, pairs: [("a", "b"), ("a", "c"), ("b", "d")], scores: ids.map { ($0, 1) })
        for i in 0..<400 { m.frame(now: Double(i) / 60, size: size) }
        return m
    }

    func run(_ m: MindmapModel, _ frames: Int = 300) { for i in 0..<frames { m.frame(now: 10 + Double(i) / 60, size: size) } }

    func testZoomPastMaxIsResistedAndSettlesBack() {
        let m = make()
        m.k = 3
        m.zoom(at: CGPoint(x: 200, y: 400), factor: 2, size: size)
        XCTAssertGreaterThan(m.k, 3); XCTAssertLessThan(m.k, 3 * 1.25 + 0.001); XCTAssertLessThan(m.k, 6)
        m.settle(size); run(m)
        XCTAssertEqual(m.k, 3, accuracy: 0.01)
        XCTAssertTrue(m.settled)
    }

    func testHit() {
        let m = make()
        let n = m.graph.nodes[4]   // "e" has no links, away from the others
        let p = CGPoint(x: size.width / 2 + m.x + n.x * m.k, y: size.height / 2 + m.y + n.y * m.k)
        XCTAssertEqual(m.hit(p, size: size), "e")
        XCTAssertNil(m.hit(CGPoint(x: -5000, y: -5000), size: size))
    }

    func testDepthIsSelectedPlusDirectLinks() {
        let m = make()
        m.select("a")
        XCTAssertEqual(m.depth, ["a": 0, "b": 1, "c": 1])   // d is two hops away
        m.select(nil)
        XCTAssertTrue(m.depth.isEmpty)
    }

    func testFlyToConverges() {
        let m = make()
        m.flyTo("a", size: size)
        XCTAssertFalse(m.settled)
        run(m)
        XCTAssertGreaterThanOrEqual(m.k, 0.35); XCTAssertLessThanOrEqual(m.k, 1.4)
        XCTAssertTrue(m.settled)
    }
}
