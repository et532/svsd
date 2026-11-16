import Foundation

/// Per-frame mindmap state. A plain class on purpose: the Canvas reads it every frame without SwiftUI observing it.
final class MindmapModel {
    var graph = ForceGraph(ids: [], pairs: [])
    var radii: [String: Double] = [:]
    var x = 0.0, y = 0.0, k = 1.0      // view: offset from the screen center, scale
    var fitK = 1.0
    var touched = false                // set by gestures (M2-3); stops the auto-fit
    private var signature = ""
    private var fitted = false

    // FPS meter (-mindmapFPS YES)
    private let meter = UserDefaults.standard.bool(forKey: "mindmapFPS")
    private var last: TimeInterval = 0, second: TimeInterval = 0, frames = 0, worst = 0.0, drawMs = 0.0

    /// Rebuild only when the set of people changes; old positions are kept.
    func sync(ids: [String], pairs: [(String, String)], scores: [(id: String, score: Int)]) {
        let sig = ids.joined(separator: ",") + "|" + pairs.map { "\($0.0)-\($0.1)" }.joined(separator: ",")
        radii = MindmapMath.radii(scores)
        guard sig != signature else { return }
        signature = sig
        var prev: [String: (x: Double, y: Double)] = [:]
        for n in graph.nodes { prev[n.id] = (n.x, n.y) }
        graph = ForceGraph(ids: ids, pairs: pairs, prev: prev)
        fitted = false
    }

    var settled: Bool { graph.alpha <= 0.01 && fitted }

    func frame(now: TimeInterval, size: CGSize) {
        if graph.alpha > 0.01 { graph.step() }
        let f = MindmapMath.fit(graph.nodes, width: size.width, height: size.height)
        fitK = f.k
        if !touched {
            x += (f.x - x) * 0.1; y += (f.y - y) * 0.1; k += (f.k - k) * 0.1
            if abs(f.x - x) + abs(f.y - y) + abs(f.k - k) * 100 < 0.5 { x = f.x; y = f.y; k = f.k; fitted = true } else { fitted = false }
        } else { fitted = true }
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
}
