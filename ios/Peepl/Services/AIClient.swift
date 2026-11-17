import Foundation

/// Port of src/lib/ai.ts `ai()` + src/lib/llmParse.ts `refine`: the server's "parse" task, validated.
enum AIClient {
    static var session: URLSession = .shared
    private static var off = false
    /// Tests call this to forget a 503 / 404 from an earlier case.
    static func reset() { off = false }

    private static var base: String {
        // -PeeplAPIBase <url>: UI tests point it at nothing, so they never use the network
        (UserDefaults.standard.string(forKey: "PeeplAPIBase") ?? Bundle.main.object(forInfoDictionaryKey: "PeeplAPIBase") as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? "https://peepl-steel.vercel.app"
    }

    private static func cut(_ v: String) -> String {
        if v.count <= 44 { return v }
        var s = String(v.prefix(44))
        if let r = s.range(of: #"\s+\S*$"#, options: .regularExpression) { s.removeSubrange(r) }
        return s + "…"
    }

    static func parse(_ note: String) async -> Draft? {
        let t = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !off, !t.isEmpty, let url = URL(string: base + "/api/ai/parse") else { return nil }
        var req = URLRequest(url: url, timeoutInterval: 10)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["text": t])
        guard let (data, resp) = try? await session.data(for: req), let http = resp as? HTTPURLResponse else { return nil }
        if http.statusCode == 503 || http.statusCode == 404 { off = true; return nil }
        guard (200..<300).contains(http.statusCode),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        func get(_ k: String) -> String { (json[k] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "" }
        func rx(_ v: String, _ p: String) -> String { v.replacingOccurrences(of: p, with: "", options: [.regularExpression, .caseInsensitive]) }

        var d = Draft()
        // Names and places must really be in the note: a model sometimes makes them up
        func found(_ k: String) -> String? {
            let v = get(k)
            return !v.isEmpty && t.localizedCaseInsensitiveContains(v) ? v : nil
        }
        d.name = found("name").map { rx($0, #"^(?:Dr|Mr|Mrs|Ms|Prof)\.?\s+"#) }
        d.company = found("company"); d.from = found("from"); d.lives = found("lives")
        func plain(_ k: String) -> String? { get(k).isEmpty ? nil : cut(get(k)) }
        d.does = plain("does"); d.follow = plain("follow")
        let met = rx(rx(get("met"), #"^(?:at|in|through)\s+"#), #"^(?:an?|the)\s+"#)
        d.met = met.isEmpty ? nil : cut(met)
        if var r = plain("remember") {
            if r.range(of: #"^(?:loves?|likes?|enjoys?|into|plays?|climbs?|runs?|collects?|obsessed|passionate)\b"#, options: [.regularExpression, .caseInsensitive]) == nil { r = cut("Loves \(r)") }
            d.remember = r
        }
        let goal = get("goal")
        if !goal.isEmpty { d.goal = cut(goal.range(of: #"^wants? to"#, options: [.regularExpression, .caseInsensitive]) != nil ? goal : "Wants to \(goal)") }
        return d
    }
}

// MARK: Find (web ai.ts rankWithAi / draftMessage)
extension AIClient {
    private static func clip(_ s: String?, _ n: Int) -> String {
        guard let s else { return "" }
        if s.count <= n { return s }
        var t = String(s.prefix(n))
        if let r = t.range(of: #"\s+\S*$"#, options: .regularExpression) { t.removeSubrange(r) }
        return t + "…"
    }

    /// What the model may know about someone: their profile, never their id.
    private static func facts(_ p: PersonInfo) -> [String: Any] {
        ["job": p.profession, "lives": p.livesNow.city, "from": p.from.city, "met": p.met.context ?? "", "tags": p.tags,
         "story": clip(p.story, 240), "recent": p.moments.prefix(2).map { clip($0.transcript ?? $0.text ?? $0.title, 120) }]
    }

    /// POST /api/ai/<task>; nil on any failure. 503 / 404 turn the AI off for the session.
    private static func post(_ task: String, _ body: [String: Any], timeout: TimeInterval) async -> [String: Any]? {
        guard !off, let url = URL(string: base + "/api/ai/" + task) else { return nil }
        var req = URLRequest(url: url, timeoutInterval: timeout)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        guard let (data, resp) = try? await session.data(for: req), let http = resp as? HTTPURLResponse else { return nil }
        if http.statusCode == 503 || http.statusCode == 404 { off = true; return nil }
        guard (200..<300).contains(http.statusCode) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    static func rank(_ query: String, result: AskResult, people: [PersonInfo], embedder: Embedder) async -> AskResult {
        // A relaxed answer (groups + note) already explains itself; the AI's flat list would drop that.
        guard case .people(let a) = result, a.groups == nil else { return result }
        var seen = Set(a.matches.map(\.person.id))
        var pool: [Match] = []
        for m in (a.near ?? []) + (await Semantic.closestMatches(query, people: people, n: 12, embedder: embedder))
        where pool.count < 12 && seen.insert(m.person.id).inserted { pool.append(m) }
        guard !pool.isEmpty,
              let out = await post("rank", ["query": query, "candidates": pool.enumerated().map { ["i": $0.offset].merging(facts($0.element.person)) { a, _ in a } }], timeout: 10),
              let results = out["results"] as? [[String: Any]] else { return result }

        var verdict: [Int: (fits: Bool, why: String)] = [:]
        for r in results { if let i = r["i"] as? Int { verdict[i] = (r["fits"] as? Bool ?? false, r["why"] as? String ?? "") } }
        var fit: [Match] = [], notQuite: [Match] = []
        for (i, var m) in pool.enumerated() {
            if let v = verdict[i], v.fits { if !v.why.isEmpty { m.why = v.why }; fit.append(m) } else { notQuite.append(m) }
        }
        let matches = (a.matches + fit).prefix(10).map { m -> Match in
            var m = m
            if m.action == nil {
                let first = m.person.firstName
                m.action = Action(kind: .message, label: "Draft a message", to: m.person.name, draft: "",
                    goal: "The user was looking for: “\(query)”, and \(first) is the person who fits (\(m.why)). Write to \(first) and ask for exactly that.")
            }
            return m
        }
        return .people(PeopleAnswer(
            title: matches.isEmpty ? "No one matches “\(query)” yet" : "\(matches.count) \(matches.count == 1 ? "person" : "people") for “\(query)”",
            matches: Array(matches), near: matches.isEmpty ? Array(notQuite.prefix(2)) : nil))
    }

    static func draft(_ person: PersonInfo, action: Action) async -> String {
        let first = person.firstName
        var p = facts(person); p["name"] = first
        let out = await post("draft", ["person": p, "kind": action.kind.rawValue, "goal": action.goal ?? action.draft], timeout: 15)
        let text = (out?["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return !text.isEmpty ? text : !action.draft.isEmpty ? action.draft : "Hey \(first)! Hope you’re doing well. Want to catch up soon?"
    }
}
