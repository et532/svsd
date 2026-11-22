# rel-e validation, attempt 2: PASS

Branch task/rel-e at 03e864c (on b72b619, 5a38b9e; base main cd5adaf). Changed files: public/privacy.html and .orchestration/reports/rel-e.md only.

Earlier gaps
- A (other person's name in drafts): now stated in the draft bullet, privacy.html:46. Code: AIClient.swift:136 sends `action.goal ?? action.draft`; Ask.swift:328, 359, 364 put names in drafts. PASS.
- B (App Attest): paragraph at privacy.html:48. Code: AppAttest.swift:29-42 sends keyId and attestation (plus a challenge request), receives token with expiry; only reached from AIClient.send, which requires the switch (AIClient.swift:25). Token is short-lived (server/appAttest.ts:52-55). PASS. Minor: a fresh key is made for each token (AppAttest.swift:38 comment), so "identifies the install" is slightly loose but not misleading.
- C (IP): privacy.html:49. Code: clientIp server/ai.ts:101, in-memory Map :68-82, per-IP and per-device limits :249. No logging or storage in server/ai.ts, appAttest.ts, api/ai. Page claims only Peepl's code, not Vercel's. PASS.

Earlier checks, unchanged and still passing
- parse sends {text} only (AIClient.swift:48); rank sends query + up to 12 candidates with job, lives, from, met, tags, story (240), 2 recent (120), no names or ids (:89-90,106-109); draft sends facts + first name + kind + goal (:135-136). Page matches field for field.
- Default off (AIClient.swift:11-14); Settings copy SettingsView.swift:63-66 agrees.
- Speech on device when supported, Apple servers otherwise: Speech.swift:33; no Peepl network use.
- On-device model: LocalAI.swift, AddView.swift:158,162, FindView.swift:134, LocalAI.swift:338-346.
- Backup local file, temp file removed: SettingsView.swift:48-52,79; Backup.swift:54,182.
- No account, cloud, sync, analytics or crash SDK: grep of ios/Peepl found none.
- Remaining server interaction check: only /api/ai/{attest-challenge,attest,parse,rank,draft}; all disclosed. No other URLSession use.

Scope and format
- Placeholders exact: privacy.html:51 and the support email line. No invented email, no OpenAI terms.
- No external assets or scripts; viewport meta, max-width layout, dark mode media query. HTML parses.
- `npm run build` succeeded on this branch earlier (dist/privacy.html present, then removed); the attempt-2 edits are text only. No deploy. No em dashes found in the page.
