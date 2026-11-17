import Foundation
import NaturalLanguage

/// Apple's built-in English sentence embedding. Needs no model file, but its vectors differ from the shipped ones.
struct NLEmbedder: Embedder {
    struct Unavailable: Error {}
    func embed(_ texts: [String]) async throws -> [[Float]] {
        guard let e = NLEmbedding.sentenceEmbedding(for: .english) else { throw Unavailable() }
        return texts.map { t in
            let v = (e.vector(for: t) ?? [Double](repeating: 0, count: e.dimension)).map(Float.init)
            let n = v.reduce(0) { $0 + $1 * $1 }.squareRoot()
            return n > 0 ? v.map { $0 / n } : v
        }
    }
}
