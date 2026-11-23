# O3-T4 validation: PASS with notes

Branch task/O3-T4 @ 7db2dbe, fresh worktree, own derivedDataPath, iPhone 18 Pro.

Tests
- Scheme Peepl (unit): 205 tests, 1 skipped, 0 failures (second run). First run was cut off mid SearchTests.testSelfRetrievalRecall (session ended, no failure line; that suite passes alone, 10 s, and in the full rerun).
- Scheme PeeplUI: TEST SUCCEEDED, 18 test cases passed, none failing. Includes M5FlowUITests.testProfileTodoTagConnectionsDelete and testMomentWithSomeoneYouKnowOpensExpanded, and AddAnotherUITests.

Files: all 14 changed files are on the allowed list except two accepted deviations (ProfileView.swift, OnboardingFlow.swift). No em dashes in added lines.

Read checks
- Plop on Add close: MindmapView.consumeAdded guards nav.layers.isEmpty, runs on appear and on layers change. OK. Queue 0.35 s, cap 3 (4th+ fade only, full=false). OK, unit tested.
- ForceGraph seeds new node at mutual centroid +24 pt, two passes, spiral if no mutuals. OK.
- Reduce Motion: 0.2 s fade, no rings, no nudge, links fade. OK (pure Plop funcs, tested).
- Nudge goes through float spring velocity, layout untouched. OK.
- Replay: finish(replay:) writes nothing; test asserts no peepl.* key written. Settings row "How Peepl works" opens OnboardingFlow(replay: true). OK. (meetWhere is written by step 7 as picked, per code comment, not by finish.)
- Tips: once via peepl.tipsSeen, one at a time, blocked by layers/replay/coach/onboarding, 700 ms delay rechecked at fire time. OK.

Notes (not blockers)
1. Weakened test: M5FlowUITests.testMomentWithSomeoneYouKnowOpensExpanded no longer asserts the "New moment saved" toast (justified as a timing issue). Profile assertions still prove the save, but the toast is now untested.
2. Brief item 5 UI tests (a) onboarding Get started and (b) Skip path were not added in this branch; OnboardingUITests.swift exists from T3 and passes, so likely covered, but not new here. Add-another unit test covers only the AddSession struct, not the view. "Add closes on X or Done": no Done button (accepted).
3. Tips are suppressed only with -PeeplSkipOnboarding; UI tests that seed people without that flag could see a tip, though all passed. Tip behaviour has no UI test.
4. "Selection reset limitation" from the brief is not mentioned in the builder report (grep found nothing).
5. ProfileView delay 450 -> 1500 ms is a timing patch: it only widens the race between the profile layer's exit animation and PeopleStore.delete, and it can still fail under a slow device or Reduce Motion off with a long spring, and it leaves the deleted person around for 1.5 s (a quick relaunch or app kill in that window loses the delete). Safer: delete when the profile layer actually disappears (onDisappear of the layer or after nav.forget completes), or make ProfileView.body guard on person.isDeleted / modelContext == nil and render nothing, or snapshot the needed fields before deleting. Not verified which crash trace the builder saw.
