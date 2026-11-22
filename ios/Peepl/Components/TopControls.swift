import SwiftUI

enum Tab { case mindmap, connections }

// Glass pill that toggles Mindmap / Connections; the grey blob springs between the two buttons.
struct TopControls: View {
    @Binding var tab: Tab
    @Namespace private var blob

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
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { tab = t }
        } label: {
            Image(systemName: symbol)
                .font(Theme.font(18))
                .foregroundStyle(Theme.ink)
                .frame(width: 42, height: 42)
                .background {
                    if tab == t { Circle().fill(Theme.pressed).matchedGeometryEffect(id: "blob", in: blob) }
                }
        }
        .buttonStyle(PressStyle(scale: 0.92))
        .accessibilityLabel(label)
    }
}
