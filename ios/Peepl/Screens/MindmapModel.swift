import UIKit

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
    // float / parallax (per dot, indexed like graph.nodes) and momentum
    struct Dot { var ux = 0.0, uy = 0.0, vx = 0.0, vy = 0.0, f = 0.0, d = 0.0 }
    var dots: [Dot] = []
    private var floating = false, gliding = false
    private var glideV = (x: 0.0, y: 0.0)
    private var panV = (x: 0.0, y: 0.0, t: 0.0)
    private var prevView = (x: 0.0, y: 0.0, k: 1.0), prevT = 0.0
    var reduceMotion = UIAccessibility.isReduceMotionEnabled

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
        dots = graph.nodes.map { let r = radii[$0.id] ?? 12; return Dot(f: MindmapMath.floatOf($0.id, r: r), d: MindmapMath.depthOf($0.id, r: r)) }
    }

    var settled: Bool { graph.alpha <= 0.01 && fitted && anim == nil && !gliding && !floating }

    func frame(now: TimeInterval, size: CGSize) {
        let dt = prevT > 0 ? min(0.05, now - prevT) : 0
        prevT = now
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
        if gliding { glide(dt, size) }
        stepFloat(dt)
        guard meter else { return }
        if last > 0 { worst = max(worst, (now - last) * 1000) }
        last = now; frames += 1
        if second == 0 { second = now }
        if now - second >= 1 {
            print(String(format: "mindmap fps=%d worst=%.1f draw=%.2f", frames, worst, drawMs / Double(max(frames, 1))))
            second = now; frames = 0; worst = 0; drawMs = 0
        }
    }

    /// Leave each dot behind by its share of how far the view carried it this frame, then let its spring pull it back.
    private func stepFloat(_ dt: Double) {
        let carried = touched && !reduceMotion
        var restless = false
        for i in dots.indices {
            if carried {
                dots[i].ux -= (x - prevView.x + graph.nodes[i].x * (k - prevView.k)) * dots[i].f
                dots[i].uy -= (y - prevView.y + graph.nodes[i].y * (k - prevView.k)) * dots[i].f
            }
            var s = dots[i]
            s.vx += (-MindmapMath.floatK * s.ux - MindmapMath.floatC * s.vx) * dt
            s.vy += (-MindmapMath.floatK * s.uy - MindmapMath.floatC * s.vy) * dt
            s.ux += s.vx * dt; s.uy += s.vy * dt
            let u = hypot(s.ux, s.uy), cap = MindmapMath.floatMax * 3
            if u > cap { s.ux *= cap / u; s.uy *= cap / u }
            if u > 0.05 || abs(s.vx) + abs(s.vy) > 0.5 { restless = true } else { s.ux = 0; s.uy = 0; s.vx = 0; s.vy = 0 }
            dots[i] = s
        }
        floating = restless
        prevView = (x, y, k)
    }

    /// Where a dot is drawn on screen: its spot pushed out from the screen center by its depth, plus its float eased into floatMax.
    func drawnPosition(_ i: Int, size: CGSize) -> CGPoint {
        let n = graph.nodes[i], s = dots[i]
        let p = reduceMotion ? 0 : s.d * MindmapMath.parallax
        let u = reduceMotion ? 0 : hypot(s.ux, s.uy)
        let soft = u > 0.01 ? MindmapMath.floatMax * tanh(u / MindmapMath.floatMax) / u : 1
        return CGPoint(x: size.width / 2 + (x + n.x * k) * (1 + p) + s.ux * soft,
                       y: size.height / 2 + (y + n.y * k) * (1 + p) + s.uy * soft)
    }

    /// How far the view may go: the people must still cover at least a quarter of the screen each way.
    private func panRange(_ size: CGSize) -> (x0: Double, x1: Double, y0: Double, y1: Double)? {
        guard let x0 = graph.nodes.map(\.x).min(), let x1 = graph.nodes.map(\.x).max(),
              let y0 = graph.nodes.map(\.y).min(), let y1 = graph.nodes.map(\.y).max() else { return nil }
        let w = size.width / 4, h = size.height / 4
        return (-w - x1 * k, w - x0 * k, -h - y1 * k, h - y0 * k)
    }

    /// Keep a released pan moving, slowing like an iOS scroll; past the edge of the people it brakes, then springs back.
    func startGlide(vx: Double, vy: Double) {
        let speed = hypot(vx, vy)
        guard speed >= 120, !reduceMotion else { return }
        let cap = min(1, 3000 / speed)
        glideV = (vx * cap, vy * cap); gliding = true; anim = nil
    }

    private func glide(_ dt: Double, _ size: CGSize) {
        let decay = exp(-dt / MindmapMath.glideTau)
        x += glideV.x * MindmapMath.glideTau * (1 - decay)
        y += glideV.y * MindmapMath.glideTau * (1 - decay)
        glideV.x *= decay; glideV.y *= decay
        let r = panRange(size), brake = exp(-dt / 0.06)
        if let r, x < r.x0 || x > r.x1 { glideV.x *= brake }
        if let r, y < r.y0 || y > r.y1 { glideV.y *= brake }
        guard hypot(glideV.x, glideV.y) <= 10 else { return }
        gliding = false
        if let r, x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1 {
            animateTo((min(r.x1, max(r.x0, x)), min(r.y1, max(r.y0, y)), k), rate: 0.12)
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
        touched = true; anim = nil; gliding = false
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

    func pan(_ dx: Double, _ dy: Double) { x += dx; y += dy; touched = true; anim = nil; gliding = false }

    /// Topmost node whose disc contains p; faded nodes can't be hit while someone is selected.
    func hit(_ p: CGPoint, size: CGSize) -> String? {
        for i in graph.nodes.indices.reversed() {
            let n = graph.nodes[i]
            if selected != nil && depth[n.id] == nil { continue }
            let c = drawnPosition(i, size: size), dr = MindmapMath.disc(radii[n.id] ?? 8) * k
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
        return (drawnPosition(i, size: size), MindmapMath.disc(radii[id] ?? 8) * k)
    }

    // MARK: touch (one finger: tap, pan or node drag; pinch is separate)

    func touchMoved(_ p: CGPoint, size: CGSize) {
        if !touching {
            touching = true; pinched = false; travel = 0; lastTouch = p; anim = nil; gliding = false
            panV = (0, 0, CACurrentMediaTime())
            if let id = hit(p, size: size), k >= MindmapMath.grabZoom, let i = graph.index[id] { grab = i; graph.nodes[i].pinned = true }
            return
        }
        guard !pinched else { lastTouch = p; return }
        travel += hypot(p.x - lastTouch.x, p.y - lastTouch.y)
        if let g = grab { moveNode(graph.nodes[g].id, to: p, size: size) } else if travel > 4 {
            let now = CACurrentMediaTime(), dt = now - panV.t
            if dt > 0.001 {
                let keep = dt > 0.1 ? 0 : 0.6   // smooth jittery samples, forget a pause
                panV = (panV.x * keep + (p.x - lastTouch.x) / dt * (1 - keep), panV.y * keep + (p.y - lastTouch.y) / dt * (1 - keep), now)
            }
            pan(p.x - lastTouch.x, p.y - lastTouch.y)
        }
        lastTouch = p
    }

    /// Returns the id to select (nil clears) when the touch was a tap, else .none.
    func touchEnded(_ p: CGPoint, size: CGSize) -> String?? {
        defer { touching = false; if let g = grab { graph.nodes[g].pinned = false }; grab = nil }
        if touching, !pinched, grab == nil, travel > 4, CACurrentMediaTime() - panV.t < 0.08 { startGlide(vx: panV.x, vy: panV.y) }
        guard touching, !pinched, travel <= 4 else { return .none }
        let id = hit(p, size: size)
        select(id)
        if let id { flyTo(id, size: size) }
        return .some(id)
    }

    func pinchBegan() { pinched = true; if let g = grab { graph.nodes[g].pinned = false; grab = nil } }
}
