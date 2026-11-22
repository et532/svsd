import XCTest
@testable import Peepl

final class LocalAIUpgradeTests: XCTestCase {
    static let people = PersonInfo.sample()
    let embedder = Embedders.current
    let q = "someone who does pottery"

    private func instant() async -> AskResult { await Search.answer(q, people: Self.people, embedder: embedder) }

    func testNilForSpecialNonPeopleAndUnavailable() async {
        let sq = "who haven't I talked to in a while"
        let special = Ask.interpret(sq, people: Self.people)
        let r1 = await LocalAI.upgrade(question: sq, instant: special, people: Self.people, embedder: embedder, parse: { Query.parse($0) })
        XCTAssertNil(r1)
        let r2 = await LocalAI.upgrade(question: q, instant: .add, people: Self.people, embedder: embedder, parse: { Query.parse($0) })
        XCTAssertNil(r2)
        if !LocalAI.isAvailable { // Simulator without the model: behaves as today
            let r3 = await LocalAI.upgrade(question: q, instant: await instant(), people: Self.people, embedder: embedder)
            XCTAssertNil(r3)
        }
    }

    func testNilWhenParseFailsOrNothingChanges() async {
        let i = await instant()
        let r1 = await LocalAI.upgrade(question: q, instant: i, people: Self.people, embedder: embedder, parse: { _ in nil })
        XCTAssertNil(r1)
        let r2 = await LocalAI.upgrade(question: q, instant: i, people: Self.people, embedder: embedder, parse: { Query.parse($0) }, model: { _, _ in nil })
        XCTAssertNil(r2) // same parse, no picks: retrieval order and wording, so unchanged
    }

    func testUpgradeKeepsRetrievalPeopleAndNeverAddsNearMisses() async {
        guard case .people(let a) = await instant(), a.matches.count >= 2, a.groups == nil else { return XCTFail("need a flat answer with 2+ matches") }
        let r = await LocalAI.upgrade(question: q, instant: .people(a), people: Self.people, embedder: embedder, parse: { Query.parse($0) },
                                      model: { _, pool in [(pool.count, "because"), (99, "invented")] })
        guard case .people(let b)? = r else { return XCTFail("expected an upgrade") }
        XCTAssertEqual(Set(b.matches.map(\.id)), Set(a.matches.map(\.id)))
        XCTAssertEqual(b.matches.count, a.matches.count)
        XCTAssertTrue(Set(b.matches.map(\.id)).isDisjoint(with: (a.near ?? []).map(\.id)))
        XCTAssertEqual(b.matches.first?.why, "because")
        XCTAssertEqual(b.title, a.title)
    }

    func testEmptyRerunKeepsInstantAndOtherEmptyCases() async {
        guard case .people(let a) = await instant(), !a.matches.isEmpty else { return XCTFail("need matches") }
        let none = Query.parse(q)
        // (1) re-run finds nobody but the instant answer had people: keep the instant answer
        let r1 = await LocalAI.upgrade(question: q, instant: .people(a), people: [], embedder: embedder, parse: { _ in none })
        XCTAssertNil(r1)
        // (2) both empty: no upgrade, stays "no one matches"
        var empty = a; empty.matches = []
        let r2 = await LocalAI.upgrade(question: q, instant: .people(empty), people: [], embedder: embedder, parse: { _ in none })
        if case .people(let e)? = r2 { XCTAssertTrue(e.matches.isEmpty) } // still "no one matches"
        // (3) instant empty, re-run has people: shown
        let r3 = await LocalAI.upgrade(question: q, instant: .people(empty), people: Self.people, embedder: embedder, parse: { Query.parse($0) })
        guard case .people(let c)? = r3 else { return XCTFail("expected re-run matches") }
        XCTAssertFalse(c.matches.isEmpty)
    }

    func testReorderDropsUnknownIds() {
        let a = PeopleAnswer(title: "t", matches: [])
        XCTAssertEqual(LocalAI.reorder(a, [("nobody", "x")]).matches.count, 0)
    }
}
