# Peepl: native iOS migration plan

Owner: Fable (orchestrator). Human: Vince. Process: `ORCHESTRATION.md` (Human <- Fable -> Opus managers -> Sonnet builders).
Settled decisions live in `DECISIONS.md`; check it before asking the human anything. Product description, design decisions and web-app internals live in `CLAUDE.md`.

## 1. Goal

Rebuild Peepl, a private "people log" (remember everyone you meet, where, and their story; nothing social), as a **native SwiftUI iOS app**. The React/Vite web app in `src/` stays in the repo as the **behavior spec and test fixture source**; it is not deleted and is not shipped in the app.

Target user: one person with a few hundred contacts, on their own iPhone, who wants to capture a person by typing or talking and find them again by asking a question.

Platform: **iOS 26+, iPhone only, portrait**, Xcode 27.2, SwiftUI + SwiftData, native Liquid Glass (`.glassEffect`).

## 2. Status (2026-11-16)

Milestones M0 and M1 are done. M1 added the test target (24 tests), `Logic/` capture parsing, `Services/` AI client, tab shell, profile and Add + Composer. Open M1 items: the Add screen echoed the typed note twice in a manager screenshot (probably simulator text injection, unconfirmed); the "Which Jordan" picker and profile "Add a moment" were covered by tests only, not driven in the UI. Nothing is committed. Next: M2 / M3 / M4.

| Built | Where |
|---|---|
| XcodeGen project (`ios/project.yml`), bundle id `com.vincelin.peepl` | `ios/` |
| SwiftData models `Person`, `Moment`, `Todo`, `Place` | `ios/Peepl/Models.swift` |
| Seed loader: 500 sample people from `seed.json` on first launch | `ios/Peepl/Seed.swift`, `scripts/export-ios-seed.ts` |
| Theme tokens + `.glass()` modifier | `ios/Peepl/Theme.swift` |
| Blob avatars (same hash as web `blobs.ts`, 18 photos) | `ios/Peepl/Blobs.swift`, `ios/Peepl/Resources/Blobs/` |
| Connections list (A-Z, glass rows) + placeholder profile | `ios/Peepl/ConnectionsView.swift` |

Not built: real profile, Add, moments, mindmap, Find, voice, aura backgrounds, Geist fonts, backup, release work.

Build and run:
```bash
cd ios && xcodegen generate
xcodebuild -project Peepl.xcodeproj -scheme Peepl -destination 'platform=iOS Simulator,name=iPhone 18 Pro' -derivedDataPath build build
```
`ios/Peepl.xcodeproj` and `ios/build` are git-ignored; `project.yml` is the source of truth, so builders never merge `.pbxproj` conflicts. Any new Swift file under `ios/Peepl/` is picked up after `xcodegen generate`.

## 3. Areas (one Opus manager each)

File ownership keeps parallel builders from colliding. A builder touches only the files in its brief.

| Area | Owns | Does not touch |
|---|---|---|
| **ios-ui** | `ios/Peepl/Screens/**`, `ios/Peepl/Components/**`, `Theme.swift`, `Blobs.swift` (avatar / color parts), assets | Models, `Logic/**`, `Services/**` |
| **ios-core** | `ios/Peepl/Models.swift`, `Seed.swift`, `ios/Peepl/Logic/**` (parsing, ask rules, search, name fixes, force graph math), `ios/Peepl/Services/**` (AI client, speech, store), `ios/PeeplTests/**` | Views |
| **platform** | `server/**`, `api/**`, `supabase/**`, `scripts/**`, `vercel.json`, release config (`project.yml` signing, `Info.plist` keys, privacy manifest) | Swift view code |

`ios-ui` and `ios-core` agree on a small interface per feature (a protocol or a plain function signature) written into the brief before either starts. Fable approves the interface; managers do not renegotiate it with each other directly.

Suggested folder layout under `ios/Peepl/` (create as needed): `Screens/`, `Components/`, `Logic/`, `Services/`, `Resources/`.

## 4. Spec map: web file -> Swift destination

The TypeScript is the spec. A builder reads the web file, ports behavior (not structure), and ports its test.

| Web source | Behavior | Swift destination |
|---|---|---|
| `src/lib/capture.ts` | `parsePerson`, `parseMoment`, `momentCandidates`, `splitPeople`, `detectNames`, school / company / place parsing, dedupe | `Logic/Capture.swift` |
| `src/lib/ai.ts`, `server/ai.ts` | `parse` / `rank` / `draft` calls, 503 -> fallback, `aiReady` | `Services/AIClient.swift` |
| `src/lib/ask.ts`, `src/lib/query/`, `src/lib/rank/` | rule-based Find: buddy, trip, intro, catch-up, keyword filters, scoring | `Logic/Ask.swift`, `Logic/Search.swift` |
| `src/lib/semantic.ts`, `src/lib/chunks.ts`, `public/vectors.json` | chunking, embedding, best-chunk score, `MIN_SCORE` 0.35, "no results" and "closest" rules | `Logic/Semantic.swift` |
| `src/lib/forceGraph.ts`, `src/screens/MindmapScreen.tsx` | layout, tiers, groups, auras, float, parallax, momentum | `Logic/ForceGraph.swift`, `Screens/MindmapView.swift` |
| `src/lib/nameFixes.ts` | detect names, saved heard->meant fixes, `resolveName` | `Logic/NameFixes.swift` |
| `src/lib/speech.ts` | live words, final transcript | `Services/Speech.swift` (Apple Speech) |
| `src/screens/ProfileScreen.tsx`, `CaptureScreen.tsx`, `AskScreen.tsx`, `ListScreen.tsx` | screens | `Screens/*.swift` |
| `tests/parse.test.ts`, `golden.test.ts`, `queries.test.ts`, `query.test.ts`, `ai.test.ts` | expected behavior | `ios/PeeplTests/*Tests.swift` (XCTest) |

Design tokens: `DESIGN-FOUNDATION.md` and the "Visual style" section of `CLAUDE.md`. The web app currently uses off-white `#f4f4f4`, not cream; follow `CLAUDE.md` where the two disagree.

## 5. Milestones

Each milestone ends with: `xcodebuild build` succeeds, `xcodebuild test` passes, and the manager takes one Simulator screenshot of the new screen. Fable then updates this file.

### M1: Core loop (done 2026-11-16; verified: 24 XCTests pass, Sam Rivera note persists across relaunch; see `.orchestration/reports/`)
Goal: capture a person by typing, see them on a real profile, log moments, everything saved on the device.

Tasks (small briefs; ios-core and ios-ui in parallel where files differ):
1. **Test target** (core): add `PeeplTests` to `project.yml`, an in-memory SwiftData helper, and the seed-loads-500 test. Must land first: every later acceptance check uses it.
2. **Capture logic** (core): port `capture.ts` parsing (name, job @ company, from / lives, met, interest, goal, follow-up, mutuals) plus `parse.test.ts` as `CaptureTests`. Includes `momentCandidates` and duplicate-name handling.
3. **AI client** (core): `AIClient.parse(text)` calling `POST https://peepl-steel.vercel.app/api/ai/parse`, 10 s timeout, any failure returns nil so the regex path runs. Validate that name / company / places appear in the note (as `llmParse.ts` does). Base URL is a build setting.
4. **Profile screen** (ui): hero in the person's blob colors (`base/mid/accent/deep`), summary + tags, "Things to do with X" (tap ticks off, persisted), Where, Mutuals, collapsible Moments with the first-meeting note. Replaces the placeholder in `ConnectionsView.swift`.
5. **Add screen + Composer** (ui): shared `Composer` component (text field, send, mic button as a no-op hook for M4), the Add flow: "Creating a new profile..." state, result card in blob colors, existing-name match shows that person, moment-for-someone-you-know disambiguation ("Which Jordan..."), **New moment saved** toast.
6. **Shell** (ui): tab shell with the Mindmap / Connections toggle pill (Mindmap tab shows "coming soon" until M2), bottom ask bar + add-person button, full-screen layers for Add / Find / profile.

Acceptance: typing "Met Sam Rivera at a pickleball meetup, designer at Kiln, loves trail running" creates a profile with job, company, met, tag and a to-do, visible in the list after relaunch; all ported parse tests pass.

### M2: Mindmap (built on branch `m2-mindmap`, not merged yet; 49 tests pass, verified 2026-11-16; open: 2-4 s freeze on tab switch (suspect the 500-row list), 3x zoom spring-back only unit-tested, group-by City is a dense knot with 500 people, no real-device check)
Goal: the signature screen: Obsidian-style people graph.
Scope: `ForceGraph.swift` (hand-rolled simulation, links from `knows`, group pull, `GROUP_SPACING` 330 and related constants), `MindmapView.swift` using SwiftUI `Canvas` inside `TimelineView`, three disc tiers by moments + closeness, initials fade-in at `INITIALS_AT` 0.27, pan / pinch / tap-to-focus pill, rubber-band zoom limits, float + parallax + momentum, Group by (None / City / Met at / Job) with the moving aura orbs and an "Other" group.
Risk: highest of all milestones. Build in this order and verify each on-device-like Simulator pass: layout math (unit tests with fixed seed) -> static render -> gestures -> float/momentum -> groups/auras. Target 60 fps with 200 people; keep per-dot blurs and blend modes off (see the web app's disc note in `CLAUDE.md`).
Acceptance: 200 people render and pan smoothly in the Simulator; tapping a person dims others and shows the pill; group-by City shows labeled auras.

### M3: Find
Goal: ask a question, get people with the real reason.
Scope: port rule-based Find (`ask.ts`, `query/`, `rank/`), moment-sentence matching with "(Met at X, Mon YYYY)" reasons, "No results / Closest, but not quite / Add someone new", then meaning search, then AI `rank` and `draft` (draft opens inline, Copy / Share via the iOS share sheet), plus "Show all N on the mindmap / list" filter pill.
Open technical choice (Fable decides after a spike, logged in `DECISIONS.md`): query embeddings via **(a)** a bundled Core ML conversion of all-MiniLM-L6-v2 so existing `public/vectors.json` stays valid, or **(b)** Apple `NLEmbedding` / `NLContextualEmbedding` and recompute vectors on first launch. Default: try (a) first. The spike's acceptance is that the demo answers hold (below).
Demo answers that must keep working (from `CLAUDE.md`): climbing -> Jordan then Zara (no other climbers); SF trip uses people in SF / Oakland / Berkeley; hardware intro needs only Ana (direct) and Aisha (connector).
Acceptance: `queries.test.ts` / `golden.test.ts` ported and passing; those three demo answers verified.

### M4: Voice
Goal: talk instead of type.
Scope: `Services/Speech.swift` with `SFSpeechRecognizer` (on-device when available) and live partial words in the Composer; waveform while recording; names, company, school and places outlined and tappable to fix (`NameFixes.swift`, saved fixes applied to later transcripts, `resolveName` for unique first names); multi-person notes split into several profiles linked as mutuals (`splitPeople`). Info.plist: `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`. Permission-denied falls back to typing with a message.
No OpenAI audio upload on iOS (the web app's `transcribe` / `live` endpoints are not used).
Acceptance: speech-permission flow works in the Simulator; a recorded sample or typed injection through the same pipeline produces correct outlines; NameFixes tests pass. Real-microphone accuracy needs a physical iPhone (human step).

### M5: Polish
Geist + Geist Mono bundled and used per `CLAUDE.md` (headings tracking -0.04em), aura backgrounds (four drifting orbs on grey with grain; lighter on the list), circular-reveal open / close for Add and Find, haptics, app icon and launch screen, Dynamic Type and VoiceOver labels (the web audit found few `aria-label`s; do not repeat that), reduced-motion handling, the diverse-200 subset (`pickDiverse`) vs showing all 500, empty state for a user with zero people.

### M6: Release hardening (human decisions required, see section 7)
1. **AI endpoint auth.** A native app sends no `Origin` header, so today's same-site guard lets it through, and so it lets any script through. Add real client authentication (see options below), keep rate limits, and confirm a monthly OpenAI spending cap exists.
2. **Supabase.** `supabase/migrations/0001_init.sql` ends with `demo_open` policies that let the anon key read and write everything. Remove the layer, or add auth + per-user RLS. The iOS app does not use it.
3. **Backup.** Export / Import of people + name fixes as one JSON file (share sheet / Files). Also consider iCloud sync via SwiftData + CloudKit later.
4. **Store readiness.** Privacy policy, App Privacy labels (notes and search questions go to OpenAI), privacy manifest, App Store screenshots, TestFlight build, physical-device testing (mic, performance, Liquid Glass on hardware).
5. **Docs.** Update `CLAUDE.md` for the shipped state; fix the stale Layout section the audit flagged.

## 6. Data and behavior rules to preserve

- Everything private; no social features; people live on the device (SwiftData). Only Add notes, Find questions with candidate facts, and draft requests may leave the device (to OpenAI via the endpoint), and every call has a local fallback.
- Without a reachable endpoint the app must stay fully usable: regex parsing, rule + meaning search, template drafts (mirror `tests/ai.test.ts`).
- Voice notes parse like typed notes; only the scripted demo note ("battery recycling") gets the made-up Jordan story, and the iOS app does not need that demo path.
- Names: first name only is fine everywhere; a first name followed by a different last name is a new person ("Ran into a Priya Venkat" is not Priya Menon).
- Dates use the local day, not UTC.
- Keep animated per-dot effects off blurred shadows, filters and blend modes (mindmap performance lesson).

## 7. Questions for the human (batched; Fable asks at a natural stopping point)

| # | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| 1 | How the iOS app authenticates to the AI endpoint | **A** Apple App Attest + short-lived signed token minted by the endpoint; **B** a long-lived app secret in the binary (extractable, weak); **C** Sign in with Apple + per-user quota | **A**, with per-device rate limits | M6, any public release |
| 2 | Supabase layer | **A** delete it; **B** keep and add auth + per-user RLS | **A**: the iOS app stores locally and it contradicts "private to you" | M6 |
| 3 | Apple Developer Program ($99/year) | buy now vs. later | Later: free Apple ID is enough for Simulator and your own iPhone until TestFlight | M6 |
| 4 | Show all 500 sample people or the diverse 200 | 500 / 200 | 200, matching the web demo, but sample data is only for the demo build | M5 |
| 5 | Keep sample people in the shipping app | seed only in a demo build vs. always | Demo / debug builds only; a real user starts empty | M5 |

Items 4 and 5 are product-minor; Fable may decide and log them if the human is unavailable. Items 1-3 touch security, money and hosting, so they always go to the human.

## 8. Orchestration notes for this project

- Fable runs on the main session and delegates; managers are Opus, builders Sonnet in worktrees (`task/<id>`), as in `ORCHESTRATION.md`.
- `.claude/settings.json` does not exist yet in this repo. It needs the two env lines from `ORCHESTRATION.md` (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` 2, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` 10), and `.claude/agents/manager.md` and `builder.md` need creating. The first step of the run is the nested-spawn test and recording its result in `DECISIONS.md`.
- Order: M1 first, alone (it creates the shared Composer, shell and test target). After M1, M2, M3 and M4 can run in parallel as separate areas because they touch different files; the Composer and the Add flow are the only shared surface, and M4 only plugs into the mic hook M1 leaves.
- **iOS-specific builder rules** (put these in every brief):
  - Run `xcodegen generate` after adding or removing files.
  - Use a worktree-local `-derivedDataPath build`, so builds from parallel worktrees do not collide.
  - The acceptance check is `xcodebuild test` against a named simulator (`-destination 'platform=iOS Simulator,name=iPhone 18 Pro'`). Do not drive the shared Simulator UI in parallel; managers take screenshots one at a time.
  - Never commit `ios/build` or `ios/Peepl.xcodeproj`, and never commit secrets (the `.env.local` key stays on the server).
- Keep briefs under about five files. M2 and M3 each split into 6 to 10 briefs.
- Sonnet builders are right for ports with tests and screens with a clear spec. Escalate to Opus / Fable for the mindmap physics feel, SwiftData concurrency and migration design, the embedding spike, and the endpoint-auth design.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Mindmap performance and feel do not match the web version | Build it in the layered order in M2; unit-test the layout math; measure frame time in the Simulator, then on a real device |
| Meaning search quality drops if embeddings change | Spike (a) vs (b) before M3 builds on it; keep the three demo answers as a regression test |
| Liquid Glass on many rows scrolls poorly | Use `GlassEffectContainer` for grouped glass and check a 500-row list on a device |
| iOS speech accuracy on invented names | Keep the name-fix flow central; pass known names as `contextualStrings` to the recognizer |
| Parity drift: web keeps changing during the rewrite | Treat the web app as frozen except bug fixes; port from a tagged commit (tag `web-spec-2026-11-16`) |
| Open endpoint is abused after release | M6.1 before any public build; spending cap on the OpenAI project |
| The prototype demo data ships as real data | Decision 5: seed in demo builds only |

## 10. Definition of done (whole migration)

All screens from the web app exist natively; typed and voice capture work; Find returns correct, explained results; mindmap is smooth at 200 people on a real iPhone; data survives relaunch and can be exported; the AI endpoint authenticates the app; the Supabase hole is closed; privacy policy and labels are in place; a TestFlight build installs on the human's phone.
