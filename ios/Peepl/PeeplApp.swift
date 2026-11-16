import SwiftUI
import SwiftData

@main
struct PeeplApp: App {
    var body: some Scene {
        WindowGroup { RootView() }
            .modelContainer(for: [Person.self, Moment.self, Todo.self])
    }
}
