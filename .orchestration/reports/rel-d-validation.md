# rel-d validation: PASS

Branch task/rel-d (4a725c6). Suite on own simulator: 162 tests, 1 skipped, 0 failures.

1. Gate: AIClient.enabled = switch && Consent.agreed. send() guards on enabled before AppAttest.token, so the attest-challenge and attest calls cannot fire without consent. parse, rank, draft and the Find/Add call sites all check enabled. Settings binding: ON without consent opens the sheet and leaves the switch off; Not now and swipe-dismiss only clear the sheet flag; onAppear turns the switch off if consent is stored below the current version. ConsentTests cover: switch on without consent sends 0 requests, with consent sends 1, old version not agreed.
2. Text vs payloads (AIClient.swift, privacy.html on rel-e): Add note, Find question plus facts for up to 12 people, draft first name plus facts plus other person's name: all accurate. Policy link is the .html URL. Minor omissions, not blocking: draft also sends the kind of message and its goal (Find question and why the person fits); Find/draft facts include story and recent moments (sheet says "short facts", "what you know about them"); the server sees the IP and App Attest runs while on. The privacy page covers these; the sheet links to it.
3. Consent line in 5 AI test setUps: necessary (enabled now needs consent, otherwise those tests would send nothing and fail). Assertions unchanged; only the setUp line differs. Allowed by the brief ("list them").
4. UI: Theme.font, Theme.night/ink/inkMuted, .pastel(), PressStyle, accessibility labels and header trait present; no animation added, so Reduce Motion is fine. Toggle-flow UI test not required by the brief (acceptance is logic-level); acceptable.
5. merge-tree with rel-c, rel-e, main: clean.
7. Only the listed files changed (plus the builder report); no secrets, build or xcodeproj.
