import Foundation

/// Onboarding gate, step logic and the step 7 answers (ONBOARDING.md sections 2, 3.0, 3.7). Pure, so it is unit tested.
enum OnboardingState {
    static let doneKey = "peepl.onboardingDone"
    static let meetWhereKey = "peepl.meetWhere"
    static let skipKey = "PeeplSkipOnboarding" // launch argument -PeeplSkipOnboarding YES
    static let lastStep = 8
    static let coachKey = "peepl.firstRunCoachSeen"
    static let firstAddKey = "peepl.firstAddSeen"
    static let micPrimerKey = "peepl.micPrimerSeen"

    /// 6a: the coach shows once, only on an empty store, never in replay or over Add / Find / a profile.
    static func shouldCoach(defaults: UserDefaults = .standard, peopleCount: Int, layersEmpty: Bool, replay: Bool = false) -> Bool {
        !replay && peopleCount == 0 && layersEmpty && !defaults.bool(forKey: coachKey)
    }
    /// 6b: the checklist ends once three people are saved; observed at the end of a save.
    @discardableResult static func endCoverIfDone(peopleCount: Int, defaults: UserDefaults = .standard) -> Bool {
        if peopleCount >= 3 { defaults.set(true, forKey: firstAddKey) }
        return peopleCount >= 3
    }

    /// Replay (Settings) ends without touching any gate flag; a first run marks onboarding done. Step 7's answers are saved as they are picked.
    static func finish(replay: Bool, defaults: UserDefaults = .standard) {
        if !replay { defaults.set(true, forKey: doneKey) }
    }

    /// Section 5: contextual tips, each shown once, one at a time. Declared in priority order.
    static let tipsKey = "peepl.tipsSeen"
    enum Tip: String, CaseIterable {
        case askBar, mindmapDot, reachOut
        var message: String {
            switch self {
            case .askBar: "Ask in your own words, like climbing buddy."
            case .mindmapDot: "Tap a dot to see who they know."
            case .reachOut: "These are people you have not talked to in a while."
            }
        }
    }
    struct TipContext {
        var people = 0, mindmapTab = false, layersEmpty = true, replaying = false, coachShowing = false, onboardingShowing = false, reachOutVisible = false
    }
    /// The tip to show now, or nil. Never over Add / Find / a profile, during a replay, the coach or onboarding; a tip already seen is never offered again.
    static func tipToShow(_ c: TipContext, defaults: UserDefaults = .standard) -> Tip? {
        guard c.layersEmpty, !c.replaying, !c.coachShowing, !c.onboardingShowing, !defaults.bool(forKey: skipKey) else { return nil } // the skip flag is the UI tests': a tip would cover their buttons
        let seen = defaults.stringArray(forKey: tipsKey) ?? []
        return Tip.allCases.first { t in
            guard !seen.contains(t.rawValue) else { return false }
            switch t {
            case .askBar: return c.people >= 1
            case .mindmapDot: return c.mindmapTab && c.people >= 2
            case .reachOut: return !c.mindmapTab && c.reachOutVisible
            }
        }
    }
    static func markTipSeen(_ t: Tip, defaults: UserDefaults = .standard) {
        defaults.set(Array(Set((defaults.stringArray(forKey: tipsKey) ?? []) + [t.rawValue])).sorted(), forKey: tipsKey)
    }

    /// Evaluated once at launch. People already on the phone mean done, silently, so deleting everyone later does not bring it back.
    static func shouldShow(defaults: UserDefaults = .standard, peopleCount: Int) -> Bool {
        if defaults.bool(forKey: doneKey) { return false }
        if peopleCount > 0 { defaults.set(true, forKey: doneKey); return false }
        return !defaults.bool(forKey: skipKey)
    }

    // Acts: The story (steps 1 to 4), Learn by doing (5, 6), Make it yours (7, 8); bar segments are 4 : 2 : 2.
    private static let acts: [(title: String, steps: ClosedRange<Int>)] = [("The story", 1...4), ("Learn by doing", 5...6), ("Make it yours", 7...8)]
    static func actTitle(step: Int) -> String { (acts.first { $0.steps.contains(step) } ?? acts[0]).title }
    static var segmentWeights: [Double] { acts.map { Double($0.steps.count) } }

    /// How full each of the three segments is at `step`.
    static func progressFractions(step: Int) -> [Double] {
        acts.map { a in
            step > a.steps.upperBound ? 1 : step < a.steps.lowerBound ? 0 : Double(step - a.steps.lowerBound + 1) / Double(a.steps.count)
        }
    }

    static func next(_ step: Int) -> Int { min(lastStep, step + 1) }
    static func back(_ step: Int) -> Int { max(1, step - 1) }
    static func skip(_ step: Int) -> Int { lastStep } // never past the privacy promise
    static func canBack(_ step: Int) -> Bool { step > 1 }
    static func canSkip(_ step: Int) -> Bool { (2...7).contains(step) }
}

/// Step 7 answers; raw values are what `peepl.meetWhere` stores. Wiring the texts into Add / Find comes later.
enum MeetWhere: String, CaseIterable {
    case events, coffee, campus, community, newcity

    var chip: String {
        switch self {
        case .events: "Conferences and work events"
        case .coffee: "Coffee chats"
        case .campus: "Classes and campus"
        case .community: "Local community"
        case .newcity: "A new city"
        }
    }
    var addPlaceholder: String {
        switch self {
        case .events: "Who did you meet at the event?"
        case .coffee: "Who did you have coffee with?"
        case .campus: "Who did you meet in class?"
        case .community: "Who did you meet in your community?"
        case .newcity: "Who did you meet in your new city?"
        }
    }
    /// Replaces Find's "Occasion" example card: what the card shows, and a query the offline rules can answer.
    var findCard: (shown: String, query: String) {
        switch self {
        case .events: ("Someone I met at a conference", "conference")
        case .coffee: ("Someone to catch up with over coffee", "coffee")
        case .campus: ("Someone from my classes", "class")
        case .community: ("Someone from my neighborhood", "neighborhood")
        case .newcity: ("Someone who knows this city", "city")
        }
    }
    static let defaultPlaceholder = "Who did you meet?"

    static func saved(_ defaults: UserDefaults = .standard) -> [MeetWhere] {
        (defaults.stringArray(forKey: OnboardingState.meetWhereKey) ?? []).compactMap(MeetWhere.init)
    }
    static func save(_ picks: [MeetWhere], _ defaults: UserDefaults = .standard) {
        defaults.set(picks.map(\.rawValue), forKey: OnboardingState.meetWhereKey)
    }
}

/// 6f: what the Composer's mic does in Add. `undetermined` / `denied` come from the system status.
enum MicPrimer {
    enum Action { case primer, deniedLine, listen }
    static func action(seen: Bool, undetermined: Bool, denied: Bool) -> Action {
        denied ? .deniedLine : (undetermined && !seen) ? .primer : .listen
    }
}
