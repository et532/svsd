import Foundation
import SwiftData
@testable import Peepl

/// In-memory container, or on disk at `url` so a test can re-open the same store.
func makeContainer(at url: URL? = nil) throws -> ModelContainer {
    let schema = Schema([Person.self, Moment.self, Todo.self])
    let config = url.map { ModelConfiguration(schema: schema, url: $0) }
        ?? ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
    return try ModelContainer(for: schema, configurations: [config])
}
