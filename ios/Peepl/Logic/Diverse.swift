import Foundation

/// Web pickDiverse (src/lib/diverse.ts): the `n` people least like each other, so a question finds a couple of people,
/// not ten. Each pick is the person whose job, tags and where-you-met are least like what is already chosen.
/// `keep` are always in. Ties go to the earlier person.
enum Diverse {
    /// The people the demo answers rely on (web `keep` in src/data/people.ts).
    static let keep: Set<String> = ["ty-nakamura", "zara-ahmed", "aisha-khan", "ana-ruiz", "jordan-smith", "maya-chen", "daniel-okafor", "dana-reyes"]

    // Things you'd ask for "someone to do X with": only a few people per activity get in.
    private static let activities: [(String, NSRegularExpression)] = [
        ("pickleball", #"\b(pickleball|tennis|padel)\b"#),
        ("climbing", #"\b(climb\w*|boulder\w*)\b"#),
        ("running", #"\b(running|run club|marathon|jogging)\b"#),
        ("hiking", #"\b(hik(e|es|ing))\b"#),
        ("fitness", #"\b(yoga|pilates|gym|crossfit|workout)\b"#),
        ("music", #"\b(concerts?|live music|gigs?|band|guitar)\b"#),
        ("art", #"\b(museums?|galler(y|ies)|exhibit\w*)\b"#),
        ("film", #"\b(movies?|cinema|film)\b"#),
        ("games", #"\b(game night|board games?|chess|poker)\b"#),
    ].map { ($0.0, try! NSRegularExpression(pattern: $0.1)) }
    private static let perActivity = 3

    private static func norm(_ s: String) -> String {
        s.lowercased().replacingOccurrences(of: #"\s+@.*$"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func pick(_ people: [PersonInfo], n: Int, keep: Set<String> = []) -> [PersonInfo] {
        var seen: [String: Int] = [:]
        // each person's traits, worked out once (the web re-tests the activity words on every pick)
        var traits: [String: [(String, Int)]] = [:], acts: [String: [String]] = [:]
        for p in people {
            let text = ([p.profession, p.story] + p.tags + p.moments.map { "\($0.title) \($0.text ?? "")" }).joined(separator: " ").lowercased()
            let a = activities.filter { $0.1.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil }.map { "a:\($0.0)" }
            acts[p.id] = a
            traits[p.id] = p.tags.map { ("t:\(norm($0))", 3) } + [("j:\(norm(p.profession))", 6), ("m:\(norm(p.met.context ?? ""))", 4),
                                                                 ("c:\(p.livesNow.hood ?? p.livesNow.city)", 1)] + a.map { ($0, 10000) }
        }
        func take(_ p: PersonInfo) { for (k, _) in traits[p.id]! { seen[k, default: 0] += 1 } }
        var chosen = Set(people.filter { keep.contains($0.id) }.map(\.id))
        people.filter { chosen.contains($0.id) }.forEach(take)
        var pool = people.filter { !keep.contains($0.id) }
        while chosen.count < n, !pool.isEmpty {
            func room(_ p: PersonInfo) -> Bool { acts[p.id]!.allSatisfy { seen[$0, default: 0] < perActivity } }
            let open = pool.contains(where: room)
            var best = 0, bestCost = Int.max
            for (i, p) in pool.enumerated() where !open || room(p) {
                let cost = traits[p.id]!.reduce(0) { $0 + $1.1 * seen[$1.0, default: 0] }
                if cost < bestCost { best = i; bestCost = cost }
            }
            let p = pool.remove(at: best)
            chosen.insert(p.id); take(p)
        }
        return people.filter { chosen.contains($0.id) } // keep the original order
    }
}
