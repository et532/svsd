# Peepl iOS: data safety and everyday features

Written 2026-11-26 from the code on `main`. **Status: proposed, nothing built.** Covers batches 1 and 2.

## 1. Scope

| # | Item | Phase |
|---|---|---|
| A | Bug: a note about an existing name is thrown away | 2 |
| B | Bug: mutuals found in a note are linked one way only | 2 |
| C | Bug: Settings text understates what OpenAI receives | 2 |
| D | Versioned saved data and backup format | 1 |
| E | Edit a person | 3 |
| F | Edit and delete moments, to-dos and tags, with undo | 3 |
| G | Link and unlink mutuals | 3 |
| H | Past dates for moments | 4 |
| I | Reminder frequency per person | 4 |
| J | Birthdays and important dates | 4 |
| K | Name search on Connections | 5 |
| L | All to-dos in one place | 5 |
| M | Merge duplicates | 5 |

**Not in scope:** the web app, notifications, Contacts import, sync, accounts, Face ID, widgets, Siri, photos, parsing birthdays from notes.

## 2. Ground rules

- Branch `features-v2` off `main`. One commit per phase. No push (the repo is public; that is a separate decision).
- Built one phase at a time in one session: most items touch `ProfileView`, `PeopleStore`, `Models` or `ConnectionsView`, so parallel builders would collide.
- No new dependencies. Reuse the existing styles (`.glass()`, `Theme`, `PressStyle`, `Motion`) with Reduce Motion fallbacks and accessibility labels.
- Nothing new is sent to OpenAI.
- A phase is done only when its new tests pass, **all** earlier tests pass, and its screens have been looked at in the Simulator.
- Existing tests change only where behavior changes on purpose, and each such change is listed here.

## 3. Decisions (defaults; change any before the phase starts)

| Question | Default |
|---|---|
| Note names someone you have | Ask: **Add to their profile** or **New profile**. Adding does not reset the reach-out clock. |
| Same case inside a several-person note | Add that part to the existing profile and say so on the result screen |
| Delete a moment, to-do or tag | No confirmation; **Undo** for 5 seconds (longer with VoiceOver) |
| Delete a person, or merge | Confirmation, no undo |
| First-meeting moment | Can be edited, not deleted (the "Met" date comes from it) |
| Past dates read from a note | First sentence only; conservative phrases; the toast shows the date used |
| Reminder choices | Auto (today's 30 / 60 / 120 days), 2 weeks, 1 month, 3 months, 6 months, Never |
| Birthdays | Month and day, year optional; shown 14 days ahead; 29 Feb shows on 28 Feb in other years |
| Find's "who haven't I talked to" | Unchanged (its own 45-day rule), except it skips "Never" |
| Merge conflicts | The profile you keep wins; the other fills blanks |

## 4. Phases

### Phase 0: safety net (before any model change)

1. With your OK, commit the pending docs (`.gitignore`, `CLAUDE.md`, `DECISIONS.md`, `ROADMAP.md`, this file), then branch.
2. Run the full unit and UI suites and record the baseline. The UI tests have not run since the Find and consent changes, so fix anything already red first.
3. **Capture "old app" fixtures from unchanged code:** a SwiftData store (`.store`, `-wal`, `-shm`) and a version 1 backup JSON, both holding people with every field filled, moments, to-dos and mutuals (one of them one-way). Save in `ios/PeeplTests/Fixtures/` and make `project.yml` copy them as test resources.
4. Build the current app into its own derived-data folder, kept for the upgrade test in phase 6.

**Done when:** baseline is green and both fixtures load in the current code.

### Phase 1: data layer (all schema changes at once)

**`Models.swift`**
- `SchemaV1` (frozen copy of today's three models) and `SchemaV2`, with a lightweight migration plan and type aliases so other files don't change.
- New on `Person`, all optional or defaulted: `updatedAt`, `remindEveryDays` (nil = auto, 0 = never), `metDateUnknown`, `removedItemIds`.
- New model `KeyDate` (id, label, month, day, year?), cascade-deleted with its person.

**`PeeplApp.swift`:** build the container with the migration plan. If it fails, show an error screen. **Never delete or recreate the store.**

**`PeopleStore.swift`:** move every change to a person here (tags, to-dos, ticking, including `FindView.sent`), so each one sets `updatedAt`.

**`Backup.swift`:** version 2.
- New fields are optional, so version 1 files still restore.
- Merge picks the newer `updatedAt`; a side that has one beats a side that doesn't; if neither has one, today's rule applies.
- Merge never brings back an id in `removedItemIds`.
- Known limit: merging an old file can still bring back a deleted or merged-away **person** (true today as well).

Why `updatedAt` matters: Merge judges "newer" by last contact and moment count. Once editing and deleting exist, that would let an older backup overwrite your edits or restore a moment you deleted.

**Tests (`MigrationTests`, extended `BackupTests`)**
- The old store opens in the new schema with every field, relationship and order intact.
- Reopening twice changes nothing.
- A version 1 backup restores (Merge and Replace); version 2 round-trips every new field.
- An edit on the phone survives merging an older file; a deleted moment stays deleted.
- Damaged and future-version files are still refused with nothing changed.

**Done when:** migration works from the fixture. If the explicit plan can't open an unversioned store, fall back to automatic lightweight migration and record that in `DECISIONS.md`.

### Phase 2: fix the three bugs

**A. Lost note.** `createPerson` stops silently reusing a name. Add `PeopleStore.matches(name:)` (ignores case and accents). `AddView` checks after parsing and shows the chooser; "Add to their profile" saves a moment plus any follow-up (and the mutual link, from a profile's Add). `AddMany` follows the several-person default.
Changed test: `testSameNameTwiceIsNotDuplicated`.

**B. One-way mutuals.** Write both directions for every mutual found in a note, and repair existing data once at launch (safe to run twice).

**C. Settings text.** OpenAI footer: "short facts about everyone in your list". Check `Speech.swift`, then make the About line state exactly when voice can leave the phone.

**Tests:** note saved for an existing name by each route (single, several-person, from a profile); two people with one name can exist; links are two-way after create and after repair. UI: the chooser, both buttons.

### Phase 3: correct your data

**Undo (first).** `Nav.say` gains an Undo button. A delete only hides the item; it is really deleted when the toast ends, another delete starts or the app goes to the background. If the app is killed first, the item comes back. This also avoids the crash seen before when a screen reads a deleted record.

**Profile menu.** Replace the trash button with a menu: Edit, Merge (phase 5), Delete. Keep the identifier `More`.
Changed test: the delete steps in `testProfileTodoTagConnectionsDelete`.

**E. Edit a person** (new `EditPersonView`): name (required), job, from, met at, lives now, story, closeness. Save and Cancel; Cancel with changes asks first. A place is rebuilt only if its city changed. The id never changes, so the avatar stays.
- `MindmapView` only resyncs when ids or links change, and `MindmapModel.sync` skips regrouping then. Both must also react to names and group values.
- Check Find results behind an edited profile; they hold copies and may show old text.

**F. Items.** Long-press a tag (Remove), a to-do (Edit, Delete) or a moment (Edit: title, note, date; Delete). Deleting or re-dating the moment that set "last talked" moves that date back to the newest remaining moment. Editing the first-meeting date clears `metDateUnknown`.

**G. Mutuals.** The Add circle offers **Someone new** (today's flow) or **Someone you know** (searchable picker). Long-press a mutual to remove it, both directions, with its note, with undo.
Changed test: `testAddMutualLinksBothWays`.

**Tests:** each edit persists after relaunch; undo restores; expiry deletes; background commits; unchanged places keep coordinates; last-contact recalculation; unlink removes both sides. UI: edit a person and see the list, profile and mindmap update; delete and undo each item type.

### Phase 4: dates and reminders

**H. Past dates** (`Capture.parseMomentDate`): yesterday, last night, day before yesterday, N days / weeks / months ago, last week, last month, last Tuesday. Never a future date. "Last talked" only moves forward, and the snooze clears only if it moved. Creating a person keeps today's behavior.
Tests include traps: "ask about her trip last year" (second sentence), "see him next week", month and year boundaries, 1 January.

**I. Frequency.** `Nudges` reads `remindEveryDays` before closeness. A "Remind me" row on the profile. Tests: each choice, Never, back to Auto, interaction with snooze.

**J. Important dates.** A Dates section on the profile (add, edit, delete with undo) and **Coming up** on Connections (next 14 days, 5 at most). A pure function computes the next occurrence.
Tests: today, tomorrow, year wrap, 29 February, optional year; deleted with the person; in backups; **absent from what `AIClient.facts` sends**. UI: add a date for today and see it under Coming up.

### Phase 5: find and tidy

**K. Name search.** A field under the Connections title; ignores case and accents; hides Reach out and Coming up while typing; "No one named…" state. Check the keyboard against the bottom bar.

**L. All to-dos.** A button in the Connections header opens a page of open to-dos grouped by person: tick, or tap through to the profile. Slides in like a profile (generalize `Layer.isProfile`). Empty state.

**M. Merge.** Profile menu, Merge with…: likely duplicates first (same name, or a first name matching a full name), then everyone. The confirmation says which profile is kept.
- Move moments, to-dos and dates **before** deleting the other profile, so the cascade can't take them.
- Union tags and mutuals; rewrite everyone else's links and mutual notes; no self-links.
- Join differing stories; keep the earlier first meeting (the other becomes an ordinary moment); take the newer last contact and higher closeness.
- Remove the other profile from navigation before deleting it.

**Tests:** search matching; to-do ordering and ticking; merge with overlapping and empty fields, mutual-of-each-other, shared third person, counts before equal counts after, survives relaunch and backup. UI: one flow each.

### Phase 6: full verification

| Check | How |
|---|---|
| All unit and UI tests, twice in a row (catches flakiness) | `xcodebuild test`, both schemes |
| **Upgrade over the old app** | Fresh simulator: install the phase 0 build, add people, moments, links and a backup; install the new build over it; compare every profile |
| Old backup into new app | Restore the phase 0 file, Merge and Replace |
| Screens | Screenshot every new and changed screen on iPhone 18 Pro |
| Small and large screens | iPhone 17e and 18 Pro Max |
| Large text | `xcrun simctl ui <udid> content_size accessibility-extra-large`, then restore |
| VoiceOver labels | UI tests find every new control by label; actions behind a long-press also get accessibility actions |
| Reduce Motion | Code check that each new animation goes through `Motion`; on screen if the Simulator allows setting it |
| 200 sample people | Search typing, to-dos, mindmap after edits and merge |
| Crashes | No new reports in `~/Library/Logs/DiagnosticReports` after the runs |
| Review | `/code-review` on the branch diff; fix what holds up |

Commands:

```bash
cd ios && xcodegen generate && xcodebuild test -project Peepl.xcodeproj -scheme Peepl -destination 'platform=iOS Simulator,name=iPhone 18 Pro' -derivedDataPath build
```

```bash
cd ios && xcodebuild test -project Peepl.xcodeproj -scheme PeeplUI -destination 'platform=iOS Simulator,name=iPhone 18 Pro' -derivedDataPath build
```

Then update `CLAUDE.md`, `DECISIONS.md`, `PLAN.md` and `ROADMAP.md`, and report what passed, what failed and what was not checked.

## 5. Risks

| Risk | Guard |
|---|---|
| Update loses people | Fixtures from old code, upgrade test, store never deleted, back up before installing |
| Crash reading a deleted record | Delayed delete, leave the screen first, crash-report check |
| Merge restore undoes edits | `updatedAt` and removed ids |
| Wrong date read from a note | Narrow phrases, date shown, editable |
| Profile screen gets crowded | Edit actions behind menus and long-press; screenshots for your review after phases 3 and 4 |
| Long-press is easy to miss | Judge on your phone; add visible edit buttons if so |

## 6. Rough effort

Phase 0 half a session; 1 one; 2 half to one; 3 two; 4 one and a half; 5 one and a half; 6 half to one. About 8 sessions. These are estimates.

## 7. Your part

1. Approve this plan and change any default in section 3.
2. Look at screenshots after phases 3 and 4.
3. **Before installing on your iPhone: export a backup.** Regenerating the project clears the signing Team in Xcode, so pick it again. A free-account install expires after 7 days (the current one on December 2).
4. On the phone, check: upgrade keeps your people, long-press actions, date pickers, undo timing, keyboard with search, haptics.
