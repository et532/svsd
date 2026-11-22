# Validation: onb-spec-v4

Verdict: PASS (with minor notes)

- Diff vs main: only ONBOARDING.md (343 insertions, 101 deletions).
- Em dash count: 0. No "Part x of 3" or replay button except as negations; "Try it" appears only as the removed v3 step.
- 8 steps each have heading, copy, timed storyboard, 3D note, reused real views (3.1 to 3.8). Step 1 keeps Restore; Skip goes to 8; Replay ends on Done and writes only peepl.meetWhere; new keys firstRunCoachSeen / firstAddSeen; micPrimerSeen kept.
- Motion spec: "Peepl motion spec" table embedded in section 4. 17 table rows, identical to the research note's 17 rows (comm diff empty).
- Past-date table: 24 rows, display rule stated, parseMetDate / parseLifeStage specified; Moment.date reader audit listed.
- Plop (6e) names files and hard bits. Contacts import in open items. Build tasks T1 to T4 present, with acceptance checks.
- Code claims spot-checked: ProfileView.metDate (line 28, prefix(10) parse) and Capture.parsePerson / today() exist as cited. `lifeStage` and `justAdded` not found by my grep (the grep for lifeStage failed on a glob, so not verified); justAdded is new by design.

Notes (minor)
1. The embedded motion rules still say demos "hold with a Replay option". That conflicts with the no-replay decision. Add a line to the spec saying it does not apply to onboarding.
2. 6c shows "Met in college" using seed lifeStage values as display text (already listed as an open item).
3. Not verified: whether Person.lifeStage exists in Models.swift, and the line numbers cited for readers of Moment.date.
