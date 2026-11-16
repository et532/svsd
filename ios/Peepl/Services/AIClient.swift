import Foundation

/// Port of src/lib/ai.ts `ai()` + src/lib/llmParse.ts `refine`: the server's "parse" task, validated.
enum AIClient {
    static var session: URLSession = .shared
    private static var off = false
    /// Tests call this to forget a 503 / 404 from an earlier case.
    static func reset() { off = false }

    private static var base: String {
        (Bundle.main.object(forInfoDictionaryKey: "PeeplAPIBase") as? String).flatMap { $0.isEmpty ? nil : $0 }
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
