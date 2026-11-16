import XCTest
@testable import Peepl

final class ForceGraphTests: XCTestCase {
    /// Two 10-node rings, no links between them.
    private func twoClusters(seed: UInt64 = 7) -> ForceGraph {
        let ids = (0..<20).map { "n\($0)" }
        var pairs: [(String, String)] = []
        for c in 0..<2 { for i in 0..<10 { pairs.append(("n\(c * 10 + i)", "n\(c * 10 + (i + 1) % 10)")) } }
        return ForceGraph(ids: ids, pairs: pairs, seed: seed)
    }

    func testDeterministic() {
        let a = twoClusters(), b = twoClusters()
        for _ in 0..<100 { a.step(); b.step() }
        XCTAssertEqual(a.nodes.map(\.x), b.nodes.map(\.x))
        XCTAssertEqual(a.nodes.map(\.y), b.nodes.map(\.y))
    }

    func testLinkedCloserThanUnlinkedAndAlphaDecays() {
        let g = twoClusters()
        for _ in 0..<300 { g.step() }
        XCTAssertLessThan(g.alpha, 0.02)
        func dist(_ i: Int, _ j: Int) -> Double { hypot(g.nodes[i].x - g.nodes[j].x, g.nodes[i].y - g.nodes[j].y) }
        let linked = g.links.map { dist($0.a, $0.b) }.reduce(0, +) / Double(g.links.count)
        var sum = 0.0
        for i in 0..<10 { for j in 10..<20 { sum += dist(i, j) } }
        XCTAssertLessThan(linked, sum / 100)
    }

    func testDegreeAndPinned() {
        let g = twoClusters()
        XCTAssertEqual(g.nodes[0].degree, 2)
        g.nodes[0].pinned = true
        let x = g.nodes[0].x
        for _ in 0..<10 { g.step() }
        XCTAssertEqual(g.nodes[0].x, x)
    }

    func testSetGroupsPullsMembersTogether() {
        let g = twoClusters()
        for _ in 0..<50 { g.step() }
        // Group by parity, ignoring the links' clusters.
        g.setGroups({ Int($0.dropFirst())! % 2 == 0 ? "even" : "odd" }, last: nil)
        XCTAssertEqual(g.alpha, 1)
        for _ in 0..<300 { g.step() }
        func mean(_ grp: String) -> (Double, Double) {
            let m = g.nodes.filter { $0.group == grp }
            return (m.map(\.x).reduce(0, +) / Double(m.count), m.map(\.y).reduce(0, +) / Double(m.count))
        }
        for n in g.nodes {
            let own = mean(n.group), oth = mean(n.group == "even" ? "odd" : "even")
            XCTAssertLessThan(hypot(n.x - own.0, n.y - own.1), hypot(n.x - oth.0, n.y - oth.1))
        }
    }

    func testPrevPositionsKept() {
        let g = ForceGraph(ids: ["a", "b"], pairs: [], prev: ["a": (x: 5, y: 6)])
        XCTAssertEqual(g.nodes[0].x, 5)
        XCTAssertEqual(g.nodes[0].y, 6)
    }

    func testStep500Fast() {
        let ids = (0..<500).map { "p\($0)" }
        let pairs = (0..<500).map { ("p\($0)", "p\(($0 * 7 + 3) % 500)") }.filter { $0.0 != $0.1 }
        let g = ForceGraph(ids: ids, pairs: pairs)
        let t = Date()
        g.step()
        XCTAssertLessThan(Date().timeIntervalSince(t), 0.05)
    }
}
