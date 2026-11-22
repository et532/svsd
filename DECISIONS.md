# Decisions

Newest at the bottom. Anyone (human or agent) may edit this file. One line each: decision, reason, date, who decided.

## Settled

- 2026-11-16 (Vince): Rewrite Peepl as a native app instead of wrapping the web app in Capacitor. Reason: native Liquid Glass, on-device voice, storage iOS will not evict.
- 2026-11-16 (Vince): **SwiftUI, iOS only**, not React Native. Reason: Apple-only goal; native glass and Speech framework.
- 2026-11-16 (Vince): First milestone is the **core loop** (list, profile, typed Add, persistence); mindmap, Find and voice follow.
- 2026-11-16 (Vince): **Keep OpenAI** behind the existing `/api/ai/*` endpoint for parse / rank / draft, instead of on-device AI. Reason: Vince is already building the parser there. **Superseded 2026-11-22: on-device AI by default, OpenAI opt-in only (see the last entries).**
- 2026-11-16 (Fable): Deployment target **iOS 26.0**, iPhone only, portrait. Reason: `.glassEffect()` needs iOS 26; installed SDK is Xcode 27.2.
- 2026-11-16 (Fable): **XcodeGen** (`ios/project.yml`) generates the Xcode project; `ios/Peepl.xcodeproj` and `ios/build` are git-ignored. Reason: no `.pbxproj` merge conflicts between parallel worktrees.
- 2026-11-16 (Fable): **Swift language mode 5** for now. Reason: avoids Swift 6 strict-concurrency friction in a prototype; revisit at M5.
- 2026-11-16 (Fable): **SwiftData** for storage; seed from `ios/Peepl/Resources/seed.json`, exported from the web data by `scripts/export-ios-seed.ts`. Reason: native, no server, simplest path.
- 2026-11-16 (Fable): The web app is the behavior spec and stays in the repo. Port behavior and tests, not structure.
- 2026-11-16 (Fable): Voice on iOS uses Apple's Speech framework; the web app's OpenAI `transcribe` / `live` endpoints are not used by the iOS app. Reason: private, no upload, no key.
- 2026-11-16 (Fable): The iOS list shows all 500 sample people for now (web shows a diverse 200). Revisit in M5 (decision 4 in `PLAN.md`).
- 2026-11-16 (Fable): System font in M0; Geist and Geist Mono are bundled in M5.

## Open (need the human; see `PLAN.md` section 7)

- AI endpoint authentication for the native app (App Attest recommended).
- Private beta defaults D1-D7 in `PLAN.md` section 11.1 (Sign in with Apple only, account optional, Supabase for accounts only, per-user quota in Postgres, Apple-only crash reports (no Sentry), no cloud copy of people). 
- Apple Developer Program purchase timing.

## Open (Fable decides, will log here)

- Query embeddings for meaning search: bundled Core ML MiniLM (keeps `vectors.json`) vs Apple `NLEmbedding` (recompute vectors). Default: spike Core ML first.
- Whether sample people ship only in demo / debug builds.

## Orchestration log

- 2026-11-16 (Fable): Nested-spawn test **passed** (Opus general-purpose spawned a Sonnet general-purpose and got its reply). Frontmatter fields checked against the docs (`name`, `description`, `model`, `tools` incl. `Agent`, `background`, `isolation: worktree`): all valid. The custom `manager` / `builder` files in `.claude/agents/` were created mid-session and are not loaded until the session restarts, so this run uses `general-purpose` agents with `model: opus` / `sonnet` and the same prompts.
- 2026-11-16 (Fable): M1 builders run **without worktree isolation, one at a time** in the main checkout. Reason: `ios/` is not committed yet, and an isolation worktree branches from committed `main`, so it would contain no iOS project. Revisit once `ios/` is committed (needs Vince's go-ahead to commit).
- 2026-11-16 (Vince): Run **one milestone at a time** to track usage. M3 (Find) and M4 (Voice) managers were stopped partway; their work so far is on branches `m3-find` (`Peepl-m3`) and `m4-voice` (`Peepl-m4`) and can be resumed later. M2 (Mindmap) continues alone on `m2-mindmap`.
- 2026-11-16 (Vince): M3 (Find) and M4 (Voice) now run **in parallel**, replacing "one milestone at a time" for these two. Each manager stays in its own worktree and simulator (`Peepl-m3` / `Peepl-M3`, `Peepl-m4` / `Peepl-M4`); M4 keeps out of Shell, Connections, Mindmap, AIClient and Find files so the two merge cleanly.
- 2026-11-16 (Vince): After the Opus managers and Sonnet builders hit the 5-hour usage limit mid-task, M3 and M4 are finished by **Fable 5.2 agents only** (one per milestone, no nested managers / builders).
- 2026-11-16 (Fable): Decision 4 (500 vs 200 people): **200**, using a Swift port of `pickDiverse`, because Group by City is a dense knot with 500. Scheduled for M5 with the demo-only seed; log any change. (Product-minor, per PLAN.md section 7.)
- 2026-11-21 (lead): Nesting test: lead can spawn quick agents (normal mode). The `quick` agent's echo reply arrived ("nesting ok").
- 2026-11-22 (Fable, animation plan, Vince approved): defer the hero avatar `matchedGeometryEffect` (5.1); use the system `scrollEdgeEffectStyle(.soft)` for the Connections list fade (3.3) instead of a custom mask; one shared `PastelAura` with drift capped at 30 fps and stopped under Reduce Motion (6.6, 7.9).
- 2026-11-21 (lead, animation M3): m3d first FAILED validation (4 spots ignored Reduce Motion: waveform bar fades, transcript word fades, symbolEffects); fixed by a builder, re-validated. `.appear` stagger stays at the shared 40ms step, not the plan's 60ms for Find/Add cards. m3a: the tab icon bounce fires on both the old and new icon (accepted); the close X rotates in but has no rotate-out on dismiss (gap, with the M4 shrink-into-button work).

- 2026-11-21 (lead, animation M4): m4b first FAILED validation (shrink-into-X measured in the wrong coordinate space); fixed by measuring the X centre in a named "host" space on the LayerHost ZStack, re-validated PASS. 5.1 hero avatar match stays deferred (user). Accepted gaps: `.appear` 40ms not 60ms, 3.4 scrollTransition, 7.6 progress dots, 8.5 line-count shortcut, 8.9 typing-outline fade, swipe-follow uses UIScreen width. The m3a tab-bounce and close-X rotate-out gaps are closed by m4b.

- 2026-11-21 (lead, iOS fixes M5a): the white band fix took 3 rounds (a recolour was rejected; the ground then moved out of the depth container; finally the mindmap tab does not scale or offset at all). Side effect: the mindmap no longer recedes under a profile, only a 5% dim. `closeOrigin` defaults to (0.1, 0.1) until the X is measured; `revealOrigin` is now only the open point set by the ask bar.
- 2026-11-21 (lead, iOS fixes M5b): `Nav.pop()` resigns first responder in the same transaction as removing the layer, with no `keyboardWillHide` curve, so keyboard / layer sync is approximate. Autofocus on open is immediate and may need a 0.1-0.2 s delay. A profile back over a focused Find also drops its keyboard. The ask bar fades and offsets while an Add or Find layer is up (`covered`).

- 2026-11-22 (Vince): **People stay on the device; the backend holds accounts only** (plus consent and AI usage counts). This reverses the earlier recommendation to delete Supabase: a new Supabase project is used for accounts, never for people. Per-user AI limits, crash reporting, consent for OpenAI, a privacy policy and robust export / restore are all in scope for the friends-and-family TestFlight beta. Plan: `PLAN.md` section 11.
- 2026-11-22 (Vince): **Confirmed D1-D7** (`PLAN.md` section 11.1): Sign in with Apple only; app works without an account, AI needs one; Supabase for accounts only; per-user daily quota in Postgres; App Attest kept; crash reports via Apple's Organizer / TestFlight (no Sentry, Vince 2026-11-22); no cloud copy of people. **Accounts, quotas and consent (D1-D5) now only matter if the OpenAI opt-in ships (see below).**
- 2026-11-22 (Vince): **MVP scope** after the Dex / Mesh competitor research: iOS only (Android later); no cross-device sync and no cloud copy of people, everything 100% on device; moving devices is a Back up file the user emails or AirDrops to themselves and Restores on the other device; add a **losing-touch nudge**. Plan: `PLAN.md` section 12.
- 2026-11-22 (Vince): **AI is on-device by default: rules + on-device embeddings (option A) plus Apple Foundation Models (option B); OpenAI is opt-in only, off by default.** The model parses questions and explains a short candidate list; code does the retrieval. Must pass the test plan in `PLAN.md` section 12.4 before it replaces OpenAI as the default. Reason: 100% on device, no accounts or quotas needed, a stronger privacy story than Dex and Mesh. Supersedes the 2026-11-16 "keep OpenAI" line.
- 2026-11-22 (Vince): **Anyone may edit `DECISIONS.md`.** The old "only Fable edits this file" rule is removed because Vince no longer has access to Fable.

- 2026-11-22 (lead, MVP-1): Notifications are out of the MVP; nudge thresholds 30 / 60 / 120 days (closeness 3 / 2 / 1 or unset) adopted, snooze 30 days; OpenAI switch (`peepl.openaiEnabled`) shipped, default off, gates every `AIClient` call; backup is a share-sheet file with Merge (default) / Replace restore.
- 2026-11-22 (Fable): Nested spawns from the lead do not survive the lead's turn ending (W1b validator and builder ended with no output); W1b runs in flat fallback: orchestrator spawns builders and validators, lead merges and writes docs.
- 2026-11-22 (Fable, Vince delegated overnight): GO on MVP-3 on-device AI; p50 ~2.2 s on the Mac simulator misses the 2 s mark, so Find shows the instant rules result first and upgrades when the model answers. Model prewarm crashed the Simulator test host and was dropped.
- 2026-11-22 (Fable): The on-device upgrade may re-run code retrieval with model-parsed constraints (PLAN 12.2); every shown person still comes from code retrieval through the guarded explain, and an empty re-run never replaces a non-empty instant result.
- 2026-11-22 (Vince): The OpenAI opt-in ships in the MVP, default off. So the App Privacy label and privacy manifest must declare the optional data (notes and questions sent for AI), a consent step is shown before the first OpenAI use, and a privacy policy page is needed. Section 11 accounts / quota / App Attest come back as prerequisites for any public OpenAI use (need Vince: Supabase project, Apple Developer enrollment).

- 2026-11-22 (Vince): **Onboarding flow approved** (spec: `ONBOARDING.md`): iOS only, no account, skippable, about 6 screens (Welcome, Problem, How it works, one question, Privacy, Try it) plus one-time in-app tips and a Settings "How Peepl works" replay. Shown only when there are no people and onboarding is not done; `-PeeplSkipOnboarding YES` skips it in tests.
- 2026-11-22 (Vince): **open-design mockups come before the SwiftUI build** of onboarding (O2 before O3).
- 2026-11-22 (lead): **Privacy copy must not claim voice never leaves the phone.** `Speech.swift` only requires on-device recognition when the device supports it. Use the qualified line: "Voice notes are turned into text on your phone when your iPhone supports it." The Settings About text has the same issue and is still to be decided.

- 2026-11-22 (Vince): **Onboarding v4: 8 steps** (was 12) in three acts. Guide character Pip kept (a blob never used by Jordan or the user's first friend). The Next control appears after 1 second. Theo Park stays the "coffee in SF" answer.
- 2026-11-22 (Vince): **No interactive tasks in onboarding.** Demos auto-play to show it is doable; the user only taps to advance, Back or Skip (step 7's choice chips excepted). The real how-to happens in the app.
- 2026-11-22 (Vince): **Demos use the real iOS app UI**, shown with some 3D (tilted, layered screens and cards in perspective).
- 2026-11-22 (Vince): **Header is the act title only** (no "Part 1 of 3", no replay button); Back left, Skip right, a long progress bar fills the space between. Animations on every content piece, mostly ease-in-out; motion table embedded in `ONBOARDING.md` section 4.
- 2026-11-22 (Vince): **First-run flow lives in the real app**, replacing the old "Try it" step: onboarding ends with "Add your first friend", a coach callout points at the add button, the first Add shows a "Try to cover" checklist that ticks live, past meetings parse to a met date ("Met 2023"; year only when the month is unknown, stored as a short string in the first Moment's date), "Add another" reopens the composer at once, and the saved person plops onto the mindmap (spring, ripple, nudged neighbours, links draw in, light haptic) when Add closes. The mic primer moves to the first mic tap in Add.
- 2026-11-22 (lead): **Open:** importing from iOS Contacts (not in scope); `lifeStage` shows only 4 values ("Met in college" etc.), Vince to confirm. **Bug logged, fix in T3:** the empty Mindmap state overlaps the title with the status bar / top controls.

- 2026-11-22 (Vince): **Onboarding v5.** Steps 5 and 6 show the real app UI pieces directly as layered 3D panels (perspective, idle float, parallax), no phone frame, note text at least 15 pt.
- 2026-11-22 (Vince): **Progress bar is three segments** (The story 4, Learn by doing 2, Make it yours 2), small gaps, Back to Skip, filling per step within each act. Act title stays, no "Part x of 3". VoiceOver: "Step N of 8, act name".
- 2026-11-22 (Vince): Pip's step 5 line is "Misheard a name? Tap it later to fix it."
- 2026-11-22 (Vince): **iOS Contacts import is out of scope for now**; it is its own flow, not part of onboarding.
- 2026-11-22 (Vince): **"Yesterday" and "last night" are not saved as today**: they set the previous calendar day (local time; last night after midnight before 5 am too). This morning / today / tonight = today, the day before yesterday = 2 days back, last week = 7 days back (shown by month), last month = month precision.
