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
