import SwiftUI

extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let v = UInt64(s, radix: 16) ?? 0
        self.init(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
    }
}

// Tokens from DESIGN-FOUNDATION.md / the web app's :root. The app uses off-white, never the old cream.
enum Theme {
    static let bg = Color(hex: "f4f4f4")
    static let ink = Color(hex: "16121c")
    static let inkMuted = Color(hex: "5b5361")
    static let night = Color(hex: "1c1522")
    static let pressed = Color(red: 22 / 255, green: 18 / 255, blue: 28 / 255).opacity(0.08)
}

extension View {
    // Native Liquid Glass, standing in for the web app's SVG-filter glass.
    func glass(_ radius: CGFloat = 20) -> some View {
        glassEffect(.regular, in: .rect(cornerRadius: radius))
    }
}

extension Theme {
    /// Geist (bundled, Resources/Fonts). Falls back to the system font if a file is missing.
    static func font(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        let name: String
        switch weight {
        case .light, .thin, .ultraLight: name = "Geist-Light"
        case .medium: name = "Geist-Medium"
        case .semibold, .bold, .heavy, .black: name = "Geist-SemiBold"
        default: name = "Geist-Regular"
        }
        return .custom(name, size: size)
    }
    static func mono(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom(weight == .medium || weight == .semibold ? "GeistMono-Medium" : "GeistMono-Regular", size: size)
    }
}
