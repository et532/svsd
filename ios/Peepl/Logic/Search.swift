import Foundation

/// Value snapshot of a person so search runs off the main actor and tests need no SwiftData.
struct PersonInfo: Decodable, Sendable, Identifiable, Hashable {
    struct TodoInfo: Decodable, Sendable, Hashable { var id: String; var text: String; var done: Bool }
    struct MomentInfo: Decodable, Sendable, Hashable {
        var id: String; var date: String; var title: String
        var text: String?; var transcript: String?; var firstMeeting: Bool?
    }
    var id: String, name: String, context: String, alsoContext: String?, profession: String, story: String
    var tags: [String]; var from: Place; var met: Place; var livesNow: Place
    var lifeStage: String?; var lastContacted: String; var knows: [String]; var closeness: Int?
    var todos: [TodoInfo] = []
    var moments: [MomentInfo] = [] // newest first: date desc, then id asc

    private enum CodingKeys: String, CodingKey {
        case id, name, context, alsoContext, profession, story, tags, from, met, livesNow, lifeStage, lastContacted, knows, closeness, todos, moments
    }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id); name = try c.decode(String.self, forKey: .name)
        context = try c.decode(String.self, forKey: .context); alsoContext = try c.decodeIfPresent(String.self, forKey: .alsoContext)
        profession = try c.decode(String.self, forKey: .profession); story = try c.decode(String.self, forKey: .story)
        tags = try c.decode([String].self, forKey: .tags)
        from = try c.decode(Place.self, forKey: .from); met = try c.decode(Place.self, forKey: .met); livesNow = try c.decode(Place.self, forKey: .livesNow)
        lifeStage = try c.decodeIfPresent(String.self, forKey: .lifeStage); lastContacted = try c.decode(String.self, forKey: .lastContacted)
        knows = try c.decode([String].self, forKey: .knows); closeness = try c.decodeIfPresent(Int.self, forKey: .closeness)
        todos = try c.decodeIfPresent([TodoInfo].self, forKey: .todos) ?? []
        moments = Self.newestFirst(try c.decodeIfPresent([MomentInfo].self, forKey: .moments) ?? [])
    }
    init(_ p: Person) {
        id = p.id; name = p.name; context = p.context; alsoContext = p.alsoContext; profession = p.profession; story = p.story
        tags = p.tags; from = p.from; met = p.met; livesNow = p.livesNow; lifeStage = p.lifeStage
        lastContacted = p.lastContacted; knows = p.knows; closeness = p.closeness
        todos = p.todos.map { TodoInfo(id: $0.id, text: $0.text, done: $0.done) }
        moments = Self.newestFirst(p.moments.map {
            MomentInfo(id: $0.id, date: $0.date, title: $0.title, text: $0.text, transcript: $0.transcript, firstMeeting: $0.firstMeeting)
        })
    }
    private static func newestFirst(_ m: [MomentInfo]) -> [MomentInfo] {
        m.sorted { $0.date != $1.date ? $0.date > $1.date : $0.id < $1.id }
    }

    /// The bundled seed.json (all 500), for tests.
    static func sample() -> [PersonInfo] {
        guard let url = Bundle.main.url(forResource: "seed", withExtension: "json"), let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([PersonInfo].self, from: data)) ?? []
    }
    var firstName: String { name.split(separator: " ").first.map(String.init) ?? name }
}

struct Hit: Sendable { var personId: String; var text: String; var from: String?; var sim: Float }

struct Outcome {
    var matches: [Match]; var groups: [MatchGroup]? = nil; var near: [Match]? = nil; var note: String? = nil
    var level: Int // 1 = everything fit; 2-3 = relaxed; 4 = honest empty
}

/// web rank/index.ts and rank/search.ts: place-aware ranking, explained.
/// Score = 0.40 theme + 0.20 relationshipFit + 0.15 proximity + 0.10 evidence + 0.10 warmth + 0.05 graph (unused features dropped, rest rescaled).
enum Search {
    private static let W = (theme: 0.4, rel: 0.2, near: 0.15, evidence: 0.1, warmth: 0.1, graph: 0.05)
    private static let nearSim = 0.45, meaningAlone = 0.64, maxResults = 10

    private static let iso: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "UTC"); f.dateFormat = "yyyy-MM-dd"; return f
    }()
    private static func days(_ s: String, _ now: Date) -> Double {
        now.timeIntervalSince(iso.date(from: String(s.prefix(10))) ?? Date(timeIntervalSince1970: 0)) / 86400
    }
    private static func clamp(_ x: Double) -> Double { max(0, min(1, x)) }
    private static let norm = Ask.norm

    // Everything written about someone, normalized, for exact-word checks. Cached per person + content.
    nonisolated(unsafe) private static var texts: [String: (Int, String)] = [:]
    private static let lock = NSLock()
    private static func textOf(_ p: PersonInfo) -> String {
        let key = Semantic.stamp(p)
        lock.lock(); defer { lock.unlock() }
        if let t = texts[p.id], t.0 == key { return t.1 }
        let t = norm(([p.profession, p.story] + p.tags + p.todos.map(\.text) + p.moments.flatMap { [$0.title, $0.text ?? "", $0.transcript ?? ""] }).joined(separator: " | "))
        texts[p.id] = (key, t)
        return t
    }
    private static func re(_ terms: [String], prefix: String = "\\b") -> NSRegularExpression {
        try! NSRegularExpression(pattern: "\(prefix)(" + terms.map { NSRegularExpression.escapedPattern(for: norm($0)) }.joined(separator: "|") + ")")
    }
    private static func has(_ r: NSRegularExpression, _ s: String) -> Bool { r.firstMatch(in: s, range: NSRange(location: 0, length: s.utf16.count)) != nil }
    private static func trimDot(_ s: String) -> String { s.replacingOccurrences(of: "\\.$", with: "", options: .regularExpression) }
    private static func jobOf(_ p: PersonInfo) -> String { norm(p.profession).replacingOccurrences(of: "\\s+@.*$", with: "", options: .regularExpression) }

    static func rankPeople(_ c: Constraints, hits: [Hit], people: [PersonInfo], now: Date = Date()) -> Outcome {
        var best: [String: Hit] = [:]
        for h in hits where best[h.personId] == nil || h.sim > best[h.personId]!.sim { best[h.personId] = h }
        let meaning = { (id: String) in Double(best[id]?.sim ?? 0) }

        let target = c.place, themed = !c.theme.isEmpty
        let fit = { (p: PersonInfo) in target.map { Places.hierarchyFit($0, Places.of(p)) } ?? 1 }
        let inArea = { (p: PersonInfo) in fit(p) > 0 }
        let metAt = c.metAt.flatMap { $0.isEmpty ? nil : norm($0) }
        let allowed = { (p: PersonInfo) in
            (c.stage == nil || p.lifeStage == c.stage) &&
            (metAt == nil || norm(p.met.context ?? "").contains(metAt!) || p.moments.contains { $0.firstMeeting == true && norm($0.title).contains(metAt!) })
        }
        // Every group of words has to be mentioned (any word of a group will do); with 3+ ideas one may be missing.
        let groupRes = c.groups.map { g in g.map { re([$0]) } }
        let mentions = { (g: [NSRegularExpression], t: String) in g.contains { has($0, t) } }
        var kw: [String: Bool] = [:], hl: [String: Bool] = [:]
        if !c.groups.isEmpty {
            for p in people {
                let t = textOf(p)
                kw[p.id] = groupRes.filter { mentions($0, t) }.count >= c.groups.count - (c.groups.count >= 3 ? 1 : 0)
                let head = norm(([p.profession] + p.tags).joined(separator: " | "))
                hl[p.id] = groupRes.allSatisfy { mentions($0, head) }
            }
        }
        let keyword = { (p: PersonInfo) in kw[p.id] ?? false }
        let qualifies = { (p: PersonInfo) in keyword(p) || meaning(p.id) >= (c.groups.count > 1 ? 0.7 : meaningAlone) }
        let themeScore = { (p: PersonInfo) -> Double in
            let m = meaning(p.id)
            if keyword(p) { return min(1, 0.65 + 0.25 * clamp((m - 0.4) / 0.3) + (hl[p.id] == true ? 0.1 : 0)) }
            if qualifies(p) { return 0.55 + 0.3 * clamp((m - 0.64) / 0.1) }
            return 0.5 * clamp((m - 0.3) / 0.35)
        }
        let into = { (p: PersonInfo) in !themed || qualifies(p) }
        var th: [String: Double] = [:]
        if themed { for p in people { th[p.id] = themeScore(p) } }
        let experts = people.filter { themed && allowed($0) && into($0) }

        // The sentence that shows why someone fits: the best match if it says the thing itself, else the first sentence that mentions it.
        let evRe = re(c.groups.flatMap { $0 })
        let evidence = { (p: PersonInfo, hit: Hit) -> (text: String, from: String?) in
            if c.groups.isEmpty || (has(evRe, norm(hit.text)) && hit.text.split(whereSeparator: \.isWhitespace).count > 2) { return (hit.text, hit.from) }
            let cs = Semantic.chunks(p).filter { $0.kind != "tag" && has(evRe, norm($0.text)) }
            let pick = cs.first { $0.kind == "moment" } ?? cs.first
            return pick.map { ($0.text, $0.from) } ?? (hit.text, hit.from)
        }
        func relationWord(_ p: PersonInfo) -> String {
            ["family": "Family", "work": "From work", "social": "Friend", "community": "Community"][p.context] ?? ""
        }
        let card = { (p: PersonInfo) -> Match in
            let place = Places.of(p), d = days(p.lastContacted, now)
            var why: String
            if themed, let hit = best[p.id], into(p) {
                let proof = evidence(p, hit)
                why = p.tags.contains(proof.text) ? "Into \(proof.text)" : "\(trimDot(proof.text))\(proof.from.map { " (\($0))" } ?? "")"
            } else {
                var parts = [relationWord(p)]
                if c.stage != nil || c.metAt != nil { parts.append("Met at \(p.met.context ?? "")") }
                parts += [p.profession, "last talked \(Ask.timeSince(p.lastContacted, now: now).lowercased())"]
                why = parts.filter { !$0.isEmpty }.joined(separator: " · ")
            }
            return Match(person: p, why: why, via: d > 180 ? "Reconnect first" : nil, chip: target != nil && place != nil ? Places.chip(target!, place!) : nil)
        }
        let relFit = { (p: PersonInfo) in max(c.contexts[p.context] ?? 0, p.alsoContext.flatMap { c.contexts[$0] } ?? 0) }
        let warmth = { (p: PersonInfo) -> Double in
            let d = days(p.lastContacted, now)
            let recent = d <= 30 ? 1.0 : d <= 120 ? 0.6 : d <= 365 ? 0.3 : 0.1
            return 0.6 * (Double(p.closeness ?? 2) / 3) + 0.4 * recent
        }
        let score = { (p: PersonInfo, graph: Double) -> Double in
            var parts: [(Double, Double)] = []
            if themed {
                parts.append((W.theme, th[p.id]!))
                parts.append((W.evidence, best[p.id]?.from != nil && into(p) ? 1 : keyword(p) ? 0.5 : 0))
            }
            if !c.contexts.isEmpty { parts.append((W.rel, relFit(p))) }
            if target != nil { parts.append((W.near, fit(p))) }
            parts += [(W.warmth, warmth(p)), (W.graph, graph)]
            return parts.reduce(0) { $0 + $1.0 * $1.1 } / parts.reduce(0) { $0 + $1.0 }
        }
        let expertIds = Set(experts.map { $0.id })
        let graphOf = { (p: PersonInfo) in clamp(Double(p.knows.filter { expertIds.contains($0) }.count) / 3) }

        // Level 1: everything the question asked for holds
        let level1 = diversify(people.filter { inArea($0) && allowed($0) && into($0) }.map { (card($0), score($0, graphOf($0)), $0) })
        if !level1.isEmpty { return Outcome(matches: level1, level: 1) }

        let whereName = target?.name ?? "your area", what = c.theme.joined(separator: " / ")
        // Nothing is both nearby and into it (in-person plans only): people who know someone who is, then good company.
        if target != nil, themed, c.intent == "plan" {
            let nearby = people.filter { inArea($0) && allowed($0) }
            let connectors: [Match] = nearby.compactMap { p in experts.first { p.knows.contains($0.id) }.map { (p, $0) } }.prefix(3).map { p, via in
                var m = card(p)
                m.via = "One step away"
                m.why = "Knows \(via.name), \(via.profession.lowercased())\(via.livesNow.city != p.livesNow.city ? " in \(via.livesNow.city.split(separator: ",", omittingEmptySubsequences: false)[0])" : "")"
                return m
            }
            let friends = diversify(nearby.map { (card($0), score($0, 0), $0) }, 5)
            if !friends.isEmpty || !connectors.isEmpty {
                let groups = (connectors.isEmpty ? [] : [MatchGroup(label: "One step away", matches: connectors)])
                    + (friends.isEmpty ? [] : [MatchGroup(label: "Good company anyway", matches: friends)])
                let note = "No one in \(whereName) is clearly into \(what).\(connectors.isEmpty ? "" : " \(connectors[0].person.firstName) knows someone who is.") \(friends.isEmpty ? "" : "These people would still be good company.")"
                return Outcome(matches: groups.flatMap { $0.matches }, groups: groups, note: note.trimmingCharacters(in: .whitespacesAndNewlines), level: connectors.isEmpty ? 2 : 3)
            }
        }

        // Honest empty: the closest few are shown as "not quite"
        var near: [Match] = []
        if themed {
            near = people.enumerated().filter { allowed($0.element) && meaning($0.element.id) >= nearSim }
                .sorted {
                    let (a, b) = ($0.element, $1.element)
                    if th[a.id]! != th[b.id]! { return th[a.id]! > th[b.id]! }
                    if meaning(a.id) != meaning(b.id) { return meaning(a.id) > meaning(b.id) }
                    return $0.offset < $1.offset
                }.prefix(2).map { var m = card($0.element); m.why = trimDot(best[$0.element.id]!.text); return m }
        }
        return Outcome(matches: [], near: near, note: target != nil && !people.contains(where: inArea) ? "No one in \(whereName) yet." : nil, level: 4)
    }

    // Best first, but a second person with the same job as one already chosen has to be clearly better to take a spot.
    private static func diversify(_ all: [(Match, Double, PersonInfo)], _ cap: Int = maxResults) -> [Match] {
        var left = all.enumerated().sorted { $0.element.1 != $1.element.1 ? $0.element.1 > $1.element.1 : $0.offset < $1.offset }.map(\.element)
        var out: [Match] = [], jobs: [String: Int] = [:]
        let adjusted = { (r: (Match, Double, PersonInfo)) in r.1 - 0.06 * Double(jobs[jobOf(r.2)] ?? 0) }
        while !left.isEmpty, out.count < cap {
            var bi = 0
            for i in 1..<max(left.count, 1) where adjusted(left[i]) > adjusted(left[bi]) { bi = i }
            let next = left.remove(at: bi)
            out.append(next.0)
            jobs[jobOf(next.2), default: 0] += 1
        }
        return out
    }

    /// web rank/search.ts answer(): the rule-based special answers stay as they are; a plain "find people like this" goes through the ranking.
    static func answer(_ query: String, people: [PersonInfo], embedder: Embedder, now: Date = Date()) async -> AskResult {
        await answer(query, constraints: Query.parse(query), people: people, embedder: embedder, now: now)
    }

    /// Same as `answer`, but with constraints already read (by the rules or the on-device model).
    static func answer(_ query: String, constraints c: Constraints, people: [PersonInfo], embedder: Embedder, now: Date = Date()) async -> AskResult {
        let rules = Ask.interpret(query, people: people, now: now)
        if Ask.isSpecial(rules) { return rules }
        var hits: [Hit] = []
        if !c.embedText.isEmpty, let q = try? await embedder.embed([c.embedText]).first {
            let shipped = Semantic.shipped()
            let missing = Array(Set(people.flatMap { Semantic.chunks($0).map(\.text) }.filter { shipped[$0] == nil }))
            let extra = missing.isEmpty ? [:] : await Semantic.vectors(missing, embedder: embedder)
            hits = Semantic.bestHits(q, people: people) { shipped[$0] ?? extra[$0] }
        }
        let out = rankPeople(c, hits: hits, people: people, now: now)
        let title = out.matches.isEmpty ? "No one matches “\(query)” yet"
            : "\(out.matches.count) \(out.matches.count == 1 ? "person" : "people") · \(c.explain.joined(separator: " · "))"
        return .people(PeopleAnswer(title: title, matches: out.matches, groups: out.groups, near: out.near, note: out.note))
    }
}
