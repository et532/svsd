# M1 interface: core <-> UI contract

Fixed by the M1 manager before UI work starts. Core builders implement exactly these signatures; UI builders call
only these. Changing a signature means stopping and reporting to the manager.

All paths are under `ios/Peepl/`.

## Logic/Capture.swift (task M1-2)

```swift
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
    func merged(with ai: Draft?) -> Draft
}

enum Capture {
    static func parsePerson(_ text: String, people: [any Named]) -> Draft      // regex path (parseByRules)
    static func parseMoment(_ text: String) -> Draft
    static func momentCandidates<P: Named>(_ text: String, people: [P]) -> [P]
    static func parseCompany(_ text: String) -> String?
    static func parseSchool(_ text: String) -> String?
    static func parseFrom(_ text: String) -> String?
    static func parseLives(_ text: String) -> String?
    static func dedupeTodos(_ texts: [String?]) -> [String]
    static func professionOf(_ d: Draft) -> String       // "Designer @ Kiln"
    static func tagsOf(_ d: Draft) -> [String]           // role, interest, activity; ["new"] if empty
    static func today() -> String                        // local day, "yyyy-MM-dd"
}
```
`splitPeople` / `detectNames` are M4, not M1.

## Services/PeopleStore.swift (task M1-2)

```swift
enum PeopleStore {
    /// Web createPerson: someone with the same name (case-insensitive) is reused, not duplicated.
    /// Otherwise inserts a new Person (unique slug id, story = note, tags, profession, from/lives/met places,
    /// to-dos = dedupeTodos([follow, goal, remember]), closeness 1, a firstMeeting Moment titled "Met at <met>")
    /// and saves. mutualOf links both ways. Returns the person and whether it already existed.
    @discardableResult
    static func createPerson(_ draft: Draft, note: String, in context: ModelContext, mutualOf: String? = nil) -> (person: Person, existed: Bool)

    /// Web addMoment: new Moment (title = parseMoment.what ?? "New moment", transcript = note, today),
    /// follow-up added as a to-do, lastContacted = today, closeness +1 (max 3), saves.
    @discardableResult
    static func addMoment(to person: Person, note: String, in context: ModelContext) -> Moment
}
```

## Services/AIClient.swift (task M1-3)

```swift
enum AIClient {
    /// POST <PeeplAPIBase>/api/ai/parse {"text": note}, 10 s timeout. Returns the validated Draft (name/company/from/lives
    /// must appear in the note, title stripped from name, "at a" stripped from met, remember gets "Loves " prefix,
    /// goal gets "Wants to " prefix; fields cut to 44 chars like llmParse.ts) or nil on ANY failure
    /// (offline, timeout, non-2xx, 503/404 -> stop asking for the rest of the session, bad JSON).
    static func parse(_ note: String) async -> Draft?
}
```
UI flow for Add: `let d = Capture.parsePerson(note, people: all).merged(with: await AIClient.parse(note))`
then `PeopleStore.createPerson(d, note: note, in: context)`.

## Screens/Shell.swift (task M1-4, shell)

```swift
enum Layer: Hashable, Identifiable { case add(mutualOf: String?), find, profile(String /* person id */)
    var id: Self { self } }

@Observable final class Nav {
    var layers: [Layer] = []
    var toast: String?
    func push(_ l: Layer)
    func pop()
    func replaceTop(_ l: Layer)
    func say(_ text: String)        // shows the black toast pill ~2 s
}
```
`RootView` creates one `Nav` and puts it in the environment (`.environment(nav)`); screens read `@Environment(Nav.self)`.
Layers render full-screen above the tabs; `.profile` is a full-screen page (slides in from the right).

## Components/Composer.swift (task M1-6)

```swift
struct Composer: View {
    init(placeholder: String, autofocus: Bool = false, onSend: @escaping (String) -> Void, onMic: (() -> Void)? = nil)
}
```
Mic is a no-op hook for M4 (button shown, does nothing when onMic is nil).
