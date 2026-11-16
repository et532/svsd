import Foundation
import Accelerate

/// all-MiniLM-L6-v2 (BERT, 6 layers, hidden 384) run in plain Swift with Accelerate. Weights come from the q8 ONNX
/// export (Resources/MiniLM, made by Tools/export_minilm.py), dequantized to fp32 at load; activations stay fp32.
final class MiniLM: Embedder, @unchecked Sendable {
    struct Failure: Error {}
    private static let H = 384, heads = 12, dh = 32, ffn = 1536, maxLen = 128

    private struct Lin { var w: [Float]; var b: [Float]; var inN: Int; var outN: Int }
    private struct Layer { var q, k, v, o, i, d: Lin; var ln1w, ln1b, ln2w, ln2b: [Float] }
    private var wordQ: [UInt8] = [], tokQ: [UInt8] = [], posQ: [UInt8] = []
    private var wordS: Float = 0, wordZ: Float = 0, tokS: Float = 0, tokZ: Float = 0, posS: Float = 0, posZ: Float = 0
    private var embLnW: [Float] = [], embLnB: [Float] = []
    private var layers: [Layer] = []
    private var vocab: [String: Int] = [:]

    init() throws {
        guard let dir = Bundle.main.url(forResource: "MiniLM", withExtension: nil) ?? Bundle.main.resourceURL,
              let blob = try? Data(contentsOf: dir.appendingPathComponent("weights.bin"), options: .alwaysMapped),
              let mdata = try? Data(contentsOf: dir.appendingPathComponent("manifest.json")),
              let manifest = (try? JSONSerialization.jsonObject(with: mdata)) as? [String: Any],
              let tensors = manifest["tensors"] as? [String: [String: Any]],
              let vtext = try? String(contentsOf: dir.appendingPathComponent("vocab.txt"), encoding: .utf8) else { throw Failure() }
        for (i, t) in vtext.split(separator: "\n", omittingEmptySubsequences: false).enumerated() where !t.isEmpty { vocab[String(t)] = i }

        func raw(_ n: String) -> (Data, [Int]) {
            let t = tensors[n]!, shape = t["shape"] as! [Int], off = t["offset"] as! Int
            let bytes = shape.reduce(1, *) * (t["dtype"] as! String == "f32" ? 4 : 1)
            return (blob.subdata(in: off..<off + bytes), shape)
        }
        func f32(_ n: String) -> [Float] { raw(n).0.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) } }
        func u8(_ n: String) -> [UInt8] { Array(raw(n).0) }
        // per-column (output channel) dequantization; signed or unsigned depends on the tensor
        func lin(_ n: String) -> Lin {
            let (data, shape) = raw(n + ".q"), s = f32(n + ".s"), z = f32(n + ".z"), outN = shape[1]
            let signed = tensors[n + ".q"]!["dtype"] as! String == "i8"
            var w = [Float](repeating: 0, count: shape[0] * outN)
            data.withUnsafeBytes { p in
                for r in 0..<shape[0] { for c in 0..<outN {
                    let q = signed ? Float(Int8(bitPattern: p[r * outN + c])) : Float(p[r * outN + c])
                    w[r * outN + c] = (q - z[c]) * s[c]
                } }
            }
            return Lin(w: w, b: f32(n + ".b"), inN: shape[0], outN: outN)
        }
        wordQ = u8("word.q"); tokQ = u8("tok.q"); posQ = u8("pos.q")
        wordS = f32("word.s")[0]; wordZ = f32("word.z")[0]; tokS = f32("tok.s")[0]; tokZ = f32("tok.z")[0]; posS = f32("pos.s")[0]; posZ = f32("pos.z")[0]
        embLnW = f32("emb.ln.w"); embLnB = f32("emb.ln.b")
        layers = (0..<6).map { L in
            let p = "L\(L)."
            return Layer(q: lin(p + "q"), k: lin(p + "k"), v: lin(p + "v"), o: lin(p + "o"), i: lin(p + "i"), d: lin(p + "d"),
                         ln1w: f32(p + "ln1.w"), ln1b: f32(p + "ln1.b"), ln2w: f32(p + "ln2.w"), ln2b: f32(p + "ln2.b"))
        }
    }

    func embed(_ texts: [String]) async throws -> [[Float]] { texts.map(embedOne) }

    // MARK: tokenizer (BERT basic + WordPiece)

    private static func isPunct(_ s: Unicode.Scalar) -> Bool {
        let v = s.value
        if (33...47).contains(v) || (58...64).contains(v) || (91...96).contains(v) || (123...126).contains(v) { return true }
        switch s.properties.generalCategory {
        case .connectorPunctuation, .dashPunctuation, .openPunctuation, .closePunctuation, .initialPunctuation, .finalPunctuation, .otherPunctuation: return true
        default: return false
        }
    }
    func tokenize(_ text: String) -> [Int] {
        var words: [String] = [], cur = String.UnicodeScalarView()
        func flush() { if !cur.isEmpty { words.append(String(cur)); cur = .init() } }
        for s in text.lowercased().decomposedStringWithCanonicalMapping.unicodeScalars {
            if s.properties.generalCategory == .nonspacingMark || s.value == 0 || s.value == 0xFFFD { continue }
            if s.properties.isWhitespace || s.properties.generalCategory == .control { flush() }
            else if Self.isPunct(s) { flush(); cur.append(s); flush() }
            else { cur.append(s) }
        }
        flush()
        var ids = [vocab["[CLS]"]!]
        for w in words { ids += wordpiece(w) }
        return Array(ids.prefix(Self.maxLen - 1)) + [vocab["[SEP]"]!]
    }
    private func wordpiece(_ w: String) -> [Int] {
        let u = Array(w.unicodeScalars)
        if u.count > 100 { return [vocab["[UNK]"]!] }
        var ids: [Int] = [], s = 0
        while s < u.count {
            var e = u.count, found: Int?
            while s < e {
                var piece = String(String.UnicodeScalarView(u[s..<e]))
                if s > 0 { piece = "##" + piece }
                if let id = vocab[piece] { found = id; break }
                e -= 1
            }
            guard let f = found else { return [vocab["[UNK]"]!] }
            ids.append(f); s = e
        }
        return ids
    }

    // MARK: forward pass

    private func layerNorm(_ x: inout [Float], _ n: Int, _ w: [Float], _ b: [Float]) {
        let H = Self.H
        for t in 0..<n {
            x.withUnsafeMutableBufferPointer { p in
                let row = UnsafeMutableBufferPointer(rebasing: p[t * H..<(t + 1) * H])
                let mu = vDSP.mean(row)
                var v: Float = 0
                for i in 0..<H { let d = row[i] - mu; v += d * d }
                let inv = 1 / (v / Float(H) + 1e-12).squareRoot()
                for i in 0..<H { row[i] = (row[i] - mu) * inv * w[i] + b[i] }
            }
        }
    }
    private func linear(_ x: [Float], _ n: Int, _ l: Lin) -> [Float] {
        var y = [Float](repeating: 0, count: n * l.outN)
        for t in 0..<n { y.replaceSubrange(t * l.outN..<(t + 1) * l.outN, with: l.b) }
        cblas_sgemm(CblasRowMajor, CblasNoTrans, CblasNoTrans, Int32(n), Int32(l.outN), Int32(l.inN), 1, x, Int32(l.inN), l.w, Int32(l.outN), 1, &y, Int32(l.outN))
        return y
    }

    private func embedOne(_ text: String) -> [Float] {
        let H = Self.H, dh = Self.dh, ids = tokenize(text), n = ids.count
        var x = [Float](repeating: 0, count: n * H)
        for t in 0..<n { for c in 0..<H {
            x[t * H + c] = (Float(wordQ[ids[t] * H + c]) - wordZ) * wordS + (Float(tokQ[c]) - tokZ) * tokS + (Float(posQ[t * H + c]) - posZ) * posS
        } }
        layerNorm(&x, n, embLnW, embLnB)
        let scale = 1 / Float(dh).squareRoot()
        for L in layers {
            let q = linear(x, n, L.q), k = linear(x, n, L.k), v = linear(x, n, L.v)
            var ctx = [Float](repeating: 0, count: n * H), s = [Float](repeating: 0, count: n * n)
            for h in 0..<Self.heads {
                let o = h * dh
                q.withUnsafeBufferPointer { qp in k.withUnsafeBufferPointer { kp in
                    cblas_sgemm(CblasRowMajor, CblasNoTrans, CblasTrans, Int32(n), Int32(n), Int32(dh), scale, qp.baseAddress! + o, Int32(H), kp.baseAddress! + o, Int32(H), 0, &s, Int32(n))
                } }
                for r in 0..<n {
                    let row = r * n, mx = s[row..<row + n].max()!
                    var sum: Float = 0
                    for c in 0..<n { s[row + c] = expf(s[row + c] - mx); sum += s[row + c] }
                    for c in 0..<n { s[row + c] /= sum }
                }
                v.withUnsafeBufferPointer { vp in ctx.withUnsafeMutableBufferPointer { cp in
                    cblas_sgemm(CblasRowMajor, CblasNoTrans, CblasNoTrans, Int32(n), Int32(dh), Int32(n), 1, s, Int32(n), vp.baseAddress! + o, Int32(H), 0, cp.baseAddress! + o, Int32(H))
                } }
            }
            var a = linear(ctx, n, L.o)
            vDSP.add(a, x, result: &a)
            layerNorm(&a, n, L.ln1w, L.ln1b)
            var f = linear(a, n, L.i)
            for i in 0..<f.count { f[i] = f[i] * 0.5 * (1 + erff(f[i] * 0.70710678)) }
            x = linear(f, n, L.d)
            vDSP.add(x, a, result: &x)
            layerNorm(&x, n, L.ln2w, L.ln2b)
        }
        var e = [Float](repeating: 0, count: H)
        for t in 0..<n { for c in 0..<H { e[c] += x[t * H + c] } }
        let norm = e.reduce(0) { $0 + $1 * $1 }.squareRoot()
        return e.map { $0 / norm } // the 1/n of the mean cancels in the normalize
    }
}
