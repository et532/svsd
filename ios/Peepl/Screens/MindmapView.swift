import SwiftUI
import SwiftData

struct MindmapView: View {
    @Query(sort: \Person.id) private var people: [Person]
    @State private var model = MindmapModel()
    @State private var paused = false
    @State private var size = CGSize.zero
    @State private var selectedId: String?
    @State private var lastMagnification = 1.0
    @State private var pillWidth: CGFloat = 0

    // src/lib/aura.ts, scaled to the screen like homeOf() in MindmapScreen.tsx
    private static let orbs: [(color: String, x: Double, y: Double, w: Double, h: Double)] = [
        ("d6347f", 86, 102, 414, 414), ("e8c22e", 322, 294, 386, 386),
        ("2f4fd0", 49, 487, 442, 586), ("ec5a32", 269.5, 701.5, 325, 325),
    ]

    private func sync() {
        model.sync(ids: people.map(\.id), pairs: MindmapMath.links(people.map { ($0.id, $0.knows) }),
                   scores: people.map { ($0.id, max(1, $0.moments.count) + MindmapMath.auraDepth(closeness: $0.closeness, lastContacted: $0.lastContacted)) },
                   initials: Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0.initials) }))
        selectedId = model.selected
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
                        ZStack {
                            Canvas { ctx, sz in draw(&ctx, sz, now: tl.date.timeIntervalSinceReferenceDate) }
                                .contentShape(Rectangle())
                                .gesture(drag.simultaneously(with: pinch))
                            if let id = selectedId, let person = people.first(where: { $0.id == id }),
                               let at = model.place(id, size: size) {
                                // top-anchored: 14 pt under the disc, ~52 pt tall pill
                                MindmapPill(person: person).fixedSize()
                                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { pillWidth = $0 }
                                    // keep the whole pill on screen (16 pt margin)
                                    .position(x: min(max(at.p.x, pillWidth / 2 + 16), size.width - pillWidth / 2 - 16), y: at.p.y + at.r + 14 + 26)
                            }
                        }
                    }
                }
            }
            .onAppear { size = geo.size; sync() }
            .onChange(of: geo.size) { _, n in size = n; paused = false }
            .onChange(of: people.map(\.id) + people.flatMap(\.knows)) { sync() }
        }
        .ignoresSafeArea()
    }

    private var drag: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { v in model.touchMoved(v.location, size: size); paused = false }
            .onEnded { v in
                if let tap = model.touchEnded(v.location, size: size) { selectedId = tap }
                paused = false
            }
    }

    private var pinch: some Gesture {
        MagnifyGesture()
            .onChanged { v in
                if !model.pinched { model.pinchBegan(); lastMagnification = 1 }
                let a = CGPoint(x: v.startAnchor.x * size.width, y: v.startAnchor.y * size.height)
                model.zoom(at: a, factor: v.magnification / lastMagnification, size: size)
                lastMagnification = v.magnification
                paused = false
            }
            .onEnded { _ in model.settle(size); paused = false }
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

        let sel = m.selected != nil
        for l in m.graph.links {
            let a = nodes[l.a], b = nodes[l.b], pa = pt(a), pb = pt(b)
            guard screen.contains(pa) || screen.contains(pb) else { continue }
            var path = Path(); path.move(to: pa); path.addLine(to: pb)
            // hook for M2-5: both ends in the same non-empty group draws solid
            let solid = !a.group.isEmpty && a.group == b.group
            let near = sel && m.depth[a.id] != nil && m.depth[b.id] != nil
            ctx.opacity = sel && !near ? 0.08 : 1
            ctx.stroke(path, with: .color(.white), style: StrokeStyle(lineWidth: near ? 3.2 : 1, dash: solid ? [] : [4, 3]))
        }

        let ini = MindmapMath.initialsOpacity(k: k, fitK: m.fitK)
        for n in nodes {
            let p = pt(n)
            guard screen.contains(p) else { continue }
            let r = m.radii[n.id] ?? 8
            let d = m.depth[n.id]
            ctx.opacity = !sel ? 1 : d == 0 ? 1 : d == 1 ? 0.55 : 0.08
            let dr = MindmapMath.disc(r) * k, dotR = MindmapMath.dot(r) * k
            let disc = Path(ellipseIn: CGRect(x: p.x - dr, y: p.y - dr, width: dr * 2, height: dr * 2))
            // 50% white x 60% layer opacity, folded into the colors (a layer per disc costs an offscreen pass each)
            ctx.fill(disc, with: .radialGradient(
                Gradient(stops: [.init(color: .white.opacity(0.3), location: 0), .init(color: .white.opacity(0.3), location: 0.55), .init(color: .white.opacity(0.6), location: 1)]),
                center: p, startRadius: 0, endRadius: dr))
            let dot = Path(ellipseIn: CGRect(x: p.x - dotR, y: p.y - dotR, width: dotR * 2, height: dotR * 2))
            if d == 0 { ctx.stroke(Path(ellipseIn: CGRect(x: p.x - dr - 2, y: p.y - dr - 2, width: dr * 2 + 4, height: dr * 2 + 4)), with: .color(.white.opacity(0.5)), lineWidth: 4) }
            ctx.fill(dot, with: .color(.white))
            ctx.stroke(dot, with: .color(.black.opacity(0.08)), lineWidth: 0.5)
            if ini > 0, let text = m.initials[n.id] {
                ctx.draw(Text(text).font(.system(size: dotR, weight: .semibold)).foregroundColor(.black.opacity(0.24 * ini)), at: p)
            }
        }
        ctx.opacity = 1
        m.addDraw(ms: (CACurrentMediaTime() - t0) * 1000)
    }
}
