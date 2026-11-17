import XCTest
@testable import Peepl

private struct P: Named { let id: String; let name: String
    init(_ name: String) { self.name = name; id = name }
}

final class NameFixesTests: XCTestCase {
    let suite = "NameFixesTests"
    override func setUp() {
        UserDefaults.standard.removePersistentDomain(forName: suite)
        NameFixes.store = UserDefaults(suiteName: suite)!
    }
    override func tearDown() { UserDefaults.standard.removePersistentDomain(forName: suite) }

    func testDetectNewAndKnown() {
        let n = NameFixes.detectNames("I met a Sally Gallagher at the gym. Maya came too.", people: [P("Maya Chen")])
        XCTAssertTrue(n.contains("Sally Gallagher")); XCTAssertTrue(n.contains("Maya"))
    }
    func testNotFirstNameWhenOnlyFullSaid() {
        let n = NameFixes.detectNames("Caught up with Jordan Lee.", people: [P("Jordan Lee")])
        XCTAssertEqual(n, ["Jordan Lee"])
    }
    func testSplitNamesAccents() {
        XCTAssertEqual(NameFixes.splitNames("Met Tomás at a bar", names: ["Tomás"]), ["Met ", "Tomás", " at a bar"])
        XCTAssertEqual(NameFixes.splitNames("Tomás", names: ["Tomás"]), ["", "Tomás", ""])
        XCTAssertEqual(NameFixes.splitNames("Tomásx", names: ["Tomás"]), ["Tomásx"])
    }
    func testSaveAndApply() {
        NameFixes.saveFix(heard: "Jorden Lee", meant: "Jordan Lee")
        let r = NameFixes.applyFixes("Jorden said hi to Jorden Lee")
        XCTAssertEqual(r.text, "Jordan said hi to Jordan Lee")
        XCTAssertEqual(r.fixed.map(\.heard), ["Jorden Lee", "Jorden"])
        XCTAssertEqual(r.fixed.map(\.meant), ["Jordan Lee", "Jordan"])
    }
    func testSameSpellingDeletes() {
        NameFixes.saveFix(heard: "Jorden", meant: "Jordan")
        NameFixes.saveFix(heard: "Jorden", meant: "jorden")
        XCTAssertEqual(NameFixes.applyFixes("Jorden").text, "Jorden")
    }
    func testResolveName() {
        let ppl: [any Named] = [P("Maya Chen"), P("Jordan Lee"), P("Jordan Smith")]
        XCTAssertEqual(NameFixes.resolveName("maya", people: ppl), "Maya Chen")
        XCTAssertEqual(NameFixes.resolveName("Jordan", people: ppl), "Jordan")
        XCTAssertEqual(NameFixes.resolveName("jordan lee", people: ppl), "Jordan Lee")
    }
    func testOutlines() {
        let o = NameFixes.outlines("Founder at Voltcell, studied at MIT, lives in Brooklyn now.", people: [])
        XCTAssertTrue(o.contains("Voltcell")); XCTAssertTrue(o.contains("MIT")); XCTAssertTrue(o.contains("Brooklyn"))
    }
    func testRenamePersonAndCompany() {
        var fixed: [(heard: String, meant: String)] = []
        let ppl: [any Named] = [P("Jordan Lee")]
        let t = NameFixes.rename("Jorden Lee is great", name: "Jorden Lee", word: 0, typed: "Jordan", people: ppl, fixed: &fixed)
        XCTAssertEqual(t, "Jordan Lee is great")
        XCTAssertEqual(fixed.map(\.heard), ["Jorden Lee"]); XCTAssertEqual(fixed.map(\.meant), ["Jordan Lee"])

        var f2: [(heard: String, meant: String)] = []
        let c = NameFixes.rename("Founder at Voltsel.", name: "Voltsel", word: 0, typed: "Jordan", people: ppl, fixed: &f2)
        XCTAssertEqual(c, "Founder at Jordan.") // a company is never linked to a person: stays "Jordan", not "Jordan Lee"
    }
}
