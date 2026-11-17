import SwiftUI
import SwiftData

@main
struct PeeplApp: App {
    var body: some Scene {
        WindowGroup { RootView() }
            // -PeeplInMemory YES: a throwaway store, so every UI test starts from the same people
            .modelContainer(for: [Person.self, Moment.self, Todo.self], inMemory: UserDefaults.standard.bool(forKey: "PeeplInMemory"))
    }
}
