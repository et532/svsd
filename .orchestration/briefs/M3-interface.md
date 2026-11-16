# M3 interface: Find (core <-> UI contract)

Fixed by the M3 manager. Builders implement exactly these signatures; changing one means stop and report.
All paths under `ios/Peepl/`. Swift language mode 5. Web spec files in `src/lib/` (ask.ts, query/index.ts,
rank/index.ts, rank/hits.ts, rank/search.ts, semantic.ts, chunks.ts, places.ts, ai.ts) and tests in `tests/`.

**Pipeline decision (manager):** iOS Find = `Ask.interpret` special answers first (buddy / trip / intro / catch-up /
add / moment / profile); otherwise the place-aware ranking `Search.answer` (web `rank/search.ts answer`, which is what
`tests/queries.test.ts` + `golden.test.ts` exercise); then `AIClient.rank` on top. The web screen's older
`semantic.ts findPeople` is NOT ported, except `closestMatches` (AI rank candidates).

## Logic/Search.swift  (value snapshot so search runs off the main actor and tests need no SwiftData)
```swift
struct PersonInfo: Decodable, Sendable, Identifiable, Hashable {
    struct TodoInfo: Decodable, Sendable, Hashable { var id: String; var text: String; var done: Bool }
    struct MomentInfo: Decodable, Sendable, Hashable { var id: String; var date: String; var title: String
        var text: String?; var transcript: String?; var firstMeeting: Bool? }
    var id: String, name: String, context: String, alsoContext: String?, profession: String, story: String
    var tags: [String]; var from: Place; var met: Place; var livesNow: Place
    var lifeStage: String?; var lastContacted: String; var knows: [String]; var closeness: Int?
    var todos: [TodoInfo] = []          // decode missing as []
    var moments: [MomentInfo] = []      // newest first: date desc, then id asc
    init(_ p: Person)                   // snapshot of a SwiftData Person (call on main actor)
    static func sample() -> [PersonInfo] // decode the bundled seed.json (all 500), for tests
    var firstName: String { get }
}
enum Search {
    /// web rank/search.ts answer(): interpret first; special -> as is; else parseQuery + hits + rankPeople.
    static func answer(_ query: String, people: [PersonInfo], embedder: Embedder, now: Date = Date()) async -> AskResult
    static func rankPeople(_ c: Constraints, hits: [Hit], people: [PersonInfo], now: Date = Date()) -> Outcome
}
struct Hit: Sendable { var personId: String; var text: String; var from: String?; var sim: Float }
struct Outcome { var matches: [Match]; var groups: [MatchGroup]?; var near: [Match]?; var note: String?; var level: Int }
```

## Logic/Ask.swift
```swift
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
enum Ask {
    static let related: [String: [String]]   // web `related`
    static let filler: Set<String>           // web `filler`
    static func norm(_ s: String) -> String  // lowercase, strip accents, drop ’ and '
    static func interpret(_ input: String, people: [PersonInfo], now: Date = Date()) -> AskResult
    static func isSpecial(_ r: AskResult) -> Bool   // web rank/search.ts isSpecial
}
```

## Logic/Places.swift  (gazetteer as Resources/gazetteer.json, exported once from src/data/gazetteer.ts)
```swift
struct PlaceRec: Decodable, Hashable, Sendable { var id, name, kind: String; var lat, lng: Double
    var parent: String?; var metro: String?; var aliases: [String]? }
enum Places {
    static func resolve(_ text: String) -> (place: PlaceRec, rest: String)?   // resolvePlace
    static func lookup(_ name: String?) -> PlaceRec?
    static func sameMetro(_ a: PlaceRec, _ b: PlaceRec?) -> Bool
    static func hierarchyFit(_ target: PlaceRec, _ other: PlaceRec?) -> Double
    static func chip(_ target: PlaceRec, _ other: PlaceRec) -> String
    static func home() -> PlaceRec                                            // new-york
    static func of(_ p: PersonInfo) -> PlaceRec?                              // placeOfPerson
    static func distanceKm(_ a: PlaceRec, _ b: PlaceRec) -> Double
}
```

## Logic/Query.swift
```swift
struct Constraints: Sendable { var text: String; var intent: String /* plan|knowledge|find */
    var activityId: String?; var activityLabel: String?; var place: PlaceRec?; var named: Bool; var stage: String?
    var contexts: [String: Double]; var theme: [String]; var groups: [[String]]; var metAt: String?
    var embedText: String; var explain: [String] }
enum Query { static func parse(_ input: String) -> Constraints }
```

## Logic/Semantic.swift
```swift
protocol Embedder: Sendable { func embed(_ texts: [String]) async throws -> [[Float]] }  // unit-length vectors
struct Chunk: Hashable, Sendable { var text: String; var from: String?; var kind: String /* profile|tag|todo|moment */; var momentId: String? }
enum Semantic {
    static func chunks(_ p: PersonInfo) -> [Chunk]                       // chunks.ts chunksOf ("Mon YYYY" in en_US)
    static func shipped() -> [String: [Float]]                           // Resources/vectors.json, int8/300, cached
    /// vector for every text: shipped first, else embedder (memory cache for the session).
    static func vectors(_ texts: [String], embedder: Embedder) async -> [String: [Float]]
    static func bestHits(_ q: [Float], people: [PersonInfo], vecOf: (String) -> [Float]?) -> [Hit]   // rank/hits.ts
    static func closestMatches(_ query: String, people: [PersonInfo], n: Int, embedder: Embedder) async -> [Match]
}
/// Which embedder the app uses. The spike decides; keep this the only place that names a concrete type.
enum Embedders { static var current: Embedder }
```

## Services/AIClient.swift (additions)
```swift
extension AIClient {
    /// web ai.ts rankWithAi: POST /api/ai/rank {query, candidates:[{i, job, lives, from, met, tags, story, recent}]}
    /// -> {results:[{i, fits, why}]}. Any failure / 503 -> returns `result` unchanged.
    static func rank(_ query: String, result: AskResult, people: [PersonInfo], embedder: Embedder) async -> AskResult
    /// web draftMessage: POST /api/ai/draft {person:{name: first, ...facts}, kind, goal}, 15 s -> {text}.
    /// Fallback: action.draft, else "Hey <first>! Hope you’re doing well. Want to catch up soon?"
    static func draft(_ person: PersonInfo, action: Action) async -> String
}
```

## Screens (UI)
- `Screens/FindView.swift` (+ `Find*.swift`): the Find layer. `Nav.showFilter: PeopleFilter?` in Shell.swift where
  `struct PeopleFilter: Equatable { var ids: [String]; var label: String }` = the "Show all N" result. ConnectionsView
  shows only those ids while set; the pill above the ask bar clears it. **M2 (Mindmap) should read `nav.showFilter`.**
