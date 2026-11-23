import Foundation

/// Port of src/lib/forceGraph.ts: a tiny force-directed layout. Positions are world units around (0, 0).
final class ForceGraph {
    struct Node { let id: String; var x: Double; var y: Double; var vx = 0.0; var vy = 0.0
                  var group = ""; var pinned = false; var degree = 0 }
    struct Link { let a: Int; let b: Int; let strength: Double; let rest: Double }

    var nodes: [Node]
    let links: [Link]
    let index: [String: Int]
    var alpha: Double = 1

    private static let repel = 60000.0, groupPull = 0.07, groupSpacing = 330.0
    private static let compSpacing = 85.0, compPull = 0.012, lonerPull = 0.05, crossGroup = 0.2

    private struct SplitMix64 {
        var s: UInt64
        mutating func next() -> Double {
            s &+= 0x9E3779B97F4A7C15
            var z = s
            z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
            z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
            z ^= z >> 31
            return Double(z >> 11) / Double(1 << 53)
        }
    }
    private var rng: SplitMix64
    // Per node: its circle's home (used when no groups are set), pull, whether its circle has >1 person.
    private var homeX: [Double], homeY: [Double], homePull: [Double], inCircle: [Bool]
    private var inner = 0.0
    private var anchorX: [Double] = [], anchorY: [Double] = [], hasAnchor: [Bool] = []
    private var anchored = false

    init(ids: [String], pairs: [(String, String)], prev: [String: (x: Double, y: Double)] = [:], seed: UInt64 = 1) {
        rng = SplitMix64(s: seed)
        // A new person lands beside the people they know (centroid + a small fixed offset), so a plop is where they will live.
        // Two passes: someone added with a friend from the same note can use that friend's spot. No known mutuals: the spiral.
        var start = prev
        if !prev.isEmpty {
            var mutuals: [String: [String]] = [:]
            for (a, b) in pairs { mutuals[a, default: []].append(b); mutuals[b, default: []].append(a) }
            for _ in 0..<2 {
                for (i, id) in ids.enumerated() where start[id] == nil {
                    let near = (mutuals[id] ?? []).compactMap { start[$0] }
                    guard !near.isEmpty else { continue }
                    let a = Double(i) * 2.4
                    start[id] = (near.map(\.x).reduce(0, +) / Double(near.count) + cos(a) * 24, near.map(\.y).reduce(0, +) / Double(near.count) + sin(a) * 24)
                }
            }
        }
        var ns = ids.enumerated().map { i, id -> Node in
            let angle = Double(i) * 2.4, r = 20 + Double(i) * 6
            let old = start[id]
            return Node(id: id, x: old?.x ?? cos(angle) * r, y: old?.y ?? sin(angle) * r)
        }
        var idx: [String: Int] = [:]
        for (i, id) in ids.enumerated() { idx[id] = i }
        let valid = pairs.compactMap { p -> (Int, Int)? in
            guard let a = idx[p.0], let b = idx[p.1] else { return nil }
            return (a, b)
        }
        var nb = [Set<Int>](repeating: [], count: ids.count)
        for (a, b) in valid { nb[a].insert(b); nb[b].insert(a) }
        for i in ns.indices { ns[i].degree = nb[i].count }
        links = valid.map { a, b in
            let shared = nb[a].intersection(nb[b]).count
            return Link(a: a, b: b, strength: 0.05 * Double(1 + shared), rest: 200 / (1 + 0.5 * Double(shared)))
        }

        // Union-find: each circle of people who know each other gets its own home (bigger circles nearer the middle).
        var parent = Array(0..<ids.count)
        func root(_ i: Int) -> Int { var r = i; while parent[r] != r { r = parent[r] }; return r }
        for (a, b) in valid { parent[root(a)] = root(b) }
        var order: [Int] = [], size: [Int: Int] = [:]   // roots in first-seen order, like the JS Map
        for i in ids.indices { let r = root(i); if size[r] == nil { order.append(r) }; size[r, default: 0] += 1 }
        var home: [Int: (x: Double, y: Double, pull: Double)] = [:]
        var placed = 0
        let linked = order.enumerated().filter { size[$0.element]! > 1 }
            .sorted { (size[$0.element]!, -$0.offset) > (size[$1.element]!, -$1.offset) }.map(\.element)
        for (i, r) in linked.enumerated() {
            let n = size[r]!
            let d = ForceGraph.compSpacing * (Double(placed) + Double(n) / 2).squareRoot()
            home[r] = (cos(Double(i) * 2.4) * d, sin(Double(i) * 2.4) * d, ForceGraph.compPull)
            placed += n
        }
        let loners = order.filter { size[$0]! == 1 }
        let ring = ForceGraph.compSpacing * Double(placed).squareRoot() + 800
        inner = ring - 450
        for (i, r) in loners.enumerated() {
            let t = Double(i) / Double(loners.count) * .pi * 2
            home[r] = (cos(t) * ring, sin(t) * ring, ForceGraph.lonerPull)
        }
        homeX = ids.indices.map { home[root($0)]!.x }
        homeY = ids.indices.map { home[root($0)]!.y }
        homePull = ids.indices.map { home[root($0)]!.pull }
        inCircle = ids.indices.map { size[root($0)]! > 1 }
        nodes = ns
        index = idx
    }

    func setGroups(_ groupOf: (String) -> String, last: String?) {
        for i in nodes.indices { nodes[i].group = groupOf(nodes[i].id) }
        var size: [String: Int] = [:], seen: [String] = []
        for n in nodes where !n.group.isEmpty {
            if size[n.group] == nil { seen.append(n.group) }
            size[n.group, default: 0] += 1
        }
        // Biggest first, `last` (the catch-all "Other") on the outside; ties keep first-seen order.
        let names = seen.enumerated().sorted {
            let l = ($0.element == last, -size[$0.element]!, $0.offset), r = ($1.element == last, -size[$1.element]!, $1.offset)
            return l.0 != r.0 ? !l.0 : (l.1, l.2) < (r.1, r.2)
        }.map(\.element)
        var pos: [String: (Double, Double)] = [:]
        for (i, g) in names.enumerated() {
            let r = ForceGraph.groupSpacing * (Double(i) + 0.5).squareRoot()
            pos[g] = (cos(Double(i) * 2.4) * r, sin(Double(i) * 2.4) * r)
        }
        anchored = !names.isEmpty
        hasAnchor = nodes.map { pos[$0.group] != nil }
        anchorX = nodes.map { pos[$0.group]?.0 ?? 0 }
        anchorY = nodes.map { pos[$0.group]?.1 ?? 0 }
        alpha = 1
    }

    func step() {
        let a = alpha, count = nodes.count
        nodes.withUnsafeMutableBufferPointer { ns in
            for i in 0..<count {
                for j in (i + 1)..<max(count, i + 1) {
                    var dx = ns[j].x - ns[i].x, dy = ns[j].y - ns[i].y
                    var d2 = dx * dx + dy * dy
                    if d2 < 1 { dx = rng.next() - 0.5; dy = rng.next() - 0.5; d2 = 1 }
                    if d2 > 640000 { continue }   // too far apart to matter; keeps 200+ people fast
                    let f = ForceGraph.repel / d2 * a, d = d2.squareRoot()
                    let fx = dx / d * f, fy = dy / d * f
                    ns[i].vx -= fx; ns[i].vy -= fy
                    ns[j].vx += fx; ns[j].vy += fy
                }
            }
            for l in links {
                let dx = ns[l.b].x - ns[l.a].x, dy = ns[l.b].y - ns[l.a].y
                var d = hypot(dx, dy); if d == 0 { d = 1 }
                let ga = ns[l.a].group, gb = ns[l.b].group
                let cross = !ga.isEmpty && !gb.isEmpty && ga != gb ? ForceGraph.crossGroup : 1
                let f = (d - l.rest) / d * l.strength * cross * a
                ns[l.a].vx += dx * f; ns[l.a].vy += dy * f
                ns[l.b].vx -= dx * f; ns[l.b].vy -= dy * f
            }
            for i in 0..<count {
                let anchor = anchored && hasAnchor[i]
                let hx = anchor ? anchorX[i] : homeX[i], hy = anchor ? anchorY[i] : homeY[i]
                let pull = anchor ? ForceGraph.groupPull : homePull[i]
                ns[i].vx += (hx - ns[i].x) * pull * a
                ns[i].vy += (hy - ns[i].y) * pull * a
                if ns[i].pinned { ns[i].vx = 0; ns[i].vy = 0; continue }
                ns[i].vx *= 0.6; ns[i].vy *= 0.6
                ns[i].x += ns[i].vx; ns[i].y += ns[i].vy
                if !anchored && inCircle[i] {
                    let r = hypot(ns[i].x, ns[i].y)
                    if r > inner { ns[i].x *= inner / r; ns[i].y *= inner / r }
                }
            }
        }
        alpha = max(alpha * 0.985, 0)
    }
}
