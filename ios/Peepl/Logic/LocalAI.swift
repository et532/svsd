import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Apple's on-device model (PLAN.md 12.2): it only reads the question and a short candidate list; code does the retrieval.
/// Every call returns nil when the model is unavailable, slow or wrong, so callers keep today's rules.
enum LocalAI {
    /// nil when the model can be used, else why not, in plain words.
    static var unavailableReason: String? {
        #if canImport(FoundationModels)
        switch SystemLanguageModel.default.availability {
        case .available: return nil
        case .unavailable(.deviceNotEligible): return "This device can't run Apple Intelligence."
        case .unavailable(.appleIntelligenceNotEnabled): return "Apple Intelligence is turned off in Settings."
        case .unavailable(.modelNotReady): return "Apple Intelligence is still downloading."
        case .unavailable: return "Apple Intelligence isn't available right now."
        }
        #else
        return "This iOS version has no on-device model."
        #endif
    }
    static var isAvailable: Bool { unavailableReason == nil }

    /// Runs `work`, or gives up after `seconds` (nil).
    private static func within<T: Sendable>(_ seconds: Double, _ work: @escaping @Sendable () async throws -> T) async -> T? {
        await withTaskGroup(of: T?.self) { g in
            g.addTask {
                do { return try await work() } catch {
                    #if DEBUG
                    print("LocalAI: \(error)")
                    #endif
                    return nil
                }
            }
            g.addTask { try? await Task.sleep(for: .seconds(seconds)); return nil }
            let first = await g.next() ?? nil
            g.cancelAll()
            return first
        }
    }

    /// Cut to about `n` characters at a word break (4 characters is roughly a token).
    static func clip(_ s: String, _ n: Int) -> String {
        if s.count <= n { return s }
        var t = String(s.prefix(n))
        if let r = t.range(of: #"\s+\S*$"#, options: .regularExpression) { t.removeSubrange(r) }
        return t + "…"
    }

    // shortcut: mirrors Query's private activity ids and a word its regex reads; W2 should expose the table from Query.swift instead.
    static let activityWords: [String: String] = [
        "house-party": "house party", "dinner": "dinner", "drinks": "drinks", "coffee": "coffee", "game-night": "game night",
        "climbing": "climbing", "running": "run", "hiking": "hike", "pickleball": "pickleball", "workout": "workout",
        "concert": "concert", "museum": "museum", "movie": "movie",
    ]
    static let stageWords = ["college": "college", "high-school": "high school", "hometown": "hometown", "first-job": "first job"]
    static let relationWords = ["family": "family", "work": "coworkers", "friends": "friends", "community": "community"]
    /// A relationship only counts when the question says it (the same words Query reads).
    private static let relationSaid = ["family": "\\b(family|relatives?|cousins?|siblings?)\\b", "work": "\\b(coworkers?|colleagues?|co-workers?|professional)\\b",
                                       "friends": "\\b(friends?|social)\\b", "community": "\\b(community|neighbou?rs?)\\b"]

    /// What the model read in a question, checked and turned into the same Constraints the rules make.
    /// The fields go back through Query.parse as a plain sentence so synonyms, groups and embed text stay the rules' own.
    static func constraints(question: String, intent: String, activity: String?, place: String?, stage: String?,
                            relationship: String?, metAt: String?, topics: [String]) -> Constraints {
        let intent = ["plan", "knowledge", "find"].contains(intent) ? intent : "find"
        let activity = activity.flatMap { activityWords[$0] != nil ? $0 : nil }
        // Places and where you met have to really be in the question; the model sometimes makes them up.
        let said = Ask.norm(question)
        let named = Places.resolve(question)?.place
        let place = place.flatMap { p -> PlaceRec? in
            guard let r = p.isEmpty ? nil : Places.lookup(p) ?? Places.resolve(p)?.place else { return nil }
            return said.contains(Ask.norm(p)) || r.id == named?.id ? r : nil // "SF" in the question, "San Francisco" from the model
        }
        let stage = stage.flatMap { stageWords[$0] != nil ? $0 : nil }
        let relationship = relationship.flatMap { r in relationSaid[r].flatMap { said.range(of: $0, options: .regularExpression) } != nil ? r : nil }
        let metAt = metAt.flatMap { m in said.range(of: "\\bmet (at|through|via|in) (the )?" + NSRegularExpression.escapedPattern(for: Ask.norm(m)), options: .regularExpression) == nil ? nil : m }
        // A topic that only repeats another field ("college", "job") or says nothing ("none") isn't a topic.
        let other = Set(Ask.norm([activity.flatMap { activityWords[$0] }, stage.flatMap { stageWords[$0] }, relationship, metAt, place?.name]
            .compactMap { $0 }.joined(separator: " ")).split(separator: " ").map(String.init) + ["none", "n/a", "nothing"])
        let topics = topics.prefix(3).map { Ask.norm($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { t in !t.isEmpty && !t.split(separator: " ").allSatisfy { other.contains(String($0)) } }

        var words: [String] = []
        if intent == "knowledge" { words.append("who knows about") }
        if intent == "plan" { words.append(activity.flatMap { activityWords[$0] } ?? "hang out with") }
        words += topics
        if let r = relationship.flatMap({ relationWords[$0] }) { words.append(r) }
        if let stage { words.append(stageWords[stage]!) }
        if let metAt { words.append("met at \(metAt)") } // Query reads "met at …" only at the end
        var c = Query.parse(words.joined(separator: " "))
        c.text = question
        c.intent = intent
        if intent != "plan" { c.activityId = nil; c.activityLabel = nil } // a topic like "running" isn't a plan unless the question was
        if c.activityId == nil, relationship == nil { c.contexts = [:] }
        c.place = place ?? (intent == "plan" ? Places.home() : nil)
        c.named = place != nil
        c.stage = stage
        c.metAt = metAt
        return c
    }

    #if canImport(FoundationModels)
    @Generable struct QueryRead {
        @Guide(description: "true only if the user wants to do something together with the person (eat, drink, play, go out)")
        var together: Bool
        @Guide(description: "none unless the user names something to do together", .anyOf(["none"] + LocalAI.activityWords.keys.sorted()))
        var activity: String
        @Guide(description: "City or neighborhood named in the question, else empty")
        var place: String
        @Guide(description: "none unless the question says college, high school, hometown or first job", .anyOf(["none", "college", "high-school", "hometown", "first-job"]))
        var stage: String
        @Guide(description: "none unless the question says family, coworkers, friends or neighbors", .anyOf(["none", "family", "work", "friends", "community"]))
        var relationship: String
        @Guide(description: "Only the words after \"met at\", else empty")
        var metAt: String
        @Guide(description: "The job, skill or interest the person should have, as 0 to 2 plain words. Empty if the question names none.", .maximumCount(2))
        var topics: [String]
    }

    @Generable struct Pick {
        @Guide(description: "The candidate's number")
        var n: Int
        @Guide(description: "Why they fit, under 15 words, from their facts only")
        var why: String
    }
    @Generable struct Picks {
        @Guide(description: "Only candidates who really fit every part of the question, best first; empty if none do", .maximumCount(10))
        var fits: [Pick]
    }
    #endif

    // Examples are not from the eval set (PeeplTests/eval-questions.json).
    private static let queryInstructions = """
        You read a question a user asks about the people they know. Fill in only what the question says; leave the rest none or empty.
        Examples:
        "my car makes a grinding noise" -> together false, topics [mechanic]
        "anyone who does yoga in Queens" -> together false, place Queens, topics [yoga]
        "a coworker to get lunch with" -> together true, activity dinner, relationship work, topics []
        "anyone up for a hike saturday" -> together true, activity hiking, topics []
        "cousins who live in Denver" -> together false, place Denver, relationship family, topics []
        "high school friends who do art" -> together false, stage high-school, relationship friends, topics [art]
        "people I met at the book fair" -> together false, metAt book fair, topics []
        """

    /// The question -> Constraints, or nil (unavailable, timeout, error): use Query.parse.
    static func parseQuery(_ question: String, timeout: Double = 5) async -> Constraints? {
        #if canImport(FoundationModels)
        guard isAvailable else { return nil }
        let q = clip(question, 400)
        guard let r = await within(timeout, {
            let s = LanguageModelSession(instructions: queryInstructions)
            return try await s.respond(to: q, generating: QueryRead.self, options: GenerationOptions(sampling: .greedy)).content
        }) else { return nil }
        func opt(_ s: String) -> String? { s.isEmpty || s == "none" ? nil : s }
        return constraints(question: question, intent: r.together ? "plan" : "find", activity: opt(r.activity), place: opt(r.place), stage: opt(r.stage),
                           relationship: opt(r.relationship), metAt: opt(r.metAt), topics: r.topics)
        #else
        return nil
        #endif
    }

    /// One short line of facts per candidate (about 40 tokens).
    static func facts(_ m: Match) -> String {
        let p = m.person
        return clip("\(p.profession); lives in \(p.livesNow.city); into \(p.tags.prefix(4).joined(separator: ", ")); \(m.why)", 160)
    }

    private static let explainInstructions = "You help a user pick people they know for a question. A candidate fits only if their facts show what the question asks for; related or similar is not enough. If no one fits, return no one. Never invent facts."

    /// The only way to rank: the result holds exactly `matches` (retrieval's own, never near misses). The model's picks (1-based
    /// numbers into the first 10) go first, deduped, in its order with its "why"; every unpicked match follows in retrieval order.
    static func merge(picks: [(n: Int, why: String)]?, matches: [Match]) -> [(id: String, why: String)] {
        let pool = Array(matches.prefix(10))
        var seen = Set<String>(), out: [(id: String, why: String)] = []
        for p in picks ?? [] where pool.indices.contains(p.n - 1) && seen.insert(pool[p.n - 1].id).inserted {
            let why = p.why.trimmingCharacters(in: .whitespacesAndNewlines)
            out.append((pool[p.n - 1].id, why.isEmpty ? pool[p.n - 1].why : why))
        }
        return out + matches.filter { seen.insert($0.id).inserted }.map { ($0.id, $0.why) }
    }

    /// Re-ranks and explains retrieval's matches. No matches -> [] and the model is not called; a model failure -> retrieval order.
    /// `model` is a test seam: given the question and the first 10 matches it returns the picks.
    static func explain(question: String, matches: [Match], timeout: Double = 8,
                        model: ((String, [Match]) async -> [(n: Int, why: String)]?)? = nil) async -> [(id: String, why: String)] {
        guard !matches.isEmpty else { return [] }
        let q = clip(question, 400)
        let pool = Array(matches.prefix(10))
        if let model { return merge(picks: await model(q, pool), matches: matches) }
        return merge(picks: await modelPicks(q, pool, timeout: timeout), matches: matches)
    }

    /// The instant answer with the model's order and "why" text, or nil (unavailable, special / grouped / non-people answer,
    /// model failed, nothing changed). Retrieval decides who is in it; the model only reorders and explains.
    static func upgrade(question: String, instant: AskResult, people: [PersonInfo], embedder: Embedder,
                        parse: ((String) async -> Constraints?)? = nil,
                        model: ((String, [Match]) async -> [(n: Int, why: String)]?)? = nil) async -> AskResult? {
        guard parse != nil || isAvailable, case .people(let a) = instant, a.groups == nil, !Ask.isSpecial(Ask.interpret(question, people: people)) else { return nil }
        let read = if let parse { await parse(question) } else { await parseQuery(question) }
        guard let c = read else { return nil }
        guard case .people(let b) = await Search.answer(question, constraints: c, people: people, embedder: embedder), b.groups == nil else { return nil }
        if b.matches.isEmpty, !a.matches.isEmpty { return nil } // never replace a real answer with "no one"
        let order = await explain(question: question, matches: b.matches, model: model)
        let out = reorder(b, order)
        return out == a ? nil : .people(out)
    }

    /// `answer` with its matches in `order`; ids not in the answer are dropped, title / near / note stay retrieval's.
    static func reorder(_ answer: PeopleAnswer, _ order: [(id: String, why: String)]) -> PeopleAnswer {
        let byId = Dictionary(answer.matches.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        var out = answer
        out.matches = order.compactMap { o in byId[o.id].map { var m = $0; m.why = o.why; return m } }
        return out
    }

    // MARK: Add note parse (PLAN 12.2): the regex result is always computed first; these fields only go on top when validated.

    /// What the model read in a note, before checks.
    struct NoteFields: Sendable {
        var name = "", company = "", does = "", from = "", lives = "", met = "", interest = "", followUp = ""
    }

    private static func cut44(_ v: String) -> String {
        if v.count <= 44 { return v }
        var s = String(v.prefix(44))
        if let r = s.range(of: #"\s+\S*$"#, options: .regularExpression) { s.removeSubrange(r) }
        return s + "…"
    }

    /// Drops any name / company / from / lives / met that is not literally in the note (case-insensitive, as AIClient.parse's found()).
    static func validated(_ f: NoteFields, note: String) -> Draft {
        let t = note.trimmingCharacters(in: .whitespacesAndNewlines)
        func clean(_ v: String) -> String { v.trimmingCharacters(in: .whitespacesAndNewlines) }
        func found(_ v: String) -> String? { let v = clean(v); return !v.isEmpty && t.localizedCaseInsensitiveContains(v) ? v : nil }
        func strip(_ v: String, _ p: String) -> String { v.replacingOccurrences(of: p, with: "", options: [.regularExpression, .caseInsensitive]) }
        func plain(_ v: String) -> String? { clean(v).isEmpty ? nil : cut44(clean(v)) }
        var d = Draft()
        d.name = found(f.name).map { strip($0, #"^(?:Dr|Mr|Mrs|Ms|Prof)\.?\s+"#) }
        d.company = found(f.company); d.from = found(f.from); d.lives = found(f.lives)
        d.does = plain(f.does); d.follow = plain(f.followUp)
        d.met = found(strip(strip(clean(f.met), #"^(?:at|in|through)\s+"#), #"^(?:an?|the)\s+"#)).map(cut44)
        if var r = plain(f.interest) {
            if r.range(of: #"^(?:loves?|likes?|enjoys?|into|plays?|climbs?|runs?|collects?|obsessed|passionate)\b"#, options: [.regularExpression, .caseInsensitive]) == nil { r = cut44("Loves \(r)") }
            d.remember = r
        }
        return d
    }

    #if canImport(FoundationModels)
    @Generable struct NoteRead {
        @Guide(description: "The new person's full name exactly as written in the note, else empty")
        var name: String
        @Guide(description: "Company exactly as written, else empty")
        var company: String
        @Guide(description: "Their job or what they do, 1 to 4 words, else empty")
        var does: String
        @Guide(description: "Where they are from, exactly as written, else empty")
        var from: String
        @Guide(description: "Where they live now, exactly as written, else empty")
        var lives: String
        @Guide(description: "Where or how you met, exactly as written, else empty")
        var met: String
        @Guide(description: "An interest of theirs, under 8 words, else empty")
        var interest: String
        @Guide(description: "Something the user wants to do next with them, under 8 words, else empty")
        var followUp: String
    }
    #endif

    private static let noteInstructions = "You read a note a user wrote about a person they just met. Copy names and places exactly as written; never invent. Leave a field empty when the note does not say it."

    /// The note -> a validated Draft, or nil (unavailable, timeout, error): keep the regex result.
    /// `model` is a test seam returning the raw fields.
    static func parseNote(_ note: String, timeout: Double = 3, model: ((String) async -> NoteFields?)? = nil) async -> Draft? {
        let text = clip(note.trimmingCharacters(in: .whitespacesAndNewlines), 1500)
        guard !text.isEmpty else { return nil }
        if let model { return await model(text).map { validated($0, note: text) } }
        #if canImport(FoundationModels)
        guard isAvailable else { return nil }
        guard let r = await within(timeout, {
            let s = LanguageModelSession(instructions: noteInstructions)
            return try await s.respond(to: text, generating: NoteRead.self, options: GenerationOptions(sampling: .greedy)).content
        }) else { return nil }
        return validated(NoteFields(name: r.name, company: r.company, does: r.does, from: r.from, lives: r.lives, met: r.met,
                                    interest: r.interest, followUp: r.followUp), note: text)
        #else
        return nil
        #endif
    }

    private static func modelPicks(_ q: String, _ candidates: [Match], timeout: Double) async -> [(n: Int, why: String)]? {
        #if canImport(FoundationModels)
        guard isAvailable else { return nil }
        var pool = candidates
        func prompt() -> String {
            "Question: \(q)\nCandidates:\n" + pool.enumerated().map { "\($0.offset + 1). \(facts($0.element))" }.joined(separator: "\n")
        }
        // Keep the prompt well inside the window (instructions, schema and the reply need the rest).
        if #available(iOS 26.4, *) {
            let model = SystemLanguageModel.default
            while pool.count > 1, let n = try? await model.tokenCount(for: prompt()), n > model.contextSize / 2 { pool.removeLast() }
        }
        let text = prompt()
        guard let r = await within(timeout, {
            let s = LanguageModelSession(instructions: explainInstructions)
            return try await s.respond(to: text, generating: Picks.self, options: GenerationOptions(sampling: .greedy)).content
        }) else { return nil }
        return r.fits.map { ($0.n, $0.why) }
        #else
        return nil
        #endif
    }
}
