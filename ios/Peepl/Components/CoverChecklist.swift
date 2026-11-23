import SwiftUI

/// The six things worth saying about someone (ONBOARDING.md 6b).
enum CoverRow: CaseIterable {
    case name, when, place, from, does, remember
    var title: String {
        switch self {
        case .name: "Name"
        case .when: "When you met"
        case .place: "Where you met"
        case .from: "Where they are from / live"
        case .does: "What they do"
        case .remember: "Something to remember or follow up"
        }
    }
}

enum CoverTicks {
    /// Ticks only ever grow within one Add session (speech streams interim text that can stop matching). Regex only: no AI, no network.
    static func update(_ ticked: Set<CoverRow>, text: String, people: [any Named], today: Date = Date()) -> Set<CoverRow> {
        let d = Capture.parsePerson(text, people: people)
        var t = ticked
        if d.name != nil { t.insert(.name) }
        if Capture.parseMetDate(text, today: today) != nil || Capture.parseLifeStage(text) != nil { t.insert(.when) }
        if d.met != nil { t.insert(.place) }
        if d.from != nil || d.lives != nil { t.insert(.from) }
        if d.does != nil || d.company != nil { t.insert(.does) }
        if d.remember != nil || d.goal != nil || d.follow != nil { t.insert(.remember) }
        return t
    }
}

struct CoverChecklist: View {
    let ticked: Set<CoverRow>
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Try to cover").font(Theme.font(13, .medium)).foregroundStyle(Theme.inkMuted)
            HStack(alignment: .top, spacing: 12) {
                column(Array(CoverRow.allCases.prefix(3)))
                column(Array(CoverRow.allCases.suffix(3)))
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10).frame(maxWidth: .infinity, alignment: .leading).glass(20)
        .sensoryFeedback(.impact(weight: .light), trigger: ticked.count) { old, new in old == 0 && new > 0 } // first tick only
    }

    private func column(_ rows: [CoverRow]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(rows, id: \.self) { r in
                let on = ticked.contains(r)
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: on ? "checkmark.circle.fill" : "circle").font(Theme.font(14))
                        .foregroundStyle(on ? Theme.ink : Theme.inkMuted)
                    Text(r.title).font(Theme.font(12)).foregroundStyle(on ? Theme.ink : Theme.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .animation(Motion.animation(Motion.snap, reduce: reduce), value: on)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(r.title), \(on ? "covered" : "not covered yet")")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
