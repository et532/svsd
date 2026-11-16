import SwiftUI
import SwiftData

struct MindmapView: View {
    @Query(sort: \Person.id) private var people: [Person]
    @State private var model = MindmapModel()
    @State private var paused = false
    @State private var size = CGSize.zero

    // src/lib/aura.ts, scaled to the screen like homeOf() in MindmapScreen.tsx
    private static let orbs: [(color: String, x: Double, y: Double, w: Double, h: Double)] = [
        ("d6347f", 86, 102, 414, 414), ("e8c22e", 322, 294, 386, 386),
        ("2f4fd0", 49, 487, 442, 586), ("ec5a32", 269.5, 701.5, 325, 325),
    ]

    private func sync() {
        model.sync(ids: people.map(\.id), pairs: MindmapMath.links(people.map { ($0.id, $0.knows) }),
                   scores: people.map { ($0.id, max(1, $0.moments.count) + MindmapMath.auraDepth(closeness: $0.closeness, lastContacted: $0.lastContacted)) })
        paused = false
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color(hex: "ededed")
                let s = geo.size.width / 393
                ForEach(0..<Self.orbs.count, id: \.self) { i in
                    let o = Self.orbs[i]
                    Ellipse().fill(Color(hex: o.color)).frame(width: o.w * s, height: o.h * s)
                        .blur(radius: 150 * s)
                        .position(x: o.x * s, y: o.y * geo.size.height / 852)
                }
                if people.isEmpty {
                    Text("No one to show.").foregroundStyle(Theme.inkMuted)
                } else {
                    TimelineView(.animation(paused: paused)) { tl in
                        Canvas { ctx, sz in draw(&ctx, sz, now: tl.date.timeIntervalSinceReferenceDate) }
                    }
                }
            }
            .onAppear { size = geo.size; sync() }
            .onChange(of: geo.size) { _, n in size = n; paused = false }
            .onChange(of: people.map(\.id) + people.flatMap(\.knows)) { sync() }
        }
        .ignoresSafeArea()
    }

    private func draw(_ ctx: inout GraphicsContext, _ sz: CGSize, now: TimeInterval) {
        let t0 = CACurrentMediaTime()
        model.frame(now: now, size: sz)
        if model.settled { DispatchQueue.main.async { paused = true } }
        let m = model, k = m.k, cx = sz.width / 2 + m.x, cy = sz.height / 2 + m.y
        let nodes = m.graph.nodes
        let pad = 130.0 * k
        func pt(_ n: ForceGraph.Node) -> CGPoint { CGPoint(x: cx + n.x * k, y: cy + n.y * k) }
        let screen = CGRect(origin: .zero, size: sz).insetBy(dx: -pad, dy: -pad)

        for l in m.graph.links {
            let a = nodes[l.a], b = nodes[l.b], pa = pt(a), pb = pt(b)
            guard screen.contains(pa) || screen.contains(pb) else { continue }
            var path = Path(); path.move(to: pa); path.addLine(to: pb)
            // hook for M2-5: both ends in the same non-empty group draws solid
            let solid = !a.group.isEmpty && a.group == b.group
            ctx.stroke(path, with: .color(.white), style: StrokeStyle(lineWidth: 1, dash: solid ? [] : [4, 3]))
        }

        let ini = MindmapMath.initialsOpacity(k: k, fitK: m.fitK)
        let byId = Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0) })
        for n in nodes {
            let p = pt(n)
            guard screen.contains(p) else { continue }
            let r = m.radii[n.id] ?? 8
            let dr = MindmapMath.disc(r) * k, dotR = MindmapMath.dot(r) * k
            let disc = Path(ellipseIn: CGRect(x: p.x - dr, y: p.y - dr, width: dr * 2, height: dr * 2))
            // 50% white x 60% layer opacity, folded into the colors (a layer per disc costs an offscreen pass each)
            ctx.fill(disc, with: .radialGradient(
                Gradient(stops: [.init(color: .white.opacity(0.3), location: 0), .init(color: .white.opacity(0.3), location: 0.55), .init(color: .white.opacity(0.6), location: 1)]),
                center: p, startRadius: 0, endRadius: dr))
            let dot = Path(ellipseIn: CGRect(x: p.x - dotR, y: p.y - dotR, width: dotR * 2, height: dotR * 2))
            ctx.fill(dot, with: .color(.white))
            ctx.stroke(dot, with: .color(.black.opacity(0.08)), lineWidth: 0.5)
            if ini > 0, let person = byId[n.id] {
                ctx.draw(Text(person.initials).font(.system(size: dotR, weight: .semibold)).foregroundColor(.black.opacity(0.24 * ini)), at: p)
            }
        }
        m.addDraw(ms: (CACurrentMediaTime() - t0) * 1000)
    }
}
