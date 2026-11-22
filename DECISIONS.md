# Decisions

Newest at the bottom. Only Fable edits this file. One line each: decision, reason, date, who decided.

## Settled

- 2026-11-16 (Vince): Rewrite Peepl as a native app instead of wrapping the web app in Capacitor. Reason: native Liquid Glass, on-device voice, storage iOS will not evict.
- 2026-11-16 (Vince): **SwiftUI, iOS only**, not React Native. Reason: Apple-only goal; native glass and Speech framework.
- 2026-11-16 (Vince): First milestone is the **core loop** (list, profile, typed Add, persistence); mindmap, Find and voice follow.
- 2026-11-16 (Vince): **Keep OpenAI** behind the existing `/api/ai/*` endpoint for parse / rank / draft, instead of on-device AI. Reason: Vince is already building the parser there.
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
- Supabase layer: delete, or add auth + per-user RLS (delete recommended).
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
