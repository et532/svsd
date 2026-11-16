import SwiftUI
import SwiftData

struct ProfileView: View {
    let person: Person
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    @Query private var everyone: [Person]
    @State private var scrolled: CGFloat = 0
    @State private var openMoment: String?

    private var blob: Blob { Blobs.blob(for: person.id) }
    private var moments: [Moment] { person.moments.sorted { $0.date > $1.date } }
    private var mutuals: [Person] { person.knows.compactMap { id in everyone.first { $0.id == id } } }
    private var metDate: String {
        let iso = person.moments.first(where: \.firstMeeting)?.date ?? person.lastContacted
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        guard let d = f.date(from: String(iso.prefix(10))) else { return "" }
        f.dateFormat = "MMM yyyy"
        return "Met " + f.string(from: d)
    }

    var body: some View {
        ZStack(alignment: .top) {
            Theme.bg.ignoresSafeArea()
            aura
            ScrollView {
                VStack(spacing: 0) {
                    hero
                    VStack(alignment: .leading, spacing: 24) {
                        summary
                        if !person.todos.isEmpty { todos }
                        where_
                        if !mutuals.isEmpty { mutualsRow }
                        momentsList
                    }
                    .padding(.horizontal, 16).padding(.top, 20).padding(.bottom, 100)
                }
            }
            .ignoresSafeArea(edges: .top) // hero runs under the status bar
            .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y + $0.contentInsets.top } action: { _, y in scrolled = y }
            topBar
        }
        .safeAreaInset(edge: .bottom) {
            Composer(placeholder: "Add a moment") { text in
                let m = PeopleStore.addMoment(to: person, note: text, in: context)
                openMoment = m.id
                nav.say("New moment saved")
            }
            .padding(.horizontal, 16).padding(.bottom, 8)
        }
    }

    private func monthYear(_ iso: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        guard let d = f.date(from: String(iso.prefix(10))) else { return iso }
        f.dateFormat = "MMM yyyy"
        return f.string(from: d)
    }

    private var aura: some View {
        let c = blob.soft.map { Color(hex: $0) }
        return ZStack {
            Circle().fill(c[0]).frame(width: 360).blur(radius: 90).offset(x: -140, y: 360)
            Circle().fill(c[1]).frame(width: 320).blur(radius: 90).offset(x: 160, y: 620)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity).opacity(0.6).allowsHitTesting(false)
    }

    private var hero: some View {
        VStack(spacing: 6) {
            Avatar(id: person.id, size: 60).padding(.bottom, 6)
            Text(person.name).font(.system(size: 20, weight: .medium)).foregroundStyle(.white)
            Text("\(person.profession) · \(person.livesNow.city)").font(.system(size: 13)).foregroundStyle(.white.opacity(0.85))
            Text(metDate).font(.system(size: 13)).foregroundStyle(Color(hex: "cccccc"))
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity).padding(.top, 150).padding(.bottom, 32)
        .background {
            ZStack {
                Color(hex: blob.base)
                Circle().fill(Color(hex: blob.mid)).frame(width: 220).blur(radius: 23).offset(x: -110, y: -50)
                Circle().fill(Color(hex: blob.accent)).frame(width: 200).blur(radius: 23).offset(x: 140, y: 0)
                Circle().fill(Color(hex: blob.deep)).frame(width: 220).blur(radius: 23).offset(x: -120, y: 70)
            }
            .clipped()
        }
        .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 28, bottomTrailingRadius: 28))
    }

    private var topBar: some View {
        let p = min(max((scrolled - 90) / 40, 0), 1)
        return ZStack {
            Color(hex: blob.base).opacity(p).ignoresSafeArea(edges: .top)
            Text(person.name).font(.system(size: 16, weight: .medium)).foregroundStyle(.white).opacity(p)
            HStack {
                circleButton("chevron.left", label: "Back") { nav.pop() }
                Spacer()
                circleButton("ellipsis", label: "More") { nav.say("Coming soon") }
            }
            .padding(.horizontal, 16)
        }
        .frame(height: 56)
    }

    private func circleButton(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 44, height: 44).glassEffect(.regular.tint(.white.opacity(0.14)), in: .circle)
        }
        .buttonStyle(.plain).accessibilityLabel(label)
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(person.story).font(.system(size: 15)).foregroundStyle(Theme.ink)
            if !person.tags.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(person.tags, id: \.self) { t in
                        Text(t).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.inkMuted)
                            .padding(.horizontal, 10).padding(.vertical, 5).background(Theme.pressed, in: .capsule)
                    }
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).glass(20)
    }

    private var todos: some View {
        VStack(alignment: .leading, spacing: 8) {
            header("Things to do with \(person.firstName)")
            ForEach(person.todos.sorted { $0.id < $1.id }) { t in
                Button { t.done.toggle(); try? context.save() } label: {
                    HStack(spacing: 12) {
                        Image(systemName: t.done ? "checkmark.circle.fill" : "circle").foregroundStyle(t.done ? Theme.ink : Theme.inkMuted)
                        Text(t.text).strikethrough(t.done).font(.system(size: 15)).foregroundStyle(Theme.ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .opacity(t.done ? 0.5 : 1).padding(14).glass(16)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var where_: some View {
        VStack(alignment: .leading, spacing: 8) {
            header("Where")
            HStack(spacing: 8) {
                tile("From", person.from.city)
                tile("Met", person.met.context ?? person.met.city)
                tile("Lives now", person.livesNow.city)
            }
        }
    }

    private func tile(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 12)).foregroundStyle(Theme.inkMuted)
            Text(value).font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.ink).lineLimit(2)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading).glass(16)
    }

    private var mutualsRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            header("Mutuals")
            ScrollView(.horizontal) {
                HStack(spacing: 16) {
                    ForEach(mutuals) { m in
                        Button { nav.push(.profile(m.id)) } label: {
                            VStack(spacing: 4) {
                                Avatar(id: m.id, size: 48)
                                Text(m.firstName).font(.system(size: 12)).foregroundStyle(Theme.ink)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .scrollIndicators(.hidden)
        }
    }

    private var momentsList: some View {
        VStack(alignment: .leading, spacing: 8) {
            header("Moments")
            ForEach(moments) { m in
                let open = openMoment == m.id
                Button { openMoment = open ? nil : m.id } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(m.firstMeeting ? "First meeting" : m.title).font(.system(size: 15, weight: .medium))
                            Spacer()
                            Text(monthYear(m.date)).font(.system(size: 12)).foregroundStyle(Theme.inkMuted)
                        }
                        .foregroundStyle(Theme.ink)
                        if open, let body = m.text ?? m.transcript {
                            Text(body).font(.system(size: 14)).foregroundStyle(Theme.inkMuted)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(14).glass(16)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func header(_ s: String) -> some View {
        Text(s).font(.system(size: 18, weight: .medium)).tracking(-0.5).foregroundStyle(Theme.ink)
    }
}

// Minimal wrapping row for tag chips.
private struct FlowLayout: Layout {
    var spacing: CGFloat
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal.width ?? 300, subviews).size
    }
    func placeSubviews(in b: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (s, p) in zip(subviews, arrange(b.width, subviews).points) { s.place(at: CGPoint(x: b.minX + p.x, y: b.minY + p.y), proposal: .unspecified) }
    }
    private func arrange(_ w: CGFloat, _ subs: Subviews) -> (size: CGSize, points: [CGPoint]) {
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, pts: [CGPoint] = []
        for s in subs {
            let sz = s.sizeThatFits(.unspecified)
            if x + sz.width > w, x > 0 { x = 0; y += row + spacing; row = 0 }
            pts.append(CGPoint(x: x, y: y)); x += sz.width + spacing; row = max(row, sz.height)
        }
        return (CGSize(width: w, height: y + row), pts)
    }
}
