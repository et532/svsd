import Foundation

/// Anything with an id and a full name. `Person` conforms; tests use a small struct.
protocol Named { var id: String { get }; var name: String { get } }
extension Person: Named {}

/// What a note says. Mirrors the web `Draft` in src/lib/capture.ts.
struct Draft: Equatable {
    var name: String?, does: String?, company: String?, from: String?, lives: String?
    var met: String?, remember: String?, goal: String?, follow: String?
    var what: String?, learned: String?            // moments only
    var knows: String?                              // "Maya Chen, Tom Reed" (display)
    var knowsIds: [String] = []
    var context: String?                            // work | social | community | family | unsorted

    /// AI fields win where they are non-nil (web: { ...regex, ...refined }).
    func merged(with ai: Draft?) -> Draft {
        guard let ai else { return self }
        var d = self
        d.name = ai.name ?? name; d.does = ai.does ?? does; d.company = ai.company ?? company
        d.from = ai.from ?? from; d.lives = ai.lives ?? lives; d.met = ai.met ?? met
        d.remember = ai.remember ?? remember; d.goal = ai.goal ?? goal; d.follow = ai.follow ?? follow
        d.what = ai.what ?? what; d.learned = ai.learned ?? learned; d.knows = ai.knows ?? knows
        d.knowsIds = ai.knowsIds.isEmpty ? knowsIds : ai.knowsIds
        d.context = ai.context ?? context
        return d
    }
}

// MARK: regex helpers (ICU; lookbehinds must be bounded)

private func rx(_ p: String, _ o: NSRegularExpression.Options = []) -> NSRegularExpression {
    try! NSRegularExpression(pattern: p, options: o)
}
private func ns(_ s: String) -> NSRange { NSRange(location: 0, length: (s as NSString).length) }
private func first(_ re: NSRegularExpression, _ s: String) -> NSTextCheckingResult? { re.firstMatch(in: s, range: ns(s)) }
private func test(_ re: NSRegularExpression, _ s: String) -> Bool { first(re, s) != nil }
/// Text of group `g` (negative counts from the last group; 0 is the whole match).
private func grp(_ m: NSTextCheckingResult?, _ g: Int, _ s: String) -> String? {
    guard let m else { return nil }
    let i = g < 0 ? m.numberOfRanges + g : g
    let r = m.range(at: i)
    return r.location == NSNotFound ? nil : (s as NSString).substring(with: r)
}
private func sub(_ re: NSRegularExpression, _ s: String, _ with: String = "") -> String {
    re.stringByReplacingMatches(in: s, range: ns(s), withTemplate: with)
}
/// JS `s.split(re)[0]`
private func head(_ re: NSRegularExpression, _ s: String) -> String {
    guard let m = first(re, s) else { return s }
    return (s as NSString).substring(to: m.range.location)
}
private func sentences(_ s: String) -> [String] {
    let ns_ = s as NSString
    var out: [String] = [], from = 0
    for m in sentenceGap.matches(in: s, range: ns(s)) {
        out.append(ns_.substring(with: NSRange(location: from, length: m.range.location - from)))
        from = m.range.location + m.range.length
    }
    out.append(ns_.substring(from: from))
    return out
}
private func trim(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }
private func cut(_ v: String) -> String {
    let n = v as NSString
    if n.length <= 44 { return v }
    return sub(rx(#"\s+\S*$"#), n.substring(to: 44)) + "…"
}

// MARK: patterns

private let roles = "founder co-?founder engineer designer investor researcher manager recruiter chef architect developer teacher nurse doctor lawyer consultant analyst scientist director editor producer photographer musician artist writer coach professor barista baker pilot plumber electrician carpenter accountant therapist illustrator journalist filmmaker translator interpreter dentist entrepreneur pharmacist"
    .split(separator: " ").map { r in "[\(r.first!.uppercased())\(r.first!)]\(r.dropFirst())s?" }.joined(separator: "|")
private let companyRx = rx(#"\b(?:\#(roles)|CEO|CTO|PM|[Ww]orks?|[Ww]orking)\s+(?:at|@|for)\s+(?:the\s+)?([A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*)*)"#)
private let cap = #"[A-Z][\w&'-]*"#
private let schoolRx1 = rx(#"\b((?:\#(cap)\s+){0,2}(?:University|College|Institute)(?:\s+of\s+\#(cap)(?:\s+\#(cap))*)?)"#)
private let schoolRx2 = rx(#"\b(?:[Ss]tudied|[Ss]tudies|[Ss]tudying|[Gg]raduated|[Gg]raduate|[Gg]rad|[Aa]ttended|[Aa]ttends|[Aa]ttending|[Aa]lum(?:ni|nus)?|[Ss]tudent)\s+(?:at|from|of)\s+(\#(cap)(?:\s+\#(cap))*)"#)
private let momentWords = rx(#"\b(caught up|catch up|grabbed|hung out|hang out|talked|chatted|ran into|bumped into|saw|had (?:coffee|lunch|dinner)|over coffee)\b"#, .caseInsensitive)
private let notSurname = rx(#"^(?:I|I'm|I've|And|The|A|An|At|In|On|For|About|From|To|With|Then|But|So|Today|Yesterday|Tonight|Tomorrow|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)$"#)
private let meet = #"[Mm]et|[Mm]eet|[Mm]eeting|[Bb]umped into|[Rr]an into|[Rr]an across|[Cc]ame across|[Ii]ntroduced to|[Tt]alked to|[Cc]hatted with|[Ss]poke (?:to|with)|[Ww]ith(?: my \w+)?|[Nn]ext to|(?:[Nn]amed|[Cc]alled)"#
private let person = #"(?:(?:Dr|Mr|Mrs|Ms|Prof)\.?\s+)?(\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+){0,2})"#
private let timeRx = rx(#"\s+(?:last (?:night|week|weekend|month)|yesterday|today|this (?:morning|week|weekend)|tonight)$"#, .caseInsensitive)
// the web's unbounded `(?<=(?:^|[.!?])\s*)into` is bounded here (40 spaces)
private let into = #"(?:is|are|she's|he's|they're|super|really|very|so|also) into|(?<=(?:^|[.!?])\s{0,40})into|obsessed with|passionate about|a big fan of"#
private let city = #"\p{Lu}[\p{Ll}\p{M}]+(?: \p{Lu}[\p{Ll}\p{M}]+)?(?![\p{L}\p{M}])"#
private let fromRx = rx(#"\b(?:[Ff]rom|[Gg]rew up in|[Gg]rown up in|[Bb]orn in|[Rr]aised in) (\#(city))(?!'s)"#)
private let livesRx1 = rx(#"(?:lives?|based|living|works?|working|coach|designer|engineer|manager|writer|artist|chef|lawyer|doctor|nurse|teacher|architect|developer|photographer|consultant|analyst|scientist|director|editor|producer|musician|translator|dentist|entrepreneur) in (\#(city))"#)
private let livesRx2 = rx(#"\b(?:[Nn]ow in|(?:just )?moved to|moving to) (\#(city))"#)
private let sentenceGap = rx(#"(?<=[.!?])\s+"#)

private let nameRx1 = rx(#"\b(?:\#(meet))\s+(?:(?:an?|the)\s+)?\#(person)"#)
private let nameRx2 = rx(#"^(?!(?:Just|Met|Bumped|Ran|Came|Talked|Chatted|Spoke|Had|Went|Grabbed|Spent|Dinner|Lunch|Coffee|I|Today|We)\b)\#(person)"#)
private let metRx1 = rx(#"\b(?:\#(meet)) (?:(?:an?|the) )?(?:\#(person)\s+)?(?:at|in|through|during|via) ([^.,]+)"#, .caseInsensitive)
private let metRx2 = rx(#"\bat ([A-Z][^.,]+)"#)
private let metRx3 = rx(#"\bat (?:an? |the )?([^.,]+)"#, .caseInsensitive)
private let metRx4 = rx(#"\bfrom (?:the |my )?([a-z][^.,]*)"#)
private let metRx5 = rx(#"\b(?:went to|attended) (?:an? |the |my )?([^.,]+?)(?= and |[.,]|$)"#, .caseInsensitive)
private let metTail = rx(#"(?<=\S)\s+(?:through|via|who|that|where)\s+.*"#, .caseInsensitive)
private let metHead = rx(#"^(?:an?|the)\s+(?:friend's\s+)?"#, .caseInsensitive)
private let doesRx = rx(#"\b((?:(?:product|project|program|engineering|marketing|operations|account|sales|general) manager|(?:software|hardware|mechanical|electrical|data|machine learning|research) (?:engineer|scientist)|(?:(?!an?\b|the\b)[a-z]+ )?(?:architect|chef|teacher|nurse|doctor|lawyer|developer|musician|photographer|filmmaker|professor|consultant|analyst|scientist|director|editor|producer|journalist|therapist|illustrator|accountant|barista|baker|carpenter|plumber|electrician|pilot|translator|interpreter|dentist|entrepreneur|pharmacist)|founder|co-?founder|engineer|designer|investor|student|researcher|artist|writer|recruiter|PM|manager|climbing coach|coach(?:es)?)\b)[^.,]*"#, .caseInsensitive)
private let studyRx = rx(#"\b(?:studying|majoring in)\s+([a-z][a-z ]*?)(?=\s+(?:at|in|and|but|who|from)\b|[.,]|$)"#, .caseInsensitive)
private let andRx = rx(#"\s+and\s+"#)
private let andButRx = rx(#"\s+(?:and|but)\s+"#)
private let teachRx = rx(#"\bteach(?:es|ing)\b"#, .caseInsensitive)
private let coachesRx = rx(#"^coaches\s+(\w+)\b.*"#, .caseInsensitive)
private let remRx = rx(#"\b(\#(into)|climbs?|loves?|likes?|enjoys?|plays?|runs(?! club)|has an?|collects?|training)\b[^.,]*"#, .caseInsensitive)
private let goalRx = rx(#"\b(?:wants to|is trying to|hopes to|plans to) ([^.,]+)"#, .caseInsensitive)
private let folRx = rx(#"\b(owe|intro|follow up|send|asked me|ask about)\b[^.]*"#, .caseInsensitive)
private let followWord = rx(#"\b(intro|send|follow up|remind|ask|owe)\b"#, .caseInsensitive)
private let workRx = rx(#"demo day|conference|summit|office|work|pitch|founders?|climate week|config"#, .caseInsensitive)
private let socialRx = rx(#"party|dinner|bar|friend"#, .caseInsensitive)
private let communityRx = rx(#"class|club|school|meetup|crit|church|gym"#, .caseInsensitive)
private let familyRx = rx(#"family|cousin|mom|dad|sister|brother|aunt|uncle"#, .caseInsensitive)
private let intoHead = rx(#"^(?:\#(into))\b"#)
private let roleSplit = rx(#",| at | in "#)
private let activityRx = rx(#"^(.*?)\s+(?:meetups?|clubs?|class(?:es)?|leagues?|groups?|tournaments?|teams?|sessions?|workshops?)\b"#, .caseInsensitive)
private let todoHead = rx(#"^(?:i\s+)?(?:wants?\s+to|should|need\s+to|to)\s+"#)
private let todoPunct = rx(#"[^\p{L}\p{N} ]"#)
private let spaces = rx(#"\s+"#)

// Rough coordinates for the places capture knows about. Anything else lands in New York.
private let places: [String: (Double, Double)] = [
    "seattle": (47.606, -122.332), "brooklyn": (40.678, -73.944), "manhattan": (40.776, -73.971),
    "queens": (40.728, -73.794), "new york": (40.713, -74.006), "jersey city": (40.718, -74.043),
    "boston": (42.36, -71.059), "san francisco": (37.775, -122.419), "los angeles": (34.052, -118.244),
    "chicago": (41.878, -87.63), "austin": (30.267, -97.743), "toronto": (43.653, -79.383),
    "london": (51.507, -0.128), "paris": (48.857, 2.352), "berlin": (52.52, 13.405),
    "tokyo": (35.676, 139.65), "seoul": (37.567, 126.978), "shanghai": (31.23, 121.474), "taipei": (25.033, 121.565),
]

enum Capture {
    static func parseCompany(_ text: String) -> String? { grp(first(companyRx, text), 1, text) }

    static func parseSchool(_ text: String) -> String? {
        grp(first(schoolRx1, text), 1, text) ?? grp(first(schoolRx2, text), 1, text)
    }

    static func parseFrom(_ text: String) -> String? { grp(first(fromRx, text), 1, text) }

    static func parseLives(_ text: String) -> String? {
        grp(first(livesRx1, text), 1, text) ?? grp(first(livesRx2, text), 1, text)
    }

    /// Everyone a moment-like note could be about: full name, or first name alone unless followed by a different last name.
    static func momentCandidates<P: Named>(_ text: String, people: [P]) -> [P] {
        guard test(momentWords, text) else { return [] }
        return people.filter { p in
            if text.contains(p.name) { return true }
            let parts = p.name.split(separator: " ").map(String.init)
            let f = NSRegularExpression.escapedPattern(for: parts.first ?? "")
            guard test(rx(#"(?<![\p{L}])\#(f)(?![\p{L}])"#), text) else { return false }
            let next = grp(first(rx(#"(?<![\p{L}])\#(f)\s+(\p{Lu}[\p{L}'-]*)"#), text), 1, text)
            return next == nil || next == parts.last || test(notSurname, next!)
        }
    }

    static func parsePerson(_ text: String, people: [any Named]) -> Draft {
        var out = Draft()
        let t = trim(text)
        if t.isEmpty { return out }
        out.name = grp(first(nameRx1, t), 1, t) ?? grp(first(nameRx2, t), 1, t)
        out.company = parseCompany(t)
        let firstSentence = String(t.prefix { !".!?".contains($0) })
        // "designer at Kiln": a capitalized name after "at" is the company, not where you met
        func notCompany(_ m: NSTextCheckingResult?) -> NSTextCheckingResult? {
            if let m, let c = out.company, let g = grp(m, 1, t), g.hasPrefix(c) { return nil }
            return m
        }
        func place(_ m: NSTextCheckingResult?, _ s: String) -> String? { grp(m, -1, s) }
        let met = grp(first(metRx1, t), -1, t)
            ?? grp(notCompany(first(metRx2, t)), 1, t)
            ?? grp(first(metRx3, firstSentence), 1, firstSentence)
            ?? grp(first(metRx4, t), 1, t)
            ?? grp(first(metRx5, t), 1, t)
        if var m = met {
            m = trim(m)
            m = sub(timeRx, m); m = sub(metTail, m); m = sub(metHead, m)
            out.met = m
        }
        if let does = grp(first(doesRx, t), 0, t) {
            out.does = cut(trim(head(andRx, does)))
        } else if test(teachRx, t) {
            out.does = "teacher"
        } else if let major = grp(first(studyRx, t), 1, t) {
            out.does = trim(major) + " student"
        }
        if let d = out.does { out.does = sub(coachesRx, d, "$1 coach") }
        if let rem = grp(first(remRx, t), 0, t) { out.remember = cut(trim(head(andButRx, rem))) }
        if let goal = grp(first(goalRx, t), 1, t) { out.goal = cut("Wants to \(trim(goal))") }
        if let fol = grp(first(folRx, t), 0, t) { out.follow = cut(trim(fol)) }
        out.from = parseFrom(t)
        out.lives = parseLives(t)

        // Mutuals: anyone already in your people whose full or first name appears (not the new person).
        let newFirst = out.name?.split(separator: " ").first.map(String.init)
        let mutuals = people.filter { p in
            let f = p.name.split(separator: " ").first.map(String.init) ?? ""
            if f == newFirst { return false }
            return t.contains(p.name) || test(rx(#"\b\#(NSRegularExpression.escapedPattern(for: f))\b"#), t)
        }
        if !mutuals.isEmpty {
            out.knowsIds = mutuals.map(\.id)
            out.knows = mutuals.map(\.name).joined(separator: ", ")
        }

        let m = "\(out.met ?? "") \(t)"
        out.context = test(workRx, m) ? "work" : test(socialRx, m) ? "social" : test(communityRx, m) ? "community" : test(familyRx, m) ? "family" : "unsorted"
        return out
    }

    /// First sentence is what happened, a sentence with an action word is the follow-up, the next other one is new.
    static func parseMoment(_ text: String) -> Draft {
        var out = Draft()
        let ss = sentences(text).map { sub(rx(#"[.!?]$"#), trim($0)) }.filter { !$0.isEmpty }
        if let s = ss.first { out.what = cut(s) }
        let rest = ss.dropFirst()
        let follow = rest.first { test(followWord, $0) }
        if let follow { out.follow = cut(follow) }
        if let learned = rest.first(where: { $0 != follow }) { out.learned = cut(learned) }
        return out
    }

    /// Each to-do said once: "catch up and grab coffee" / "Wants to catch up and grab coffee" become one.
    static func dedupeTodos(_ texts: [String?]) -> [String] {
        func key(_ t: String) -> String {
            var k = t.lowercased()
            k = sub(todoHead, k); k = sub(todoPunct, k); k = sub(spaces, k, " ")
            return trim(k)
        }
        var kept: [(text: String, key: String)] = []
        for t in texts {
            guard let text = t.map(trim), !text.isEmpty else { continue }
            let k = key(text)
            if k.isEmpty || kept.contains(where: { $0.key.contains(k) || k.contains($0.key) }) { continue }
            kept.append((text.prefix(1).uppercased() + text.dropFirst(), k))
        }
        return kept.map(\.text)
    }

    static func professionOf(_ d: Draft) -> String {
        guard let role = roleOf(d) else { return "Unknown" }
        let title = role.prefix(1).uppercased() + role.dropFirst()
        return d.company.map { "\(title) @ \($0)" } ?? title
    }

    static func tagsOf(_ d: Draft) -> [String] {
        var tags: [String] = []
        for t in [roleOf(d)?.lowercased(), interest(d.remember), activity(d.met)] {
            if let t, !t.isEmpty, !tags.contains(t) { tags.append(t) }
        }
        return tags.isEmpty ? ["new"] : tags
    }

    static func today() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    // MARK: used by PeopleStore

    static func place(_ name: String?, fallback: String) -> Place {
        let c = trim(name ?? "").isEmpty ? fallback : trim(name!)
        let (lat, lng) = places[c.lowercased()] ?? places["new york"]!
        return Place(city: c, lat: lat, lng: lng)
    }

    static func slug(_ name: String) -> String {
        let s = name.lowercased().folding(options: .diacriticInsensitive, locale: nil)
        let d = sub(rx(#"^-|-$"#), sub(rx(#"[^a-z0-9]+"#), s, "-"))
        return d.isEmpty ? "person" : d
    }

    static func uid() -> String { String(UUID().uuidString.prefix(6)).lowercased() }

    private static func roleOf(_ d: Draft) -> String? {
        let r = trim(head(roleSplit, d.does ?? ""))
        return r.isEmpty ? nil : r
    }

    /// "Loves pottery" -> "pottery"; "Climbs Tuesdays" -> "climbs".
    private static func interest(_ remember: String?) -> String? {
        guard let remember else { return nil }
        let words = sub(intoHead, remember.lowercased(), "loves").split(whereSeparator: \.isWhitespace).map(String.init)
        guard let w0 = words.first else { return nil }
        guard ["love", "loves", "like", "likes", "enjoy", "enjoys", "play", "plays", "collect", "collects", "has", "into"].contains(w0) else { return w0 }
        let rest = words.dropFirst().filter { !["a", "an", "the", "my", "every"].contains($0) }
        let end = rest.firstIndex { ["on", "at", "in", "and", "to", "with", "every", "for"].contains($0) }
        let n = end.map { min($0 - rest.startIndex, 2) } ?? 2
        let s = rest.prefix(n).joined(separator: " ")
        return s.isEmpty ? nil : s
    }

    /// The activity in a place you met ("pickleball meetup" -> "pickleball", "run club" -> "running").
    private static func activity(_ met: String?) -> String? {
        guard let met, let w = grp(first(activityRx, met), 1, met) else { return nil }
        let word = (w.split(whereSeparator: \.isWhitespace).last.map(String.init) ?? "").lowercased().filter { ("a"..."z").contains($0) || $0 == "-" }
        return word == "run" ? "running" : (word.isEmpty ? nil : word)
    }
}

// MARK: when you met (ONBOARDING 6c)

private let numWords = ["one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
                        "a": 1, "an": 1, "a couple of": 2, "a few": 3, "couple of": 2, "few": 3]
private let monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
private let seasonMonth = ["summer": 7, "winter": 1, "spring": 4, "fall": 10, "autumn": 10]
private let monthAlt = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
private let metSentenceRx = rx(#"\b(?:met|meet|ran into|bumped into|introduced|know|knew|friends since)\b"#, .caseInsensitive)
private let lifeStages: [(String, NSRegularExpression)] = [
    ("grad-school", rx(#"\b(?:in|from|at|during|since)\s+(?:grad(?:uate)?\s+school)\b"#, .caseInsensitive)),
    ("high-school", rx(#"\b(?:in|from|at|during|since)\s+high\s+school\b"#, .caseInsensitive)),
    ("college", rx(#"\b(?:in|from|at|during|since)\s+college\b"#, .caseInsensitive)),
    ("childhood", rx(#"\b(?:as\s+(?:kids|children)|in\s+childhood|since\s+(?:we were\s+)?(?:kids|children)|childhood friend)\b"#, .caseInsensitive)),
]
private let numRx = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|an?(?: couple of| few)?|couple of|few)"

extension Capture {
    static func parseLifeStage(_ text: String) -> String? {
        lifeStages.first { test($0.1, text) }?.0
    }

    /// "yyyy-MM-dd" / "yyyy-MM" / "yyyy" for when the note says they met, or nil. `today` is injected; local calendar day.
    static func parseMetDate(_ text: String, today: Date) -> String? {
        let sentences = text.components(separatedBy: CharacterSet(charactersIn: ".!?\n")).map { $0.trimmingCharacters(in: .whitespaces) }
        let met = sentences.filter { test(metSentenceRx, $0) }
        for s in met { if let r = metDate(in: s, today: today, daysOnly: false) { return r.value } }
        for s in sentences where !met.contains(s) { if let r = metDate(in: s, today: today, daysOnly: true) { return r.value } }
        return nil
    }

    /// Outer nil: no date phrase. `value` nil: a date phrase matched but is invalid (future / out of range), so the parse stops there.
    private static func metDate(in s: String, today: Date, daysOnly: Bool) -> (value: String?, Void)? {
        let cal = Calendar.current
        let c = cal.dateComponents([.year, .month], from: today)
        let (y, mo) = (c.year!, c.month!)
        func day(_ back: Int) -> (String?, Void)? {
            (fmt("yyyy-MM-dd", cal.date(byAdding: .day, value: -back, to: today)!), ())
        }
        func ym(_ year: Int, _ month: Int) -> (String?, Void)? { (String(format: "%04d-%02d", year, month), ()) }
        func past(_ month: Int) -> (String?, Void)? { ym(month > mo ? y - 1 : y, month) }
        func n(_ t: String) -> Int { Int(t) ?? numWords[t.lowercased()] ?? 0 }
        func has(_ p: String) -> Bool { test(rx(p, .caseInsensitive), s) }

        // Day words come first, longer phrases before shorter ("day before yesterday", "last week").
        if has(#"\bday before yesterday\b"#) { return day(2) }
        if has(#"\b(?:yesterday|last night)\b"#) { return day(1) }
        if has(#"\b(?:this morning|today|tonight|this week)\b"#) { return day(0) }
        if has(#"\blast week\b"#) { return day(7) }
        if daysOnly { return nil }

        if let m = first(rx("\\b\(numRx) years? ago\\b", .caseInsensitive), s), let t = grp(m, 1, s) {
            return ("\(y - n(t))", ())
        }
        if let m = first(rx("\\b\(numRx) months? ago\\b", .caseInsensitive), s), let t = grp(m, 1, s) {
            let total = y * 12 + (mo - 1) - n(t)
            return ym(total / 12, total % 12 + 1)
        }
        if has(#"\blast month\b"#) { return ym(mo == 1 ? y - 1 : y, mo == 1 ? 12 : mo - 1) }
        if has(#"\bthis month\b"#) { return ym(y, mo) }
        if has(#"\blast year\b"#) { return ("\(y - 1)", ()) }
        if let m = first(rx(#"\b(summer|winter|spring|fall|autumn)\b(?:\s+of)?(?:\s+(\d{4}))?"#, .caseInsensitive), s), let k = grp(m, 1, s) {
            let mm = seasonMonth[k.lowercased()]!
            if let yr = grp(m, 2, s).flatMap(Int.init) { return (1950...y).contains(yr) ? ym(yr, mm) : (nil, ()) }
            return past(mm)
        }
        if let m = first(rx("\\b(\(monthAlt))\\b\\.?,?\\s+(\\d{4})\\b", .caseInsensitive), s), let k = grp(m, 1, s), let yr = grp(m, 2, s).flatMap(Int.init) {
            let mm = monthNames.firstIndex(of: String(k.lowercased().prefix(3)))! + 1
            return (1950...y).contains(yr) && (yr < y || mm <= mo) ? ym(yr, mm) : (nil, ())
        }
        if let m = first(rx("\\b(?:in|last|this|since)\\s+(\(monthAlt))\\b", .caseInsensitive), s), let k = grp(m, 1, s) {
            return past(monthNames.firstIndex(of: String(k.lowercased().prefix(3)))! + 1)
        }
        if let m = first(rx(#"\b(?:19|20)\d{2}\b"#), s), let yr = grp(m, 0, s).flatMap(Int.init) {
            return ((1950...y).contains(yr) ? "\(yr)" : nil, ())
        }
        return nil
    }

    private static func fmt(_ f: String, _ d: Date) -> String {
        let df = DateFormatter(); df.locale = Locale(identifier: "en_US_POSIX"); df.dateFormat = f; return df.string(from: d)
    }

    /// "2023" -> "2023-07-01", "2023-05" -> "2023-05-15", so short met dates sort, age and print sensibly.
    static func padDate(_ s: String) -> String {
        switch s.count { case 4: return s + "-07-01"; case 7: return s + "-15"; default: return String(s.prefix(10)) }
    }
}

/// The "Met ..." line shown on a profile and on the new-person card.
enum MetDate {
    private static let stageText = ["college": "college", "high-school": "high school", "grad-school": "grad school", "childhood": "childhood"]

    /// A date label when `iso` is known; otherwise the life stage ("Met in college") if there is one, else "".
    static func label(_ iso: String?, lifeStage: String?) -> String {
        guard let iso else { return stageText[lifeStage ?? ""].map { "Met in \($0)" } ?? "" }
        if iso.count == 4 { return "Met \(iso)" }
        let p = iso.split(separator: "-")
        guard iso.count >= 7, p.count >= 2, let m = Int(p[1]), (1...12).contains(m) else { return "" }
        return "Met \(Calendar.current.shortMonthSymbols[m - 1]) \(p[0])"
    }

    /// Dateless rule (no schema change): createPerson stores the first moment as today when the note names no date, so a person
    /// with a display life stage whose first moment is on their lastContacted day (both "today" at creation), or who has no
    /// moments, has no known meeting date. Sample people have older dated first moments, so they keep their dates.
    /// Limit: once the person is contacted on a later day the dates differ and the date label shows; fix would need a schema flag.
    static func label(for p: Person) -> String {
        let first = p.moments.first(where: \.firstMeeting)
        let dateless = stageText[p.lifeStage ?? ""] != nil && (first == nil || first!.date == p.lastContacted)
        return label(dateless ? nil : (first?.date ?? p.lastContacted), lifeStage: p.lifeStage)
    }
}
