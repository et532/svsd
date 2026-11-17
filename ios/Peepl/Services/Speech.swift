import Foundation
import AVFoundation
import Speech
import Observation

protocol SpeechRecognizer: AnyObject {
    func authorize() async -> Bool
    func start(contextualStrings: [String]) throws -> AsyncThrowingStream<String, Error>
    var level: Float { get }
    func stop()
}

struct SpeechUnavailable: Error {}

final class AppleSpeechRecognizer: SpeechRecognizer {
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var stopped = false
    private(set) var level: Float = 0

    func authorize() async -> Bool {
        let speech = await withCheckedContinuation { c in SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) } }
        guard speech else { return false }
        return await AVAudioApplication.requestRecordPermission()
    }

    func start(contextualStrings: [String]) throws -> AsyncThrowingStream<String, Error> {
        guard let rec = SFSpeechRecognizer(locale: .current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US")),
              rec.isAvailable else { throw SpeechUnavailable() }
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.requiresOnDeviceRecognition = rec.supportsOnDeviceRecognition
        req.addsPunctuation = true
        req.contextualStrings = contextualStrings
        request = req
        stopped = false

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        let input = engine.inputNode
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { [weak self] buf, _ in
            self?.request?.append(buf)
            guard let ch = buf.floatChannelData?[0] else { return }
            let n = Int(buf.frameLength)
            var sum: Float = 0
            for i in 0..<n { sum += ch[i] * ch[i] }
            self?.level = min(1, (n > 0 ? (sum / Float(n)).squareRoot() : 0) * 8)
        }
        engine.prepare()
        try engine.start()

        return AsyncThrowingStream { cont in
            task = rec.recognitionTask(with: req) { [weak self] result, error in
                if let result { cont.yield(result.bestTranscription.formattedString) }
                if result?.isFinal == true { cont.finish() }
                else if let error { cont.finish(throwing: self?.stopped == true ? nil : error) }
            }
            cont.onTermination = { [weak self] _ in self?.stop() }
        }
    }

    func stop() {
        stopped = true
        if engine.isRunning { engine.stop(); engine.inputNode.removeTap(onBus: 0) }
        request?.endAudio()
        request = nil
        level = 0
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

final class ScriptedRecognizer: SpeechRecognizer {
    private let words: [String]
    private let delay: Duration
    private let allowed: Bool
    private var stopped = false
    private(set) var level: Float = 0

    init(script: String, wordDelay: Duration = .milliseconds(150), allowed: Bool = true) {
        words = script.split(separator: " ").map(String.init)
        delay = wordDelay
        self.allowed = allowed
    }

    func authorize() async -> Bool { allowed }

    func start(contextualStrings: [String]) throws -> AsyncThrowingStream<String, Error> {
        stopped = false
        return AsyncThrowingStream { cont in
            let job = Task { [weak self] in
                for i in words.indices {
                    try? await Task.sleep(for: delay)
                    guard let self, !self.stopped, !Task.isCancelled else { break }
                    self.level = 0.5 + 0.5 * Float(sin(Double(i)))
                    cont.yield(words[0...i].joined(separator: " "))
                }
                cont.finish()
            }
            cont.onTermination = { _ in job.cancel() }
        }
    }

    func stop() { stopped = true; level = 0 }
}

enum Speech {
    static func make() -> SpeechRecognizer {
        if let s = UserDefaults.standard.string(forKey: "PeeplVoiceScript") { return ScriptedRecognizer(script: s) }
        return AppleSpeechRecognizer()
    }
}

@MainActor @Observable final class VoiceSession {
    enum State: Equatable { case idle, recording, review }
    private(set) var state: State = .idle
    var text = ""
    private(set) var message: String?
    var fixed: [(heard: String, meant: String)] = []
    @ObservationIgnored let recognizer: SpeechRecognizer
    @ObservationIgnored private var job: Task<Void, Never>?

    init(recognizer: SpeechRecognizer = Speech.make()) { self.recognizer = recognizer }

    func start(names: [String]) async {
        message = nil
        guard await recognizer.authorize() else {
            message = "Microphone or speech access is off. Allow it in Settings, or type."
            state = .idle
            return
        }
        let stream: AsyncThrowingStream<String, Error>
        do { stream = try recognizer.start(contextualStrings: Array(names.prefix(60))) }
        catch { fail(); return }
        state = .recording
        let task = Task { [weak self] in
            do {
                for try await words in stream { let r = NameFixes.applyFixes(words); self?.text = r.text; self?.fixed = r.fixed }
                self?.finish()
            } catch { self?.fail() }
        }
        job = task
        await task.value
    }

    private func fail() {
        guard state != .review else { return }
        if text.isEmpty { message = "Voice is not working right now. Type instead."; state = .idle } else { finish() }
    }

    private func finish() {
        guard state == .recording else { return }
        state = .review
    }

    func stop() {
        guard state == .recording else { return }
        recognizer.stop()
        job?.cancel()
        finish()
    }

    func reset() {
        recognizer.stop(); job?.cancel()
        state = .idle; text = ""; fixed = []; message = nil
    }
}
