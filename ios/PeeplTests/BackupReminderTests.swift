import XCTest
import SwiftData
@testable import Peepl

final class BackupReminderTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    func ago(_ d: Double) -> Date { now.addingTimeInterval(-d * 86400) }
    func due(days: Double = 1, base: Int = 20, count: Int = 25, reminded: Double? = nil) -> Bool {
        BackupReminder.due(now: now, lastBackupAt: ago(days), baselineCount: base, count: count, lastReminderAt: reminded.map(ago))
    }

    func testTruthTable() {
        XCTAssertFalse(due())
        XCTAssertTrue(due(count: 30))
        XCTAssertFalse(due(count: 29))
        XCTAssertTrue(due(days: 30))
        XCTAssertFalse(due(days: 29))
        XCTAssertFalse(due(days: 40, reminded: 3))
        XCTAssertTrue(due(days: 40, reminded: 8))
        XCTAssertFalse(due(days: 40, base: 0, count: 0))
    }

    func testLaunchHookRemindsOnceAndNotOnFreshInstall() {
        let s = UserDefaults(suiteName: "BackupReminderTests")!
        s.removePersistentDomain(forName: "BackupReminderTests"); BackupReminder.store = s
        defer { s.removePersistentDomain(forName: "BackupReminderTests"); BackupReminder.store = .standard }
        XCTAssertFalse(BackupReminder.shouldRemind(count: 5, now: now))        // first launch sets baseline
        XCTAssertFalse(BackupReminder.shouldRemind(count: 14, now: now))
        XCTAssertTrue(BackupReminder.shouldRemind(count: 15, now: now))
        XCTAssertFalse(BackupReminder.shouldRemind(count: 15, now: now.addingTimeInterval(86400)))
        BackupReminder.recordBackup(count: 15, now: now)
        XCTAssertFalse(BackupReminder.shouldRemind(count: 16, now: now.addingTimeInterval(9 * 86400)))
    }

    @MainActor
    func testLoadingSamplesIsNotCountedAsNewPeople() throws {
        let s = UserDefaults(suiteName: "BackupReminderTests.samples")!
        s.removePersistentDomain(forName: "BackupReminderTests.samples"); BackupReminder.store = s
        defer { s.removePersistentDomain(forName: "BackupReminderTests.samples"); BackupReminder.store = .standard }
        XCTAssertFalse(BackupReminder.shouldRemind(count: 0, now: now))        // first launch, empty list
        let context = ModelContext(try makeContainer())
        Seed.loadSamples(context)
        let n = try context.fetchCount(FetchDescriptor<Person>())
        XCTAssertGreaterThan(n, 100)
        XCTAssertEqual(s.integer(forKey: "backupBaselineCount"), n)
        XCTAssertFalse(BackupReminder.shouldRemind(count: n, now: now.addingTimeInterval(86400)))
        XCTAssertTrue(BackupReminder.shouldRemind(count: n + 10, now: now.addingTimeInterval(2 * 86400))) // people added after that still count
    }

    func testCleanupRemovesFile() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("rela-\(UUID()).json")
        try Data("{}".utf8).write(to: url)
        BackupReminder.cleanup(url)
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
    }
}
