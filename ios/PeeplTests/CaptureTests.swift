import XCTest
@testable import Peepl

private struct P: Named { let id: String; let name: String
    init(_ name: String) { self.name = name; id = name }
}

final class CaptureTests: XCTestCase {
    let voiceScript = "Jorden Lee, met at Demo Day. Founder at Voltsel, battery recycling for e-bikes. From Seattle, lives in Brooklyn now. Climbs Tuesdays. Owe them a hardware intro."
    func parse(_ t: String) -> Draft { Capture.parsePerson(t, people: []) }

    func check(_ d: Draft, _ want: [String: String], file: StaticString = #filePath, line: UInt = #line) {
        let got: [String: String?] = ["name": d.name, "company": d.company, "does": d.does, "from": d.from, "lives": d.lives,
                                      "met": d.met, "remember": d.remember, "goal": d.goal]
        for (k, v) in want { XCTAssertEqual(got[k] ?? nil, v, k, file: file, line: line) }
    }

    func testMessyBumpedInto() {
        let d = parse("Bumped into Priyanka Raman at a friend's rooftop thing last night. She works at Notion as a PM, grew up in Austin, now in Brooklyn. Super into ceramics and wants to open a studio. Promised to send her the pottery class link.")
        check(d, ["name": "Priyanka Raman", "company": "Notion", "does": "PM", "from": "Austin", "lives": "Brooklyn", "met": "rooftop thing"])
        XCTAssertEqual(d.remember, "Super into ceramics")
        XCTAssertEqual(d.goal, "Wants to open a studio")
    }

    func testKeepsCompanyForOtherRoles() {
        let d = parse("Met Jules Marlowe at a climbing gym. Jules is a chef at Nopa.")
        check(d, ["name": "Jules Marlowe", "company": "Nopa", "met": "climbing gym"])
        XCTAssertEqual(Capture.professionOf(d), "Chef @ Nopa")
    }

    func testPlainNotes() {
        check(parse("Met Riley Brooks at a pickleball meetup. Riley is a designer at Kiln."), ["name": "Riley Brooks", "company": "Kiln", "met": "pickleball meetup"])
        check(parse(voiceScript), ["name": "Jorden Lee", "company": "Voltsel", "from": "Seattle", "lives": "Brooklyn", "met": "Demo Day"])
    }

    func testRealWorldCases() {
        let cases: [(String, [String: String])] = [
            ("Met Tomás Herrera at Config. He's a product manager at Figma, lives in San Francisco. Loves surfing.", ["name": "Tomás Herrera", "company": "Figma", "lives": "San Francisco", "met": "Config"]),
            ("Ran into Aisha Khan at the farmers market. She's a nurse at Mount Sinai, originally from Chicago. Into hiking and wants to run a marathon.", ["name": "Aisha Khan", "company": "Mount Sinai", "from": "Chicago", "met": "farmers market", "remember": "Into hiking"]),
            ("Had dinner with my cousin Leo Park. He's a software engineer at Google, based in Seattle.", ["name": "Leo Park", "company": "Google", "lives": "Seattle"]),
            ("Spoke with Dr. Elena Rossi at church. She's a doctor at NYU Langone, grew up in Rome.", ["name": "Elena Rossi", "company": "NYU Langone", "from": "Rome", "met": "church"]),
            ("Came across Ben Carter at a house party yesterday. He teaches high school math and plays guitar.", ["name": "Ben Carter", "does": "teacher", "met": "house party", "remember": "plays guitar"]),
            ("Sam from the climbing gym. Really into bouldering, lives in Queens.", ["name": "Sam", "met": "climbing gym", "lives": "Queens"]),
            ("Bumped into Jamal Brown at the gym this morning. He's a barista at Blue Bottle and a big fan of jazz.", ["name": "Jamal Brown", "does": "barista at Blue Bottle", "company": "Blue Bottle", "met": "gym"]),
            ("Met Zoë Müller at a book club. She's a translator at the UN, from Berlin, now in Queens.", ["name": "Zoë Müller", "company": "UN", "from": "Berlin", "lives": "Queens", "met": "book club"]),
            ("Went to a wedding and sat next to Marcus Webb. He's a lawyer in Chicago and collects vintage watches.", ["name": "Marcus Webb", "lives": "Chicago", "met": "wedding"]),
            ("Met Kenji Ito in Tokyo through my friend Hana. Photographer, loves analog film.", ["name": "Kenji Ito", "met": "Tokyo"]),
            ("Talked to Nina Alvarez after the pickleball tournament. She coaches tennis in Miami and wants to open an academy.", ["name": "Nina Alvarez", "does": "tennis coach", "goal": "Wants to open an academy"]),
            ("Met a guy named Felix at a bar who builds drones.", ["name": "Felix", "met": "bar"]),
            ("Ran into Dr. James O'Neil at the gym. Dentist at SmileCo, lives in Queens.", ["name": "James O'Neil", "company": "SmileCo", "lives": "Queens", "met": "gym"]),
            ("Met Ana María López at a salsa class. Software developer at Mercado Libre, from Buenos Aires.", ["name": "Ana María López", "company": "Mercado Libre", "from": "Buenos Aires", "met": "salsa class"]),
        ]
        for (note, want) in cases { check(parse(note), want) }
    }

    func testNameAfterMetAAndCities() {
        check(parse("I just came back from a climbing gym and I met a Sally Gallagher. She's a founder at Cork and she lives in Brooklyn now."), ["name": "Sally Gallagher", "company": "Cork", "lives": "Brooklyn"])
        let s = "She's from Bogotá and lives in São Paulo now."
        XCTAssertEqual(Capture.parseFrom(s), "Bogotá")
        XCTAssertEqual(Capture.parseLives(s), "São Paulo")
        XCTAssertNil(Capture.parseFrom("she's from Cork's"))
    }

    func testMomentCandidates() {
        let people = ["Priya Menon", "Sofía Reyes", "Jordan Smith", "Jordan Lee"].map(P.init)
        func names(_ t: String) -> [String] { Capture.momentCandidates(t, people: people).map(\.name) }
        XCTAssertEqual(names("Ran into a Priya Venkat at a pottery studio. She is a data scientist at Spotify."), [])
        XCTAssertEqual(names("Bumped into Sofía Alvarez at the gym."), [])
        XCTAssertEqual(names("Caught up with Priya over coffee."), ["Priya Menon"])
        XCTAssertEqual(names("Grabbed coffee with Priya Menon."), ["Priya Menon"])
        XCTAssertEqual(names("Coffee with Priya Tuesday, we talked about her research."), ["Priya Menon"])
        XCTAssertEqual(names("Caught up with Sofía yesterday."), ["Sofía Reyes"])
        XCTAssertEqual(names("Caught up with Jordan over lunch."), ["Jordan Smith", "Jordan Lee"])
        XCTAssertEqual(names("Met Priya Venkat at a pottery studio."), [])
    }

    func testDedupeTodos() {
        XCTAssertEqual(Capture.dedupeTodos(["catch up and grab coffee", "Wants to catch up and grab coffee", "Loves rock climbing"]), ["Catch up and grab coffee", "Loves rock climbing"])
        XCTAssertEqual(Capture.dedupeTodos([nil, "send her the darkroom link", "Send her the darkroom link."]), ["Send her the darkroom link"])
        XCTAssertEqual(Capture.dedupeTodos(["Open a gym", "Learn to surf"]), ["Open a gym", "Learn to surf"])
    }

    func testIntoInBumpedIntoIsNotAnInterest() {
        XCTAssertNil(parse("Bumped into Sam Lee at the gym.").remember)
    }

    func testMergedAIWins() {
        var a = Draft(); a.name = "A"; a.does = "chef"
        var b = Draft(); b.name = "B"
        let m = a.merged(with: b)
        XCTAssertEqual(m.name, "B"); XCTAssertEqual(m.does, "chef")
    }

    // MARK: 6c when you met

    func local(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 12) -> Date {
        Calendar.current.date(from: DateComponents(year: y, month: m, day: d, hour: h))!
    }

    func testMetDateTable() {
        let today = local(2026, 11, 22)
        let rows: [(String, String?)] = [
            ("met them three years ago", "2023"), ("met them 3 years ago", "2023"), ("met a couple of years ago", "2024"),
            ("met a few years ago", "2023"), ("met a year ago", "2025"), ("met them last year", "2025"),
            ("met six months ago", "2026-05"), ("we met last month", "2026-10"), ("met in 2023", "2023"),
            ("back in 2019 we met", "2019"), ("met in March 2022", "2022-03"), ("met in Mar 2022", "2022-03"),
            ("met last March", "2026-03"), ("met last summer", "2026-07"), ("met in the summer of 2019", "2019-07"),
            ("met last winter", "2026-01"), ("met them yesterday", "2026-11-21"), ("met them last night", "2026-11-21"),
            ("met them the day before yesterday", "2026-11-20"), ("met them this morning", "2026-11-22"),
            ("met them today", "2026-11-22"), ("met them tonight", "2026-11-22"), ("met them last week", "2026-11-15"),
            ("met in 2031", nil), ("met in 1920", nil), ("we founded it in 2019. Met Sam at a bar.", nil),
            ("met in college", nil), ("met in high school", nil), ("Met Sam at Demo Day.", nil),
        ]
        for (text, want) in rows { XCTAssertEqual(Capture.parseMetDate(text, today: today), want, text) }
        // 30th row: after midnight, "last night" is still the previous calendar day.
        XCTAssertEqual(Capture.parseMetDate("met them last night", today: local(2026, 11, 22, 2)), "2026-11-21")
        XCTAssertEqual(Capture.parseLifeStage("met in college"), "college")
        XCTAssertEqual(Capture.parseLifeStage("met in high school"), "high-school")
        XCTAssertEqual(Capture.parseLifeStage("we met in grad school"), "grad-school")
        XCTAssertEqual(Capture.parseLifeStage("friends as kids"), "childhood")
        XCTAssertNil(Capture.parseLifeStage("Met Sam at Demo Day."))
    }

    func testMetDateMonthBoundary() {
        XCTAssertEqual(Capture.parseMetDate("met yesterday", today: local(2026, 12, 1)), "2026-11-30")
        XCTAssertEqual(Capture.parseMetDate("met last month", today: local(2026, 1, 5)), "2025-12")
    }

    func testMetLabel() {
        XCTAssertEqual(MetDate.label("2026-11-22", lifeStage: nil), "Met Nov 2026")
        XCTAssertEqual(MetDate.label("2022-03", lifeStage: nil), "Met Mar 2022")
        XCTAssertEqual(MetDate.label("2023", lifeStage: nil), "Met 2023")
        XCTAssertEqual(MetDate.label(nil, lifeStage: "college"), "Met in college")
        XCTAssertEqual(MetDate.label(nil, lifeStage: "high-school"), "Met in high school")
        XCTAssertEqual(MetDate.label(nil, lifeStage: "grad-school"), "Met in grad school")
        XCTAssertEqual(MetDate.label(nil, lifeStage: "childhood"), "Met in childhood")
        XCTAssertEqual(MetDate.label(nil, lifeStage: "nyc-work"), "")
        // a known date wins over the life stage
        XCTAssertEqual(MetDate.label("2014-09-01", lifeStage: "college"), "Met Sep 2014")
    }

    func testPadDate() {
        XCTAssertEqual(Capture.padDate("2023"), "2023-07-01")
        XCTAssertEqual(Capture.padDate("2023-05"), "2023-05-15")
        XCTAssertEqual(Capture.padDate("2023-05-10"), "2023-05-10")
    }
}
