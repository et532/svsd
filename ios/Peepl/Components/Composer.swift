import SwiftUI

/// Shared input: type, or talk (built-in VoiceSession) with names outlined for fixing when `people` is given.
struct Composer: View {
    let placeholder: String
    var autofocus = false
    let onSend: (String) -> Void
    var onMic: (() -> Void)?
    var people: [any Named]?

    @State private var text = ""
    @State private var voice = VoiceSession()
    @State private var plain = true
    @FocusState private var focused: Bool
    private var recording: Bool { voice.state == .recording }
    private var showNote: Bool { voice.state == .review && !plain && people != nil }
    private var trimmed: String { (recording ? "" : text).trimmingCharacters(in: .whitespacesAndNewlines) }

    init(placeholder: String, autofocus: Bool = false, onSend: @escaping (String) -> Void, onMic: (() -> Void)? = nil,
         people: [any Named]? = nil) {
        self.placeholder = placeholder; self.autofocus = autofocus; self.onSend = onSend; self.onMic = onMic; self.people = people
    }

    private func startVoice() {
        if let onMic { onMic(); return }
        focused = false
        let sorted = (people as? [Person])?.sorted { $0.lastContacted > $1.lastContacted } ?? (people ?? [])
        Task { await voice.start(names: sorted.map(\.name)) }
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            field
            if recording {
                Waveform(level: { voice.recognizer.level }).frame(height: 40)
                Button { voice.stop() } label: {
                    Image(systemName: "stop.fill").font(.system(size: 16)).foregroundStyle(.white)
                        .frame(width: 40, height: 40).background(Theme.night, in: .circle)
                }
                .buttonStyle(.plain).accessibilityLabel("Stop")
            } else {
                Button { startVoice() } label: {
                    Image(systemName: "mic").font(.system(size: 18)).foregroundStyle(Theme.ink).frame(width: 40, height: 40)
                }
                .buttonStyle(.plain).accessibilityLabel("Voice")
            }
            if !trimmed.isEmpty {
                Button { onSend(trimmed); text = ""; voice.reset(); plain = true } label: {
                    Image(systemName: "arrow.up").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 40, height: 40).background(Theme.night, in: .circle)
                }
                .buttonStyle(.plain).accessibilityLabel("Send").transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 3)
        .glassEffect(.regular.tint(.white.opacity(0.8)), in: .rect(cornerRadius: 26))
        .animation(.snappy, value: trimmed.isEmpty)
        .onAppear { if autofocus { focused = true } }
        .onChange(of: voice.state) { _, s in
            if s == .review { text = voice.text; plain = people == nil }
        }
    }

    @ViewBuilder private var field: some View {
        if recording {
            ScrollView {
                Text(voice.text.isEmpty ? " " : voice.text).font(.system(size: 16)).foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10).padding(.leading, 6)
            }
            .defaultScrollAnchor(.bottom).frame(maxHeight: 144).fixedSize(horizontal: false, vertical: true)
        } else if showNote, let people {
            NameNote(text: $text, fixed: $voice.fixed, people: people) { plain = true; focused = true }
        } else {
            TextField("", text: $text, prompt: Text(voice.message ?? placeholder).foregroundStyle(Theme.inkMuted), axis: .vertical)
                .font(.system(size: 16)).foregroundStyle(Theme.ink)
                .lineLimit(1...6).focused($focused) // 6 lines ≈ the web's 144 pt cap; a maxHeight frame made it greedy
                .padding(.vertical, 10).padding(.leading, 6)
        }
    }
}
