import SwiftUI
import SwiftData

struct MindmapView: View {
    @Environment(Nav.self) private var nav
    @Query(sort: \Person.id) private var allPeople: [Person]
    private var people: [Person] {
        guard let f = nav.showFilter else { return allPeople }
        let ids = Set(f.ids); return allPeople.filter { ids.contains($0.id) }
    }
    private let model = MindmapModel.shared
    @State private var groupBy = MindmapModel.shared.groupBy
    @State private var paused = false
    @State private var size = CGSize.zero
    @State private var selectedId: String?
    @State private var lastMagnification = 1.0
    @State private var pillWidth: CGFloat = 0

    private func sync() {
        model.sync(ids: people.map(\.id), pairs: MindmapMath.links(people.map { ($0.id, $0.knows) }),
                   scores: people.map { ($0.id, max(1, $0.moments.count) + MindmapMath.auraDepth(closeness: $0.closeness, lastContacted: $0.lastContacted)) },
                   initials: Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0.initials) }),
                   groupKeys: Dictionary(uniqueKeysWithValues: people.map { ($0.id, GroupKeys(city: $0.livesNow.city, met: $0.met.city, job: $0.profession)) }))
        selectedId = model.selected
        paused = false
    }

    var body: some View {
        ZStack {
            map
            VStack { HStack { Spacer(); MindmapFilters(selection: $groupBy) }.padding(.horizontal, 16); Spacer() }
        }
        .onChange(of: groupBy) { _, g in model.setGroupBy(g); selectedId = nil; paused = false }
    }

    private var map: some View {
        GeometryReader { geo in
            ZStack {
                Color(hex: "ededed")
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
        let m = model, k = m.k
        let nodes = m.graph.nodes
        let pad = 130.0 * k
        let pos = nodes.indices.map { m.drawnPosition($0, size: sz) }
        let screen = CGRect(origin: .zero, size: sz).insetBy(dx: -pad, dy: -pad)

        ctx.fill(Path(CGRect(origin: .zero, size: sz)), with: .color(Color(hex: "ededed")))
        drawOrbs(&ctx, m)
        let sel = m.selected != nil, focus = m.focus
        for l in m.graph.links {
            let a = nodes[l.a], b = nodes[l.b], pa = pos[l.a], pb = pos[l.b]
            guard screen.contains(pa) || screen.contains(pb) else { continue }
            var path = Path(); path.move(to: pa); path.addLine(to: pb)
            let solid = !a.group.isEmpty && a.group == b.group && a.group != MindmapMath.other
            let near = sel && m.depth[a.id] != nil && m.depth[b.id] != nil
            ctx.opacity = (sel && !near) || (focus != nil && (a.group != focus || b.group != focus)) ? 0.08 : 1
            ctx.stroke(path, with: .color(.white), style: StrokeStyle(lineWidth: near ? 3.2 : 1, dash: solid ? [] : [4, 3]))
        }

        let ini = MindmapMath.initialsOpacity(k: k, fitK: m.fitK)
        for (i, n) in nodes.enumerated() {
            let p = pos[i]
            guard screen.contains(p) else { continue }
            let r = m.radii[n.id] ?? 8
            let d = m.depth[n.id]
            ctx.opacity = focus != nil && n.group != focus ? 0.08 : !sel ? 1 : d == 0 ? 1 : d == 1 ? 0.55 : 0.08
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
        for g in m.ovals.keys {
            guard let r = m.labelRect(g, size: sz) else { continue }
            ctx.opacity = focus != nil && focus != g ? 0.2 : 1
            ctx.draw(Text(g).font(.system(size: 13, weight: .medium)).tracking(-0.52).foregroundColor(Theme.ink.opacity(0.7)), at: CGPoint(x: r.midX, y: r.midY))
        }
        ctx.opacity = 1
        m.addDraw(ms: (CACurrentMediaTime() - t0) * 1000)
    }

    /// Each orb as a radial gradient from its color to clear, shaped like a gaussian-blurred ellipse (no blur filter).
    private func drawOrbs(_ ctx: inout GraphicsContext, _ m: MindmapModel) {
        for (i, o) in m.orbCur.enumerated() where o.op > 0.003 {
            let c = Color(hex: MindmapModel.aura[i % MindmapModel.aura.count].color)
            let cr = 2 * o.blur / MindmapModel.orbBase            // blur sigma / half-size, the same on both axes
            let ext = 1 + 2.5 * cr, edge = 1 / ext, sigma = cr * edge
            let stops = (0...12).map { j -> Gradient.Stop in
                let u = Double(j) / 12
                return .init(color: c.opacity(j == 12 ? 0 : 0.5 * erfc((u - edge) / (sigma * 2.0.squareRoot()))), location: u)
            }
            var g = ctx
            g.opacity = o.op
            g.translateBy(x: o.x, y: o.y); g.scaleBy(x: o.w / 2 * ext, y: o.h / 2 * ext)
            g.fill(Path(ellipseIn: CGRect(x: -1, y: -1, width: 2, height: 2)), with: .radialGradient(Gradient(stops: stops), center: .zero, startRadius: 0, endRadius: 1))
        }
    }
}
