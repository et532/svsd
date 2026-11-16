import SwiftUI

/// Shared input: typing only (voice and name outlines come in M4).
struct Composer: View {
    let placeholder: String
    var autofocus = false
    let onSend: (String) -> Void
    var onMic: (() -> Void)?

    @State private var text = ""
    @FocusState private var focused: Bool
    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    init(placeholder: String, autofocus: Bool = false, onSend: @escaping (String) -> Void, onMic: (() -> Void)? = nil) {
        self.placeholder = placeholder; self.autofocus = autofocus; self.onSend = onSend; self.onMic = onMic
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(Theme.inkMuted), axis: .vertical)
                .font(.system(size: 16)).foregroundStyle(Theme.ink)
                .lineLimit(1...6).focused($focused) // 6 lines ≈ the web's 144 pt cap; a maxHeight frame made it greedy
                .padding(.vertical, 10).padding(.leading, 6)
            Button { onMic?() } label: {
                Image(systemName: "mic").font(.system(size: 18)).foregroundStyle(Theme.ink).frame(width: 40, height: 40)
            }
            .buttonStyle(.plain).accessibilityLabel("Voice")
            if !trimmed.isEmpty {
                Button { onSend(trimmed); text = "" } label: {
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
    }
}
