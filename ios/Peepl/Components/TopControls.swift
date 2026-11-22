import SwiftUI

enum Tab { case mindmap, connections }

// Glass pill that toggles Mindmap / Connections; the grey blob springs between the two buttons.
struct TopControls: View {
    @Binding var tab: Tab
    @Namespace private var blob
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        HStack(spacing: 2) {
            button(.mindmap, "circle.hexagongrid.fill", "Mindmap")
            button(.connections, "list.bullet", "Connections")
        }
        .padding(6)
        .frame(height: 54)
        .pastel(in: Capsule())
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    private func button(_ t: Tab, _ symbol: String, _ label: String) -> some View {
        Button {
            withAnimation(Motion.animation(Motion.pop, reduce: reduce)) { tab = t }
        } label: {
            Image(systemName: symbol)
                .font(Theme.font(18))
                .foregroundStyle(Theme.ink)
                .symbolEffect(.bounce, value: tab == t) // shortcut: also bounces the icon that was just deselected
                .frame(width: 42, height: 42)
                .background {
                    if tab == t { Circle().fill(Theme.pressed).matchedGeometryEffect(id: "blob", in: blob) }
                }
        }
        .buttonStyle(PressStyle(scale: 0.92))
        .accessibilityLabel(label)
    }
}
