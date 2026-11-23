import SwiftUI

/// Small glass callout with an arrow pointing down at its anchor; tap to dismiss. The caller fades it in and out (`.transition(.opacity)`, 0.25 s).
struct TipCallout: View {
    var title: String?
    let message: String
    var onDismiss: () -> Void
    var arrowInset: CGFloat = 28 // arrow centre from the trailing edge
    var arrow = true

    var body: some View {
        Button(action: onDismiss) {
            VStack(alignment: .leading, spacing: 4) {
                if let title { Text(title).font(Theme.font(15, .semibold)).foregroundStyle(Theme.ink) }
                Text(message).font(Theme.font(14)).foregroundStyle(Theme.ink.opacity(0.8)).multilineTextAlignment(.leading)
            }
            .padding(14).frame(width: 250, alignment: .leading).glass(18)
            .overlay(alignment: .bottomTrailing) {
                if arrow { Triangle().fill(Color(hex: "faf7ff").opacity(0.92)).frame(width: 16, height: 8).offset(x: -(arrowInset - 8), y: 8) }
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine).accessibilityHint("Dismiss")
        .transition(.opacity)
    }
}

private struct Triangle: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path(); p.move(to: CGPoint(x: r.minX, y: r.minY)); p.addLine(to: CGPoint(x: r.maxX, y: r.minY)); p.addLine(to: CGPoint(x: r.midX, y: r.maxY)); p.closeSubpath(); return p
    }
}
