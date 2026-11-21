import XCTest
@testable import Peepl

final class MindmapMathTests: XCTestCase {
    func testLinksDedupeAndDropUnknown() {
        let l = MindmapMath.links([("a", ["b", "a", "zz"]), ("b", ["a", "c"]), ("c", [])])
        XCTAssertEqual(l.map { "\($0.0)-\($0.1)" }, ["a-b", "b-c"])
    }

    func testRadiiTiers() {
        let r = MindmapMath.radii((1...9).map { (id: "p\($0)", score: 10 - $0) })
        XCTAssertEqual(r.values.filter { $0 == 32 }.count, 2)
        XCTAssertEqual(r.values.filter { $0 == 19.2 }.count, 5)   // web: indices 2...6 (brief's 4 medium / 3 small was a miscount)
        XCTAssertEqual(r.values.filter { $0 == 8 }.count, 2)
        XCTAssertEqual(r["p1"], 32)
        let t = MindmapMath.radii([(id: "b", score: 1), (id: "a", score: 1), (id: "c", score: 1)])
        XCTAssertEqual(t["a"], 32)   // tie broken by id; 3 * 0.22 = 0.66 so only index 0 is large
        XCTAssertEqual(t["b"], 19.2)
    }

    func testBendMatchesJS() {
        XCTAssertEqual(MindmapMath.bend("Austin"), 0.11200000000000002, accuracy: 1e-12)
        XCTAssertEqual(MindmapMath.bend("maya"), 0.13599999999999998, accuracy: 1e-12)
        XCTAssertEqual(MindmapMath.bend(""), -0.2, accuracy: 1e-12)
        XCTAssertEqual(MindmapMath.bend("a~depth"), -0.16, accuracy: 1e-12)
    }

    func testInitialsOpacity() {
        let fitK = 0.5
        let full = fitK * pow(3 / fitK, MindmapMath.initialsAt)
        XCTAssertEqual(MindmapMath.initialsOpacity(k: full / 1.25, fitK: fitK), 0, accuracy: 1e-12)
        XCTAssertEqual(MindmapMath.initialsOpacity(k: full, fitK: fitK), 1, accuracy: 1e-12)
        XCTAssertEqual(MindmapMath.initialsOpacity(k: fitK / 2, fitK: fitK), 0)
        var last = -1.0
        for i in 0...20 {
            let o = MindmapMath.initialsOpacity(k: fitK * (0.5 + Double(i) * 0.1), fitK: fitK)
            XCTAssertGreaterThanOrEqual(o, last); last = o
        }
    }

    func testGroups() {
        let g = MindmapMath.groups([("1", "NYC"), ("2", "SF"), ("3", "NYC"), ("4", "LA"), ("5", "SF"), ("6", "NYC")])
        XCTAssertEqual(g.names, ["NYC", "SF", "Other"])
        XCTAssertEqual(g.groupOf["4"], "Other")
        XCTAssertEqual(g.groupOf["2"], "SF")
        XCTAssertEqual(MindmapMath.groups([("1", "A"), ("2", "A")]).names, ["A"])
    }

    func testAuraDepth() {
        let now = Date()
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        func ago(_ d: Int) -> String { f.string(from: now.addingTimeInterval(Double(-d) * 86_400)) }
        XCTAssertEqual(MindmapMath.auraDepth(closeness: 2, lastContacted: ago(1), now: now), 2)
        XCTAssertEqual(MindmapMath.auraDepth(closeness: nil, lastContacted: ago(10), now: now), 3)
        XCTAssertEqual(MindmapMath.auraDepth(closeness: nil, lastContacted: ago(60), now: now), 2)
        XCTAssertEqual(MindmapMath.auraDepth(closeness: nil, lastContacted: ago(300), now: now), 1)
        XCTAssertEqual(MindmapMath.auraDepth(closeness: nil, lastContacted: "", now: now), 1)
    }

    func testFitAndMinK() {
        let ns = [ForceGraph.Node(id: "a", x: -100, y: -50), ForceGraph.Node(id: "b", x: 100, y: 50)]
        let f = MindmapMath.fit(ns, width: 390, height: 800)
        XCTAssertEqual(f.x, 0, accuracy: 1e-9)
        XCTAssertEqual(f.k, 1.6 * min(1.2, min(300 / 290, 470 / 190)), accuracy: 1e-9)
        XCTAssertEqual(MindmapMath.minK(fitK: 1.6), 0.85, accuracy: 1e-12)
    }

    func testFitKeepsFarApartPeopleInFrame() {
        // Two unlinked people sit on opposite sides of the loner ring (~1600 apart).
        let g = ForceGraph(ids: ["a", "b"], pairs: [])
        g.nodes[0].x = -800; g.nodes[1].x = 800; g.nodes[0].y = 0; g.nodes[1].y = 0
        let f = MindmapMath.fit(g.nodes, width: 393, height: 852)
        for n in g.nodes {
            let sx = 393 / 2 + f.x + n.x * f.k
            XCTAssertTrue(sx > 0 && sx < 393, "node at \(sx) is off screen")
        }
    }

    func testGroupOvalsContainMembers() {
        let g = ForceGraph(ids: (0..<12).map { "p\($0)" }, pairs: [("p0", "p1"), ("p1", "p2")])
        g.setGroups({ Int($0.dropFirst())! < 8 ? "A" : "B" }, last: nil)
        for _ in 0..<200 { g.step() }
        let radii = Dictionary(uniqueKeysWithValues: g.nodes.map { ($0.id, 19.2) })
        let ovals = MindmapMath.groupOvals(g.nodes, radii: radii)
        XCTAssertEqual(ovals.count, 2)
        for n in g.nodes {
            let o = ovals[n.group]!, d = MindmapMath.disc(19.2)
            let out = hypot((abs(n.x - o.cx) + d) / (o.w / 2), (abs(n.y - o.cy) + d) / (o.h / 2))
            XCTAssertLessThanOrEqual(out, 0.85 + 1e-9)
        }
    }
}
