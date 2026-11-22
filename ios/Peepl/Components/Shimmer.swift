import SwiftUI

/// Placeholder with a moving highlight; static under Reduce Motion.
struct Shimmer: View {
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var x: CGFloat = -1
    var body: some View {
        Color.white.opacity(0.7)
            .overlay {
                if !reduce {
                    GeometryReader { g in
                        LinearGradient(colors: [.clear, .white.opacity(0.9), .clear], startPoint: .leading, endPoint: .trailing)
                            .frame(width: g.size.width * 0.5)
                            .offset(x: x * g.size.width)
                    }
                }
            }
            .clipped()
            .onAppear { if !reduce { withAnimation(.linear(duration: 1.3).repeatForever(autoreverses: false)) { x = 1.5 } } }
    }
}
