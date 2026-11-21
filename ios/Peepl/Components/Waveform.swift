import SwiftUI

/// Scrolling input-level bars; `level` is polled every frame.
struct Waveform: View {
    let level: () -> Float
    @State private var history = [Float](repeating: 0, count: 24)

    init(level: @escaping () -> Float) { self.level = level }

    var body: some View {
        TimelineView(.animation) { ctx in
            HStack(spacing: 3) {
                ForEach(history.indices, id: \.self) { i in
                    Capsule().fill(Color(hex: "2F4FD0")).frame(width: 3, height: 4 + CGFloat(history[i]) * 28)
                }
            }
            .frame(height: 36)
            .accessibilityHidden(true)
            .onChange(of: ctx.date) { _, _ in
                history.removeFirst()
                history.append(min(1, max(0, level())))
            }
        }
    }
}
