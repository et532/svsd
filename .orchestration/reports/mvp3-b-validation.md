# mvp3-b validation: PASS
- Tests: 149 run, 1 skipped, 0 failures (own sim, deleted after).
- Files: only LocalAI.swift, AddView.swift, LocalAINoteTests.swift, mvp3-b report. No secrets/build/xcodeproj.
- Chain: switch on and OpenAI returns nil goes straight to regex (no on-device fallback). Off: on-device, nil gives regex. Add always gets a parsed person (regex computed first, merged(with: nil)).
- validated() uses localizedCaseInsensitiveContains, same as AIClient.found; case-insensitive OK ("voltcell"/"Voltcell"); accents match when the note has them (not diacritic-folded, so "Sofia" vs "Sofía" drops, which is the safe direction).
- 3 s timeout via within(), clip 1500 (tested with long note). explain/upgrade untouched. dedupeTodos is applied in createPerson path unchanged.
- Gap: switch-on path not tested (only default-off asserted); AIClient.enabled has no seam. Minor.
