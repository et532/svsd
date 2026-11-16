import Foundation

struct PlaceRec: Decodable, Hashable, Sendable {
    var id, name, kind: String
    var lat, lng: Double
    var parent: String?
    var metro: String?
    var aliases: [String]?
}

/// Place understanding without a geocoder (web places.ts). Gazetteer is Resources/gazetteer.json.
enum Places {
    private struct Gazetteer: Decodable { var places: [PlaceRec] }

    private static let all: [PlaceRec] = {
        guard let url = Bundle.main.url(forResource: "gazetteer", withExtension: "json"), let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode(Gazetteer.self, from: data))?.places ?? []
    }()
    private static let byId = Dictionary(all.map { ($0.id, $0) }, uniquingKeysWith: { $1 })
    /// Every name a place is known by -> the place (later wins, as the JS Map does); keys longest first.
    private static let names: [String: PlaceRec] = {
        var m: [String: PlaceRec] = [:]
        for p in all { for n in [p.name] + (p.aliases ?? []) { m[norm(n)] = p } }
        return m
    }()
    private static let bySize: [String] = {
        var seen = Set<String>(), order: [String] = []
        for p in all { for n in [p.name] + (p.aliases ?? []) { let k = norm(n); if seen.insert(k).inserted { order.append(k) } } }
        return order.enumerated().sorted { ($0.element.utf16.count, $1.offset) > ($1.element.utf16.count, $0.offset) }.map(\.element)
    }()

    private static func norm(_ s: String) -> String {
        var t = String(String.UnicodeScalarView(s.lowercased().decomposedStringWithCanonicalMapping.unicodeScalars
            .filter { !(0x300...0x36F).contains($0.value) }))
        t = t.replacingOccurrences(of: "’", with: " ").replacingOccurrences(of: "'", with: " ")
        t = t.replacingOccurrences(of: "[^a-z0-9.\\s,-]", with: " ", options: .regularExpression)
        return t.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// An exact place name ("Brooklyn, NY", "Bed-Stuy").
    static func lookup(_ name: String?) -> PlaceRec? { name.flatMap { names[norm($0)] } }

    /// The longest place named inside a sentence, and the sentence with that name taken out.
    static func resolve(_ text: String) -> (place: PlaceRec, rest: String)? {
        let t = " \(norm(text).replacingOccurrences(of: ",", with: " ")) "
        for name in bySize {
            let key = " \(name.replacingOccurrences(of: ",", with: " ").replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)) "
            if let r = t.range(of: key) {
                let rest = (String(t[..<r.lowerBound]) + " " + String(t[r.upperBound...]))
                    .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                return (names[name]!, rest)
            }
        }
        return nil
    }

    static func distanceKm(_ a: PlaceRec, _ b: PlaceRec) -> Double {
        let rad = Double.pi / 180
        let h = pow(sin((b.lat - a.lat) * rad / 2), 2) + cos(a.lat * rad) * cos(b.lat * rad) * pow(sin((b.lng - a.lng) * rad / 2), 2)
        return 2 * 6371 * asin(sqrt(h))
    }

    /// In the area of a place: its metro, or (for a city with none) within 40 km.
    static func sameMetro(_ a: PlaceRec, _ b: PlaceRec?) -> Bool {
        guard let b else { return false }
        if a.metro != nil || b.metro != nil { return a.metro == b.metro }
        return distanceKm(a, b) <= 40
    }

    private static func chain(_ p: PlaceRec) -> [PlaceRec] {
        var out = [p], q = p.parent.flatMap { byId[$0] }
        while let c = q { out.append(c); q = c.parent.flatMap { byId[$0] } }
        return out
    }

    /// 1 = same neighborhood, 0.9 = same borough (or inside a named city / borough), 0.75 = same metro, 0 = out of area.
    static func hierarchyFit(_ target: PlaceRec, _ other: PlaceRec?) -> Double {
        guard let other, sameMetro(target, other) else { return 0 }
        if target.id == other.id { return 1 }
        let mine = chain(target), theirs = chain(other)
        if target.kind != "hood" && theirs.contains(where: { $0.id == target.id }) { return 0.9 }
        let shared = mine.first { q in q.kind == "borough" && theirs.contains { $0.id == q.id } }
        return shared != nil ? 0.9 : 0.75
    }

    /// How a person's place reads next to the one asked about: "Bed-Stuy, 3 km from Bushwick".
    static func chip(_ target: PlaceRec, _ other: PlaceRec) -> String {
        if target.id == other.id { return other.name }
        let km = distanceKm(target, other)
        return target.kind == "hood" ? "\(other.name), \(km < 1 ? "under 1" : String(Int(km.rounded()))) km from \(target.name)" : other.name
    }

    /// Home is where the person using the app lives.
    static func home() -> PlaceRec { byId["new-york"]! }

    /// Where someone lives, as a place: their neighborhood if known, otherwise their city.
    static func of(_ p: PersonInfo) -> PlaceRec? { lookup(p.livesNow.hood) ?? lookup(p.livesNow.city) }
}
