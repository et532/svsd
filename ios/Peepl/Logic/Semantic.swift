import Foundation
import Accelerate

/// Turns text into unit-length vectors.
protocol Embedder: Sendable { func embed(_ texts: [String]) async throws -> [[Float]] }

struct Chunk: Hashable, Sendable {
    var text: String; var from: String?
    var kind: String // profile | tag | todo | moment
    var momentId: String?
}

enum Semantic {
    private static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    private static func when(_ iso: String) -> String {
        let p = iso.split(separator: "-")
        guard p.count >= 2, let m = Int(p[1]), (1...12).contains(m) else { return iso }
        return "\(months[m - 1]) \(p[0])"
    }
    // Split after . ! ? plus whitespace, but not after "Dr." and the like (web chunks.ts SENTENCE).
    private static let sentenceBreak = try! NSRegularExpression(pattern: #"(?<!\b(?:Dr|Mr|Mrs|Ms|St|Prof|Jr|Sr)\.)(?<=[.!?])\s+"#)
    private static func split(_ t: String) -> [String] {
        let ns = t as NSString
        var out: [String] = [], last = 0
        for m in sentenceBreak.matches(in: t, range: NSRange(location: 0, length: ns.length)) {
            out.append(ns.substring(with: NSRange(location: last, length: m.range.location - last)))
            last = m.range.location + m.range.length
        }
        out.append(ns.substring(from: last))
        return out
    }
    private static func sentences(_ t: String) -> [String] {
        split(t).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { $0.split(whereSeparator: \.isWhitespace).count >= 4 }
    }

    /// web chunks.ts chunksOf: pieces of what you know about someone; moment pieces say where they came from.
    static func chunks(_ p: PersonInfo) -> [Chunk] {
        let key = stamp(p)
        cacheLock.lock(); defer { cacheLock.unlock() }
        if let hit = chunkCache[p.id], hit.0 == key { return hit.1 }
        let out = computeChunks(p)
        chunkCache[p.id] = (key, out)
        return out
    }
    nonisolated(unsafe) private static var chunkCache: [String: (Int, [Chunk])] = [:]
    private static let cacheLock = NSLock()
    /// Cheap fingerprint of everything chunks / search text read, so caches notice an edit.
    static func stamp(_ p: PersonInfo) -> Int {
        var h = Hasher()
        h.combine(p.profession); h.combine(p.story); h.combine(p.tags); h.combine(p.todos); h.combine(p.moments)
        return h.finalize()
    }
    private static func computeChunks(_ p: PersonInfo) -> [Chunk] {
        let profile: [Chunk] = [Chunk(text: p.profession, kind: "profile")]
            + split(p.story).map { Chunk(text: $0, kind: "profile") }
            + p.tags.map { Chunk(text: $0, kind: "tag") }
            + p.todos.map { Chunk(text: $0.text, kind: "todo") }
        let moments = p.moments.flatMap { m in
            sentences(m.transcript ?? m.text ?? m.title).map {
                Chunk(text: $0, from: "\(m.title), \(when(m.date))", kind: "moment", momentId: m.id)
            }
        }
        var seen = Set<String>()
        return (profile.map { var c = $0; c.text = c.text.trimmingCharacters(in: .whitespacesAndNewlines); return c } + moments)
            .filter { !$0.text.isEmpty && seen.insert($0.text).inserted }
    }

    private static let shippedVectors: [String: [Float]] = {
        guard let url = Bundle.main.url(forResource: "vectors", withExtension: "json"), let data = try? Data(contentsOf: url),
              let raw = try? JSONDecoder().decode([String: String].self, from: data) else { return [:] }
        return raw.compactMapValues { b64 in
            Data(base64Encoded: b64).map { $0.map { Float(Int8(bitPattern: $0)) / 300 } }
        }
    }()
    /// Resources/vectors.json: chunk text -> vector (signed byte / 300), as shipped by the web build.
    static func shipped() -> [String: [Float]] { shippedVectors }

    private final class Memory: @unchecked Sendable {
        let lock = NSLock(); var v: [String: [Float]] = [:]
    }
    private static let memory = Memory()

    /// A vector for every text: shipped first, else the embedder (cached in memory for the session).
    static func vectors(_ texts: [String], embedder: Embedder) async -> [String: [Float]] {
        var out: [String: [Float]] = [:], todo: [String] = []
        memory.lock.lock()
        for t in Set(texts) { if let v = shippedVectors[t] ?? memory.v[t] { out[t] = v } else { todo.append(t) } }
        memory.lock.unlock()
        if !todo.isEmpty, let vs = try? await embedder.embed(todo) {
            memory.lock.lock(); for (t, v) in zip(todo, vs) { memory.v[t] = v; out[t] = v }; memory.lock.unlock()
        }
        return out
    }

    // A real moment wins a near-tie with a profile line; a bare tag is a weak reason to show.
    private static let bias: [String: Float] = ["moment": 0.03, "profile": 0, "todo": -0.02, "tag": -0.08]

    /// web rank/hits.ts bestHits: the best-matching piece of what you know about each person for a question vector.
    static func bestHits(_ q: [Float], people: [PersonInfo], vecOf: (String) -> [Float]?) -> [Hit] {
        people.compactMap { person in
            var best: Hit?, bestText: Hit?
            for chunk in chunks(person) {
                guard let v = vecOf(chunk.text), v.count == q.count else { continue }
                let hit = Hit(personId: person.id, text: chunk.text, from: chunk.from, sim: vDSP.dot(q, v) + (bias[chunk.kind] ?? 0))
                if best == nil || hit.sim > best!.sim { best = hit }
                if chunk.kind != "tag", bestText == nil || hit.sim > bestText!.sim { bestText = hit }
            }
            guard let b = best else { return nil }
            if var t = bestText, t.sim >= 0.35, t.sim >= b.sim - 0.2 { t.sim = b.sim; return t }
            return b
        }
    }
}

extension Semantic {
    private static let moreFiller = try! NSRegularExpression(pattern: "^(do|does|did|make|makes|can|help|need|want|my|me)$")
    /// web semantic.ts topic(): "someone who does my taxes" -> "taxes".
    static func topic(_ query: String) -> String {
        let cleaned = String(String.UnicodeScalarView(query.lowercased().unicodeScalars.map {
            CharacterSet.letters.contains($0) || CharacterSet.decimalDigits.contains($0) || CharacterSet.whitespacesAndNewlines.contains($0) || "'’-".unicodeScalars.contains($0) ? $0 : " "
        }))
        let words = cleaned.split(whereSeparator: \.isWhitespace).map(String.init).filter {
            !Ask.filler.contains($0) && moreFiller.firstMatch(in: $0, range: NSRange(location: 0, length: $0.utf16.count)) == nil
        }
        return words.isEmpty ? query : words.joined(separator: " ")
    }

    /// web semantic.ts closestMatches: the n people closest in meaning, however close (candidates for the AI to judge).
    static func closestMatches(_ query: String, people: [PersonInfo], n: Int, embedder: Embedder) async -> [Match] {
        guard let q = try? await embedder.embed([topic(query)]).first else { return [] }
        let chunks = people.map(chunks)
        let vec = await vectors(Array(Set(chunks.flatMap { $0.map(\.text) })), embedder: embedder)
        var scored: [(person: PersonInfo, score: Float, chunk: Chunk)] = []
        for (person, cs) in zip(people, chunks) {
            var best: (Float, Chunk)?
            for c in cs {
                guard let v = vec[c.text], v.count == q.count else { continue }
                let s = vDSP.dot(q, v) + (c.from != nil ? 0.04 : 0)
                if best == nil || s > best!.0 { best = (s, c) }
            }
            if let b = best { scored.append((person, b.0, b.1)) }
        }
        let top = scored.enumerated().sorted { $0.element.score != $1.element.score ? $0.element.score > $1.element.score : $0.offset < $1.offset }.prefix(n)
        return top.map { e in
            let (person, chunk) = (e.element.person, e.element.chunk)
            let text = chunk.text.replacingOccurrences(of: "\\.$", with: "", options: .regularExpression)
            return Match(person: person, why: chunk.from != nil ? "\(text) (\(chunk.from!))" : person.tags.contains(chunk.text) ? "Into \(chunk.text)" : text)
        }
    }
}

/// Which embedder the app uses. The spike decides; keep this the only place that names a concrete type.
enum Embedders {
    nonisolated(unsafe) static var current: Embedder = (try? MiniLM()) ?? NLEmbedder()
}
