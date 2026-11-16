# M4 interface (Voice): core <-> UI contract

Fixed by the M4 manager. All paths under `ios/Peepl/`. Changing a signature: stop and report.

## Logic/SplitPeople.swift (M4-1)
```swift
struct PersonNote: Equatable { let name: String; let text: String }
extension Capture {
    /// Port of capture.ts splitPeople: one note per person when 2+ names follow with / met; [] otherwise.
    static func splitPeople(_ text: String) -> [PersonNote]
}
```

## Logic/NameFixes.swift (M4-1)
```swift
enum NameFixes {
    /// Where heard -> meant fixes live (lower-cased heard key -> meant). Tests swap in a suite.
    static var store: UserDefaults = .standard
    static let key = "peepl.nameFixes.v1"
    static func replaceName(_ text: String, from: String, to: String) -> String  // whole word, any alphabet, case-insensitive
    static func saveFix(heard: String, meant: String)
    static func applyFixes(_ text: String) -> (text: String, fixed: [(heard: String, meant: String)])
    static func detectNames(_ text: String, people: [any Named]) -> [String]
    static func splitNames(_ text: String, names: [String]) -> [String]          // plain at even indexes, a name at odd
    static func resolveName(_ typed: String, people: [any Named]) -> String
    /// What the Composer outlines: detectNames + company, school, from, lives (in that order, no duplicates).
    static func outlines(_ text: String, people: [any Named]) -> [String]
    /// Web Composer.rename: retype word `word` of outlined `name` as `typed`; company/school/place never linked to a
    /// person, otherwise resolveName. Saves the fix (heard = the original spelling recorded in `fixed`, else `name`),
    /// updates `fixed`, returns the new text (unchanged if nothing changed).
    static func rename(_ text: String, name: String, word: Int, typed: String, people: [any Named],
                       fixed: inout [(heard: String, meant: String)]) -> String
}
```

## Services/Speech.swift (M4-2)
```swift
protocol SpeechRecognizer: AnyObject {
    /// Mic + speech permission (asks if undetermined). false = denied / restricted.
    func authorize() async -> Bool
    /// Whole transcript so far on each element (not deltas). Finishes after stop(); throws on failure.
    func start(contextualStrings: [String]) throws -> AsyncThrowingStream<String, Error>
    /// Latest input level 0...1 for the waveform.
    var level: Float { get }
    func stop()
}
final class AppleSpeechRecognizer: SpeechRecognizer      // SFSpeechRecognizer + AVAudioEngine, on-device when supported
final class ScriptedRecognizer: SpeechRecognizer {       // fake: emits the script word by word
    init(script: String, wordDelay: Duration = .milliseconds(150), allowed: Bool = true)
}
enum Speech {
    /// ScriptedRecognizer when launched with `-PeeplVoiceScript "<text>"` (Simulator / screenshots), else Apple's.
    static func make() -> SpeechRecognizer
}
@MainActor @Observable final class VoiceSession {
    enum State: Equatable { case idle, recording, review }
    private(set) var state: State
    var text: String                 // live words (name fixes applied), then the editable note
    private(set) var message: String? // why voice failed, shown in place of the placeholder
    var fixed: [(heard: String, meant: String)]
    init(recognizer: SpeechRecognizer = Speech.make())
    /// Authorize, then stream words into `text` with NameFixes.applyFixes; names = contextualStrings (newest 60).
    /// Denied -> message "Microphone or speech access is off. Allow it in Settings, or type." and state idle.
    /// Recognizer error with no words -> "Voice is not working right now. Type instead.", idle; with words -> review.
    func start(names: [String]) async
    /// Stop -> state review (text kept, fixes applied, `fixed` filled).
    func stop()
    func reset()                      // after send: idle, text "", fixed []
}
```

## Components (M4-3)
- `Components/Waveform.swift`: `struct Waveform: View { init(level: @escaping () -> Float) }` animated bars.
- `Components/NameNote.swift`: the note with outlined name words; tap a word to retype it inline (old spelling faded
  behind), Return saves via `NameFixes.rename`, tap elsewhere -> edit as plain text.
- `Composer` keeps its init and gains one defaulted parameter `people: [any Named]? = nil` (outlines only when given).
  `onMic` stays; when nil the mic now starts the built-in VoiceSession.
