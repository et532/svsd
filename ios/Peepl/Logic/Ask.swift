import Foundation

/// A suggested next step on a result: Peepl drafts the message, the user decides whether to send it.
struct Action: Hashable, Sendable {
    enum Kind: String, Sendable { case message, coffee, intro }
    struct Closes: Hashable, Sendable { var personId: String; var todoId: String }
    var kind: Kind; var label: String; var to: String; var draft: String
    var goal: String? = nil; var closes: Closes? = nil
}
struct Match: Identifiable, Hashable, Sendable {
    var person: PersonInfo; var why: String
    var say: String? = nil; var via: String? = nil; var action: Action? = nil; var chip: String? = nil
    var id: String { person.id }
}
struct MatchGroup: Hashable, Sendable { var label: String; var matches: [Match] }
struct PeopleAnswer: Hashable, Sendable {
    var title: String; var matches: [Match]; var groups: [MatchGroup]? = nil
    var generic = false; var criteria = 0; var near: [Match]? = nil; var note: String? = nil
}
enum AskResult: Hashable, Sendable { case people(PeopleAnswer), add, moment(PersonInfo), profile(PersonInfo), none(title: String) }

/// Web ask.ts: the rule-based "Ask" (add / moment / profile / catch-up / keyword filters / buddy / trip / intro).
enum Ask {
    /// Words that broaden a request ("sports" should find baseball and running).
    static let related: [String: [String]] = [
        "sports": ["baseball", "basketball", "soccer", "running", "tennis", "climbing", "hiking", "marathon", "run club", "sports"],
        "sport": ["baseball", "basketball", "soccer", "running", "tennis", "climbing", "hiking", "marathon", "sports"],
        "outdoors": ["hiking", "climbing", "running", "patagonia", "outdoors"],
        "tech": ["engineering", "software", "data", "robotics", "startup", "tech", "product"],
        "music": ["music", "jazz", "cello", "band", "musician"],
        "art": ["art", "design", "film", "ceramics", "pottery", "photography", "sketch", "gallery"],
        "food": ["food", "chef", "cooking", "ramen", "supper", "spicy"],
        "health": ["health", "med", "medical", "nurse", "pediatrics"],
        "climate": ["climate", "sustainab", "wildfire", "fertilizer", "passive house"],
        "money": ["investing", "investor", "vc"],
        "startups": ["founder", "startup", "startups"],
        "books": ["books", "reading", "writer", "journalist"],
        "fashion": ["fashion", "style", "stylist", "clothing", "vintage", "tailor", "runway", "apparel", "thrift", "wardrobe"],
        "photography": ["photography", "photographer", "photo", "portrait", "portraits", "film cameras"],
        "film": ["film", "movie", "movies", "cinema", "director", "screening"],
        "fitness": ["fitness", "gym", "yoga", "pilates", "lifting", "training"],
        "travel": ["travel", "trip", "abroad", "backpacking"],
        "games": ["games", "gaming", "board game", "game night", "chess"],
        "taxes": ["taxes", "tax", "accountant", "cpa", "bookkeeping"],
        "classical": ["classical", "chamber music", "orchestra", "cello", "viola", "violin", "piano", "symphony", "quartet"],
        "hardware": ["hardware", "electronics", "robotics", "embedded", "mechanical"],
    ]

    /// Words that carry no meaning for matching (the web list has a curly apostrophe in who’s / that’s).
    static let filler: Set<String> = Set((
        "who whos whom what which where when do does did i im ive me my mine you your know knows known people person " +
        "everyone everybody anyone someone somebody all show find search look looking for get give list tell about " +
        "that thats is are was were be been being the a an and or of to with into in at on from by like likes liked " +
        "love loves into interested interest interests can could would please any some who’s that’s there their them " +
        "they he she his her it its just also really guys folks lot lots much many works working work does do into " +
        "lives live living met meet meeting play plays playing played want wants need needs something"
    ).split(separator: " ").map(String.init))

    /// Lowercase, strip accents, drop ’ and '.
    static func norm(_ s: String) -> String {
        String(String.UnicodeScalarView(s.lowercased().decomposedStringWithCanonicalMapping.unicodeScalars
            .filter { !(0x300...0x36F).contains($0.value) && $0 != "’" && $0 != "'" }))
    }

    // MARK: regex helpers (JS-compatible enough: ICU)

    private static func rx(_ p: String) -> NSRegularExpression { try! NSRegularExpression(pattern: p) }
    private static func test(_ re: NSRegularExpression, _ s: String) -> Bool {
        re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }
    private static func test(_ p: String, _ s: String) -> Bool { test(rx(p), s) }
    /// First match only, like JS replace without /g.
    private static func replaceFirst(_ re: NSRegularExpression, in s: String, with r: String) -> String {
        guard let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return s }
        return (s as NSString).replacingCharacters(in: m.range, with: r)
    }
    /// JS `s.split(/(?<=[.!?])\s+/)` (or after "." only).
    private static func sentences(_ s: String, dotOnly: Bool = false) -> [String] {
        let re = rx(dotOnly ? "(?<=\\.)\\s+" : "(?<=[.!?])\\s+")
        var out: [String] = [], last = 0
        let ns = s as NSString
        for m in re.matches(in: s, range: NSRange(location: 0, length: ns.length)) {
            out.append(ns.substring(with: NSRange(location: last, length: m.range.location - last)))
            last = m.range.location + m.range.length
        }
        out.append(ns.substring(from: last))
        return out
    }
    private static func noDot(_ s: String) -> String { s.replacingOccurrences(of: "\\.$", with: "", options: .regularExpression) }
    private static func cap(_ s: String) -> String { s.prefix(1).uppercased() + s.dropFirst() }
    private static func plural(_ n: Int) -> String { n == 1 ? "person" : "people" }

    // MARK: dates

    private static let iso: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "UTC"); f.dateFormat = "yyyy-MM-dd"; return f
    }()
    private static let monthYear: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.timeZone = TimeZone(identifier: "UTC"); f.dateFormat = "MMM yyyy"; return f
    }()
    /// Dates in data are ISO days; UTC midnight like JS `new Date('2026-10-02')`.
    private static func date(_ s: String) -> Date { iso.date(from: Capture.padDate(s)) ?? Date(timeIntervalSince1970: 0) }

    /// Web people.ts timeSince.
    static func timeSince(_ isoDate: String, now: Date = Date()) -> String {
        let days = Int(floor(now.timeIntervalSince(date(isoDate)) / 86400))
        if days <= 0 { return "Today" }
        if days == 1 { return "Yesterday" }
        if days < 7 { return "\(days)d ago" }
        if days < 30 { return "\(days / 7)w ago" }
        if days < 365 { return "\(days / 30)mo ago" }
        return "\(days / 365)y ago"
    }

    /// Who is most worth a message: the longer it has been, and the closer you are, the higher.
    static func staleness(_ p: PersonInfo, now: Date) -> Double {
        now.timeIntervalSince(date(p.lastContacted)) * 1000 * (0.5 + Double(p.closeness ?? 1))
    }
    private static func overdue(_ p: PersonInfo, now: Date) -> Bool { now.timeIntervalSince(date(p.lastContacted)) / 86400 > 45 }
    private static func openTodos(_ p: PersonInfo) -> [PersonInfo.TodoInfo] { p.todos.filter { !$0.done } }
    private static func sentence(_ story: String, _ term: NSRegularExpression) -> String? {
        sentences(story, dotOnly: true).first { test(term, norm($0)) }.map(noDot)
    }

    // MARK: interpret

    static func isSpecial(_ r: AskResult) -> Bool {
        switch r {
        case .none: return false
        case .people(let a): return !(a.generic || a.matches.isEmpty)
        default: return true
        }
    }

    static func interpret(_ input: String, people: [PersonInfo], now: Date = Date()) -> AskResult {
        let text = norm(input).replacingOccurrences(of: "[?.!,]", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty { return .none(title: "I didn’t catch that") }

        let named = mentionedPerson(text, people)
        if let s = buddy(text, people) ?? trip(text, people, now: now) ?? intro(text, people, now: now) { return s }

        if let named, test("\\b(log|note|record|add)\\b.*\\b(moment|catch ?up|coffee|chat|call)\\b", text) { return .moment(named) }
        if named == nil, test("\\b(add|new (person|profile|contact)|create|save|i (just )?met someone|someone new)\\b", text) { return .add }
        if let named, test("\\b(open|show|pull up|go to|see|view)\\b", text),
           test("\\b(profile|page|card)\\b|^(open|show|pull up|go to|see|view) \\w+( \\w+)?$", text) { return .profile(named) }

        // How long it's been
        if test("(havent|have not|hasnt|not)( i| we| you)? (talked|spoken|seen|caught up)|lost touch|(been|in) a while|catch up with|reach out|out of touch", text) {
            let m = people.sorted { staleness($0, now: now) > staleness($1, now: now) }.prefix(5)
                .map { Match(person: $0, why: "Last talked \(timeSince($0.lastContacted, now: now).lowercased())") }
            return .people(PeopleAnswer(title: "People you haven’t talked to in a while", matches: m))
        }
        if test("\\b(recently|lately|this week|this month)\\b", text), test("\\b(talked|spoke|seen|met|saw)\\b", text) {
            let m = people.sorted { $0.lastContacted > $1.lastContacted }.prefix(5)
                .map { Match(person: $0, why: "Last talked \(timeSince($0.lastContacted, now: now).lowercased())") }
            return .people(PeopleAnswer(title: "People you talked to recently", matches: m))
        }

        // Filters that all have to hold
        struct Filter { var label: String; var test: (PersonInfo) -> String? }
        var filters: [Filter] = []
        var rest = " \(text) "

        let relationWords: [(String, String, String)] = [
            ("\\b(family|relatives?|cousins?|siblings?)\\b", "family", "family"),
            ("\\b(work|coworkers?|colleagues?|professional)\\b", "work", "from work"),
            ("\\b(friends?|social)\\b", "social", "friends"),
            ("\\b(community|neighbou?rs?)\\b", "community", "community"),
        ]
        for (pat, context, label) in relationWords {
            let re = rx(pat)
            if test(re, rest), !test("\\b(works? (in|at|as)|working)\\b", replaceFirst(re, in: rest, with: "")) {
                filters.append(Filter(label: label) { $0.context == context ? cap(label) : nil })
                rest = replaceFirst(re, in: rest, with: " ")
                break
            }
        }

        // Places and events: the longest names first so "New York" wins over "York".
        var placeKeys: [String] = [], places: [String: (field: String, name: String)] = [:]
        var known: [String] = []
        var seen = Set<String>()
        for p in people { for n in [p.from.city, p.met.city, p.met.context, p.livesNow.city] { if let n, seen.insert(n).inserted { known.append(n) } } }
        let names = known.enumerated().sorted { ($0.element.utf16.count, $1.offset) > ($1.element.utf16.count, $0.offset) }.map(\.element)
        for name in names {
            let head = name.components(separatedBy: ",")[0]
            let short = norm(head)
            if short.utf16.count < 3 { continue }
            let ns = rest as NSString
            let at = ns.range(of: " \(short) ")
            if at.location == NSNotFound { continue }
            let start = max(0, at.location - 16)
            let before = ns.substring(with: NSRange(location: start, length: at.location - start))
            let field = test("\\bfrom\\s*$", before) ? "from" : test("\\bmet( (at|in))?\\s*$", before) ? "met" : test("\\b(lives?|living|based)( in)?\\s*$", before) ? "lives" : "any"
            if places[short] == nil { placeKeys.append(short) }
            places[short] = (field, head)
            rest = ns.replacingCharacters(in: at, with: " ")
        }
        for short in placeKeys {
            let (field, name) = places[short]!
            filters.append(Filter(label: field == "from" ? "from \(name)" : field == "met" ? "met at \(name)" : "in \(name)") { p in
                func hit(_ s: String?) -> Bool { norm(s ?? "").contains(short) }
                if field == "met" || field == "any", hit(p.met.context) || hit(p.met.city) { return "Met at \(p.met.context ?? "") · \(p.met.city)" }
                if field == "lives" || field == "any", hit(p.livesNow.city) { return "Lives in \(p.livesNow.city)" }
                if field == "from" || field == "any", hit(p.from.city) { return "From \(p.from.city)" }
                return nil
            })
        }

        // Whatever is left is about interests or work
        let words = rest.components(separatedBy: " ").filter { $0.utf16.count > 2 && !filler.contains($0) }
        for word in words {
            let stem = word.replacingOccurrences(of: "(ers|ing|ies|es|s)$", with: "", options: .regularExpression)
            let terms = related[word] ?? [word, stem.utf16.count >= 4 ? stem : word]
            let re = momentRegex(terms)
            filters.append(Filter(label: word) { p in
                // What actually happened with them comes first; the profile (tags, job, story) is the fallback reason
                if let m = inMoments(p, re) { return m }
                if let tag = p.tags.first(where: { t in terms.contains { norm(t).contains($0) } }) { return "Into \(tag)" }
                if terms.contains(where: { norm(p.profession).contains($0) }) { return p.profession }
                let line = sentences(p.story).first { x in terms.contains { norm(x).contains($0) } }
                return line.map(noDot)
            })
        }

        if let named, filters.isEmpty { return .profile(named) }
        if filters.isEmpty { return .none(title: "I’m not sure what to look for") }

        var matches: [Match] = []
        let momentRe = rx("\\(.+, [A-Z][a-z]{2} \\d{4}\\)$")
        for person in people {
            let reasons = filters.map { $0.test(person) }
            // A moment ("… (Coffee, Oct 2026)") is the best reason: say that, not every filter's reason
            guard reasons.allSatisfy({ $0 != nil }) else { continue }
            let all = reasons.compactMap { $0 }
            let moment = all.first { test(momentRe, $0) }
            var uniq: [String] = []; for r in all where !uniq.contains(r) { uniq.append(r) }
            matches.append(Match(person: person, why: moment ?? uniq.joined(separator: " · ")))
        }
        let about = filters.map(\.label).joined(separator: ", ")
        let title = matches.isEmpty ? "No one matches “\(about)” yet" : "\(matches.count) \(plural(matches.count)) · \(about)"
        return .people(PeopleAnswer(title: title, matches: matches, generic: true, criteria: filters.count))
    }

    private static func momentRegex(_ terms: [String]) -> NSRegularExpression {
        rx("\\b(\(terms.map { NSRegularExpression.escapedPattern(for: $0) }.joined(separator: "|")))")
    }

    /// What happened with someone that mentions one of the words: the sentence from a logged moment, and when.
    private static func inMoments(_ p: PersonInfo, _ re: NSRegularExpression) -> String? {
        for m in p.moments {
            if let hit = sentences(m.transcript ?? m.text ?? m.title).first(where: { test(re, norm($0)) }) {
                return "\(noDot(hit)) (\(m.title), \(monthYear.string(from: date(m.date))))"
            }
        }
        return nil
    }

    /// Someone mentioned by full name, or by a first name only one person has.
    private static func mentionedPerson(_ text: String, _ people: [PersonInfo]) -> PersonInfo? {
        let t = " \(text) "
        if let full = people.first(where: { t.contains(" \(norm($0.name)) ") }) { return full }
        let byFirst = people.filter { p in let f = norm(p.firstName); return t.contains(" \(f) ") || t.contains(" \(f)s ") }
        return byFirst.count == 1 ? byFirst[0] : nil
    }

    // MARK: richer answers

    /// Only climbing is answered this way (the pitch demo: Jordan, then Zara).
    private static let climbAsk = rx("\\b(climb|climbing|boulder|bouldering)\\b")
    private static let climbTerm = rx("climb|boulder")

    private static func wants(_ p: PersonInfo, _ term: NSRegularExpression) -> String? {
        (openTodos(p).map(\.text) + sentences(p.story, dotOnly: true))
            .first { test(term, norm($0)) && test("buddy|partner|someone", norm($0)) }.map(noDot)
    }

    private static func buddy(_ text: String, _ people: [PersonInfo]) -> AskResult? {
        guard test("\\b(buddy|partner|someone to|go with|join me)\\b", text), test(climbAsk, text) else { return nil }
        let activity = "climbing", label = "climbing buddy", term = climbTerm
        let whereAt = Places.resolve(text)?.place ?? Places.home()
        func said(_ p: PersonInfo) -> Bool { ([p.story] + p.tags + openTodos(p).map(\.text)).contains { test(term, norm($0)) } }
        let matches = people.filter { said($0) && Places.sameMetro(whereAt, Places.of($0)) }
            .sorted { a, b in
                let wa = wants(a, term) != nil, wb = wants(b, term) != nil
                return wa != wb ? wa : a.lastContacted > b.lastContacted
            }
            .map { person -> Match in
                let first = person.firstName
                let w = wants(person, term)
                let why = w ?? sentence(person.story, term) ?? "Into \(activity)"
                let hook = w != nil ? "you said you were looking for a \(label)" : "you mentioned getting into \(activity)"
                return Match(person: person, why: why,
                             say: w != nil ? "“Still up for \(activity)? I’m in.”" : "Ask how the \(activity) is going, then invite them along.",
                             action: Action(kind: .message, label: "Draft a message", to: person.name, draft: "Hey \(first)! Last time \(hook). Want to go \(activity) this week?"))
            }
        let area = " in \(whereAt.name)"
        return .people(PeopleAnswer(title: matches.isEmpty ? "No one into \(activity)\(area) yet" : "\(matches.count) \(plural(matches.count)) for \(activity)\(area)", matches: matches))
    }

    private static func trip(_ text: String, _ people: [PersonInfo], now: Date) -> AskResult? {
        guard test("\\b(travel|traveling|travelling|trip|visiting|heading|going|flying|in town|next (week|month))\\b", text),
              let hit = Places.resolve(text), !Places.sameMetro(Places.home(), hit.place) else { return nil } // a trip is somewhere else
        let area = hit.place.metro == "bay" ? "the Bay Area" : hit.place.name
        let there = people.filter { Places.sameMetro(hit.place, Places.of($0)) }
        // The TS builds this regex with "\b" in a template string (a backspace char, so it never matches); the intent is a word match.
        func named(_ s: String, _ first: String) -> Bool { test("\\b\(NSRegularExpression.escapedPattern(for: norm(first)))\\b", norm(s)) }
        var promised: [String: PersonInfo] = [:]
        for p in there { if let o = people.first(where: { $0.id != p.id && openTodos($0).contains { named($0.text, p.firstName) } }) { promised[p.id] = o } }
        let sorted = there.sorted { a, b in
            let pa = promised[a.id] != nil, pb = promised[b.id] != nil
            return pa != pb ? pa : a.lastContacted < b.lastContacted
        }
        let matches = sorted.map { person -> Match in
            let first = person.firstName
            let owed = promised[person.id]
            let last = "last talked \(timeSince(person.lastContacted, now: now).lowercased())"
            let why = "\(person.profession) · \(person.livesNow.city.components(separatedBy: ",")[0]) · \(last)"
            let say: String
            if let owed { say = "Bring up \(owed.firstName): you promised them an intro to \(first)." }
            else if overdue(person, now: now) { say = "It’s been a while. Ask about \(sentence(person.story, rx("."))?.lowercased() ?? person.tags.first ?? "")." }
            else { say = "Ask about \(person.tags.first ?? "")." }
            let todo = owed.flatMap { o in openTodos(o).first { named($0.text, first) } }
            return Match(person: person, why: why, say: say,
                         via: owed.map { "\($0.firstName)’s follow-up" } ?? (overdue(person, now: now) ? "Overdue to catch up" : nil),
                         action: Action(kind: .coffee, label: "Plan coffee", to: person.name,
                                        draft: "Hi \(first)! I’m in \(hit.place.metro == "bay" ? "SF" : hit.place.name) next month and would love to grab a coffee.\(owed.map { " I also want to introduce you to \($0.name), who I think you’d get along with." } ?? "") Any morning free?",
                                        closes: owed.flatMap { o in todo.map { .init(personId: o.id, todoId: $0.id) } }))
        }
        return .people(PeopleAnswer(title: matches.isEmpty ? "No one in \(area) yet" : "\(matches.count) \(plural(matches.count)) in \(area)", matches: matches))
    }

    private static func intro(_ text: String, _ people: [PersonInfo], now: Date) -> AskResult? {
        guard test("\\b(introduce|intro|connect|refer)\\b", text) else { return nil }
        let re = rx("\\b(?:looking for|needs?|hiring|wants?|searching for) (?:an? )?([a-z ]+?)(?: who| that| can|$| i | what)")
        guard let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)), m.numberOfRanges > 1,
              let r = Range(m.range(at: 1), in: text) else { return nil }
        let role = text[r].trimmingCharacters(in: .whitespaces)
        if role.isEmpty { return nil }
        let words = role.components(separatedBy: " ").filter { !filler.contains($0) }
        guard let key = words.first(where: { !test("^(engineer|designer|person|someone|developer|expert)$", $0) }) ?? words.first else { return nil }
        func has(_ p: PersonInfo, _ w: String) -> Bool { ([p.profession] + p.tags).contains { norm($0).contains(w) } }
        func askTodo(_ p: PersonInfo) -> PersonInfo.TodoInfo? { openTodos(p).first { test("intro", norm($0.text)) && norm($0.text).contains(key) } }
        let asker = people.filter { askTodo($0) != nil }.sorted { $0.lastContacted > $1.lastContacted }.first
        let askerTodo = asker.flatMap(askTodo)
        let direct = people.filter { p in p.id != asker?.id && words.allSatisfy { w in has(p, w) || norm(p.story).contains(w) } }
        let directIds = Set(direct.map(\.id))
        let connectors = people.filter { $0.id != asker?.id && !directIds.contains($0.id) && norm($0.story).contains(key) }
        let founder = asker?.name ?? "the founder"
        let blurb = asker.map { sentence($0.story, rx(".")) ?? $0.profession } ?? ""
        let keenRe = rx("advise|mentor|help|looking|open to")
        func wantish(_ k: String) -> String { k.replacingOccurrences(of: "^wants", with: "want", options: [.regularExpression, .caseInsensitive]).lowercased() }
        func toMatch(_ person: PersonInfo, viaWhy: String?) -> Match {
            let first = person.firstName
            let keen = sentence(person.story, keenRe)
            if let viaWhy {
                return Match(person: person, why: viaWhy, say: "Ask who on their team or portfolio does \(key).", via: "Can connect you",
                             action: Action(kind: .message, label: "Ask \(first)", to: person.name, draft: "Hi \(first)! I just met \(founder), who’s looking for a \(role). Anyone you’d recommend?"))
            }
            return Match(person: person, why: [person.profession, keen].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
                         say: keen.map { "They said they \(wantish($0))." } ?? "Ask if they’d be open to a chat.",
                         action: Action(kind: .intro, label: "Draft intro", to: asker.map { "\(person.name) and \($0.name)" } ?? person.name,
                                        draft: "Hi \(first), meet \(founder).\(blurb.isEmpty ? "" : " \(blurb).") They’re looking for a \(role).\(keen.map { " You mentioned you \(wantish($0)), so I thought of you two." } ?? "")",
                                        closes: asker.flatMap { a in askerTodo.map { .init(personId: a.id, todoId: $0.id) } }))
        }
        let keyRe = rx(key)
        let groups = [
            MatchGroup(label: "You know directly", matches: direct.map { toMatch($0, viaWhy: nil) }),
            MatchGroup(label: "One step away", matches: connectors.map { toMatch($0, viaWhy: sentence($0.story, keyRe) ?? $0.profession) }),
        ].filter { !$0.matches.isEmpty }
        let matches = groups.flatMap(\.matches)
        return .people(PeopleAnswer(title: matches.isEmpty ? "No \(role) in your people yet" : "Who could help with a \(role)", matches: matches, groups: groups))
    }
}
