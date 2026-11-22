import SwiftUI

/// Shared input: type, or talk (built-in VoiceSession) with names outlined for fixing when `people` is given.
struct Composer: View {
    let placeholder: String
    var autofocus = false
    var tall = false // 1.5x the height, so it reads as something to tap
    let onSend: (String) -> Void
    var onMic: (() -> Void)?
    var people: [any Named]?
    var startVoice = false // open already listening (the ask bar's mic)

    @State private var text = ""
    @State private var voice = VoiceSession()
    @State private var plain = true
    @State private var sends = 0
    @FocusState private var focused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduce
    private var recording: Bool { voice.state == .recording }
    private var showNote: Bool { voice.state == .review && !plain && people != nil }
    private var snap: Animation? { Motion.animation(Motion.snap, reduce: reduce) }
    private var swap: AnyTransition { reduce ? .opacity : .scale.combined(with: .opacity) }
    private var trimmed: String { (recording ? "" : text).trimmingCharacters(in: .whitespacesAndNewlines) }

    init(placeholder: String, autofocus: Bool = false, onSend: @escaping (String) -> Void, onMic: (() -> Void)? = nil,
         people: [any Named]? = nil, startVoice: Bool = false, tall: Bool = false) {
        self.placeholder = placeholder; self.autofocus = autofocus; self.onSend = onSend; self.onMic = onMic; self.people = people
        self.startVoice = startVoice; self.tall = tall
    }

    private func listen() {
        if let onMic { onMic(); return }
        focused = false
        let sorted = (people as? [Person])?.sorted { $0.lastContacted > $1.lastContacted } ?? (people ?? [])
        Task { await voice.start(names: sorted.map(\.name)) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
        // its own line, not the placeholder: it must show even when there is text in the field
        if let m = voice.message {
            Text(m).font(Theme.font(13)).foregroundStyle(Theme.inkMuted).padding(.horizontal, 6).padding(.top, 8)
                .transition(.opacity.combined(with: reduce ? .identity : .move(edge: .top)))
        }
        HStack(alignment: .bottom, spacing: 8) {
            field
            if recording {
                Waveform(level: { voice.recognizer.level }).frame(height: 40)
                    .transition(.opacity.combined(with: reduce ? .identity : .scale(scale: 0.8, anchor: .leading)))
                Button { voice.stop() } label: {
                    Image(systemName: "stop.fill").font(Theme.font(16)).foregroundStyle(.white)
                        .symbolEffect(.pulse, isActive: !reduce) // listening
                        .frame(width: 40, height: 40).background(Theme.night, in: .circle)
                }
                .buttonStyle(PressStyle(scale: 0.9)).accessibilityLabel("Stop").transition(swap)
            } else {
                Button { listen() } label: {
                    Image(systemName: "mic").font(Theme.font(18)).foregroundStyle(Theme.ink).frame(width: 40, height: 40)
                }
                .buttonStyle(PressStyle(scale: 0.9)).accessibilityLabel("Voice").transition(swap)
            }
            if !trimmed.isEmpty {
                Button { sends += 1; onSend(trimmed); text = ""; voice.reset(); plain = true } label: {
                    Image(systemName: "arrow.up").font(Theme.font(16, .semibold)).foregroundStyle(.white)
                        .frame(width: 40, height: 40).background(Theme.night, in: .circle)
                }
                .buttonStyle(PressStyle(scale: 0.9)).accessibilityLabel("Send").transition(.scale.combined(with: .opacity))
            }
        }
        }
        .padding(.horizontal, 10).padding(.vertical, 3)
        .frame(minHeight: tall ? 84 : nil)
        .pastel(in: RoundedRectangle(cornerRadius: 26), tint: Color(hex: "eee7fb"))
        .overlay { // focus: a faint border
            RoundedRectangle(cornerRadius: 26).stroke(Theme.ink.opacity(focused ? 0.18 : 0), lineWidth: 1).allowsHitTesting(false)
        }
        .animation(snap, value: trimmed.isEmpty)
        .animation(snap, value: recording)
        .animation(snap, value: focused)
        .animation(snap, value: voice.message)
        // shortcut: wrapped lines are guessed from the length (~28 chars a line); upgrade by measuring the field
        .animation(snap, value: text.count / 28 + text.filter(\.isNewline).count)
        .sensoryFeedback(trigger: recording) { _, new in .impact(weight: new ? .medium : .light) }
        .sensoryFeedback(.impact(weight: .light), trigger: sends)
        .sensoryFeedback(.warning, trigger: voice.message) { _, new in new != nil }
        .onAppear { if startVoice { listen() } else if autofocus { focused = true } }
        .onChange(of: voice.state) { _, s in
            if s == .review { text = voice.text; plain = people == nil }
        }
    }

    @ViewBuilder private var field: some View {
        if recording {
            ScrollView {
                if let people {
                    NameNote(text: .constant(voice.text), fixed: .constant([]), people: people, onPlain: {}, interactive: false)
                } else {
                    Text(voice.text.isEmpty ? " " : voice.text).font(Theme.font(16)).foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10).padding(.leading, 6)
                }
            }
            .defaultScrollAnchor(.bottom).frame(maxHeight: 144).fixedSize(horizontal: false, vertical: true)
        } else if showNote, let people {
            NameNote(text: $text, fixed: $voice.fixed, people: people) { plain = true; focused = true }
        } else {
            TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(Theme.inkMuted), axis: .vertical)
                .font(Theme.font(16)).foregroundStyle(Theme.ink)
                .accessibilityIdentifier("composer")
                .lineLimit(1...6).focused($focused) // 6 lines ≈ the web's 144 pt cap; a maxHeight frame made it greedy
                // names outlined as you type. shortcut: past 6 lines the outlines follow the end of the note only
                // (bottom-aligned), so they drift if you scroll back up; needs a real text view to track scrolling.
                .background {
                    if let people, !text.isEmpty {
                        Color.clear.overlay(alignment: .bottomLeading) {
                            NameOutlines(text: text, people: people).fixedSize(horizontal: false, vertical: true).padding(.horizontal, 4)
                        }
                        .padding(.horizontal, -4).clipped() // 4 pt of room for an outline at the start of a line
                    }
                }
                .padding(.vertical, 10).padding(.leading, 6)
        }
    }
}
