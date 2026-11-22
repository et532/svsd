# Task mvp1-w7: Losing-touch nudge
Owner: lead   Builder: sonnet
Branch task/mvp1-w7 from main (`git checkout -B task/mvp1-w7 main` in your worktree). Read .orchestration/briefs/_rules.txt and PLAN.md 12.3 W7 first.
Goal: remind the user to reach out to people they have not talked to in a long time. 100% on device. NO notifications (decided out of MVP).
Files you may touch: ios/Peepl/Services/Nudges.swift (new), ios/PeeplTests/NudgesTests.swift (new), ios/Peepl/ConnectionsView.swift, ios/Peepl/Screens/ProfileView.swift, ios/Peepl/Services/PeopleStore.swift (only to reset the snooze in addMoment and add `talkedToday`).
Do not touch: SettingsView.swift, Backup.swift, AIClient.swift, Logic/LocalAI.swift, anything else.
Spec:
- Nudges.swift, pure logic: `Nudges.due(people, today:, snoozed:) -> [Person]` (most overdue first). Threshold by closeness: 3 = 30 days, 2 = 60, 1 or nil = 120. Days since `lastContacted` ("yyyy-MM-dd", local day via Capture.today style, NOT UTC; take `today` as a parameter so tests are deterministic; unparseable date = not due). Per-person snooze: `[id: untilISODay]` stored in UserDefaults (key `peepl.nudgeSnooze`), snooze = 30 days; a snoozed person is not due until that day passes. Helpers: `snooze(id)`, `clearSnooze(id)`.
- PeopleStore: `talkedToday(person, in:)` sets lastContacted = Capture.today(), clears snooze, saves (does NOT change closeness). `addMoment` also clears the snooze (it already sets lastContacted).
- Connections: a "Reach out" section at the top of the list (above all rows, hidden when empty, hidden when a showFilter is active) listing due people (cap 5, same Row look, with a small dot) and a small dot on the row of any due person in the main list. Keep the existing glass style and Theme tokens; honor Reduce Motion like the surrounding code.
- Profile: when the person is due, show a small "Haven't talked in N days" card with "Talked today" and "Snooze 30 days" buttons; also a "Talked today" action reachable when not due (e.g. in the existing menu or a plain button near the top of the content; keep it small). Toast via nav.say("Marked as talked today").
- Tests (NudgesTests): thresholds at 29/30/31, 59/60/61, 119/120/121 days for closeness 3/2/1 and nil; snooze hides then expires; unparseable date not due; talkedToday and addMoment clear snooze and make the person not due; local-day (a today passed in is used, not Date()).
Acceptance: `cd ios && xcodegen generate && xcodebuild test -project Peepl.xcodeproj -scheme Peepl -destination 'platform=iOS Simulator,name=Peepl-MVP1' -derivedDataPath build 2>&1 | tail -40`: all existing tests plus new ones pass. Report the test counts. Commit the listed files on the branch (not ios/build, not the xcodeproj).
Validator should also check: standard checks; nothing network or notification related added; local-day logic.
If blocked: stop and report. Do not guess at scope changes.
