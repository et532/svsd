# Validation mvp1-w6: PASS
Checks run:
- xcodegen + xcodebuild test (sim Peepl-MVP1, worktree-local derivedDataPath, detached worktree of cab375d): TEST SUCCEEDED, 135 tests, 0 failures (last suite line; includes the 3 new AIOptInTests).
- Ungated-network grep over ios/Peepl (URLSession, .data(for, URLRequest, URL(string, AppAttest, DCAppAttest): only network call sites are AIClient.send (line ~26) and AppAttest.swift (challenge/attest posts via AIClient.session). AppAttest.token is called only from AIClient.send, after the `enabled` guard; AppAttest.swift is reachable only through it. SettingsView URL use is the iOS Settings deep link, not a network call. AddView/FindView only call AIClient.parse/rank/draft, all gated.
- Gate present in send, parse, post, rank (returns input result), draft (returns template or plain hello) before any work. Default false via UserDefaults key peepl.openaiEnabled.
- Settings: new Section "AI help from OpenAI" with @AppStorage toggle on the same key, footer text matches the brief verbatim; About text replaced and now accurate. Back up / Restore sections untouched.
- Tests: AIOptInTests covers default off, off -> 0 requests, 0 token fetches, parse nil, rank unchanged, draft template and plain fallback; on -> 1 request. Existing suites enable in setUp, tearDown sets false.
Files touched vs allowed: ok. Changed: SettingsView.swift, AIClient.swift, AIClientTests.swift, AIOptInTests.swift, AIRankDraftTests.swift, plus AppAttestTests.swift (setUp/tearDown only; accepted by lead).
Problems: none. Minor note: the draft fallback string is duplicated from the existing plain-hello text rather than shared (not a bug). Not run: manual UI check of the Settings toggle.
