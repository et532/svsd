import SwiftUI
import SwiftData

enum AddMany {
    /// Web `list()`: "A", "A and B", "A, B and C".
    static func list(_ n: [String]) -> String {
        n.count < 2 ? (n.first ?? "") : n.dropLast().joined(separator: ", ") + " and " + n.last!
    }

    /// One profile per person note (same parse as a single note), all linked to each other both ways.
    @MainActor static func create(_ notes: [PersonNote], people: [Person], in context: ModelContext,
                                  aiFor: (String) async -> Draft? = { _ in nil }) async -> [Person] {
        var made: [Person] = []
        for n in notes {
            let d = Capture.parsePerson(n.text, people: people).merged(with: await aiFor(n.text))
            made.append(PeopleStore.createPerson(d, note: n.text, in: context).person)
        }
        for p in made { for q in made where q.id != p.id && !p.knows.contains(q.id) { p.knows.append(q.id) } }
        try? context.save()
        return made
    }
}

/// Which way a sent note goes: a moment with someone you know, a choice between same-named people, or a new person.
enum AddPath<P> {
    case moment(P), choose([P]), newPerson

    static func decide(_ note: String, people: [P]) -> AddPath where P: Named {
        let c = Capture.momentCandidates(note, people: people)
        return c.count == 1 ? .moment(c[0]) : c.isEmpty ? .newPerson : .choose(c)
    }
}

struct AddView: View {
    let mutualOf: String?
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    @Query private var people: [Person]

    private enum Phase { case idle, choosing([Person]), creating(String), done(Person), doneMany([Person]) }
    @State private var phase = Phase.idle
    @State private var note = ""
    @Namespace private var ns
    @Environment(\.accessibilityReduceMotion) private var reduce

    /// `Phase` carries values and is not Equatable, so animations key on this.
    private var phaseKey: Int {
        switch phase { case .idle: 0; case .choosing: 1; case .creating: 2; case .done: 3; case .doneMany: 4 }
    }
    private var enter: AnyTransition { reduce ? .opacity : .opacity.combined(with: .offset(y: 12)) }

    private var heading: String {
        if let id = mutualOf, let p = people.first(where: { $0.id == id }) { return "Who does \(p.firstName) know?" }
        return "Tell me about a new person or moment"
    }

    var body: some View {
        ZStack {
            PastelAura().equatable()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch phase {
                    case .idle:
                        title(heading).padding(.top, 60).transition(enter) // Figma 2.2b: the heading sits a third of the way down
                    case .choosing(let c):
                        bubble
                        title("Which \(c[0].firstName) did you catch up with?")
                        ForEach(Array(c.enumerated()), id: \.element.id) { i, p in
                            Button { saveMoment(p) } label: { candidateRow(p) }.buttonStyle(PressStyle(scale: 0.98))
                                .modifier(Arrive(i, step: 0.05))
                        }
                        Button { startNew() } label: {
                            Text("Neither, add a new profile").font(Theme.font(15, .medium)).foregroundStyle(.white)
                                .padding(.horizontal, 18).padding(.vertical, 12).background(Theme.night, in: .capsule)
                        }.buttonStyle(PressStyle(scale: 0.96)).modifier(Arrive(c.count, step: 0.05))
                    case .creating:
                        bubble
                        let notes = mutualOf == nil ? Capture.splitPeople(note) : []
                        if notes.count > 1 {
                            title("Creating \(notes.count) new profiles for \(AddMany.list(notes.map(\.name)))…")
                            ForEach(notes, id: \.name) { _ in
                                Shimmer().frame(height: 96).clipShape(.rect(cornerRadius: 24)).transition(enter)
                            }
                        } else {
                            title("Creating a new profile for \(Capture.parsePerson(note, people: people).name ?? "them")…")
                            Shimmer().frame(height: 96).clipShape(.rect(cornerRadius: 24))
                                .matchedGeometryEffect(id: "result", in: ns).transition(enter)
                        }
                    case .done(let p):
                        bubble
                        Button { nav.replaceTop(.profile(p.id)) } label: { ResultCard(person: p) }.buttonStyle(PressStyle(scale: 0.98))
                            .modifier(Arrive(0, scale: 0.96, spring: true)).matchedGeometryEffect(id: "result", in: ns)
                    case .doneMany(let ps):
                        bubble
                        ForEach(Array(ps.enumerated()), id: \.element.id) { i, p in
                            Button { nav.replaceTop(.profile(p.id)) } label: { ResultCard(person: p) }.buttonStyle(PressStyle(scale: 0.98))
                                .modifier(Arrive(i, step: 0.08, scale: 0.96, spring: true))
                        }
                        Text("\(AddMany.list(ps.map(\.firstName))) were met together, so they're linked as mutuals.")
                            .font(Theme.font(13)).foregroundStyle(Theme.inkMuted).modifier(Arrive(ps.count, step: 0.08))
                    }
                }
                .padding(.horizontal, 20).padding(.top, 80).padding(.bottom, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
                .animation(Motion.animation(Motion.smooth, reduce: reduce), value: phaseKey)
            }
        }
        .sensoryFeedback(.success, trigger: phaseKey) { _, new in new >= 3 } // the result card landed
        .safeAreaInset(edge: .bottom) {
            Composer(placeholder: "Who did you meet?", autofocus: true, onSend: send, people: people).padding(.horizontal, 16).padding(.bottom, 8)
        }
    }

    private func title(_ s: String) -> some View {
        Text(s).font(Theme.font(28, .light)).tracking(-1.1).foregroundStyle(Theme.ink)
            .contentTransition(.opacity).animation(Motion.animation(Motion.smooth, reduce: reduce), value: s)
    }

    private var bubble: some View {
        Text(note).font(Theme.font(16)).foregroundStyle(Theme.ink).padding(14)
            .background(.white.opacity(0.7), in: .rect(cornerRadius: 20)).frame(maxWidth: .infinity, alignment: .trailing)
            .transition(reduce ? .opacity : .move(edge: .bottom).combined(with: .scale(scale: 0.9, anchor: .bottomTrailing)).combined(with: .opacity))
    }

    private func candidateRow(_ p: Person) -> some View {
        HStack(spacing: 12) {
            Avatar(id: p.id, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(p.name).font(Theme.font(16, .medium)).foregroundStyle(Theme.ink)
                Text("Last updated \(monthYear(p.lastContacted))").font(Theme.font(13)).foregroundStyle(Theme.inkMuted)
            }
            Spacer()
        }
        .padding(14).frame(maxWidth: .infinity).glass(20)
    }

    private func send(_ text: String) {
        note = text
        if mutualOf != nil { return startNew() } // from a profile's "Add" mutual: always someone new
        switch AddPath.decide(text, people: people) {
        case .moment(let p): saveMoment(p)
        case .choose(let c): phase = .choosing(c)
        case .newPerson: startNew()
        }
    }

    private func saveMoment(_ p: Person) {
        nav.fresh = PeopleStore.addMoment(to: p, note: note, in: context).id // their profile opens with it expanded
        nav.say("New moment saved")
        nav.replaceTop(.profile(p.id))
    }

    private func startNew() {
        let text = note
        phase = .creating(text)
        let notes = mutualOf == nil ? Capture.splitPeople(text) : []
        if notes.count > 1 {
            Task { phase = .doneMany(await AddMany.create(notes, people: people, in: context, aiFor: { AIClient.enabled ? await AIClient.parse($0) : await LocalAI.parseNote($0) })) }
            return
        }
        Task {
            let ai = AIClient.enabled ? await AIClient.parse(text) : await LocalAI.parseNote(text)
            let d = Capture.parsePerson(text, people: people).merged(with: ai)
            let r = PeopleStore.createPerson(d, note: text, in: context, mutualOf: mutualOf)
            phase = .done(r.person)
        }
    }
}

/// "2026-10-22" -> "Oct 2026"
private func monthYear(_ iso: String) -> String {
    let p = iso.split(separator: "-")
    guard p.count >= 2, let m = Int(p[1]), (1...12).contains(m) else { return iso }
    return "\(Calendar.current.shortMonthSymbols[m - 1]) \(p[0])"
}

/// Entrance for one item of a stagger; shows at once under Reduce Motion.
private struct Arrive: ViewModifier {
    let index: Int, step: Double, scale: CGFloat, spring: Bool
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    init(_ i: Int, step: Double = 0.05, scale: CGFloat = 1, spring: Bool = false) { index = i; self.step = step; self.scale = scale; self.spring = spring }
    func body(content: Content) -> some View {
        content
            .opacity(shown || reduce ? 1 : 0)
            .scaleEffect(shown || reduce ? 1 : scale)
            .offset(y: shown || reduce || scale != 1 ? 0 : 12)
            .onAppear { withAnimation((spring ? Motion.pop : Motion.smooth).delay(Double(index) * step)) { shown = true } }
    }
}

private struct ResultCard: View {
    let person: Person
    var body: some View {
        let b = Blobs.blob(for: person.id)
        let city = person.livesNow.city == "Unknown" ? "" : person.livesNow.city
        let sub = [person.profession, city].filter { !$0.isEmpty && $0 != "Unknown" }.joined(separator: " · ")
        HStack(spacing: 14) {
            Avatar(id: person.id, size: 60)
            VStack(alignment: .leading, spacing: 3) {
                Text(person.name).font(Theme.font(20, .medium)).foregroundStyle(.white)
                if !sub.isEmpty { Text(sub).font(Theme.font(13)).foregroundStyle(.white.opacity(0.85)) }
                Text("Met \(monthYear(Capture.today()))").font(Theme.font(13)).foregroundStyle(Color(hex: "cccccc"))
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.white)
        }
        .padding(18)
        .background {
            ZStack {
                Color(hex: b.base)
                Circle().fill(Color(hex: b.mid)).frame(width: 140).blur(radius: 23).offset(x: -110, y: -30)
                Circle().fill(Color(hex: b.accent)).frame(width: 110).blur(radius: 23).offset(x: 120, y: 10)
            }
        }
        .clipShape(.rect(cornerRadius: 24))
    }
}
