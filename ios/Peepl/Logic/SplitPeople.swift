import Foundation

struct PersonNote: Equatable { let name: String; let text: String }

private let nameP = #"[A-Z][A-Za-z0-9_'-]+(?:\s+[A-Z][A-Za-z0-9_'-]+)?"#
private let listRx = try! NSRegularExpression(pattern: #"\b(?:[Ww]ith|[Mm]et|[Mm]eet|[Mm]eeting)\s+(\#(nameP)(?:\s*(?:,|\band\b|&)\s*\#(nameP))+)"#)
private let nameSep = try! NSRegularExpression(pattern: #"\s*(?:,|\band\b|&)\s*"#)
private let sentenceSep = try! NSRegularExpression(pattern: #"(?<=[.!?])\s+"#)

private func nsr(_ s: String) -> NSRange { NSRange(s.startIndex..., in: s) }

/// `s` cut at every match of `re` (like JS String.split with a non-capturing regex).
private func pieces(_ re: NSRegularExpression, _ s: String) -> [String] {
    var out: [String] = [], at = s.startIndex
    for m in re.matches(in: s, range: nsr(s)) {
        let r = Range(m.range, in: s)!
        out.append(String(s[at..<r.lowerBound])); at = r.upperBound
    }
    out.append(String(s[at...]))
    return out
}

extension Capture {
    /// Port of capture.ts splitPeople: one note per person when 2+ names follow with / met; [] otherwise.
    static func splitPeople(_ text: String) -> [PersonNote] {
        guard let list = listRx.firstMatch(in: text, range: nsr(text)), let lr = Range(list.range(at: 1), in: text) else { return [] }
        let names = pieces(nameSep, String(text[lr])).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        if names.count < 2 { return [] }
        let sentences = pieces(sentenceSep, text.trimmingCharacters(in: .whitespacesAndNewlines))
        guard let at = sentences.firstIndex(where: { listRx.firstMatch(in: $0, range: nsr($0)) != nil }) else { return [] }
        let intro = sentences[at]
        let im = listRx.firstMatch(in: intro, range: nsr(intro))!
        let whole = Range(im.range, in: intro)!, listR = Range(im.range(at: 1), in: intro)!
        let before = intro[..<whole.lowerBound].trimmingCharacters(in: .whitespacesAndNewlines)
        let after = String(intro[whole.upperBound...]).filter { !".!?".contains($0) }.trimmingCharacters(in: .whitespacesAndNewlines)
        func named(_ x: String, _ n: String) -> Bool {
            let f = NSRegularExpression.escapedPattern(for: String(n.split(separator: " ").first ?? ""))
            return (try? NSRegularExpression(pattern: #"\b\#(f)\b"#))?.firstMatch(in: x, range: nsr(x)) != nil
        }
        let single = !before.isEmpty && before.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" }
        return names.map { name in
            var how = "Met at \(before.lowercased())."
            if !(after.isEmpty && single) { how = intro.replacingCharacters(in: listR, with: name) }
            let own = sentences.enumerated().filter { i, x in i != at && (!names.contains { named(x, $0) } || named(x, name)) }.map(\.element)
            return PersonNote(name: name, text: ([ "\(name).", how] + own).joined(separator: " "))
        }
    }
}
