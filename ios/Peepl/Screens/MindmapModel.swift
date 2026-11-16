import Foundation

/// Per-frame mindmap state. A plain class on purpose: the Canvas reads it every frame without SwiftUI observing it.
final class MindmapModel {
    var graph = ForceGraph(ids: [], pairs: [])
    var radii: [String: Double] = [:]
    var x = 0.0, y = 0.0, k = 1.0      // view: offset from the screen center, scale
    var fitK = 1.0
    var touched = false                // set by gestures; stops the auto-fit
    var selected: String?
    private(set) var depth: [String: Int] = [:]   // selected 0, direct links 1; others absent
    var initials: [String: String] = [:]
    private var anim: (x: Double, y: Double, k: Double, rate: Double)?
    // touch state, kept here so the gesture callbacks don't invalidate SwiftUI
    private var touching = false, grab: Int?, travel = 0.0, lastTouch = CGPoint.zero
    private(set) var pinched = false
    private var signature = ""
    private var fitted = false

    // FPS meter (-mindmapFPS YES)
    private let meter = UserDefaults.standard.bool(forKey: "mindmapFPS")
    private var last: TimeInterval = 0, second: TimeInterval = 0, frames = 0, worst = 0.0, drawMs = 0.0

    /// Rebuild only when the set of people changes; old positions are kept.
    func sync(ids: [String], pairs: [(String, String)], scores: [(id: String, score: Int)], initials: [String: String] = [:]) {
        self.initials = initials
        let sig = ids.joined(separator: ",") + "|" + pairs.map { "\($0.0)-\($0.1)" }.joined(separator: ",")
        radii = MindmapMath.radii(scores)
        guard sig != signature else { return }
        signature = sig
        var prev: [String: (x: Double, y: Double)] = [:]
        for n in graph.nodes { prev[n.id] = (n.x, n.y) }
        graph = ForceGraph(ids: ids, pairs: pairs, prev: prev)
        fitted = false
        selected = nil; depth = [:]
    }

    var settled: Bool { graph.alpha <= 0.01 && fitted && anim == nil }

    func frame(now: TimeInterval, size: CGSize) {
        if graph.alpha > 0.01 { graph.step() }
        let f = MindmapMath.fit(graph.nodes, width: size.width, height: size.height)
        fitK = f.k
        if !touched {
            x += (f.x - x) * 0.1; y += (f.y - y) * 0.1; k += (f.k - k) * 0.1
            if abs(f.x - x) + abs(f.y - y) + abs(f.k - k) * 100 < 0.5 { x = f.x; y = f.y; k = f.k; fitted = true } else { fitted = false }
        } else {
            fitted = true
            if let a = anim {
                x += (a.x - x) * a.rate; y += (a.y - y) * a.rate; k += (a.k - k) * a.rate
                if abs(a.k - k) <= 0.002 && abs(a.x - x) <= 0.5 && abs(a.y - y) <= 0.5 { anim = nil }
            }
        }
        guard meter else { return }
        if last > 0 { worst = max(worst, (now - last) * 1000) }
        last = now; frames += 1
        if second == 0 { second = now }
        if now - second >= 1 {
            print(String(format: "mindmap fps=%d worst=%.1f draw=%.2f", frames, worst, drawMs / Double(max(frames, 1))))
            second = now; frames = 0; worst = 0; drawMs = 0
        }
    }

    func addDraw(ms: Double) { if meter { drawMs += ms } }

    // MARK: view control (ports of MindmapScreen.tsx)

    func select(_ id: String?) {
        selected = id
        depth = [:]
        guard let id, let i = graph.index[id] else { return }
        depth[id] = 0
        for l in graph.links {
            if l.a == i { depth[graph.nodes[l.b].id] = depth[graph.nodes[l.b].id] ?? 1 }
            if l.b == i { depth[graph.nodes[l.a].id] = depth[graph.nodes[l.a].id] ?? 1 }
        }
    }

    func animateTo(_ t: (x: Double, y: Double, k: Double), rate: Double = 0.16) {
        touched = true
        anim = (t.x, t.y, t.k, rate)
    }

    /// Zoom to a person and center them with their direct connections in view.
    func flyTo(_ id: String, size: CGSize) {
        guard let i = graph.index[id] else { return }
        var near: Set<Int> = [i]
        for l in graph.links { if l.a == i { near.insert(l.b) }; if l.b == i { near.insert(l.a) } }
        let ns = near.map { graph.nodes[$0] }
        let x0 = ns.map(\.x).min()!, x1 = ns.map(\.x).max()!, y0 = ns.map(\.y).min()!, y1 = ns.map(\.y).max()!
        let k = min(1.4, max(0.35, min((size.width - 110) / (x1 - x0 + 90), (size.height - 360) / (y1 - y0 + 90))))
        animateTo((-(x0 + x1) / 2 * k, -(y0 + y1) / 2 * k + 20, k))   // +20: room for the name pill below
    }

    /// Past a limit only a third of the gesture counts, and the stretch is capped.
    func zoom(at p: CGPoint, factor: Double, size: CGSize) {
        var f = factor
        let lo = MindmapMath.minK(fitK: fitK), hi = MindmapMath.maxK
        if (k <= lo && f < 1) || (k >= hi && f > 1) { f = pow(f, 0.3) }
        let nk = min(hi * 1.25, max(lo * 0.7, k * f))
        let px = p.x - size.width / 2, py = p.y - size.height / 2
        x = px - (px - x) / k * nk
        y = py - (py - y) / k * nk
        k = nk
        touched = true; anim = nil
    }

    /// Let go of a pinch: spring back if it went too far.
    func settle(_ size: CGSize) {
        let lo = MindmapMath.minK(fitK: fitK), hi = MindmapMath.maxK
        if k < lo {
            let f = MindmapMath.fit(graph.nodes, width: size.width, height: size.height)
            animateTo((f.x, f.y, f.k), rate: 0.12)
        } else if k > hi {
            animateTo((x * hi / k, y * hi / k, hi), rate: 0.12)
        }
    }

    func pan(_ dx: Double, _ dy: Double) { x += dx; y += dy; touched = true; anim = nil }

    private func screen(_ n: ForceGraph.Node, _ size: CGSize) -> CGPoint {
        CGPoint(x: size.width / 2 + x + n.x * k, y: size.height / 2 + y + n.y * k)
    }

    /// Topmost node whose disc contains p; faded nodes can't be hit while someone is selected.
    func hit(_ p: CGPoint, size: CGSize) -> String? {
        for n in graph.nodes.reversed() {
            if selected != nil && depth[n.id] == nil { continue }
            let c = screen(n, size), dr = MindmapMath.disc(radii[n.id] ?? 8) * k
            if hypot(p.x - c.x, p.y - c.y) <= dr { return n.id }
        }
        return nil
    }

    func moveNode(_ id: String, to p: CGPoint, size: CGSize) {
        guard let i = graph.index[id] else { return }
        graph.nodes[i].pinned = true
        graph.nodes[i].x = (p.x - size.width / 2 - x) / k
        graph.nodes[i].y = (p.y - size.height / 2 - y) / k
        graph.alpha = max(graph.alpha, 0.35)
    }

    /// Where a person is drawn on screen, and their disc radius, for the name pill.
    func place(_ id: String, size: CGSize) -> (p: CGPoint, r: Double)? {
        guard let i = graph.index[id] else { return nil }
        return (screen(graph.nodes[i], size), MindmapMath.disc(radii[id] ?? 8) * k)
    }

    // MARK: touch (one finger: tap, pan or node drag; pinch is separate)

    func touchMoved(_ p: CGPoint, size: CGSize) {
        if !touching {
            touching = true; pinched = false; travel = 0; lastTouch = p; anim = nil
            if let id = hit(p, size: size), k >= MindmapMath.grabZoom, let i = graph.index[id] { grab = i; graph.nodes[i].pinned = true }
            return
        }
        guard !pinched else { lastTouch = p; return }
        travel += hypot(p.x - lastTouch.x, p.y - lastTouch.y)
        if let g = grab { moveNode(graph.nodes[g].id, to: p, size: size) } else if travel > 4 { pan(p.x - lastTouch.x, p.y - lastTouch.y) }
        lastTouch = p
    }

    /// Returns the id to select (nil clears) when the touch was a tap, else .none.
    func touchEnded(_ p: CGPoint, size: CGSize) -> String?? {
        defer { touching = false; if let g = grab { graph.nodes[g].pinned = false }; grab = nil }
        guard touching, !pinched, travel <= 4 else { return .none }
        let id = hit(p, size: size)
        select(id)
        if let id { flyTo(id, size: size) }
        return .some(id)
    }

    func pinchBegan() { pinched = true; if let g = grab { graph.nodes[g].pinned = false; grab = nil } }
}
