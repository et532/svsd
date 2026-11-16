import Foundation

/// A question -> what has to be true (hard) and what only makes someone a better fit (soft) (web query/index.ts).
struct Constraints: Sendable {
    var text: String
    var intent: String // plan | knowledge | find
    var activityId: String?
    var activityLabel: String?
    var place: PlaceRec?
    var named: Bool
    var stage: String?
    var contexts: [String: Double]
    var theme: [String]
    var groups: [[String]]
    var metAt: String?
    var embedText: String
    var explain: [String]
}

enum Query {
    private typealias W = [String: Double]
    private static let party: W = ["social": 1, "community": 0.7, "family": 0.4, "work": 0.3]
    private static let anyone: W = ["social": 1, "community": 0.8, "work": 0.8, "family": 0.5]
    private static let friends: W = ["social": 1, "community": 0.9, "work": 0.4, "family": 0.3]

    private struct Activity { var id, label, re: String; var contexts: W; var theme: [String]? = nil }
    // Order matters: the first one that reads in the question wins.
    private static let activities: [Activity] = [
        .init(id: "house-party", label: "a house party", re: "\\b(house ?party|housewarming|house warming|birthday party|party)\\b", contexts: party),
        .init(id: "dinner", label: "dinner", re: "\\b(dinner|supper|brunch|lunch)\\b", contexts: party.merging(["family": 0.6]) { $1 }),
        .init(id: "drinks", label: "drinks", re: "\\b(drinks?|happy hour|beers?|cocktails?)\\b", contexts: party),
        .init(id: "coffee", label: "coffee", re: "\\b(coffee|cafe)\\b", contexts: anyone),
        .init(id: "game-night", label: "a game night", re: "\\bgame night\\b", contexts: party, theme: ["games"]),
        .init(id: "climbing", label: "climbing", re: "\\b(climb|climbing|boulder|bouldering)\\b", contexts: friends, theme: ["climbing", "bouldering"]),
        .init(id: "running", label: "a run", re: "\\b(run|running|jog|jogging)\\b", contexts: friends, theme: ["running", "run club", "marathon"]),
        .init(id: "hiking", label: "a hike", re: "\\b(hike|hiking)\\b", contexts: friends, theme: ["hiking"]),
        .init(id: "pickleball", label: "pickleball", re: "\\b(pickleball|tennis|padel)\\b", contexts: friends, theme: ["pickleball", "tennis"]),
        .init(id: "workout", label: "a workout", re: "\\b(workout|gym|yoga|pilates)\\b", contexts: friends, theme: ["fitness"]),
        .init(id: "concert", label: "a concert", re: "\\b(concert|gig|live music)\\b", contexts: party, theme: ["music"]),
        .init(id: "museum", label: "a gallery", re: "\\b(museum|gallery|exhibit|exhibition)\\b", contexts: friends, theme: ["art"]),
        .init(id: "movie", label: "a movie", re: "\\b(movie|movies|cinema|film screening)\\b", contexts: friends, theme: ["film"]),
    ]
    private static let relations: [(String, W)] = [
        ("\\b(family|relatives?|cousins?|siblings?)\\b", ["family": 1]),
        ("\\b(coworkers?|colleagues?|co-workers?|professional)\\b", ["work": 1]),
        ("\\b(friends?|social)\\b", ["social": 1, "community": 0.6]),
        ("\\b(community|neighbou?rs?)\\b", ["community": 1]),
    ]
    private static let stages: [(String, String)] = [
        ("\\bcollege\\b", "college"), ("\\bhigh ?school\\b", "high-school"),
        ("\\b(hometown|grew up with|childhood)\\b", "hometown"), ("\\b(first job|chicago job|old job)\\b", "first-job"),
    ]
    private static let askWords: Set<String> = Set((
        "themed theme vibe invite inviting host hosting over around near nearby moved move moving fun cool good great nice best " +
        "next month week weekend tonight tomorrow soon free thing things kind sort type totally really maybe ask grab hang come " +
        "talk talking speak chat right now currently mine ours join along how night evening afternoon morning day time quiet chill relaxed easy casual cozy lively small big birthday anniversary celebration holiday"
    ).split(separator: " ").map(String.init))

    private static func test(_ re: String, _ s: String) -> Bool { s.range(of: re, options: .regularExpression) != nil }
    /// JS non-global replace: only the first match.
    private static func replaceFirst(_ re: String, in s: String, with r: String = " ") -> String {
        guard let range = s.range(of: re, options: .regularExpression) else { return s }
        return s.replacingCharacters(in: range, with: r)
    }
    private static func squash(_ s: String) -> String {
        s.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func parse(_ input: String) -> Constraints {
        let clean = squash(Ask.norm(input).replacingOccurrences(of: "[?.!;:]", with: " ", options: .regularExpression))
        var rest = " \(clean) "
        var explain: [String] = []

        let found = Places.resolve(clean)
        if let found { rest = " \(found.rest) " }

        // "met at Supper club": where you met them is a filter, not a topic
        var metAt: String?
        let metRe = "\\bmet (?:at|through|via|in)\\s+(?:the\\s+)?(.+?)\\s*$"
        if let m = try? NSRegularExpression(pattern: metRe).firstMatch(in: rest, range: NSRange(rest.startIndex..., in: rest)),
           let r = Range(m.range(at: 1), in: rest) {
            metAt = String(rest[r])
            rest = replaceFirst("\\bmet (?:at|through|via|in)\\s+(?:the\\s+)?.+$", in: rest)
        }

        let knowRe = "\\b(who knows|knows about|know (about|anything|how)|expert|good at|help (me )?with|advice|teach)\\b"
        let topicOnly = test(knowRe, clean)
        let activity = topicOnly ? nil : activities.first { test($0.re, rest) }
        if let activity { rest = replaceFirst(activity.re, in: rest) }

        let stageHit = stages.first { test($0.0, rest) }
        if let stageHit { rest = replaceFirst(stageHit.0, in: rest) }
        let stage = stageHit?.1

        var contexts: W = activity?.contexts ?? [:]
        for (re, w) in relations where test(re, rest) {
            contexts = w
            rest = replaceFirst(re, in: rest)
            break
        }

        let plan = activity != nil || test("\\b(invite|hang out|hang with|come over|join me|go out with|meet ?up|catch up with)\\b", clean)
        let knowledge = !plan && test("\\b(who knows|knows about|know (about|anything|how)|expert|good at|help (me )?with|does my|advice|teach)\\b", clean)
        let intent = plan ? "plan" : knowledge ? "knowledge" : "find"

        let words = rest.components(separatedBy: CharacterSet.whitespaces.union(CharacterSet(charactersIn: "/")))
            .map { $0.replacingOccurrences(of: "[^a-z0-9-]", with: "", options: .regularExpression) }
            .filter { $0.count > 2 && !Ask.filler.contains($0) && !askWords.contains($0) && !test("^(for|the|who|how|that|this|than|then|there|not|any|but)$", $0) }
        var theme: [String] = []
        for w in (activity?.theme ?? []) + words where !theme.contains(w) { theme.append(w) }

        // Synonyms; the activity's own words are alternatives, the words the person added all have to appear.
        func expand(_ w: String) -> [String] {
            let stem = replaceFirst("(ers|ing|ies|es|s)$", in: w, with: "")
            return Ask.related[w] ?? [w, stem.count >= 4 ? stem : w]
        }
        let wanted = rest.contains(" or ") ? [words.flatMap(expand)] : words.map(expand)
        let groups = (((activity?.theme).map { [$0.flatMap(expand)] } ?? []) + wanted).map { g -> [String] in
            var seen = Set<String>(); return g.filter { seen.insert($0).inserted }
        }

        let place = found?.place ?? (intent == "plan" ? Places.home() : nil)
        if let place { explain.append(found != nil ? "in \(place.name)" : "near home (\(place.name))") }
        if let activity { explain.append(activity.label) }
        if !theme.isEmpty { explain.append("about \(theme.joined(separator: ", "))") }
        if let stage { explain.append("from \(replaceFirst("-", in: stage, with: " "))") }
        if let metAt { explain.append("met at \(metAt)") }

        let synonyms = theme.flatMap { Ask.related[$0] ?? [] }.filter { !theme.contains($0) }
        let embedText = theme.isEmpty ? "" : (theme + synonyms.prefix(5)).joined(separator: ", ")
        return Constraints(text: input, intent: intent, activityId: activity?.id, activityLabel: activity?.label, place: place,
                           named: found != nil, stage: stage, contexts: contexts, theme: theme, groups: groups, metAt: metAt,
                           embedText: embedText, explain: explain)
    }
}
