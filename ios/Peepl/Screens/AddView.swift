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

    private var heading: String {
        if let id = mutualOf, let p = people.first(where: { $0.id == id }) { return "Who does \(p.firstName) know?" }
        return "Tell me about a new person or moment"
    }

    var body: some View {
        ZStack {
            AddAura()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch phase {
                    case .idle:
                        title(heading)
                    case .choosing(let c):
                        bubble
                        title("Which \(c[0].firstName) did you catch up with?")
                        ForEach(c) { p in
                            Button { saveMoment(p) } label: { candidateRow(p) }.buttonStyle(.plain)
                        }
                        Button { startNew() } label: {
                            Text("Neither, add a new profile").font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                                .padding(.horizontal, 18).padding(.vertical, 12).background(Theme.night, in: .capsule)
                        }.buttonStyle(.plain)
                    case .creating:
                        bubble
                        let notes = mutualOf == nil ? Capture.splitPeople(note) : []
                        if notes.count > 1 {
                            title("Creating \(notes.count) new profiles for \(AddMany.list(notes.map(\.name)))…")
                            ForEach(notes, id: \.name) { _ in Shimmer().frame(height: 96).clipShape(.rect(cornerRadius: 24)) }
                        } else {
                            title("Creating a new profile for \(Capture.parsePerson(note, people: people).name ?? "them")…")
                            Shimmer().frame(height: 96).clipShape(.rect(cornerRadius: 24))
                        }
                    case .done(let p):
                        bubble
                        Button { nav.replaceTop(.profile(p.id)) } label: { ResultCard(person: p) }.buttonStyle(.plain)
                    case .doneMany(let ps):
                        bubble
                        ForEach(ps) { p in
                            Button { nav.replaceTop(.profile(p.id)) } label: { ResultCard(person: p) }.buttonStyle(.plain)
                        }
                        Text("\(AddMany.list(ps.map(\.firstName))) were met together, so they're linked as mutuals.")
                            .font(.system(size: 13)).foregroundStyle(Theme.inkMuted)
                    }
                }
                .padding(.horizontal, 20).padding(.top, 80).padding(.bottom, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .safeAreaInset(edge: .bottom) {
            Composer(placeholder: "Who did you meet?", autofocus: true, onSend: send, people: people).padding(.horizontal, 16).padding(.bottom, 8)
        }
    }

    private func title(_ s: String) -> some View {
        Text(s).font(.system(size: 28, weight: .light)).tracking(-1.1).foregroundStyle(Theme.ink)
    }

    private var bubble: some View {
        Text(note).font(.system(size: 16)).foregroundStyle(Theme.ink).padding(14)
            .background(.white.opacity(0.7), in: .rect(cornerRadius: 20)).frame(maxWidth: .infinity, alignment: .trailing)
    }

    private func candidateRow(_ p: Person) -> some View {
        HStack(spacing: 12) {
            Avatar(id: p.id, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(p.name).font(.system(size: 16, weight: .medium)).foregroundStyle(Theme.ink)
                Text("Last updated \(monthYear(p.lastContacted))").font(.system(size: 13)).foregroundStyle(Theme.inkMuted)
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
            Task { phase = .doneMany(await AddMany.create(notes, people: people, in: context, aiFor: { await AIClient.parse($0) })) }
            return
        }
        Task {
            let ai = await AIClient.parse(text)
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

private struct ResultCard: View {
    let person: Person
    var body: some View {
        let b = Blobs.blob(for: person.id)
        let city = person.livesNow.city == "Unknown" ? "" : person.livesNow.city
        let sub = [person.profession, city].filter { !$0.isEmpty && $0 != "Unknown" }.joined(separator: " · ")
        HStack(spacing: 14) {
            Avatar(id: person.id, size: 60)
            VStack(alignment: .leading, spacing: 3) {
                Text(person.name).font(.system(size: 20, weight: .medium)).foregroundStyle(.white)
                if !sub.isEmpty { Text(sub).font(.system(size: 13)).foregroundStyle(.white.opacity(0.85)) }
                Text("Met \(monthYear(Capture.today()))").font(.system(size: 13)).foregroundStyle(Color(hex: "cccccc"))
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

private struct Shimmer: View {
    @State private var on = false
    var body: some View {
        Color.white.opacity(on ? 0.35 : 0.8)
            .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: on)
            .onAppear { on = true }
    }
}

private struct AddAura: View {
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
