import SwiftUI
import SwiftData

@main
struct PeeplApp: App {
    init() {
        #if DEBUG
        // -PeeplResetAI YES, UI tests only: start with the OpenAI switch off and no consent saved from an earlier run.
        // (A launch-argument value would shadow what the app writes, so the keys are removed instead.)
        if UserDefaults.standard.bool(forKey: "PeeplResetAI") {
            UserDefaults.standard.removeObject(forKey: AIClient.enabledKey)
            Consent.defaults.removeObject(forKey: Consent.key)
        }
        #endif
    }

    var body: some Scene {
        WindowGroup { RootView() }
            // -PeeplInMemory YES: a throwaway store, so every UI test starts from the same people
            .modelContainer(for: [Person.self, Moment.self, Todo.self], inMemory: UserDefaults.standard.bool(forKey: "PeeplInMemory"))
    }
}
