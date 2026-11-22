import SwiftUI

/// Agreement to send data to OpenAI. Stored as a version so a changed text can ask again.
enum Consent {
    static let currentVersion = 1
    static let key = "consentVersion"
    /// Tests swap this for their own suite.
    static var defaults = UserDefaults.standard
    static var agreed: Bool { defaults.integer(forKey: key) >= currentVersion }
    static func agree() { defaults.set(currentVersion, forKey: key) }
}

struct ConsentView: View {
    let onAgree: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Use OpenAI?").font(Theme.font(24, .semibold)).foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            Text("If you agree, these are sent to OpenAI through Peepl's server:")
                .font(Theme.font(15)).foregroundStyle(Theme.ink)
            VStack(alignment: .leading, spacing: 6) {
                Text("• The note you type when you add someone")
                Text("• Your question, with short facts about up to 12 people")
                Text("• For a message draft: the person's first name and what you know about them, and for an introduction the other person's name")
            }.font(Theme.font(15)).foregroundStyle(Theme.ink)
            Text("Nothing is sent while the switch is off. You can turn it off any time in Settings.")
                .font(Theme.font(14)).foregroundStyle(Theme.inkMuted)
            Link("Privacy policy", destination: URL(string: "https://peepl-steel.vercel.app/privacy.html")!)
                .font(Theme.font(15, .medium))
            Spacer(minLength: 0)
            Button(action: onAgree) {
                Text("Agree").font(Theme.font(16, .medium)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 52).background(Theme.night, in: Capsule())
            }
            .buttonStyle(PressStyle(scale: 0.96)).accessibilityLabel("Agree and turn on OpenAI")
            Button(action: onCancel) {
                Text("Not now").font(Theme.font(16, .medium)).foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, minHeight: 52).pastel(in: Capsule())
            }
            .buttonStyle(PressStyle(scale: 0.96)).accessibilityLabel("Not now, keep OpenAI off")
        }
        .padding(24)
        .presentationDetents([.medium, .large])
    }
}
