import XCTest
import SwiftData
@testable import Peepl

@MainActor
final class DiverseTests: XCTestCase {
    /// What the web's pickDiverse (src/lib/diverse.ts) picks from the same seed.json, without Jordan Lee, in seed order.
    static let web = "maya-chen daniel-okafor aisha-khan kenji-watanabe tom-becker lucas-silva hannah-cohen emma-wright noah-patel ana-ruiz jordan-smith zara-ahmed dana-reyes theo-park nina-volkov mei-lin ben-adler yusuf-demir ines-moreau rohan-mehta sasha-ivanova caleb-foster mia-tanaka owen-murphy elena-rossi jamal-washington anika-rao olivia-grant nora-lindqvist hana-yoshida yeh-yeh-lin frank-wu kevin-wu mikey-russo priscilla-okonkwo karen-halvorsen kofi-mensah sana-qureshi marcus-ellison raymond-zhou amy-castellanos jerome-baptiste meera-iyer colin-murphy noelia-vasquez greta-hoffman tommy-nguyen dana-whitaker shira-katz devon-clarke elise-park mohammed-rahman sofia-bianchi adam-brodsky rebecca-lindgren valeria-santos tessa-wolfe priya-menon tomas-herrera keisha-williams bryn-abbott dani-moreno sunita-rao paul-everett ty-nakamura finn-oliver june-park chloe-bernard isabel-correa wes-tran anil-sethi gabriela-ruiz anna-kowalski marcus-tillman fatima-hassan dalia-mansour rob-castellan jasper-wu cora-bellamy manny-ortiz ben-sorensen monique-laurent samuel-oduya claire-dumont danny-kowalczyk rhea-kapoor hank-ostrander garrett-boyle mina-takeda marguerite-bloom katie-sullivan dolores-whitman hamza-siddiqui terrence-walsh gwen-ashford lakshmi-ramaswamy hector-moreno ruth-vandermeer emma-ostrowski kiran-bhatia lauren-voss ben-hartley kareem-abdi luca-bianchi jon-yoon yuki-hayashi trevor-banks gloria-nakamura warren-kessler ayesha-malik tyrone-banks lars-bergman manuela-ortiz alisha-barnes petr-novak sven-eriksson thandi-mokoena andy-chavez rosalind-greer mateo-fuentes ahmed-farouk lou-marchetti raymond-liu hugo-beaumont eleni-petrakis tamsin-okoro jules-amato rin-matsuda benji-stern dmitri-sokolov luis-ferreira imani-brooks nadia-rahimi oscar-whitfield lucy-braun francesca-marino rafael-cruz harlan-boyd bea-lopez adrian-voss samir-chaudhry kenneth-ho odessa-wright gideon-reyes maxine-cho zadie-hamilton victoria-ng bastien-leclerc daisy-okonkwo gigi-laurent otis-whitmore emanuel-grant marcel-dupont wendell-price margot-ellis hamid-karimi tobias-greene anselm-richter chinwe-adeyemi dario-bianchi tarek-saleh marcus-whitlock linnea-berg finley-ross gabriel-sousa noah-berkowitz devika-rao sakura-ito hassan-farah clara-ibanez jamal-henderson maxwell-gray anders-hagen freya-lindgren octavio-ramos yeh-yeh-friend-chang noa-levi hugo-castellanos brooke-hammond ricky-tran elodie-marchand darius-moore camila-bruno ethan-lee rhiannon-davies michael-obi jenna-moreno luka-horvat nell-baxter anya-petrenko oscar-lindqvist miguel-santana naomi-ibe duncan-fraser elena-sokolov pablo-herrera ola-bakare petra-hudson mateus-lima ruth-adeyinka"

    let all = PersonInfo.sample()
    var now: Date { ISO8601DateFormatter().date(from: "2026-11-16T12:00:00Z")! }

    func testSameTwoHundredAsTheWeb() {
        let picked = Diverse.pick(all.filter { $0.id != "jordan-lee" }, n: 200, keep: Diverse.keep).map(\.id)
        XCTAssertEqual(picked, Self.web.split(separator: " ").map(String.init))
    }

    func testKeepAndOrder() {
        let few = Diverse.pick(Array(all.prefix(50)), n: 5, keep: [all[40].id])
        XCTAssertEqual(few.count, 5)
        XCTAssertTrue(few.contains { $0.id == all[40].id })
        XCTAssertEqual(few.map(\.id), all.prefix(50).map(\.id).filter(Set(few.map(\.id)).contains)) // original order
        XCTAssertEqual(Diverse.pick(Array(all.prefix(3)), n: 10).count, 3) // fewer people than asked for
    }

    /// The three demo answers still hold on the 201 people the app shows.
    func testDemoAnswersOnShownPeople() {
        let ids = Seed.shownIds(all)
        XCTAssertEqual(ids.count, 201)
        let shown = all.filter { ids.contains($0.id) }.map { p -> PersonInfo in var p = p; p.knows = p.knows.filter(ids.contains); return p }
        func answer(_ q: String) -> PeopleAnswer {
            guard case .people(let a) = Ask.interpret(q, people: shown, now: now) else { XCTFail("not people: \(q)"); return PeopleAnswer(title: "", matches: []) }
            return a
        }
        XCTAssertEqual(answer("I want to find someone to go climbing with me").matches.map(\.id), ["jordan-lee", "zara-ahmed"])
        let sf = answer("I’m traveling to SF next month. Who can I grab a coffee with?")
        XCTAssertGreaterThanOrEqual(sf.matches.count, 3)
        for m in sf.matches { XCTAssertEqual(Places.of(m.person)?.metro, "bay", m.person.name) }
        let hw = answer("I just met a founder looking for a hardware engineer. Who can I introduce?")
        XCTAssertEqual(hw.groups?[0].matches.first?.id, "ana-ruiz")
        XCTAssertTrue(hw.groups?.first { $0.label == "One step away" }?.matches.map(\.id).contains("aisha-khan") ?? false)
    }
}
