# Peepl: native iOS migration plan

Owner: Fable (orchestrator). Human: Vince. Process: `ORCHESTRATION.md` (Human <- Fable -> Opus managers -> Sonnet builders).
Settled decisions live in `DECISIONS.md`; check it before asking the human anything. Product description, design decisions and web-app internals live in `CLAUDE.md`.

## 1. Goal

Rebuild Peepl, a private "people log" (remember everyone you meet, where, and their story; nothing social), as a **native SwiftUI iOS app**. The React/Vite web app in `src/` stays in the repo as the **behavior spec and test fixture source**; it is not deleted and is not shipped in the app.

Target user: one person with a few hundred contacts, on their own iPhone, who wants to capture a person by typing or talking and find them again by asking a question.

Platform: **iOS 26+, iPhone only, portrait**, Xcode 27.2, SwiftUI + SwiftData, native Liquid Glass (`.glassEffect`).

## 2. Status (2026-11-16)

Milestones M0 and M1 are done. M1 added the test target (24 tests), `Logic/` capture parsing, `Services/` AI client, tab shell, profile and Add + Composer. Open M1 items: the Add screen echoed the typed note twice in a manager screenshot (probably simulator text injection, unconfirmed); the "Which Jordan" picker and profile "Add a moment" were covered by tests only, not driven in the UI. Nothing is committed. Next: M2 / M3 / M4.

Animation plan (`ios/ANIMATION_PLAN.md`): M1 Foundation done 2026-11-22 (`Motion.swift`, shared `Components/Shimmer.swift`; validator PASS, simulator-SDK build only). Next: apply `PressStyle` and the P0 items.

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

### M3: Find (merged into main 2026-11-16; 85 tests passed on the branch; knows 30/30, recall@10 111/116, three demo answers in `testDemoAnswers`; embeddings = MiniLM forward pass in Swift with the shipped vectors; open: nothing needing a tap was driven in the UI (draft / Copy / Share, Show all, filter pill, no-match state), real rank / draft endpoints only stubbed, `AIClient.rank` leaves grouped answers unchanged (not in the web spec, untested), the web's "Still reading your moments" state is skipped, Find's aura duplicates AddView's)
Goal: ask a question, get people with the real reason.
Scope: port rule-based Find (`ask.ts`, `query/`, `rank/`), moment-sentence matching with "(Met at X, Mon YYYY)" reasons, "No results / Closest, but not quite / Add someone new", then meaning search, then AI `rank` and `draft` (draft opens inline, Copy / Share via the iOS share sheet), plus "Show all N on the mindmap / list" filter pill.
Open technical choice (Fable decides after a spike, logged in `DECISIONS.md`): query embeddings via **(a)** a bundled Core ML conversion of all-MiniLM-L6-v2 so existing `public/vectors.json` stays valid, or **(b)** Apple `NLEmbedding` / `NLContextualEmbedding` and recompute vectors on first launch. Default: try (a) first. The spike's acceptance is that the demo answers hold (below).
Demo answers that must keep working (from `CLAUDE.md`): climbing -> Jordan then Zara (no other climbers); SF trip uses people in SF / Oakland / Berkeley; hardware intro needs only Ana (direct) and Aisha (connector).
Acceptance: `queries.test.ts` / `golden.test.ts` ported and passing; those three demo answers verified.

### M4: Voice (merged into main 2026-11-16; main with M2 + M3 + M4 runs 105 unit tests on scheme `Peepl` and 3 UI tests on scheme `PeeplUI`, all passing; open: names outlined for voice only, not while typing; a comma after an outlined name can wrap alone; the denied message is a placeholder, hidden once text is typed; the profile mic has no outlines; not verified: real microphone, Apple's recognizer path, the speech-permission alert, the profile mic in the Simulator)
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

- Everything private; no social features; people live on the device (SwiftData). **Since 2026-11-22 (section 12) AI runs on the device by default** (rules + embeddings + Apple Foundation Models); Add notes, Find questions with candidate facts, and draft requests leave the device (to OpenAI via the endpoint) **only if the user turns on the opt-in**, and every call has a local fallback.
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

### Animation plan (ios/ANIMATION_PLAN.md)
- Foundation (Motion.swift, Shimmer) merged. Animation M2 (PressStyle on every interactive button, 35 sites) merged 2026-11-21, validator PASS, generic simulator build OK. Next: later animation milestones.
- Animation M3 (shell, Add + Composer, Find, Profile, Connections + Mindmap) merged 2026-11-21, validators PASS (Profile after a Reduce Motion fix), generic simulator builds OK, nothing run on a device. Left for M4: depth effect and swipe-follow (2.1), shrink-into-button dismiss (2.4), PastelAura (6.6/7.9/5.9), hero avatar match (5.1).
- iOS fixes M5a + M5b merged 2026-11-21, validators PASS, generic simulator build OK, nothing run on a device. M5a (3 rounds): reveal grows from the tap point (separate open / close origins), X fades out fast, mindmap / list background sits outside the depth container, dark gradient behind the ask bar. M5b: keyboard and ask bar close together with the layer. **Device checks needed:** status-bar / bottom band on swipe-back (mindmap and list), reveal origins (ask text, mic, add button) and collapse into the X, keyboard slide timing on open and close, Reduce Motion.

---

# 11. Private beta plan: accounts, usage limits, consent, crash reports, backup, real-device AI (2026-11-22)

> **Update 2026-11-22 (section 12):** AI is now on-device by default and OpenAI is opt-in only. Workstreams A to D, G and the OpenAI parts of H below (accounts, quotas, consent, App Attest) only matter if the opt-in ships, so they are **off the MVP critical path** until Vince decides (section 12.6). E (crash reports), F (backup) and the TestFlight steps still apply.

Goal: a TestFlight build that friends and family can install, make an account in, and use. **People, moments and to-dos stay on the phone** (SwiftData). The backend only knows who an account is, what that account has agreed to, and how much AI it has used. This replaces open decision 2 in section 7 ("delete Supabase"): Supabase is back, but **accounts only, never the people**.

## 11.1 Decisions (defaults chosen; Vince can override before work starts)

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | Sign-in methods | **Sign in with Apple only** | No passwords, reset emails, SMTP or email verification to build; Apple requires it anyway if any other social login is offered; friends and family all have iPhones. Add email later if someone needs it. |
| D2 | Is an account required to use the app? | **No. The app works fully local without one; AI (Add parsing, Find ranking, drafts) needs an account** | App Store guideline 5.1.1: don't force sign-in when the core feature doesn't need an account. It also matches the existing rule "the app stays usable without the endpoint". |
| D3 | Backend | **Supabase** (Auth + Postgres), new project, called with plain HTTP like `src/lib/supabaseRepo.ts` (no Swift SDK) | Auth, a database and per-row security with no server to run. Free tier is enough for a beta. |
| D4 | Where per-user limits live | **Postgres counter table, checked by the Vercel function** | The current limiter is in memory per serverless instance (a "good brake, not a hard wall"); a user limit must survive cold starts and multiple instances. |
| D5 | Keep App Attest | **Yes, on top of the account** | The account says who; App Attest says the request comes from a real Peepl install, not a script holding a stolen token. Both must be valid. |
| D6 | Crash reporting | **No third-party service: Xcode Organizer (TestFlight crash reports) + MetricKit** (Vince's call 2026-11-22, no Sentry) | Apple collects crashes from TestFlight builds for free; no SDK, no extra data leaves the phone, no privacy-label change for crash data. Reports arrive later and have less context. |
| D7 | Optional cloud copy of the backup | **Off for the beta (stretch task G5)** | Contradicts "people live on the device"; the user's own exported file already covers reinstalling. |

## 11.2 Architecture after this work

```
iPhone (SwiftData: people, moments, to-dos, name fixes; Keychain: session)
  |  Sign in with Apple identity token
  v
Supabase Auth ──> auth.users            Supabase Postgres: profiles, usage_daily  (RLS, own row only)
  |  access token (JWT, 1 h) + refresh token
  v
Vercel  /api/ai/<task>   headers:  Authorization: Bearer <App Attest token>   X-User-Token: <Supabase JWT>
  1. verify App Attest token (existing)        2. verify Supabase JWT (new)
  3. per-user quota in Postgres (new)          4. consent version recorded? (new)
  5. call OpenAI                               6. return answer
  /api/account (DELETE)  -> deletes auth user + rows, revokes the Apple token
  /privacy               -> static policy page
```

Only these leave the phone: the Add note (parse), Find question plus up to 12 candidate profile facts (rank), and draft requests. Crash reports go to Apple only (TestFlight / Organizer). Nothing else.

## 11.3 Workstreams

Do them in this order; each is a branch with its own tests. A and B can start the moment Vince has the accounts in 11.4.

### A. Backend foundation (Supabase) — blocks B, C, D

1. **Create the project** (Vince, 11.4). Record `SUPABASE_URL`, anon key (iOS app), service-role key and JWT secret (Vercel only, never in the app or git).
2. **Delete the old layer.** Remove `supabase/migrations/0001_init.sql`'s demo data path from use; leave the web app's `VITE_SUPABASE_*` unset so it stays local. Add `supabase/migrations/0002_accounts.sql` for the new project (do not reuse the old project).
3. **Schema** (`0002_accounts.sql`):
   - `profiles(user_id uuid primary key references auth.users on delete cascade, created_at timestamptz default now(), consent_version int, consent_at timestamptz, ai_enabled bool default true, deleted_at timestamptz)`.
   - `usage_daily(user_id uuid references auth.users on delete cascade, day date, task text, count int, primary key (user_id, day, task))`.
   - `app_config(key text primary key, value jsonb)` for the current policy version and the daily limits, so limits change without a redeploy.
   - Trigger: insert a `profiles` row when an `auth.users` row is created.
   - **RLS on, deny by default.** `profiles`: a user can `select` and `update (ai_enabled)` their own row only; `consent_*` only through the RPC below. `usage_daily`: no client access at all (the Vercel function uses the service role). `app_config`: read-only for authenticated users.
   - RPC `bump_usage(p_user uuid, p_task text, p_limit int) returns int` (atomic upsert, returns the new count or raises when over limit), `record_consent(p_version int)` (security definer, writes the caller's own row).
4. **Apple provider:** enable Apple in Supabase Auth with the App ID `com.vincelin.peepl` as the client ID (native sign-in uses the bundle ID; a Services ID is only needed for web).
5. **Tests:** SQL/pgTAP or a small script with two test users: user A cannot read or write user B's `profiles`, cannot touch `usage_daily`, cannot call `bump_usage` for someone else. This is the most important test in the whole plan.

**Done when:** two users exist in a scratch project and the cross-user script proves isolation; migration is committed and runs cleanly on an empty project.

### B. Accounts in the iOS app (Sign in with Apple, session, delete)

New files in `ios/Peepl/Services/`: `Account.swift` (observable: `state` = signedOut / signedIn(user), `accessToken()` that refreshes when under 5 minutes left), `AuthAPI.swift` (HTTP to `/auth/v1/...`), `Keychain.swift` (store refresh token + user id; kSecAttrAccessibleAfterFirstUnlock). New view `Screens/AccountView.swift` (inside Settings).

1. **Capabilities:** add "Sign in with Apple" to the App ID and `com.apple.developer.applesignin` to `Peepl.entitlements`; keep `project.yml` as the source of truth, then `xcodegen generate`.
2. **Sign-in flow:** `ASAuthorizationAppleIDButton` (SwiftUI `SignInWithAppleButton`) with a random nonce (send the SHA-256 in the request, the raw nonce to Supabase) → `POST /auth/v1/token?grant_type=id_token` with `{provider: "apple", id_token, nonce}` → store tokens in Keychain. Apple gives the user's name only on the very first sign-in; save it to `profiles` then (optional, display only).
3. **Session upkeep:** refresh via `grant_type=refresh_token`; on a failed refresh, drop to signed-out (the local app keeps working, AI turns off). Check Apple credential state (`getCredentialState`) at launch: if revoked, sign out.
4. **Where it shows:** Settings → Account (signed-out: the Sign in button with one line explaining what it unlocks; signed-in: "Signed in with Apple", **Sign out**, **Delete account**). The first time someone taps an AI-backed action while signed out, show a sheet with the Sign in button and "Not now", and run the local fallback while it is open (never block).
5. **Delete account (required by Apple):** confirm sheet ("This deletes your account and usage record. Your people stay on this phone.") → `DELETE https://<site>/api/account` with the user token → the function (service role) deletes `auth.users` (cascades the rows) and **revokes the Apple refresh token** via Apple's REST revoke endpoint (needs a Sign in with Apple key `.p8`, key id, team id; env vars below). Then wipe Keychain, go to signed-out. Offer "Also erase people on this phone" as a separate toggle, default off.
6. **Tests:** `AccountTests` with a stubbed `URLProtocol` (the repo already has `StubProtocol`): refresh near expiry, refresh failure → signed out, revoked credential → signed out, delete clears Keychain. UI test: signed-out Add still saves a person.

**Done when:** on a real device, sign in → relaunch → still signed in; sign out; sign in again; delete account → the Supabase user and rows are gone and signing in again creates a fresh one.

### C. Per-user limits and the user check on the AI endpoint

Files: `server/ai.ts`, new `server/userAuth.ts` (verify the Supabase JWT), new `server/usage.ts`, `api/account.ts`, `tests/` for each.

1. **Verify the user.** `verifyUser(jwt)`: check signature with `SUPABASE_JWT_SECRET` (HS256) or the project's JWKS, `aud = authenticated`, not expired, take `sub` as the user id. Native requests must now carry both `Authorization` (App Attest) and `X-User-Token`; missing or bad → 401 `{error: "sign_in_required"}` so the app shows the sign-in sheet instead of a failure. Web (same-site) requests stay unchanged.
2. **Quota.** After auth and before calling OpenAI: `bump_usage(user, task, limit)` through the service role. Daily limits as data (`app_config`), starting points: parse 60, rank 120, draft 120 per user per day, plus the existing short-window per-IP / per-device brake. Over the limit → 429 `{error: "daily_limit", resetsAt}`; the app shows "You've used today's AI. It resets at midnight UTC" and falls back to local behavior. Fail closed: if the quota call itself errors, refuse the AI call (never spend without counting).
3. **Consent gate.** The function reads `profiles.consent_version`; if it is below the current policy version → 403 `{error: "consent_required"}`. (The app also checks locally first, see D.)
4. **Kill switch.** `profiles.ai_enabled = false` stops one user without touching others (for abuse or a runaway friend); `app_config` global `ai_enabled` stops everyone.
5. **Cost guard.** Keep `max_completion_tokens` and body caps. Vince sets a **monthly spending limit on the OpenAI project** (11.4); that is the true wall, the quota is the fair-share rule.
6. **Tests** (extend `tests/guard.test.ts`): no user token → 401; expired / wrong-secret / wrong-audience token → 401; user under limit passes and increments; user at limit → 429; two users do not share a counter; quota backend down → refused; web same-site path unchanged; consent below current → 403.

**Done when:** from a script, a valid user hits the daily cap exactly at the limit, a second user is unaffected, and an invalid token never reaches OpenAI (verify with the OpenAI usage page, not only status codes).

### D. Privacy policy and consent for OpenAI

1. **Privacy policy page** at `https://peepl-steel.vercel.app/privacy` (static `public/privacy.html`, plain text, readable on a phone). It must say, in plain words: what stays on the device (all people, moments, to-dos); what the account stores (Apple user id, optional name/email Apple shares, consent record, daily usage counts); what goes to OpenAI and when (Add notes, Find questions with candidate profile facts, draft requests; sent through our server; not used to train models under OpenAI's API terms, check their current wording and quote it exactly); crash reports (collected by Apple for TestFlight, not by us); how to export, delete the account, and contact. Add a support email Vince controls. Date it and give it a **version number** that matches `app_config.policy_version`.
2. **Consent sheet** (`Screens/ConsentView.swift`), shown at the first AI-backed action after sign-in and again whenever `policy_version` increases: a short summary of the three bullets above, a link to the policy, **Agree** and **Not now** (Not now = local-only mode, the app keeps working). On Agree, call `record_consent(version)` and store the version in UserDefaults so the app doesn't ask the server every time.
3. **Settings → Privacy:** "Use AI features" switch (off = local rules only; writes `profiles.ai_enabled` when signed in), link to the policy, the plain-language data list.
4. **App Store Connect privacy questionnaire** (Vince fills in with this list): Data linked to you: User ID (account), Other user content (notes and questions sent for AI). Tracking: none. Purpose: app functionality. Update `PrivacyInfo.xcprivacy` to match (add `NSPrivacyCollectedDataTypeUserID`, set `Linked` true where it now is).
5. **Tests:** consent version bump re-prompts; "Not now" still lets a person be added and found locally; the AI switch off sends no network request (assert with `StubProtocol` that nothing is called).

**Done when:** a fresh install on a device shows consent before the first note is sent, and the policy URL opens in Safari with no login.

### E. Crash reporting (Apple's own tools, no third party)

1. **Nothing to install.** TestFlight and App Store builds send crash reports to Apple (for testers who have "Share With App Developers" on, the iOS default for TestFlight). Read them in Xcode → Window → Organizer → Crashes after each build. Upload symbols with the archive (leave "Upload your app's symbols" on) so stacks are readable.
2. **MetricKit (optional, small):** subscribe a `MXMetricManagerSubscriber` in `PeeplApp.swift` and keep diagnostic payloads (crashes, hangs) in the app's log (`os.Logger`, no content) so a tester can attach them when sending feedback. Nothing is uploaded by the app.
3. **Feedback path:** TestFlight's built-in "Send Beta Feedback" (screenshot + comment) covers non-crash bugs; mention it in the TestFlight test notes.
4. **Privacy:** no crash SDK, so no crash-data entry is needed in the App Store privacy labels or `PrivacyInfo.xcprivacy`.

**Done when:** a deliberate crash on a TestFlight build appears in Organizer with a readable stack (it can take a day to show up).

### F. Backup and restore (reinstall without losing people)

The export and import already exist (`Services/Backup.swift`, now under Settings → Your data). Harden them, because this is the only safety net:

1. **Format:** keep `version` in the file, refuse a newer-than-known version with a clear message, and keep decoding older ones. Add `exportedAt` and a person/moment count to the file for a sanity check. Include name fixes (already) and the **consent and AI settings are not exported** (they belong to the account).
2. **Restore options:** today Restore silently replaces everyone. Change to a confirmation sheet showing "File has 83 people, this phone has 12" with **Replace everything** and **Merge** (merge by `id`; on a clash keep the newer `lastContacted`/more moments; never delete). Default Merge.
3. **Reinstall path:** the empty state ("No one here yet") gets a third button **Restore from a backup file**, so a fresh install finds it without hunting through Settings.
4. **Remind people:** after 10 new people or 30 days since the last export, one gentle toast on launch ("Back up your people?") with a button; store `lastBackupAt` in UserDefaults. Do not nag more than once a week.
5. **Safe write:** write to a temp file first and verify it decodes before handing it to the share sheet. On restore, decode and validate the whole file before touching existing data, and do it in one SwiftData transaction so a bad file changes nothing.
6. **Tests** (extend `PeopleStoreTests`/new `BackupTests`): round trip (export → wipe → restore equals original, including todos order, mutual notes, name fixes); merge keeps both sets; corrupt JSON changes nothing; newer version refused; 500-person file restores under a few seconds.
7. **Existing testers' data:** anyone who already used the app before this build keeps their people (SwiftData store is unchanged). Add a SwiftData migration check only if `Models.swift` changes; if so, version the schema first.

**Done when:** on a device: add 5 people, export to Files, delete the app, reinstall, restore from the empty screen, and all 5 (with moments, to-dos and name fixes) are back.

### G. Real-device AI path (App Attest end to end)

Mostly configuration; this is the riskiest step because it can only be tested on hardware.

1. **Apple Developer Program** ($99): enroll with the Apple ID Vince wants to own the app. Enrollment can take a day or two (identity check).
2. **App ID** `com.vincelin.peepl`: enable App Attest and Sign in with Apple. Team ID goes into the `APPLE_APP_ID` value (`TEAMID.com.vincelin.peepl`).
3. **Entitlement:** `com.apple.developer.devicecheck.appattest-environment` is `development` for Xcode device runs and **`production` for TestFlight and App Store**. Do it with build settings (`project.yml`: Debug `development`, Release `production`) so nobody has to remember. The server accepts both only if it knows which it is talking to: add an `APP_ATTEST_ENV` check or accept either and log which (the attestation carries an `aaguid` that says `appattestdevelop` or `appattest`).
4. **Vercel env vars (Production and Preview):** `OPENAI_API_KEY`, `APP_TOKEN_SECRET` (long random), `APPLE_APP_ID`, plus the new ones in 11.5. **Never** set `APP_DEBUG_TOKEN` in Production. Redeploy (`npx vercel --prod`); env changes only reach new deployments.
5. **Device test script** (run on a real iPhone, a Release or TestFlight build, not the Simulator): (a) signed out → AI action shows the sign-in sheet and the local fallback works; (b) sign in, agree to consent; (c) Add a messy note → card is filled in by AI (check the Vercel function log shows a 200 and the OpenAI usage page shows the call); (d) Find a question → results with reasons; (e) tap Draft a message → text appears; (f) airplane mode → everything still works locally with the fallbacks; (g) exhaust the daily limit (temporarily set it to 3 in `app_config`) → friendly message, no crash; (h) sign out / delete account.
6. **Failure modes to confirm:** token expires mid-session (token refresh works, no stuck spinner), a second device for the same account (each device gets its own App Attest key; user limit is shared), OpenAI down (502 → fallback), App Attest rate (Apple limits key generation; the existing design makes one key per token, about hourly, so check how often it regenerates and consider reusing the key and using assertions instead, see risk R3).

**Done when:** all of 5(a)–(h) pass on a physical phone from a TestFlight build.

### H. Release: TestFlight

1. Version / build numbers in `project.yml` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`; bump the build each upload).
2. App icon (exists) and launch screen; screenshots are not needed for TestFlight internal builds but are for external review.
3. **Archive** in Xcode (Release, "Any iOS Device") → Distribute → App Store Connect → upload. Wait for processing.
4. **Export compliance:** the app uses only Apple's standard encryption (HTTPS, CryptoKit); answer "uses standard encryption, exempt" and set `ITSAppUsesNonExemptEncryption = NO` in `Info.plist` so the question stops appearing.
5. **Internal testers first** (up to 100 people on your App Store Connect team, no review). Then **external testers** (up to 10,000, by email or public link; the first build gets a short Beta App Review, needs the privacy policy URL, a demo note on how to try it, and contact info). Because sign-in is optional (D2), reviewers can try the app without an account; also provide a note that AI needs Sign in with Apple.
6. Builds expire after 90 days: put a calendar reminder to upload a new one.

## 11.4 Things only Vince can do (accounts, money, secrets)

1. Enroll in the **Apple Developer Program** and create the App ID with App Attest + Sign in with Apple; create a **Sign in with Apple key** (`.p8`) for token revocation.
2. Create the **Supabase project**; copy the URL, anon key, service-role key, JWT secret.
3. On the **OpenAI** dashboard set a **$20 monthly spending limit** for the project (Vince 2026-11-22; the real protection) and an email alert at about $10.
4. Add all env vars in Vercel (table below), then redeploy.
5. Provide a **support email** and confirm the privacy policy text before it goes public.
6. Fill in the App Store Connect privacy questionnaire and the TestFlight test information.

## 11.5 Environment variables and build settings

| Where | Name | Purpose |
|---|---|---|
| Vercel | `OPENAI_API_KEY` | already used |
| Vercel | `APP_TOKEN_SECRET` | signs App Attest tokens (existing) |
| Vercel | `APPLE_APP_ID` | `TEAMID.com.vincelin.peepl` (existing) |
| Vercel | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | verify users, count usage, delete accounts; **server only** |
| Vercel | `APPLE_TEAM_ID`, `APPLE_SIWA_KEY_ID`, `APPLE_SIWA_PRIVATE_KEY` | revoke the Apple token on account deletion |
| Vercel | `APP_DEBUG_TOKEN` | **not set in Production** |
| iOS build setting | `PEEPL_SUPABASE_URL`, `PEEPL_SUPABASE_ANON_KEY` | anon key is meant to be public; RLS protects the data |
| Supabase `app_config` | `policy_version`, `limits`, `ai_enabled` | change without redeploying |

## 11.6 Order of work and dependencies

1. **Day 0 (Vince, parallel):** developer enrollment, Supabase project, OpenAI spending limit. Enrollment is the long pole.
2. **A** Supabase schema and RLS tests.
3. **B** and **C** together (the app and the server must agree on headers and error codes: `sign_in_required`, `consent_required`, `daily_limit`). Contract first: write the three error shapes and the two headers into `ios/Peepl/Services/AIClient.swift` and `server/ai.ts` tests before building either side.
4. **D** policy page and consent (can start any time; needed before C's consent gate is switched on).
5. **E** crash reporting (Apple tools, nearly no work), **F** backup hardening (independent; either can go in parallel with B/C).
6. **G** real-device pass once enrollment is done and B, C, D are on the server.
7. **H** TestFlight internal, fix, then external.

Suggested branches: `beta/backend`, `beta/accounts-ios`, `beta/usage-limits`, `beta/consent`, `beta/crash` (MetricKit only), `beta/backup`, `beta/release`. One owner per set of files (`server/ai.ts` is touched by C only; `AIClient.swift` by B and C, so merge C's contract first).

## 11.7 Risks

- **R1 Cross-user data leak** if RLS is wrong. Mitigation: deny by default, the two-user test in A runs in CI before any real user signs up; the people never go to the server, so the blast radius is the account and usage tables only.
- **R2 Apple rejection:** forcing sign-in (avoided by D2), missing delete-account (B5), missing or vague privacy policy and labels (D), Sign in with Apple token not revoked on delete (B5).
- **R3 App Attest quirks:** one attestation per key and Apple rate-limits key generation; the current design makes a new key about hourly. If real devices hit limits, switch to one key per install (stored in Keychain) plus per-request **assertions**, with the token as a cache.
- **R4 Spending:** a signed-in user is still a user; the daily caps plus the OpenAI monthly limit bound the worst case. Watch usage the first week.
- **R5 Serverless limits:** the Vercel Hobby plan is for non-commercial use and has function time/size limits; fine for a beta, revisit before any paid launch.
- **R6 Restore is destructive** today. Fixed by F2 (confirmation + merge).
- **R7 The hardware-only test (G)** can fail late. Do the Apple enrollment and a first signed device build **early** (even before B/C are finished) to flush out signing and entitlement problems.
- **R8 Policy drift:** the consent text, policy page, privacy manifest and App Store labels must say the same thing; one owner updates all four together and bumps `policy_version`.

## 11.8 Definition of done for the private beta

- [ ] Fresh install on a real iPhone from TestFlight: add a person without an account works.
- [ ] Sign in with Apple works, survives relaunch, sign out and delete account work and really delete the server record.
- [ ] Consent shown before the first AI call; declining keeps the app fully local.
- [ ] AI Add, Find and Draft work on the device through App Attest + user token; the per-user daily cap and the kill switch demonstrably work.
- [ ] Two accounts cannot see each other's rows (automated test passes).
- [ ] A deliberate crash on a TestFlight build shows in Xcode Organizer with a readable stack.
- [ ] Export → delete app → reinstall → restore recovers everything, including from the empty screen.
- [ ] Privacy policy URL is live; privacy manifest, App Store labels and consent text agree.
- [ ] OpenAI monthly spending limit is set; `APP_DEBUG_TOKEN` is not set in Production.
- [ ] `CLAUDE.md`, `DECISIONS.md` and this file are updated (decision 2 reversed; D1-D7 recorded).

---

# 12. MVP scope and on-device AI (2026-11-22)

Source: the Dex / Mesh competitor research and Vince's calls of 2026-11-22. This section **supersedes** `DECISIONS.md` 2026-11-16 ("keep OpenAI") (logged there 2026-11-22). Nothing here is built yet; everything in 12.4 must pass before the on-device path replaces OpenAI as the default.

## 12.1 Decisions (Vince, 2026-11-22)

| # | Decision | Why |
|---|---|---|
| S1 | **MVP is iOS only.** Android is a later, separate effort. | Focus; the SwiftUI app is iOS-only by design. |
| S2 | **No cross-device sync and no cloud copy of people.** 100% on device. | Privacy is the product's edge over Dex and Mesh (their reviews complain about forced email access, vague data policies, sync bugs). |
| S3 | **Moving devices = a file.** Settings → Back up makes one JSON; the user sends it to themselves (email, AirDrop, Files) and Restores it on the other device. | Replaces sync without a database. Already half built (`Services/Backup.swift`, `SettingsView.swift`). |
| S4 | **Add a losing-touch nudge** (12.3 W7). | The most praised feature in both competitors' reviews; Peepl has to-dos but no "you haven't talked to X in a while". |
| S5 | **AI = option A + B combined: rules and on-device embeddings, plus Apple Foundation Models. OpenAI is opt-in only, off by default.** | Free, private, offline. Must be tested first (12.4). |

## 12.2 AI architecture

The model never reads everyone. **Code retrieves; the model only interprets and explains.**

```
question
  1. understand   Foundation Models -> @Generable Constraints (place, activity, role, relationship, time)
                  fallback: today's rules in Logic/Query.swift
  2. retrieve     existing filters + MiniLM embeddings (Logic/Search.swift, Semantic.swift) -> about 10 candidates
  3. explain      Foundation Models reads those candidates' short facts (inside its 4,096-token window),
                  re-ranks and writes the "why"; it may only return ids from the candidate list
                  fallback: the sentence from the matching moment (already how Find works)
  4. result       same AskResult the UI already renders
Add note parse  -> @Generable Draft (name / company / from / lives / met / interest / follow-up); fallback: Capture.swift regex
Draft message   -> Foundation Models; fallback: template drafts
```

- **Availability:** check `SystemLanguageModel.default.availability` at launch and before each call. Not eligible, Apple Intelligence off, or model still downloading all mean step 1 and 3 use their fallbacks. Settings shows the status in plain words.
- **Token budget:** the 4,096 window covers instructions, prompt, the `@Generable` schema and the reply. Clip each candidate to about 40 tokens, cap candidates at 10, keep `@Guide` text short, and count before sending (newer SDKs expose a token count).
- **Guardrails:** validate every model answer in code (ids must be in the candidate set; parsed name / company / places must appear in the note, as the web `parse` task already does). Never show a result the retrieval step did not return.
- **OpenAI opt-in:** `AIClient` stays but is dormant. A Settings toggle (default off) turns it on and shows what leaves the device. While it is off nothing is sent, so the App Store label can say "Data Not Collected". If the opt-in ships, section 11 (accounts, quota, consent, App Attest) comes back as its prerequisite and the label must disclose it.

## 12.3 Workstreams

| ID | Work | Files (likely) | Notes |
|---|---|---|---|
| W1 | **Spike and eval harness** (do first, gates the rest) | `PeeplTests/` new `FoundationModelsEvalTests`, `Logic/LocalAI.swift` | 12.4. Runs on a real eligible iPhone; the Simulator only works if the Mac has Apple Intelligence. |
| W2 | Query understanding with `@Generable` | `Logic/LocalAI.swift`, `Logic/Query.swift` | Maps onto `Constraints`; rules remain the fallback and the baseline. |
| W3 | Explain and re-rank top candidates | `Logic/LocalAI.swift`, `Logic/Search.swift` | Replaces `AIClient.rank` as the default. |
| W4 | Add parse and message drafts on device | `Logic/Capture.swift`, `Logic/LocalAI.swift` | Same validity rules as 12.2. |
| W5 | Availability, status line, fallback UX | `Screens/SettingsView.swift` | No dead ends: every AI action has a working local result. |
| W6 | OpenAI opt-in toggle, default off, plain-language disclosure | `Services/AIClient.swift`, `Screens/SettingsView.swift` | Gate every `AIClient` call on the toggle. |
| W7 | **Losing-touch nudge** | `Screens/Shell.swift` / Connections, `Services/Nudges.swift` | Uses `lastContacted` and `closeness`. Default thresholds (proposed): closeness 3 = 30 days, 2 = 60, 1 or unset = 120. Shows a "Reach out" section and a dot on the row; tapping "Talked today" or saving a moment resets it. Optional weekly local notification via `UNUserNotificationCenter` (no server, off until the user agrees). Snooze per person. |
| W8 | **Backup as email-able file** | `Services/Backup.swift`, `Screens/SettingsView.swift` | Swap the save-to-Files exporter for a share sheet (Mail, AirDrop, Files); dated filename; Restore asks first and offers **merge** vs replace (today it wipes silently; this is section 11 F2). |

## 12.4 Test plan (gates W2 to W4)

**Baseline** is today's pipeline: rules + MiniLM (web-spec numbers: knows 30/30, recall@10 111/116, three demo answers in `testDemoAnswers`).

1. **Question set.** About 40 questions with gold answers: the three demo questions (climbing -> Jordan then Zara, SF trip using SF / Oakland / Berkeley people, hardware intro via Ana and Aisha), 15 messy or unusual phrasings, 10 multi-constraint ("someone in Austin who could help with taxes"), 5 questions with no real match.
2. **Metrics and proposed thresholds** (Vince to confirm):
   - Constraint parse: at least 90% field-level agreement with the gold labels, and never worse than the rules on any demo question.
   - Retrieval: recall@10 at least equal to the baseline; the three demo answers unchanged.
   - No-match honesty: 5 of 5 no-match questions return "no one matches" (nothing invented).
   - Validity: 0 results outside the candidate set; 0 parsed names that are not in the note.
   - Latency on a real eligible iPhone: p50 under 2 s and p95 under 5 s for Find; Add parse under 3 s. Slower falls back to the instant local result first.
   - Token safety: a 500-person list and a very long note never overflow the window (the call is clipped or skipped, no crash or error shown).
3. **Device matrix:** eligible iPhone with Apple Intelligence on; the same phone with it off; a non-eligible phone or Simulator (must behave exactly like the fallback); airplane mode throughout.
4. **A/B compare.** Run the same question set through (a) fallback only, (b) fallback + Foundation Models, (c) OpenAI (today's `gpt-4.1-mini` path) and record all three in `.orchestration/reports/`, so the decision to make on-device the default is based on numbers.
5. **Regression:** the existing 105 unit tests stay green with the model disabled.
6. **Not testable here:** I have not run Foundation Models on a device. The quality numbers above do not exist yet.

## 12.5 What changes in earlier sections

- **M6.1 and section 7 decision 1 (endpoint auth)** and **section 11 A to D, G**: conditional on the OpenAI opt-in shipping.
- **M6.4 / 11 D:** if the opt-in does not ship in the MVP, the App Privacy label is "Data Not Collected" and the privacy policy is short; there is nothing to consent to.
- **M6.3 / 11 F (backup):** W8 is the MVP version of F; iCloud sync stays out of scope (S2).
- **Section 6 rule 1** is already updated above.

## 12.6 Open questions for Vince

1. After the W1 spike: does the OpenAI opt-in ship in the MVP at all, or is it deferred (recommended: defer, keep `AIClient` dormant, skip accounts and quotas until a friend asks for better answers)?
2. Nudge defaults (30 / 60 / 120 days) and whether weekly notifications are in the MVP.
3. Should the sample-people demo mode run the on-device AI too, or keep scripted answers so demos never depend on the device?

## 12.7 Risks

- **R9 Quality gap:** the 3B on-device model may be worse than `gpt-4.1-mini` at odd phrasings. Mitigation: the model only parses and explains, retrieval stays in code, and the eval in 12.4 decides.
- **R10 Eligibility:** only Apple Intelligence devices get step 1 and 3 upgrades; others get today's behavior. Mitigation: show status in Settings; never block on it.
- **R11 Competitors catch up:** Dex already ships voice mode and AI briefs. Peepl's edge is private, story-first capture plus explainable search, so keep the "why" visible.
- **R12 Destructive Restore** until W8 lands.

## 12.8 Definition of done for section 12

- [ ] 12.4 eval run and recorded; thresholds met or Vince accepts the gap.
- [ ] Find, Add and Draft work with the network off, on an eligible and a non-eligible device.
- [ ] OpenAI toggle exists, defaults off, and nothing is sent while it is off (checked with a proxy or airplane-mode log).
- [ ] The nudge shows the right people for test data and resets on a new moment.
- [ ] Back up -> email -> Restore on a second device brings everyone across; Restore asks before replacing.
- [ ] `CLAUDE.md`, `DECISIONS.md` and this file agree.
