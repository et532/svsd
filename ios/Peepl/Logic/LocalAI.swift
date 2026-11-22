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

    /// No-match guard: the model may only reorder and explain what retrieval already counts as a match; anything else is dropped.
    static func guarded(_ picks: [(id: String, why: String)], matches: [Match]) -> [(id: String, why: String)] {
        let ok = Set(matches.map(\.id))
        return picks.filter { ok.contains($0.id) }
    }

    /// Picks, re-ranks and explains up to 10 candidates. Only ids from `candidates` ever come back; nil = use the candidates as they are.
    static func explain(question: String, candidates: [Match], timeout: Double = 8) async -> [(id: String, why: String)]? {
        #if canImport(FoundationModels)
        guard isAvailable, !candidates.isEmpty else { return nil }
        var pool = Array(candidates.prefix(10))
        let q = clip(question, 400)
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
            let s = LanguageModelSession(instructions: "You help a user pick people they know for a question. A candidate fits only if their facts show what the question asks for; related or similar is not enough. If no one fits, return no one. Never invent facts.")
            return try await s.respond(to: text, generating: Picks.self, options: GenerationOptions(sampling: .greedy)).content
        }) else { return nil }
        var seen = Set<Int>(), out: [(id: String, why: String)] = []
        for p in r.fits where pool.indices.contains(p.n - 1) && seen.insert(p.n).inserted {
            let why = p.why.trimmingCharacters(in: .whitespacesAndNewlines)
            out.append((pool[p.n - 1].person.id, why.isEmpty ? pool[p.n - 1].why : why))
        }
        return out
        #else
        return nil
        #endif
    }
}
