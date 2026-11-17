import XCTest
@testable import Peepl

final class EmbeddingSpikeTests: XCTestCase {
    static let people = PersonInfo.sample()
    static let queries: [(String, String)] = [
        ("who knows about taxes", "wendy-tsai"), ("who knows about wine", "rafael-cruz"), ("I need a doctor", "naomi-feldman"),
        ("a good lawyer", "hannah-cohen"), ("who knows about ceramics", "ayesha-malik"), ("who knows about baking bread", "bea-lopez"),
        ("who knows about jazz", "adaeze-obi"), ("an architect", "emily-chung"), ("who knows about coffee", "kenneth-ho"),
        ("who knows about film", "amara-osei"), ("who is a tailor", "luis-ferreira"), ("a plumber or handyman", "gideon-reyes"),
        ("someone who sells vintage clothes", "dmitri-sokolov"), ("a fashion stylist", "tamsin-okoro"), ("a barber", "lou-marchetti"),
        ("who knows about poetry", "odessa-wright"), ("a dentist", "raymond-liu"), ("who runs a bookstore", "gus-papadakis"),
        ("a physical therapist", "marcus-bell"), ("someone in climate tech", "maya-chen"), ("a recruiter", "rhonda-pierce"),
        ("a personal trainer", "bianca-costa"), ("who knows about gardening", "harlan-boyd"), ("a mural painter", "benji-stern"),
        ("someone who makes furniture", "theo-park"), ("a florist", "phoebe-lawrence"), ("a chess teacher", "oleg-ivanov"),
        ("who plays the cello", "zara-ahmed"), ("a sommelier", "rafael-cruz"), ("an ER nurse", "lila-sharma"),
    ]
    static let stop: Set<String> = ["who", "knows", "know", "about", "a", "an", "is", "the", "i", "need", "someone", "good", "plays", "runs", "makes", "sells"]
    static func strip(_ q: String) -> String { q.split(separator: " ").filter { !stop.contains($0.lowercased()) }.joined(separator: " ") }
    static func ms(_ t: Duration) -> Double { Double(t.components.seconds) * 1000 + Double(t.components.attoseconds) / 1e15 }

    func testPeopleLoaded() { XCTAssertEqual(Self.people.count, 500) }

    // 1 + 2: parity with the shipped vectors, timing
    func testMiniLMParityAndTiming() async throws {
        let clock = ContinuousClock()
        var model: MiniLM!
        let load = try clock.measure { model = try MiniLM() }
        let shipped = Semantic.shipped()
        let texts = Array(shipped.keys.sorted()).enumerated().filter { $0.offset % (shipped.count / 50) == 0 }.prefix(50).map(\.element)
        XCTAssertEqual(texts.count, 50)
        var cos: [Float] = [], times: [Double] = []
        for t in texts {
            var v: [Float] = []
            let d = try await clock.measure { v = try await model.embed([t])[0] }
            times.append(Self.ms(d))
            let s = shipped[t]!, dot = zip(v, s).reduce(0) { $0 + $1.0 * $1.1 }
            cos.append(dot / s.reduce(0) { $0 + $1 * $1 }.squareRoot())
        }
        times.sort()
        let mean = cos.reduce(0, +) / Float(cos.count)
        print("SPIKE parity: mean \(mean) min \(cos.min()!)")
        print("SPIKE MiniLM load \(Self.ms(load)) ms, median embed \(times[times.count / 2]) ms (max \(times.last!) ms)")
        XCTAssertGreaterThanOrEqual(mean, 0.97); XCTAssertGreaterThanOrEqual(cos.min()!, 0.93)
    }

    // 2 + 3: NLEmbedding timing, retrieval comparison
    func testRetrievalComparison() async throws {
        let clock = ContinuousClock()
        let model = try MiniLM(), nl = NLEmbedder()
        let texts = Array(Set(Self.people.flatMap { Semantic.chunks($0).map(\.text) }))
        var nlVecs: [String: [Float]] = [:]
        var perText: [Double] = []
        // NLEmbedding's model asset cannot be loaded on the simulator ("not entitled"); then NL stays nil.
        var nlOK = true
        let total = await clock.measure {
            for t in texts {
                var v: [Float] = []
                do { perText.append(Self.ms(try await clock.measure { v = try await nl.embed([t])[0] })) } catch { nlOK = false; return }
                nlVecs[t] = v
            }
        }
        perText.sort()
        print(nlOK ? "SPIKE NLEmbedding: \(texts.count) chunk texts in \(Self.ms(total) / 1000) s, median \(perText[perText.count / 2]) ms per text"
                   : "SPIKE NLEmbedding: UNAVAILABLE on this simulator (sentenceEmbedding(for: .english) returned nil)")

        let shipped = Semantic.shipped()
        let tr = clock.now
        var miniHits = 0, nlHits = 0
        print("SPIKE retrieval (rank of target, MiniLM | NL):")
        for (q, id) in Self.queries {
            let text = Self.strip(q)
            func rank(_ qv: [Float], _ vec: (String) -> [Float]?) -> Int {
                let hits = Semantic.bestHits(qv, people: Self.people, vecOf: vec).sorted { $0.sim > $1.sim }
                return (hits.firstIndex { $0.personId == id } ?? 999) + 1
            }
            let a = rank(try await model.embed([text])[0]) { shipped[$0] }
            let b = nlOK ? rank(try await nl.embed([text])[0]) { nlVecs[$0] } : 0
            if a <= 10 { miniHits += 1 }; if nlOK, b <= 10 { nlHits += 1 }
            print("SPIKE   \(q) -> \(id): \(a) | \(b)")
        }
        print("SPIKE top-10 hits: MiniLM \(miniHits)/30, NLEmbedding \(nlHits)/30")
        print("SPIKE retrieval loop took \(Self.ms(tr.duration(to: clock.now)) / 1000) s")
        XCTAssertGreaterThanOrEqual(miniHits, 24)
    }

    // 4: chunks match the web
    func testChunks() {
        let maya = Self.people.first { $0.id == "maya-chen" }!
        let chunks = Semantic.chunks(maya)
        XCTAssertEqual(chunks.first?.text, "Climate tech founder")
        XCTAssertTrue(chunks.contains { $0.from == "Fourth dumpling night, Oct 2026" }, "\(chunks.compactMap(\.from))")
        let shipped = Semantic.shipped()
        let all = Self.people.flatMap { Semantic.chunks($0).map(\.text) }
        let missing = all.filter { shipped[$0] == nil }
        print("SPIKE chunks: \(all.count) total, \(missing.count) missing from vectors.json \(missing.prefix(5))")
        XCTAssertEqual(shipped.count, 3981)
    }
}
