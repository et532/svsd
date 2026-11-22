import SwiftUI
import SwiftData

/// "Search for someone by…": ask a question; Peepl finds the people, says why, and can draft the message (web AskScreen).
struct FindView: View {
    var voice = false // opened from the ask bar's mic: start listening
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    @Query private var people: [Person]

    @State private var pending: String?
    @State private var asked: Asked?
    @State private var seq = 0 // only the latest question may show its answer

    private struct Asked { var text: String; var result: AskResult }
    private static let minThink = Duration.milliseconds(450)
    private static let ways = [
        ("gamecontroller", "Interest", "Someone to go climbing with", "Someone to go climbing with"),
        ("party.popper", "Occasion", "Someone to invite to a house party", "friends"),
        ("mappin.and.ellipse", "Location", "Someone to hang out in the city", "friends in New York"),
    ]
    /// Debug only: `-findQuery "<question>"` as a launch argument asks it at once (for screenshots).
    private var preset: String? {
        #if DEBUG
        UserDefaults.standard.string(forKey: "findQuery")
        #else
        nil
        #endif
    }

    var body: some View {
        ZStack {
            FindAura()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let pending {
                        title(pending)
                        Thinking()
                    } else if let asked {
                        title(asked.text)
                        answer(asked.result)
                    } else {
                        title("Search for someone by…")
                        ForEach(Self.ways, id: \.1) { way in
                            Button { ask(way.2, query: way.3) } label: {
                                HStack(spacing: 14) {
                                    Image(systemName: way.0).font(Theme.font(20)).foregroundStyle(Theme.ink).frame(width: 28)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(way.1).font(Theme.font(16, .medium)).foregroundStyle(Theme.ink)
                                        Text("“\(way.2)”").font(Theme.font(13)).foregroundStyle(Theme.inkMuted)
                                    }
                                    Spacer()
                                }
                                .padding(16).glass(20)
                            }.buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 20).padding(.top, 80).padding(.bottom, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .safeAreaInset(edge: .bottom) {
            Composer(placeholder: "Ask me about people", autofocus: preset == nil, onSend: { ask($0) }, startVoice: voice).padding(.horizontal, 16).padding(.bottom, 8)
        }
        .task { if let q = preset, asked == nil, pending == nil { ask(q) } }
    }

    private func title(_ s: String) -> some View {
        Text(s).font(Theme.font(28, .light)).tracking(-1.1).foregroundStyle(Theme.ink)
    }
    private func note(_ s: String) -> some View {
        Text(s).font(Theme.font(16)).foregroundStyle(Theme.inkMuted)
    }
    private func wide(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).font(Theme.font(15, .medium)).foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity).frame(height: 48).pastel(in: Capsule())
        }.buttonStyle(.plain)
    }

    @ViewBuilder private func answer(_ result: AskResult) -> some View {
        switch result {
        case .add: note("Okay, let’s add someone new…")
        case .moment(let p), .profile(let p): note("Opening \(p.name)…")
        case .none(let title): note("\(title). Try “who’s into music?”, “people I met at Config” or “who lives in London?”")
        case .people(let a) where a.matches.isEmpty:
            note("\(a.title). None of the \(people.count) \(people.count == 1 ? "person" : "people") in your list fit, so I won’t guess.")
            if let near = a.near, !near.isEmpty {
                group("Closest, but not quite", near)
            }
            wide("Add someone new") { nav.replaceTop(.add(mutualOf: nil)) }
        case .people(let a):
            if let n = a.note { note(n) }
            ForEach(a.groups ?? [MatchGroup(label: "", matches: a.matches)], id: \.label) { g in
                group(g.label, Array(g.matches.prefix(6)))
            }
            if a.matches.count > 6 { note("and \(a.matches.count - 6) more") }
            wide("Show \(a.matches.count == 1 ? "them" : "all \(a.matches.count)") \(nav.tab == .mindmap ? "on the mindmap" : "in your list")") {
                nav.showFilter = PeopleFilter(ids: a.matches.map(\.id),
                                              label: a.title.replacingOccurrences(of: #"^\d+ (people|person) · "#, with: "", options: .regularExpression))
                nav.focus = nil
                nav.pop()
            }
        }
    }

    @ViewBuilder private func group(_ label: String, _ matches: [Match]) -> some View {
        if !label.isEmpty { Text(label.uppercased()).font(Theme.font(12, .medium)).tracking(0.6).foregroundStyle(Theme.inkMuted) }
        ForEach(matches) { m in
            FindCard(match: m, open: { nav.push(.profile(m.id)) }, sent: sent)
        }
    }

    /// `query` is what gets searched when the shown text is a loose example (the cards).
    private func ask(_ text: String, query: String? = nil) {
        seq += 1
        let mine = seq, asking = query ?? text
        let infos = people.map(PersonInfo.init)
        asked = nil; pending = text
        Task {
            // Off the main thread: the model load, the embedding and the ranking.
            async let found = Task.detached { () -> AskResult in
                let rules = Ask.interpret(asking, people: infos)
                if Ask.isSpecial(rules) { return rules }
                let embedder = Embedders.current
                let ranked = await Search.answer(asking, people: infos, embedder: embedder)
                return await AIClient.rank(asking, result: ranked, people: infos, embedder: embedder)
            }.value
            try? await Task.sleep(for: Self.minThink) // a very quick answer is held for a beat so it doesn't flash
            let result = await found
            guard mine == seq else { return }
            pending = nil; asked = Asked(text: text, result: result)
            // Actions hand off to the right screen after a beat, so you see what's happening
            let go: (() -> Void)? = switch result {
            case .add: { nav.replaceTop(.add(mutualOf: nil)) }
            case .moment(let p), .profile(let p): { nav.push(.profile(p.id)) }
            default: nil
            }
            if let go {
                try? await Task.sleep(for: .milliseconds(900))
                if mine == seq { go() }
            }
        }
    }

    /// Copying or sharing a draft counts as sending it: tick off the follow-up it answers.
    private func sent(_ action: Action) {
        if let c = action.closes, let todo = people.first(where: { $0.id == c.personId })?.todos.first(where: { $0.id == c.todoId }) {
            todo.done = true
            try? context.save()
        }
        nav.say("Draft for \(action.to.split(separator: " ").first.map(String.init) ?? action.to) ready")
    }
}

/// Name and "job · city", then why they came up, then the drafted next step.
private struct FindCard: View {
    let match: Match
    let open: () -> Void
    let sent: (Action) -> Void
    @State private var text: String? // the draft, once opened inline
    @State private var writing = false

    var body: some View {
        let p = match.person
        VStack(alignment: .leading, spacing: 12) {
            Button(action: open) {
                HStack(spacing: 12) {
                    Avatar(id: p.id, size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(p.name).font(Theme.font(16, .medium)).foregroundStyle(Theme.ink)
                        Text([p.profession, p.livesNow.city].filter { !$0.isEmpty && $0 != "Unknown" }.joined(separator: " · "))
                            .font(Theme.font(13)).foregroundStyle(Theme.inkMuted).lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right").font(Theme.font(13, .semibold)).foregroundStyle(.tertiary)
                }
                .contentShape(Rectangle())
            }.buttonStyle(.plain)
            Divider()
            if let via = match.via { Text(via.uppercased()).font(Theme.font(11, .medium)).tracking(0.6).foregroundStyle(Theme.inkMuted) }
            Text(match.why).font(Theme.font(17, .light)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            if let action = match.action {
                if text == nil {
                    Button {
                        text = ""; writing = true
                        Task { text = await AIClient.draft(p, action: action); writing = false }
                    } label: {
                        Text(action.label).font(Theme.font(15, .medium)).foregroundStyle(Theme.ink)
                            .frame(maxWidth: .infinity).frame(height: 40).background(.white, in: .capsule)
                    }.buttonStyle(.plain)
                } else {
                    TextField("", text: Binding(get: { text ?? "" }, set: { text = $0 }), prompt: Text(writing ? "Writing…" : ""), axis: .vertical)
                        .font(Theme.font(16)).foregroundStyle(Theme.ink).lineLimit(3...10).disabled(writing)
                        .padding(12).background(.white.opacity(0.8), in: .rect(cornerRadius: 16))
                        .accessibilityLabel("Message")
                    HStack(spacing: 8) {
                        Button { UIPasteboard.general.string = text; sent(action) } label: { pill("Copy Text") }.buttonStyle(.plain)
                        ShareLink(item: text ?? "") { pill("Share") }.buttonStyle(.plain)
                            .simultaneousGesture(TapGesture().onEnded { sent(action) })
                    }
                    .disabled(writing || (text ?? "").isEmpty)
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).glass(20)
    }

    private func pill(_ s: String) -> some View {
        Text(s).font(Theme.font(15, .medium)).foregroundStyle(Theme.ink)
            .padding(.horizontal, 18).frame(height: 40).background(Theme.pressed, in: .capsule)
    }
}

/// A status line that changes as the search moves along, over placeholder cards.
private struct Thinking: View {
    private static let steps = ["Reading your notes…", "Looking through your people…", "Picking the best matches…"]
    @State private var step = 0

    var body: some View {
        Text(Self.steps[step]).font(Theme.font(16)).foregroundStyle(Theme.inkMuted)
            .task {
                while step < Self.steps.count - 1 {
                    try? await Task.sleep(for: .milliseconds(530))
                    if Task.isCancelled { return }
                    step += 1
                }
            }
        ForEach(0..<2, id: \.self) { _ in
            Shimmer().frame(height: 120).clipShape(.rect(cornerRadius: 20))
        }
        .accessibilityHidden(true)
    }
}

// Same pastel orbs as AddView's (private there; AddView is being changed by M4, so not shared yet).
private struct FindAura: View {
    var body: some View {
        ZStack {
            Circle().fill(Color(hex: "f5b5d3")).frame(width: 320).offset(x: -120, y: -260)
            Circle().fill(Color(hex: "ffe08a")).frame(width: 300).offset(x: 140, y: -120)
            Circle().fill(Color(hex: "a9c4ff")).frame(width: 340).offset(x: -140, y: 200)
            Circle().fill(Color(hex: "ffb899")).frame(width: 280).offset(x: 150, y: 300)
        }
        .blur(radius: 90).opacity(0.6).ignoresSafeArea()
    }
}
