import XCTest
import SwiftData
@testable import Peepl

@MainActor
final class BackupTests: XCTestCase {
    override func setUp() { NameFixes.store = UserDefaults(suiteName: "backup-tests-\(UUID().uuidString)")! }

    @discardableResult
    func add(_ ctx: ModelContext, _ id: String, last: String = "2026-01-01", knows: [String] = [], moments: Int = 1) -> Person {
        let pl = Place(city: "X", lat: 0, lng: 0)
        let p = Person(id: id, name: "Name \(id)", context: "social", alsoContext: nil, profession: "Job", story: "Story", tags: ["a"],
                       from: pl, met: pl, livesNow: pl, lifeStage: nil, lastContacted: last, knows: knows, mutualNotes: knows.reduce(into: [:]) { $0[$1] = "note" }, closeness: 2)
        ctx.insert(p)
        p.addTodo(id: "\(id)-t1", text: "first"); p.addTodo(id: "\(id)-t0", text: "second")
        for i in 0..<moments { p.moments.append(Moment(id: "\(id)-m\(i)", date: "2026-01-0\(i % 9 + 1)", title: "T\(i)", text: "text")) }
        try? ctx.save()
        return p
    }
    func all(_ ctx: ModelContext) throws -> [Person] { try ctx.fetch(FetchDescriptor<Person>(sortBy: [SortDescriptor(\.id)])) }
    func fileOf(_ ctx: ModelContext) throws -> BackupFile { try BackupFile.read(Data(contentsOf: BackupFile.export(people: all(ctx)))) }

    func testRoundTrip() throws {
        let a = ModelContext(try makeContainer())
        add(a, "p1", knows: ["p2"]); add(a, "p2", moments: 3)
        NameFixes.store.set(["jorden": "Jordan"], forKey: NameFixes.key)
        let data = try Data(contentsOf: BackupFile.export(people: all(a)))
        XCTAssertEqual(try BackupFile.read(data).counts?.moments, 4)
        let b = ModelContext(try makeContainer())
        NameFixes.store.removeObject(forKey: NameFixes.key)
        try BackupFile.read(data).restore(into: b, mode: .replace)
        let ps = try all(b)
        XCTAssertEqual(ps.map(\.id), ["p1", "p2"])
        XCTAssertEqual(ps[0].orderedTodos.map(\.text), ["first", "second"])
        XCTAssertEqual(ps[0].mutualNotes, ["p2": "note"])
        XCTAssertEqual(ps[1].moments.count, 3)
        XCTAssertEqual(NameFixes.store.dictionary(forKey: NameFixes.key) as? [String: String], ["jorden": "Jordan"])
    }

    func testMergeKeepsBothAndNeverDeletes() throws {
        let src = ModelContext(try makeContainer()); add(src, "b")
        let f = try fileOf(src)
        let ctx = ModelContext(try makeContainer()); add(ctx, "a")
        NameFixes.store.set(["x": "mine"], forKey: NameFixes.key)
        let r = try f.restore(into: ctx, mode: .merge)
        XCTAssertEqual(try all(ctx).map(\.id), ["a", "b"]); XCTAssertEqual(r.added, 1)
    }

    func testMergeClashPicksNewerLastContacted() throws {
        let src = ModelContext(try makeContainer()); add(src, "p", last: "2026-05-01")
        let f = try fileOf(src)
        let ctx = ModelContext(try makeContainer()); let p = add(ctx, "p", last: "2026-03-01"); p.name = "Old"
        try f.restore(into: ctx, mode: .merge)
        XCTAssertEqual(try all(ctx)[0].name, "Name p")
        let ctx2 = ModelContext(try makeContainer()); let q = add(ctx2, "p", last: "2026-09-01"); q.name = "Mine"
        try f.restore(into: ctx2, mode: .merge)
        XCTAssertEqual(try all(ctx2)[0].name, "Mine")
    }

    func testMergeKeptPersonGainsMissingMoments() throws {
        let src = ModelContext(try makeContainer()); let s = add(src, "p", last: "2026-01-01")
        s.moments.append(Moment(id: "extra", date: "2026-01-01", title: "E")); try src.save()
        let f = try fileOf(src)
        let ctx = ModelContext(try makeContainer()); add(ctx, "p", last: "2026-06-01")
        try f.restore(into: ctx, mode: .merge)
        XCTAssertTrue(try all(ctx)[0].moments.contains { $0.id == "extra" })
    }

    func testReplaceRemovesOthersAndCleansLinks() throws {
        let src = ModelContext(try makeContainer()); add(src, "a")
        let f = try fileOf(src)
        let ctx = ModelContext(try makeContainer()); add(ctx, "a", knows: ["z"]); add(ctx, "z")
        try f.restore(into: ctx, mode: .replace)
        XCTAssertEqual(try all(ctx).map(\.id), ["a"])
        XCTAssertEqual(try ctx.fetchCount(FetchDescriptor<Moment>()), 1)
    }

    func testBadFilesChangeNothing() throws {
        let ctx = ModelContext(try makeContainer()); add(ctx, "a")
        let good = try Data(contentsOf: BackupFile.export(people: all(ctx)))
        let json = String(decoding: good, as: UTF8.self)
        XCTAssertThrowsError(try BackupFile.read(Data("not json".utf8)))
        let newer = json.replacingOccurrences(of: "\"version\" : 1", with: "\"version\" : 2")
        XCTAssertThrowsError(try BackupFile.read(Data(newer.utf8))) { XCTAssertTrue($0.localizedDescription.contains("newer version")) }
        var dup = try BackupFile.read(good); dup.people.append(dup.people[0])
        let enc = try JSONEncoder().encode(dup)
        XCTAssertThrowsError(try BackupFile.read(enc))
        XCTAssertEqual(try all(ctx).count, 1)
    }

    func testExportThatFailsItsCheckLeavesNoTempFile() throws {
        let ctx = ModelContext(try makeContainer()); let p = add(ctx, "a")
        let url = BackupFile.exportURL()
        try? FileManager.default.removeItem(at: url)
        XCTAssertThrowsError(try BackupFile.export(people: [p, p])) // the same id twice fails read()
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        let ok = try BackupFile.export(people: [p])
        XCTAssertEqual(ok, url)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        BackupReminder.cleanup(ok)
    }

    func testOldFileWithoutNewFieldsDecodes() throws {
        let f = try BackupFile.read(Data(#"{"version":1,"people":[],"nameFixes":{}}"#.utf8))
        XCTAssertNil(f.exportedAt); XCTAssertNil(f.counts)
    }

    func testFiveHundredRestoreIsFast() throws {
        let src = ModelContext(try makeContainer())
        for i in 0..<500 { add(src, "p\(i)", moments: 2) }
        let f = try fileOf(src)
        let ctx = ModelContext(try makeContainer())
        let t = Date()
        try f.restore(into: ctx, mode: .replace)
        XCTAssertLessThan(Date().timeIntervalSince(t), 5)
        XCTAssertEqual(try ctx.fetchCount(FetchDescriptor<Person>()), 500)
    }
}
