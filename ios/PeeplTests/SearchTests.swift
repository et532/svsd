import XCTest
@testable import Peepl

/// Ports of tests/queries.test.ts and tests/golden.test.ts: the real MiniLM question embedding, shipped chunk vectors, all 500 people.
final class SearchTests: XCTestCase {
    static let people = PersonInfo.sample()
    static let byId = Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0) })
    static let t0 = Date()
    let embedder = Embedders.current

    struct Run { var r: PeopleAnswer; var ids: [String] }
    func run(_ q: String, people: [PersonInfo] = SearchTests.people) async -> Run {
        guard case .people(let a) = await Search.answer(q, people: people, embedder: embedder) else {
            XCTFail("\(q): not a people answer"); return Run(r: PeopleAnswer(title: "", matches: []), ids: [])
        }
        return Run(r: a, ids: a.matches.map(\.id))
    }
    func inArea(_ q: String) -> (String) -> Bool {
        let target = Places.resolve(q)?.place ?? Places.home()
        return { Places.sameMetro(target, Places.of(Self.byId[$0]!)) }
    }
    func inNyc(_ id: String) -> Bool { Places.sameMetro(Places.home(), Places.of(Self.byId[id]!)) }

    static let plans = [
        "dinner in Williamsburg", "drinks in the East Village", "brunch in Park Slope", "coffee in Harlem", "game night in Astoria",
        "a concert in Greenpoint", "a house party in Bushwick", "pickleball in Brooklyn", "a run in Queens", "lunch in Chinatown",
        "a quiet coffee in Brooklyn", "dinner party in Jersey City", "a birthday dinner in Astoria", "drinks in Manhattan",
        "someone to see a movie with", "a hike this weekend", "a workout buddy", "someone to grab a beer with", "a gallery visit in Bed-Stuy",
        "a music themed house party in Bushwick", "a vintage themed dinner in Williamsburg", "a cooking themed dinner in Brooklyn",
        "dinner in London", "coffee in Chicago", "lunch in Seattle", "drinks in Los Angeles", "dinner in Paris", "coffee in Boston", "drinks in Berlin",
    ]
    static let knows = EmbeddingSpikeTests.queries

    func testPlansArePlaceGated() async {
        XCTAssertEqual(Self.plans.count, 29)
        for q in Self.plans {
            let r = await run(q), ok = inArea(q)
            XCTAssertEqual(r.ids.filter { !ok($0) }, [], "out of area: \(q)")
            for g in r.r.groups ?? [] { for m in g.matches { XCTAssertTrue(ok(m.id), "\(q): group member \(m.id)") } }
        }
    }

    func testKnowledgeQuestions() async {
        XCTAssertEqual(Self.knows.count, 30)
        var misses: [String] = []
        for (q, id) in Self.knows {
            let ids = await run(q).ids
            if !ids.prefix(10).contains(id) { misses.append("\(q) -> \(id): rank \((ids.firstIndex(of: id) ?? -2) + 1)") }
        }
        print("SEARCH knows misses: \(misses)")
        XCTAssertEqual(misses, [])
    }

    func testEmpties() async {
        for q in ["who knows about deep sea welding", "someone who does rocket science", "who knows about beekeeping", "a falconer",
                  "who is a professional wrestler", "someone who breeds alpacas", "portrait photographer in New York", "a taxidermist in Brooklyn"] {
            let r = await run(q); XCTAssertEqual(r.r.matches.map(\.person.name), [], q)
        }
    }

    func testLifeStageAndMetAt() async {
        for (q, stage) in [("high school friends", "high-school"), ("college friends", "college"), ("people from my first job", "first-job")] {
            let r = await run(q)
            XCTAssertGreaterThan(r.ids.count, 3, q)
            XCTAssertTrue(r.ids.allSatisfy { Self.byId[$0]!.lifeStage == stage }, q)
        }
        for event in ["Config", "Climate Week", "Pickleball league", "Supper club", "Book club"] {
            let r = await run("people I met at \(event)"), e = event.lowercased()
            XCTAssertGreaterThan(r.ids.count, 0, event)
            XCTAssertTrue(r.ids.allSatisfy { id in
                let p = Self.byId[id]!
                return (p.met.context ?? "").lowercased().contains(e) || p.moments.contains { $0.firstMeeting == true && $0.title.lowercased().contains(e) }
            }, event)
        }
    }

    func testOrdering() async {
        let a = await run("someone to go for a run with"); XCTAssertEqual(a.ids.first, "bianca-costa")
        let b = await run("fashion themed party in Bushwick"); XCTAssertTrue(b.ids.prefix(3).contains("tamsin-okoro"), "\(b.ids)")
        let c = await run("a night of classical music in Brooklyn"); XCTAssertTrue(c.ids.prefix(10).contains("lucien-bailey"), "\(c.ids)")
    }

    func testWellFormed() async {
        for q in Self.plans.prefix(10) + Self.knows.prefix(10).map(\.0) {
            let r = await run(q)
            XCTAssertEqual(Set(r.ids).count, r.ids.count, q)
            XCTAssertLessThanOrEqual(r.r.matches.count, 10, q)
            for m in r.r.matches { XCTAssertGreaterThan(m.why.count, 3, "\(q): \(m.id)") }
        }
    }

    func testSelfRetrievalRecall() async {
        var counts: [String: Int] = [:]
        for p in Self.people { counts[p.profession.lowercased(), default: 0] += 1 }
        let unique = Self.people.filter { counts[$0.profession.lowercased()] == 1 && !$0.profession.contains("@") }.enumerated().filter { $0.offset % 3 == 0 }.map(\.element)
        var hit = 0; var misses: [String] = []
        for p in unique {
            let r = await run("who is a \(p.profession.lowercased())")
            if r.ids.prefix(10).contains(p.id) { hit += 1 } else { misses.append("\(p.name) (\(p.profession))") }
        }
        print("SEARCH recall@10: \(hit)/\(unique.count) \(misses.prefix(15))")
        XCTAssertGreaterThan(Double(hit) / Double(unique.count), 0.8)
    }

    // MARK: golden
    func testGoldenBushwickFashion() async {
        let r = await run("someone for me to invite to a house party in Bushwick that is like fashion themed")
        XCTAssertTrue(r.ids.allSatisfy(inNyc))
        XCTAssertTrue(r.ids.prefix(3).contains("tamsin-okoro"), "\(r.ids)")
        for id in ["dmitri-sokolov", "chloe-bernard", "jules-amato"] { XCTAssertTrue(r.ids.contains(id), "\(id) in \(r.ids)") }
        XCTAssertFalse(r.ids.contains("dani-moreno"))
    }
    func testGoldenChatty() async {
        let r = await run("i would like to talk to a software engineer who lives in san francisco right now")
        XCTAssertTrue(r.ids.contains("ty-nakamura"))
    }
    func testGoldenInPersonPlans() async {
        for q in ["someone to play pickleball with", "someone to go for a run with", "a birthday dinner in Astoria", "coffee in Brooklyn"] {
            let r = await run(q); XCTAssertTrue(r.ids.allSatisfy(inNyc), q)
        }
    }
    func testGoldenPickleballAndTaxes() async {
        let r = await run("someone to play pickleball with")
        for id in ["marcus-bell", "dana-reyes"] { XCTAssertTrue(r.ids.prefix(6).contains(id), "\(id) in \(r.ids)") }
        let t = await run("who knows about taxes"); XCTAssertEqual(t.ids.first, "wendy-tsai")
    }
    func testGoldenHonestEmpties() async {
        let r = await run("portrait photographer in New York")
        XCTAssertEqual(r.r.matches.count, 0); XCTAssertGreaterThan(r.r.near?.count ?? 0, 0)
        let w = await run("who knows about deep sea welding"); XCTAssertEqual(w.r.matches.count, 0)
    }
    func testGoldenCollegeFriendsInNYC() async {
        let r = await run("college friends who moved to New York")
        XCTAssertTrue(r.ids.allSatisfy { Self.byId[$0]!.lifeStage == "college" && inNyc($0) })
        XCTAssertGreaterThan(r.ids.count, 5)
    }
    func testDemoAnswers() async {
        // SF trip
        let sf = await run("dinner in SF next month")
        XCTAssertGreaterThan(sf.ids.count, 3)
        XCTAssertTrue(sf.ids.allSatisfy { Places.of(Self.byId[$0]!)?.metro == "bay" || Self.byId[$0]!.livesNow.city.range(of: "San Francisco|Oakland|Berkeley", options: .regularExpression) != nil })
        // climbing
        let cl = await run("I want to find someone to go climbing with me")
        XCTAssertEqual(cl.ids, ["jordan-lee", "zara-ahmed"])
        // hardware intro
        let hw = await run("I just met a founder looking for a hardware engineer. Who can I introduce?")
        XCTAssertEqual(hw.r.groups?.first?.matches.first?.id, "ana-ruiz")
        XCTAssertTrue(hw.ids.contains("aisha-khan"))
    }
    func testGoldenRelaxation() async {
        let fashiony = try! NSRegularExpression(pattern: "fashion|vintage|styl|tailor|costume|textile|runway|apparel|thrift|wardrobe|clothing|sneaker|perfume|interior", options: .caseInsensitive)
        let people = Self.people.filter { p in
            let all = ([p.profession, p.story] + p.tags + p.moments.map { "\($0.title) \($0.text ?? "") \($0.transcript ?? "")" }).joined(separator: " ")
            return fashiony.firstMatch(in: all, range: NSRange(location: 0, length: all.utf16.count)) == nil
        }
        let r = await run("someone for a house party in Bushwick that is fashion themed", people: people)
        XCTAssertTrue(r.r.note?.contains("No one in Bushwick is clearly into fashion") ?? false, "\(r.r.note ?? "nil")")
        XCTAssertGreaterThan(r.r.matches.count, 0)
    }

    override class func setUp() { _ = t0 } // start the clock (a static let is lazy)
    override class func tearDown() { print("SEARCH total time \(Date().timeIntervalSince(t0)) s") }
}
