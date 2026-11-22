import SwiftUI
import SwiftData

struct ProfileView: View {
    let person: Person
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    @Query private var everyone: [Person]
    @State private var scrolled: CGFloat = 0
    @State private var openMoment: String?
    @State private var addingTag = false
    @State private var addingTodo = false
    @State private var confirmDelete = false
    @State private var deleted = false
    @State private var newMoment: String?
    @State private var addBounce = 0
    @Environment(\.accessibilityReduceMotion) private var reduce

    /// Runs `body` with a Motion animation (a short fade under Reduce Motion).
    private func go(_ a: Animation, _ body: () -> Void) { withAnimation(Motion.animation(a, reduce: reduce), body) }
    /// Slides / scales are plain fades under Reduce Motion.
    private func tr(_ t: AnyTransition) -> AnyTransition { reduce ? .opacity : t }

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
            ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 0) {
                    hero
                    VStack(alignment: .leading, spacing: 24) {
                        summary.appear(0)
                        todos.appear(1)
                        where_.appear(2)
                        mutualsRow.appear(3)
                        momentsList.appear(4)
                    }
                    .padding(.horizontal, 16).padding(.top, 20).padding(.bottom, 100)
                }
                .offset(y: min(scrolled, 0)) // the banner stays put: pulling down at the top can't reveal what is behind it
            }
            .scrollDismissesKeyboard(.immediately) // leaving an inline field saves it
            .ignoresSafeArea(edges: .top) // hero runs under the status bar
            .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y + $0.contentInsets.top } action: { _, y in scrolled = y }
            .onChange(of: newMoment) { _, id in
                guard let id else { return }
                go(Motion.smooth) { proxy.scrollTo(id, anchor: .center) }
                newMoment = nil
            }
            }
            topBar
        }
        .safeAreaInset(edge: .bottom) {
            if !addingTag && !addingTodo { // the inline field has the keyboard
                Composer(placeholder: "Add a moment", onSend: { text in
                    go(Motion.smooth) {
                        let m = PeopleStore.addMoment(to: person, note: text, in: context)
                        openMoment = m.id
                        newMoment = m.id
                    }
                    nav.say("New moment saved")
                }, people: everyone)
                .padding(.horizontal, 16).padding(.bottom, 8)
                .background(alignment: .bottom) {
                    // a soft darkening behind the input, so it reads as something to tap
                    LinearGradient(colors: [.clear, Color(hex: "3b2a5e").opacity(0.45)], startPoint: .top, endPoint: .bottom)
                        .frame(height: 170).ignoresSafeArea(edges: .bottom).allowsHitTesting(false)
                }
            }
        }
        .onAppear {
            if let f = nav.fresh, person.moments.contains(where: { $0.id == f }) { openMoment = f; nav.fresh = nil }
        }
        .sensoryFeedback(.warning, trigger: deleted)
        .confirmationDialog("Delete \(person.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete person", role: .destructive) {
                let p = person, ctx = context
                deleted.toggle()
                nav.forget(p.id)
                nav.say("\(p.firstName) deleted")
                // once the profile has slid away: a view must never read a deleted person
                Task { try? await Task.sleep(for: .milliseconds(450)); PeopleStore.delete([p], in: ctx) }
            }
        } message: {
            Text("Their moments and to-dos go too, and they leave other people's mutuals. This can't be undone.")
        }
    }

    /// Web dateLabel: "Today" or "Oct 22".
    private func dayLabel(_ iso: String) -> String {
        if String(iso.prefix(10)) == Capture.today() { return "Today" }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        guard let d = f.date(from: String(iso.prefix(10))) else { return iso }
        f.dateFormat = "MMM d"
        return f.string(from: d)
    }

    /// Tags other people have that this person doesn't, most common first.
    private var tagIdeas: [String] {
        var count: [String: Int] = [:]
        for x in everyone { for t in x.tags where !person.tags.contains(t) { count[t, default: 0] += 1 } }
        return count.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }.prefix(4).map(\.key)
    }

    private func addTag(_ text: String?) {
        guard let tag = text?.lowercased(), !person.tags.contains(tag) else { go(Motion.snap) { addingTag = false }; return }
        go(Motion.snap) { addingTag = false; person.tags.append(tag) }
        try? context.save()
    }

    private func addTodo(_ text: String?) {
        guard let text else { go(Motion.snap) { addingTodo = false }; return }
        go(Motion.smooth) { addingTodo = false; person.addTodo(id: Capture.uid(), text: text) }
        try? context.save()
    }

    private var aura: some View {
        let c = blob.soft
        return PastelAura(orbs: [.init(color: c[0], size: 360, x: -140, y: 360), .init(color: c[1], size: 320, x: 160, y: 620)])
            .equatable()
    }

    private var heroFade: CGFloat { min(max((scrolled - 40) / 80, 0), 1) }

    private var hero: some View {
        // Figma "Profile Top": 233 pt tall, avatar left, name and details beside it
        HStack(spacing: 16) {
            Avatar(id: person.id, size: 88).scaleEffect(1 - 0.15 * heroFade).opacity(1 - heroFade)
            VStack(alignment: .leading, spacing: 6) {
                Text(person.name).font(Theme.font(20, .medium)).foregroundStyle(.white)
                Text(person.subtitle).font(Theme.font(13)).foregroundStyle(.white.opacity(0.85))
                Text(metDate).font(Theme.font(13)).foregroundStyle(Color(hex: "cccccc"))
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 22).padding(.top, 118).padding(.bottom, 22)
        .frame(maxWidth: .infinity, alignment: .leading)
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
            Text(person.name).font(Theme.font(16, .medium)).foregroundStyle(.white).opacity(p)
            HStack {
                iconButton("chevron.left", label: "Back", id: nil, glass: 1 - p) { nav.pop() }
                Spacer()
                iconButton("trash", label: "Delete person", id: "More", glass: 1 - p, tint: Color(hex: "d62839")) { confirmDelete = true }
            }
            .padding(.horizontal, 12)
        }
        .frame(height: 56)
        .padding(.bottom, 18) // room under the buttons before the colour ends
        .background(alignment: .top) {
            UnevenRoundedRectangle(bottomLeadingRadius: 28, bottomTrailingRadius: 28)
                .fill(Color(hex: blob.base)).opacity(p).ignoresSafeArea(edges: .top)
        }
    }

    /// Pastel circle behind the icon on the expanded banner (`glass` 1), plain icon once the bar has collapsed (0).
    private func iconButton(_ icon: String, label: String, id: String?, glass: CGFloat, tint: Color = Theme.ink, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(Theme.font(18, .semibold))
                .foregroundStyle(tint.mix(with: .white, by: 1 - glass)) // dark on the pastel circle, white once it is gone
                .frame(width: 44, height: 44).contentShape(.rect)
                .background { Circle().fill(Color(hex: "faf7ff").opacity(0.94)).opacity(glass) }
        }
        .buttonStyle(PressStyle(scale: 0.92)).accessibilityLabel(label).accessibilityIdentifier(id ?? label)
    }

    private func chip(_ t: String, ghost: Bool = false) -> some View {
        Text(t).font(Theme.font(12, .medium)).foregroundStyle(Theme.inkMuted)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(ghost ? Color.clear : Theme.pressed, in: .capsule)
            .overlay { if ghost { Capsule().stroke(Theme.inkMuted.opacity(0.3), lineWidth: 1) } }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(person.story).font(Theme.font(15)).foregroundStyle(Theme.ink)
            FlowLayout(spacing: 6) {
                ForEach(person.tags, id: \.self) { chip($0).transition(tr(.scale.combined(with: .opacity))) }
                if addingTag {
                    InlineField(placeholder: "New tag", size: 12, onDone: addTag).frame(width: 110)
                        .padding(.horizontal, 10).padding(.vertical, 5).overlay(Capsule().stroke(Theme.ink, lineWidth: 1))
                        .transition(tr(.scale(scale: 0.9, anchor: .leading).combined(with: .opacity)))
                } else {
                    Button { go(Motion.snap) { addingTag = true } } label: { chip("+ tag", ghost: true) }.buttonStyle(PressStyle(scale: 0.94)).accessibilityLabel("Add tag")
                        .transition(tr(.scale(scale: 0.9, anchor: .leading).combined(with: .opacity)))
                }
            }
            .animation(Motion.animation(Motion.snap, reduce: reduce), value: person.tags)
            if addingTag, !tagIdeas.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(tagIdeas, id: \.self) { t in
                        Button { addTag(t) } label: { chip(t, ghost: true) }.buttonStyle(PressStyle(scale: 0.94))
                    }
                }
                .transition(tr(.opacity.combined(with: .offset(y: 6))))
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).glass(20)
    }

    private var todos: some View {
        VStack(alignment: .leading, spacing: 8) {
            header("Things to do with \(person.firstName)")
            // Figma: one card, rows split by hairlines
            VStack(spacing: 0) {
                ForEach(person.orderedTodos) { t in
                    VStack(spacing: 0) {
                        Button { go(Motion.snap) { t.done.toggle() }; try? context.save() } label: {
                            HStack(spacing: 10) {
                                Image(systemName: t.done ? "checkmark.circle.fill" : "circle").font(Theme.font(17))
                                    .foregroundStyle(t.done ? Theme.ink : Theme.inkMuted.opacity(0.6))
                                    .symbolEffect(.bounce, value: reduce ? false : t.done)
                                Text(t.text).strikethrough(t.done).font(Theme.font(15)).foregroundStyle(Theme.ink)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .opacity(t.done ? 0.45 : 1).padding(.horizontal, 16).padding(.vertical, 14).contentShape(.rect)
                        }
                        .buttonStyle(PressStyle(scale: 0.99))
                        .accessibilityLabel(t.text).accessibilityValue(t.done ? "Done" : "To do")
                        .sensoryFeedback(.selection, trigger: t.done)
                        Divider().padding(.leading, 16)
                    }
                    .transition(tr(.move(edge: .top).combined(with: .opacity)))
                }
                if addingTodo {
                    InlineField(placeholder: "Something to do with \(person.firstName)", size: 15, onDone: addTodo).padding(16)
                        .transition(tr(.scale(scale: 0.9, anchor: .leading).combined(with: .opacity)))
                } else {
                    Button { go(Motion.snap) { addingTodo = true } } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "plus").font(Theme.font(12, .semibold))
                            Text("Add something to do").font(Theme.font(14))
                            Spacer()
                        }
                        .foregroundStyle(Theme.inkMuted).padding(16).contentShape(.rect)
                    }
                    .buttonStyle(PressStyle(scale: 0.95))
                    .transition(tr(.scale(scale: 0.9, anchor: .leading).combined(with: .opacity)))
                }
            }
            .glass(16)
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
            Text(label).font(Theme.font(12)).foregroundStyle(Theme.inkMuted)
            Text(value).font(Theme.font(14, .medium)).foregroundStyle(Theme.ink).lineLimit(2)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading).glass(16)
    }

    private var mutualsRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                header("Mutuals")
                Spacer()
                Button("View connections") { nav.viewConnections(person) }
                    .font(Theme.font(13, .medium)).foregroundStyle(Theme.inkMuted).buttonStyle(PressStyle(scale: 0.95))
            }
            ScrollView(.horizontal) {
                HStack(alignment: .top, spacing: 16) {
                    Button { addBounce += 1; nav.push(.add(mutualOf: person.id)) } label: {
                        VStack(spacing: 4) {
                            Image(systemName: "plus").font(Theme.font(18)).foregroundStyle(Theme.inkMuted).symbolEffect(.bounce, value: reduce ? 0 : addBounce).frame(width: 48, height: 48)
                                .overlay(Circle().stroke(Theme.inkMuted.opacity(0.5), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])))
                            Text("Add").font(Theme.font(12)).foregroundStyle(Theme.ink)
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(PressStyle(scale: 0.92)).accessibilityLabel("Add mutual")
                    ForEach(mutuals) { m in
                        Button { nav.push(.profile(m.id)) } label: {
                            VStack(spacing: 4) {
                                Avatar(id: m.id, size: 48)
                                Text(m.firstName).font(Theme.font(12)).foregroundStyle(Theme.ink)
                                if let note = person.mutualNotes[m.id] {
                                    Text(note).font(Theme.font(10)).foregroundStyle(Theme.inkMuted).lineLimit(2).frame(maxWidth: 72)
                                }
                            }
                        }
                        .buttonStyle(PressStyle(scale: 0.92)).accessibilityLabel(m.name)
                    }
                }
                .padding(.vertical, 2)
            }
            .scrollIndicators(.hidden)
        }
    }

    private var momentsList: some View {
        VStack(alignment: .leading, spacing: 8) {
            header("Moments")
            ForEach(moments) { m in
                let open = openMoment == m.id
                VStack(alignment: .leading, spacing: 10) {
                    Button { go(Motion.smooth) { openMoment = open ? nil : m.id } } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(dayLabel(m.date)).font(Theme.font(12)).foregroundStyle(Theme.inkMuted)
                                Text(m.title).font(Theme.font(15, .medium)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(Theme.font(13, .semibold)).foregroundStyle(Theme.inkMuted)
                                .rotationEffect(.degrees(open ? 90 : 0))
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(PressStyle(scale: 0.98)).accessibilityValue(open ? "Open" : "Closed")
                    if open {
                        VStack(alignment: .leading, spacing: 10) {
                            if let text = m.text, text != m.title {
                                Text(text).font(Theme.font(14)).foregroundStyle(Theme.inkMuted).frame(maxWidth: .infinity, alignment: .leading)
                            }
                            if let t = m.transcript { VoiceNote(transcript: t, seconds: m.seconds) }
                        }
                        .transition(tr(.opacity.combined(with: .move(edge: .top))))
                    }
                }
                .padding(14).glass(16)
                .overlay { RoundedRectangle(cornerRadius: 16).stroke(Color(hex: "4f7cff"), lineWidth: 1.5).opacity(open ? 1 : 0) }
                .animation(Motion.animation(Motion.snap, reduce: reduce), value: open)
                .id(m.id)
                .transition(tr(.scale(scale: 0.96).combined(with: .opacity)))
            }
        }
    }

    private func header(_ s: String) -> some View {
        Text(s.uppercased()).font(Theme.mono(11)).tracking(0.6).foregroundStyle(Theme.inkMuted).accessibilityLabel(s)
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

/// One-line field for adding a tag / to-do in place: Return saves, leaving it saves if there's text.
private struct InlineField: View {
    let placeholder: String
    let size: CGFloat
    let onDone: (String?) -> Void
    @State private var text = ""
    @State private var done = false
    @FocusState private var focused: Bool

    var body: some View {
        TextField(placeholder, text: $text).font(Theme.font(size)).foregroundStyle(Theme.ink)
            .focused($focused).submitLabel(.done)
            .onAppear { focused = true }
            .onSubmit(finish)
            .onChange(of: focused) { _, on in if !on { finish() } }
            .onChange(of: text) { _, t in if t.count > 80 { text = String(t.prefix(80)) } }
    }

    private func finish() {
        guard !done else { return }
        done = true
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        onDone(t.isEmpty ? nil : t)
    }
}

/// A moment's note. A voice note "plays": the transcript fills in along a waveform (no audio is kept, as on the web).
private struct VoiceNote: View {
    let transcript: String
    let seconds: Int?
    @State private var at = 0 // bars played
    @State private var playing = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    private static let wave = (0..<40).map { 4 + Double(($0 * 7) % 11) * 1.6 }

    var body: some View {
        if let seconds, seconds > 0 {
            let words = transcript.split(separator: " ")
            let said = at >= Self.wave.count ? words.count : at * words.count / Self.wave.count
            VStack(alignment: .leading, spacing: 10) {
                (Text(words.prefix(said).joined(separator: " ") + (said > 0 ? " " : "")).foregroundStyle(Theme.ink)
                    + Text(words.dropFirst(said).joined(separator: " ")).foregroundStyle(at == 0 ? Theme.ink : Theme.inkMuted.opacity(0.5)))
                    .font(Theme.font(14)).frame(maxWidth: .infinity, alignment: .leading)
                    .animation(reduce ? nil : .easeOut(duration: 0.12), value: said)
                HStack(spacing: 10) {
                    Button {
                        if !playing, at >= Self.wave.count { at = 0 }
                        withAnimation(Motion.animation(Motion.snap, reduce: reduce)) { playing.toggle() }
                    } label: {
                        Image(systemName: playing ? "pause.fill" : "play.fill").font(Theme.font(12)).foregroundStyle(.white)
                            .contentTransition(reduce ? .identity : .symbolEffect(.replace))
                            .frame(width: 32, height: 32).background(Theme.night, in: .circle)
                    }
                    .buttonStyle(PressStyle(scale: 0.9)).accessibilityLabel(playing ? "Pause voice note" : "Play voice note")
                    HStack(spacing: 2) {
                        ForEach(Self.wave.indices, id: \.self) { i in
                            Capsule().fill(i < at ? Theme.ink : Theme.inkMuted.opacity(0.3)).frame(width: 2.5, height: Self.wave[i])
                                .animation(reduce ? nil : .linear(duration: 0.14), value: at)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).accessibilityHidden(true)
                    Text("\(seconds / 60):\(String(format: "%02d", seconds % 60))").font(Theme.font(12)).foregroundStyle(Theme.inkMuted)
                }
            }
            .task(id: playing) {
                while playing, at < Self.wave.count {
                    try? await Task.sleep(for: .milliseconds(140))
                    if Task.isCancelled { return }
                    at += 1
                }
                playing = false
            }
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text("Typed note").font(Theme.font(12)).foregroundStyle(Theme.inkMuted)
                Text("“\(transcript)”").font(Theme.font(14)).foregroundStyle(Theme.ink)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
