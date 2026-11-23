import XCTest
@testable import Peepl

/// ONBOARDING.md 6d / 6e / section 5 and the replay rule.
final class PlopTests: XCTestCase {
    private func suite() -> UserDefaults {
        let name = "peepl.test.\(UUID().uuidString)"
        let d = UserDefaults(suiteName: name)!; d.removePersistentDomain(forName: name); return d
    }

    // MARK: ForceGraph seeding

    func testNewNodeStartsNearItsMutuals() {
        let old = ForceGraph(ids: ["a", "b", "c", "d"], pairs: [("a", "b"), ("c", "d")])
        for _ in 0..<200 { old.step() }
        var prev: [String: (x: Double, y: Double)] = [:]
        for n in old.nodes { prev[n.id] = (n.x, n.y) }
        let g = ForceGraph(ids: ["a", "b", "c", "d", "new"], pairs: [("a", "b"), ("c", "d"), ("new", "c"), ("new", "d")], prev: prev)
        let cx = (prev["c"]!.x + prev["d"]!.x) / 2, cy = (prev["c"]!.y + prev["d"]!.y) / 2
        let n = g.nodes[g.index["new"]!]
        XCTAssertLessThan(hypot(n.x - cx, n.y - cy), 100)
        XCTAssertEqual(g.nodes[0].x, prev["a"]!.x) // existing nodes keep their spot
    }

    func testNewNodeWithoutLinksUsesTheSpiral() {
        let g = ForceGraph(ids: ["a", "loner"], pairs: [], prev: ["a": (500, 500)])
        let n = g.nodes[1]
        XCTAssertLessThan(hypot(n.x, n.y), 100) // near the centre, not at a
    }

    func testTwoNewPeopleLinkedToEachOtherAndAnOldOne() {
        let g = ForceGraph(ids: ["a", "x", "y"], pairs: [("a", "x"), ("x", "y")], prev: ["a": (300, -200)])
        XCTAssertLessThan(hypot(g.nodes[2].x - 300, g.nodes[2].y + 200), 100) // y follows x, which follows a
    }

    // MARK: queue and draw parameters

    func testQueueIsSpacedAndCappedAtThree() {
        let m = MindmapModel()
        m.plop(["a", "b", "c", "d", "e"], now: 100)
        XCTAssertEqual(m.born["a"]?.t, 100)
        XCTAssertEqual(m.born["b"]!.t, 100.35, accuracy: 1e-9)
        XCTAssertEqual(m.born["c"]!.t, 100.70, accuracy: 1e-9)
        XCTAssertEqual([m.born["a"]!.full, m.born["c"]!.full, m.born["d"]!.full, m.born["e"]!.full], [true, true, false, false])
        XCTAssertFalse(m.settled)
    }

    func testPlopLookMotion() {
        XCTAssertEqual(Plop.look(age: -0.1, full: true, reduce: false).scale, 0)
        XCTAssertEqual(Plop.look(age: -0.1, full: true, reduce: false).opacity, 0)
        let early = Plop.look(age: 0.15, full: true, reduce: false)
        XCTAssertEqual(early.rings.count, 2) // second ring at +120 ms
        XCTAssertTrue(Plop.look(age: 0.05, full: true, reduce: false).rings.count == 1)
        XCTAssertTrue((1.05...1.2).contains([0.1, 0.2, 0.3, 0.4, 0.5].map { Plop.look(age: $0, full: true, reduce: false).scale }.max()!)) // overshoots
        let end = Plop.look(age: 0.65, full: true, reduce: false).rings
        XCTAssertLessThanOrEqual(end.map(\.radius).max()!, 2.2)
        XCTAssertTrue(Plop.look(age: 0.9, full: true, reduce: false).rings.isEmpty)
        XCTAssertEqual(Plop.look(age: 1.2, full: true, reduce: false).scale, 1, accuracy: 0.02)
    }

    func testReduceMotionIsAPlainFade() {
        for age in [0.05, 0.1, 0.2, 0.5] {
            let l = Plop.look(age: age, full: true, reduce: true)
            XCTAssertEqual(l.scale, 1); XCTAssertTrue(l.rings.isEmpty)
            XCTAssertEqual(l.opacity, min(1, age / 0.2), accuracy: 1e-9)
        }
        XCTAssertEqual(Plop.nudge(distance: 10, discR: 50, reduce: true), 0)
        XCTAssertEqual(Plop.link(age: 0.1, index: 2, full: true, reduce: true).trim, 1)
        XCTAssertTrue(Plop.look(age: 0.3, full: false, reduce: false).rings.isEmpty) // past the cap: fade only
    }

    func testLinksDrawInStaggeredAndNudgeIsBounded() {
        XCTAssertEqual(Plop.link(age: 0.25, index: 0, full: true, reduce: false).trim, 0.5, accuracy: 1e-9)
        XCTAssertEqual(Plop.link(age: 0.25, index: 1, full: true, reduce: false).trim, 0.3, accuracy: 1e-9)
        XCTAssertEqual(Plop.link(age: 0.6, index: 0, full: true, reduce: false).trim, 1)
        XCTAssertLessThanOrEqual(Plop.nudge(distance: 40, discR: 50, reduce: false), 10)
        XCTAssertEqual(Plop.nudge(distance: 50, discR: 50, reduce: false), 10)
        XCTAssertEqual(Plop.nudge(distance: 81, discR: 50, reduce: false), 0)
    }

    func testPlopPushesNeighboursThroughTheFloatSpringNotTheLayout() {
        let m = MindmapModel()
        m.reduceMotion = false
        let ids = ["a", "b", "c"]
        m.sync(ids: ids, pairs: [("a", "b"), ("b", "c")], scores: ids.map { ($0, 1) })
        let size = CGSize(width: 393, height: 852)
        for i in 0..<400 { m.frame(now: Double(i) / 60, size: size) }
        let before = m.graph.nodes.map(\.x)
        m.graph.nodes[1].x = m.graph.nodes[0].x + 20; m.graph.nodes[1].y = m.graph.nodes[0].y
        m.plop(["a"], now: 50)
        m.frame(now: 50.01, size: size)
        XCTAssertNotEqual(m.dots[1].vx, 0)
        XCTAssertEqual(m.graph.nodes[2].x, before[2], accuracy: 1) // layout untouched by the nudge itself
    }

    // MARK: Add another

    func testAddAnotherClearsNoteAndTicksButKeepsTheCount() {
        var s = AddSession(note: "Met Sam", ticked: [.name, .place], saved: 1)
        XCTAssertNil(s.countLine)
        s.saved += 1; s.another()
        XCTAssertEqual(s.note, ""); XCTAssertTrue(s.ticked.isEmpty)
        XCTAssertEqual(s.countLine, "2 added")
    }

    // MARK: tips and replay

    func testTipsShowOnceInOrderAndRespectBlockers() {
        let d = suite()
        var c = OnboardingState.TipContext(people: 3, mindmapTab: true, reachOutVisible: true)
        XCTAssertEqual(OnboardingState.tipToShow(c, defaults: d), .askBar)
        for blocked in [{ c.layersEmpty = false }, { c.replaying = true }, { c.coachShowing = true }, { c.onboardingShowing = true }] as [() -> Void] {
            blocked(); XCTAssertNil(OnboardingState.tipToShow(c, defaults: d))
            c = OnboardingState.TipContext(people: 3, mindmapTab: true, reachOutVisible: true)
        }
        OnboardingState.markTipSeen(.askBar, defaults: d)
        XCTAssertEqual(OnboardingState.tipToShow(c, defaults: d), .mindmapDot)
        OnboardingState.markTipSeen(.mindmapDot, defaults: d)
        XCTAssertNil(OnboardingState.tipToShow(c, defaults: d)) // reachOut is for Connections
        c.mindmapTab = false
        XCTAssertEqual(OnboardingState.tipToShow(c, defaults: d), .reachOut)
        OnboardingState.markTipSeen(.reachOut, defaults: d)
        XCTAssertNil(OnboardingState.tipToShow(c, defaults: d))
    }

    func testTipNeedsItsPeople() {
        let d = suite()
        XCTAssertNil(OnboardingState.tipToShow(.init(people: 0, mindmapTab: true), defaults: d))
        OnboardingState.markTipSeen(.askBar, defaults: d)
        XCTAssertNil(OnboardingState.tipToShow(.init(people: 1, mindmapTab: true), defaults: d)) // a dot tip needs two
        XCTAssertEqual(OnboardingState.tipToShow(.init(people: 2, mindmapTab: true), defaults: d), .mindmapDot)
    }

    func testReplayFinishWritesNothingButFirstRunSetsDone() {
        let d = suite()
        OnboardingState.finish(replay: true, defaults: d)
        XCTAssertTrue(d.dictionaryRepresentation().keys.filter { $0.hasPrefix("peepl.") }.isEmpty)
        OnboardingState.finish(replay: false, defaults: d)
        XCTAssertTrue(d.bool(forKey: OnboardingState.doneKey))
        XCTAssertFalse(d.bool(forKey: OnboardingState.coachKey)); XCTAssertFalse(d.bool(forKey: OnboardingState.firstAddKey))
    }
}
