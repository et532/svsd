import Foundation

/// Pure math from src/screens/MindmapScreen.tsx and src/lib/people.ts.
enum MindmapMath {
    static let tierR: [Double] = [8, 19.2, 32]
    static let initialsAt = 0.27, fitZoom = 1.6, maxK = 3.0, grabZoom = 0.6
    static let groupSpread = 3.0, groupPad = 170.0, groupCover = 0.85, other = "Other"
    static let floatK = 55.0, floatC = 8.2, floatMax = 14.0, parallax = 0.07, glideTau = 0.42

    static func links(_ people: [(id: String, knows: [String])]) -> [(String, String)] {
        let ids = Set(people.map(\.id))
        var seen = Set<[String]>(), out: [(String, String)] = []
        for p in people {
            for o in p.knows where ids.contains(o) && o != p.id && seen.insert([p.id, o].sorted()).inserted {
                out.append((p.id, o))
            }
        }
        return out
    }

    static func auraDepth(closeness: Int?, lastContacted: String, now: Date = .now) -> Int {
        if let c = closeness, c != 0 { return c }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"   // local day
        guard let last = f.date(from: lastContacted) else { return 1 }
        let days = now.timeIntervalSince(last) / 86_400
        return days <= 30 ? 3 : days <= 120 ? 2 : 1
    }

    static func radii(_ scores: [(id: String, score: Int)]) -> [String: Double] {
        let ranked = scores.sorted { $0.score != $1.score ? $0.score > $1.score : $0.id < $1.id }
        let n = Double(ranked.count)
        var out: [String: Double] = [:]
        for (i, p) in ranked.enumerated() { out[p.id] = tierR[Double(i) < n * 0.22 ? 2 : Double(i) < n * 0.67 ? 1 : 0] }
        return out
    }

    static func disc(_ r: Double) -> Double { 14 + r * 1.25 }
    static func dot(_ r: Double) -> Double { (3.2 + r * 0.15) * 1.4 }

    static func initialsOpacity(k: Double, fitK: Double) -> Double {
        let full = fitK * pow(max(1, 3 / fitK), initialsAt)
        let start = full / 1.25
        return min(1, max(0, (k - start) / (full - start)))
    }

    static func bend(_ key: String) -> Double {
        var h: Int32 = 0
        for c in key.utf16 { h = h &* 31 &+ Int32(c) }
        return (Double(abs(Int64(h)) % 100) / 100 - 0.5) * 0.4
    }
    static func floatOf(_ id: String, r: Double) -> Double { (0.05 + 0.05 * (32 - r) / 24) * (1 + bend(id) * 1.25) }
    static func depthOf(_ id: String, r: Double) -> Double { (r - 19.2) / 12.8 * 0.6 + bend("\(id)~depth") * 2 }

    static func groups(_ values: [(id: String, value: String)]) -> (groupOf: [String: String], names: [String]) {
        var count: [String: Int] = [:], order: [String] = []   // first-seen order, for stable ties
        for v in values { if count[v.value] == nil { order.append(v.value) }; count[v.value, default: 0] += 1 }
        var of: [String: String] = [:]
        for v in values { of[v.id] = count[v.value]! > 1 ? v.value : other }
        var names = order.enumerated().filter { !$0.element.isEmpty && count[$0.element]! > 1 }
            .sorted { (count[$0.element]!, -$0.offset) > (count[$1.element]!, -$1.offset) }.map(\.element)
        if of.values.contains(other) { names.append(other) }
        return (of, names)
    }

    static func fit(_ nodes: [ForceGraph.Node], width: Double, height: Double) -> (x: Double, y: Double, k: Double) {
        guard !nodes.isEmpty else { return (0, 0, 1) }
        let xs = nodes.map(\.x), ys = nodes.map(\.y)
        let x0 = xs.min()!, x1 = xs.max()!, y0 = ys.min()!, y1 = ys.max()!
        let k = fitZoom * min(1.2, max(0.02, min((width - 90) / (x1 - x0 + 90), (height - 330) / (y1 - y0 + 90))))
        return (-(x0 + x1) / 2 * k, -(y0 + y1) / 2 * k + 65, k)   // +65: controls take more room at the top
    }

    static func minK(fitK: Double) -> Double { fitK / fitZoom * 0.85 }

    struct Oval: Equatable { var cx, cy, w, h: Double }

    static func groupOvals(_ nodes: [ForceGraph.Node], radii: [String: Double]) -> [String: Oval] {
        var sums: [String: [Double]] = [:]
        for n in nodes where !n.group.isEmpty {
            let c = sums[n.group] ?? [0, 0, 0, 0, 0]
            sums[n.group] = [c[0] + n.x, c[1] + n.y, c[2] + n.x * n.x, c[3] + n.y * n.y, c[4] + 1]
        }
        var ovals: [String: Oval] = [:]
        for (g, s) in sums {
            let c = s[4], cx = s[0] / c, cy = s[1] / c
            let minOf = 200 + 100 * c.squareRoot()
            let stretch = 1 + bend(g) * 1.25   // tight groups get their own fixed stretch
            let w = max(minOf * stretch, max(0, s[2] / c - cx * cx).squareRoot() * groupSpread + groupPad)
            let h = max(minOf / stretch, max(0, s[3] / c - cy * cy).squareRoot() * groupSpread + groupPad)
            ovals[g] = Oval(cx: cx, cy: cy, w: w, h: h)
        }
        var grow: [String: Double] = [:]
        for n in nodes {
            guard let b = ovals[n.group] else { continue }
            let d = disc(radii[n.id] ?? 12)
            let out = hypot((abs(n.x - b.cx) + d) / (b.w / 2), (abs(n.y - b.cy) + d) / (b.h / 2)) / groupCover
            grow[n.group] = max(grow[n.group] ?? 1, out)
        }
        for (g, f) in grow { ovals[g]!.w *= f; ovals[g]!.h *= f }
        return ovals
    }
}
