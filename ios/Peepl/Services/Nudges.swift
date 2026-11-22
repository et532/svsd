import Foundation

/// Losing-touch nudge: who has gone quiet for longer than their closeness allows. On device only, no notifications.
enum Nudges {
    static let key = "peepl.nudgeSnooze"
    static let snoozeDays = 30

    static func threshold(_ closeness: Int?) -> Int {
        switch closeness { case 3: 30; case 2: 60; default: 120 }
    }

    private static var formatter: DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        return f
    }

    /// Whole local days from `iso` to `today`; nil if either is not a date.
    static func daysSince(_ iso: String, today: String) -> Int? {
        let f = formatter
        guard let a = f.date(from: String(iso.prefix(10))), let b = f.date(from: String(today.prefix(10))) else { return nil }
        return Calendar.current.dateComponents([.day], from: a, to: b).day
    }

    /// Most overdue first. A snoozed person stays hidden through their snooze day.
    static func due(_ people: [Person], today: String, snoozed: [String: String]) -> [Person] {
        people.compactMap { p -> (Person, Int)? in
            guard let d = daysSince(p.lastContacted, today: today) else { return nil }
            let over = d - threshold(p.closeness)
            if over < 0 { return nil }
            if let until = snoozed[p.id], today <= until { return nil }
            return (p, over)
        }
        .sorted { $0.1 != $1.1 ? $0.1 > $1.1 : $0.0.name < $1.0.name }
        .map(\.0)
    }

    static func load(_ d: UserDefaults = .standard) -> [String: String] { d.dictionary(forKey: key) as? [String: String] ?? [:] }

    static func snooze(_ id: String, today: String = Capture.today(), _ d: UserDefaults = .standard) {
        let f = formatter
        guard let t = f.date(from: today), let u = Calendar.current.date(byAdding: .day, value: snoozeDays, to: t) else { return }
        var all = load(d); all[id] = f.string(from: u); d.set(all, forKey: key)
    }

    static func clearSnooze(_ id: String, _ d: UserDefaults = .standard) {
        var all = load(d)
        if all.removeValue(forKey: id) != nil { d.set(all, forKey: key) }
    }
}
