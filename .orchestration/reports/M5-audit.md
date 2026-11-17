# M5 audit: what the web prototype does that the native app did not

Walked every web screen (`src/Prototype.tsx`, `ListScreen`, `MindmapScreen`, `CaptureScreen`, `AskScreen`,
`ProfileScreen`, `Composer`) against the Swift in `ios/Peepl` as it was on `main` (after M4).
Status: **fixed** (in this branch), **already worked** (checked, now covered by a UI test), or **left** (with why).

## Shell (tabs, ask bar, layers)

| # | Gap | Status |
|---|---|---|
| S1 | The ask bar's mic did the same as tapping the text (web: opens Find already listening) | fixed: `Layer.find(voice:)`, the mic is its own button ("Ask by voice"), Find's Composer starts listening |
| S2 | No "View connections" focus and no "← Name" pill back to the profile | fixed: `Nav.focus`, `Nav.viewConnections`, night pill above the ask bar; changing tab or opening Find clears it, as on the web |
| S3 | A profile layer whose person no longer exists was a blank screen with no way out | fixed: the layer removes itself |
| S4 | Find's "Show all N" pill above the ask bar, cleared with × | already worked |
| S5 | App opens on Connections; the web opens on the Mindmap | left: not a missing function, and the list is the cheaper first screen on a phone. Human's call |

## Connections list

| # | Gap | Status |
|---|---|---|
| L1 | Nothing shown for a user with zero people | fixed: "No one here yet" + **Add someone** (opens Add) |
| L2 | A new person with no job / city read "· Unknown" | fixed: `Person.subtitle` drops the missing parts (list row and profile hero) |

## Mindmap

| # | Gap | Status |
|---|---|---|
| M1 | Tapping the name pill opens the profile | already worked |
| M2 | `nav.showFilter` narrows the map | already worked |
| M3 | A profile's "View connections" selects and flies to that person (everyone shown, filter ignored) | fixed: `MindmapView.focusNav` |
| M4 | Empty state was a bare "No one to show." | fixed: same empty state as the list |

## Person profile

| # | Gap | Status |
|---|---|---|
| P1 | "Things to do with X" only showed when there were to-dos | fixed: always shown; tap ticks off, saved |
| P2 | No "Add something to do" | fixed: the row turns into a field; Return saves, leaving it saves if there is text |
| P3 | No "+ tag" | fixed: inline field, saved lower-cased, no duplicates, up to 4 ideas from other people's tags |
| P4 | Mutuals only showed when there were some; no dashed **Add**, no **View connections**, no captions | fixed: all three (`mutualNotes` captions under the name) |
| P5 | Add under Mutuals | fixed: opens Add headed "Who does X know?", the note is always someone new (it used to be able to turn into a moment), linked both ways |
| P6 | Moments: every first meeting was titled "First meeting", no date, text and voice note not told apart, no play | fixed: real title, "Today" / "Oct 22", text + note, a voice note "plays" (transcript fills in along the waveform, as on the web; there is no audio on either), one open at a time, blue border on the open one |
| P7 | A moment logged from Add did not open expanded on the profile | fixed: `Nav.fresh` |
| P8 | ⋯ was a "Coming soon" toast | fixed: **Delete person** with a confirmation; removes their moments, to-dos and every link and caption other people have to them. Nothing else in that menu (orchestrator's addition; the web's ⋯ is a stub) |
| P9 | The profile Composer's mic had no name outlines | fixed: it gets `people`, so voice notes there are outlined and fixable like in Add |
| P10 | "Add a moment" saves any text as a moment | left on purpose: same as the web. The title rule already matched (`draft.what ?? "New moment"`: the first sentence, cut at 44 characters) |
| P11 | To-dos are ordered by id, so one you add can land between older ones (web: at the end) | left: SwiftData relationships have no order and fixing it needs a new stored field (a schema change); cosmetic |

## Add

| # | Gap | Status |
|---|---|---|
| A1 | Names / company / school / places were only outlined after voice, not while typing | fixed: `NameOutlines` draws the outlines under the field as you type (SwiftUI `TextRenderer`, the web's invisible mirror). Limit: past 6 lines the outlines follow the end of the note only |
| A2 | The "microphone access is off" message was the placeholder, so it was invisible once text was typed | fixed: its own line above the field |
| A3 | A comma after an outlined name could wrap alone onto the next line | fixed: whatever is glued to a name ("Voltcell,") is laid out as one piece with it |
| A4 | One / several new people, "Which Jordan…?", "Neither", existing name reused | already worked |

## Find

| # | Gap | Status |
|---|---|---|
| F1 | Example cards ask their question | already worked |
| F2 | Draft opens inline, editable; Copy Text / Share; toast; ticks off the to-do it answers | already worked (now UI-tested: copy on the hardware intro ticks Jordan's "Intro to someone in hardware") |
| F3 | "Show all N in your list / on the mindmap" | already worked |
| F4 | No match: "…so I won't guess", "Closest, but not quite", **Add someone new** -> Add | already worked |
| F5 | "add someone" -> Add, "log a moment" / "open X" -> profile | already worked |
| F6 | Find's mic | already worked (and S1) |
| F7 | Web's "Still reading your moments (38%)…" slow-search state | left: not needed natively, the sample people's vectors ship in the app (`vectors.json`) and new text is embedded on the device in well under the 4 s that triggers it |

## Data

| # | Gap | Status |
|---|---|---|
| D1 | All 500 sample people shown (web: a diverse 200) | fixed: Swift port of `pickDiverse` (`Logic/Diverse.swift`), checked against the web function's own output on the same `seed.json` (identical 200, same order). 200 + Jordan Lee = 201, links to people left out dropped, the web's `keep` people always in, the three demo answers tested on the 201 |
| D2 | An install that already holds all 500 (the human's phone) | fixed: once, the sample people outside the 200 are removed, **unless you added a moment or to-do to them**. Needs the human to know: see report |
| D3 | Deleting everyone brought the sample people back on the next launch | fixed: the seed runs once per install |

## Not built (out of scope by the brief)

Backup export / import, endpoint authentication, Supabase, Geist fonts, aura backgrounds, the circular reveal, haptics, app icon.

## Verification pass (second agent, 2026-11-16)

Unit 112 / UI 15 on `Peepl-M4`, all passing. Every "fixed" row above was checked against the code and against the UI test or screenshot that covers it; none was found wrong in the app. What changed:

- Three UI tests were wrong, not the app: (1) "Back to Jordan" sits at the same screen spot as the 4th to-do of a freshly pushed profile, and the synthesized tap also reached that to-do (it flipped "Intro to Priya" back to To do); the test now ticks the 3rd to-do. (2) With `-findQuery` every Find re-asks "open Jordan Lee" on its own, so a typed question in the second Find was ignored; and "open Jordan Lee" with Jordan gone opens **Jordan Smith** (a first name alone matches, as on the web). (3) The mutual cell for Jordan on Rae's profile reports not-hittable to XCUI, so it is tapped by coordinate.
- P8: the UI test no longer opens Aisha to look for a stale mutual (she is not on screen in the list); "every link to the deleted person goes" is covered by `PeopleStoreTests.testDeletePersonTakesTheirThingsAndEveryLinkToThem`.
- L2: `Person.subtitle` now has a unit test (`testSubtitleDropsWhatANewPersonLacks`).
- `M5-debug.png` was scratch and is deleted.
- M3 / F3 "Show all" on the mindmap: the filter pill and the narrowed list are verified, but `M5-show-all-mindmap.png` shows **no dots**. Cause: the two climbers are unlinked, the layout pushes them ~1600 world px apart, and `fitZoom` 1.6 (same constant and formula as the web's `FIT_ZOOM`) puts both just off the edges of the screen. Same behaviour as the web, so left; a human call whether a 2-person filter should fit tighter.
- `M5-find-closes-todo.png` shows the profile with the keyboard up, not the ticked to-do; the tick itself is asserted in the test.

### Figma match (profile, Find, Add)
Compared with the "FINAL DESIGN" page (frames 2.6, 6.4, 2.2b): profile hero is now left-aligned (88 pt avatar, name beside it, ~233 pt tall); section labels are small uppercase mono; to-dos are one card split by hairlines with no tick circles (done = strikethrough); Find's Draft button is full width; Add's idle heading sits lower. Not matched: Geist font, grain texture, Find heading size/colour, "Show all" (in the app, not the frame), moment-quote "why" text.
Note: screenshots are only written when the variable is passed as `TEST_RUNNER_M5_SHOT_DIR`; the `M5_SHOT_DIR` runs earlier in this round did not overwrite anything, so `M5-show-all-mindmap.png` was not re-taken after `sleep(8)`. The off-screen-dots finding rests on a throwaway unit test (nodes ±797 world px at k 0.288), not on that screenshot.
