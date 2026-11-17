import Foundation

/// Speech gets names wrong; a fix (heard -> meant) is remembered and applied to later transcripts.
enum NameFixes {
    /// Where heard -> meant fixes live (lower-cased heard key -> meant). Tests swap in a suite.
    static var store: UserDefaults = .standard
    static let key = "peepl.nameFixes.v1"

    private static var fixes: [String: String] {
        get { store.dictionary(forKey: key) as? [String: String] ?? [:] }
        set { store.set(newValue, forKey: key) }
    }

    private static func nsr(_ s: String) -> NSRange { NSRange(s.startIndex..., in: s) }
    /// The name as a whole word, for any alphabet ("Tomás": a plain \b would not see the end of the á).
    private static func word(_ name: String) -> NSRegularExpression {
        try! NSRegularExpression(pattern: #"(?<![\p{L}\p{N}_])\#(NSRegularExpression.escapedPattern(for: name))(?![\p{L}\p{N}_])"#, options: .caseInsensitive)
    }
    private static func has(_ name: String, in s: String) -> Bool { word(name).firstMatch(in: s, range: nsr(s)) != nil }

    static func replaceName(_ text: String, from: String, to: String) -> String {
        word(from).stringByReplacingMatches(in: text, range: nsr(text), withTemplate: NSRegularExpression.escapedTemplate(for: to))
    }

    /// A full name also fixes the first name alone ("Jorden" -> "Jordan") when the last name matches.
    static func saveFix(heard: String, meant: String) {
        var next = fixes
        let h = heard.split(separator: " ").map(String.init), m = meant.split(separator: " ").map(String.init)
        var pairs = [(heard, meant)]
        if h.count > 1, h.last == m.last { pairs.append((h[0], m[0])) }
        for (a, b) in pairs {
            if a.lowercased() == b.lowercased() { next[a.lowercased()] = nil } else { next[a.lowercased()] = b }
        }
        fixes = next
    }

    static func applyFixes(_ text: String) -> (text: String, fixed: [(heard: String, meant: String)]) {
        var text = text, fixed: [(heard: String, meant: String)] = []
        let all = fixes
        for heard in all.keys.sorted(by: { $0.count > $1.count }) { // longest first: "Jorden Lee" beats "Jorden"
            guard let m = word(heard).firstMatch(in: text, range: nsr(text)), let r = Range(m.range, in: text) else { continue }
            let hit = String(text[r]), meant = all[heard]!
            if hit != meant { fixed.append((hit, meant)); text = replaceName(text, from: heard, to: meant) }
        }
        return (text, fixed)
    }

    /// Names in a note: the new person capture reads, plus anyone you know (full name if said, else first name).
    static func detectNames(_ text: String, people: [any Named]) -> [String] {
        var out: [String] = []
        func add(_ n: String?) { if let n, !n.isEmpty, !out.contains(where: { $0.lowercased() == n.lowercased() }) { out.append(n) } }
        let group = Capture.splitPeople(text)
        group.forEach { add($0.name) }
        // a lone first word followed by "with", "at"... is just the start of a sentence: "Dinner with Maya"
        if group.isEmpty, let lead = Capture.parsePerson(text, people: people).name {
            let startsSentence = try! NSRegularExpression(pattern: #"^\s*\#(NSRegularExpression.escapedPattern(for: lead))\s+(?:with|at|in|on|for|to|and|of|the|an?)\b"#)
            if startsSentence.firstMatch(in: text, range: nsr(text)) == nil { add(lead) }
        }
        for p in people {
            let first = String(p.name.split(separator: " ").first ?? "")
            if text.contains(p.name) { add(p.name) } else if !first.isEmpty, has(first, in: text) { add(first) }
        }
        for g in group {
            let first = String(g.name.split(separator: " ").first ?? "")
            if has(first, in: replaceName(text, from: g.name, to: "")) { add(first) }
        }
        // Not "Jordan" when only "Jordan Lee" is there; but "Maya" stays if it is also said on its own
        return out.filter { n in
            text.contains(n) && !out.contains { o in
                o != n && o.count > n.count && has(n, in: o) && !has(n, in: replaceName(text, from: o, to: ""))
            }
        }
    }

    /// The note cut around its names: plain text at even indexes, a name at odd ones.
    static func splitNames(_ text: String, names: [String]) -> [String] {
        guard !names.isEmpty else { return [text] }
        let alt = names.sorted { $0.count > $1.count }.map(NSRegularExpression.escapedPattern(for:)).joined(separator: "|")
        let re = try! NSRegularExpression(pattern: #"(?<![\p{L}\p{N}_])(\#(alt))(?![\p{L}\p{N}_])"#, options: .caseInsensitive)
        var out: [String] = [], at = text.startIndex
        for m in re.matches(in: text, range: nsr(text)) {
            let r = Range(m.range, in: text)!
            out.append(String(text[at..<r.lowerBound])); out.append(String(text[r])); at = r.upperBound
        }
        out.append(String(text[at...]))
        return out
    }

    /// A first name only one person has becomes their full name.
    static func resolveName(_ typed: String, people: [any Named]) -> String {
        let t = typed.trimmingCharacters(in: .whitespaces), l = t.lowercased()
        if let exact = people.first(where: { $0.name.lowercased() == l }) { return exact.name }
        if l.contains(" ") { return t }
        let same = people.filter { $0.name.split(separator: " ").first.map { $0.lowercased() == l } ?? false }
        return same.count == 1 ? same[0].name : t
    }

    private static func places(_ text: String) -> [String] { [Capture.parseFrom(text), Capture.parseLives(text)].compactMap { $0 } }

    /// What the Composer outlines: detectNames + company, school, from, lives (in that order, no duplicates).
    static func outlines(_ text: String, people: [any Named]) -> [String] {
        var n = detectNames(text, people: people)
        for o in [Capture.parseCompany(text), Capture.parseSchool(text)] + places(text) { if let o, !n.contains(o) { n.append(o) } }
        return n
    }

    /// Retype word `word` of outlined `name` as `typed` (web Composer.rename). Company / school / place never link to a person.
    static func rename(_ text: String, name: String, word: Int, typed: String, people: [any Named],
                       fixed: inout [(heard: String, meant: String)]) -> String {
        var words = name.split(separator: " ").map(String.init)
        guard !typed.isEmpty, words.indices.contains(word) else { return text }
        words[word] = typed
        let full = typed.contains(" ") ? typed : words.joined(separator: " ")
        let plain = [Capture.parseCompany(text), Capture.parseSchool(text)].contains(name) || places(text).contains(name)
        let meant = plain ? full : resolveName(full, people: people)
        if meant == name { return text }
        let was = fixed.first { $0.meant == name }?.heard ?? name
        saveFix(heard: was, meant: meant)
        fixed = fixed.filter { $0.meant != name } + [(was, meant)]
        return replaceName(text, from: name, to: meant)
    }
}
