import XCTest
import SwiftData
@testable import Peepl

@MainActor
final class SeedTests: XCTestCase {
    func testLoadsAll500AndIsIdempotent() throws {
        let context = ModelContext(try makeContainer())
        Seed.loadIfEmpty(context)
        XCTAssertEqual(try context.fetchCount(FetchDescriptor<Person>()), 500)
        Seed.loadIfEmpty(context)
        XCTAssertEqual(try context.fetchCount(FetchDescriptor<Person>()), 500)
    }
}
