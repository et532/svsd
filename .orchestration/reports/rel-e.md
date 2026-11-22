# rel-e: claims in public/privacy.html

- Data on phone, no cloud copy, no sync: SettingsView.swift:44 ("Everyone you add stays on this device"); CLAUDE.md MVP scope. No network code except AIClient.send (AIClient.swift:24-25).
- No analytics / ads / tracking: PrivacyInfo.xcprivacy:5-8 (tracking false, no domains); grep for Analytics/Sentry/Firebase found none.
- Nothing shared with other users: SettingsView.swift:64, :71.
- Back up is one file the user shares: Backup.swift:5, :53-58; SettingsView.swift:41-43. Peepl does not keep it: Backup.swift:182 (temp file deleted).
- Voice: Speech.swift:33 `requiresOnDeviceRecognition = rec.supportsOnDeviceRecognition` (on device only when supported; otherwise Apple's server may be used). Not forced. No voice upload to Peepl/OpenAI: AIClient sends only text (AIClient.swift:48, :109, :136).
- On-device model for Find/Add/drafts: LocalAI.swift:10-18 (availability), AddView.swift:158,162 (LocalAI.parseNote when OpenAI off), FindView.swift:134 (LocalAI.upgrade), LocalAI.swift:338-346 (draft chain).
- OpenAI switch off by default: AIClient.swift:10-15, SettingsView.swift:35, :63.
- Only while on: AIClient.swift:25, :48, :95, :103, :134 (all guard `enabled`).
- Add notes sent: AIClient.swift:48 ("text").
- Find: up to 12 candidates; facts = job, lives, from, met, tags, story (240 chars), 2 recent moments, no id or name: AIClient.swift:88-91, :106-109. The question text is sent too (:109).
- Draft: AIClient.swift:135-136 sends the person's FIRST NAME plus the same facts and a goal. The page says "requests to draft a message" without naming this; see questions.
- Via Peepl's server: AIClient.swift:20, :25.
- Server rate limit per IP: server/ai.ts:66-80, :101, :206, :230 (in memory).
- Server code does not log notes: no console/log calls in server/ai.ts, server/appAttest.ts, api/ai/*.ts. Vercel platform logs are not covered by code and are not claimed.
- Crash reports not collected by Peepl: no crash SDK in ios/Peepl. Apple's crash sharing is Apple's feature (not verifiable in code).
- PrivacyInfo.xcprivacy:9-22 declares OtherUserContent, unlinked, no tracking, app functionality (the OpenAI path). Consistent with the page.
- Delete the app to delete data: standard iOS behaviour, not verifiable in code.
- vercel.json has no cleanUrls or rewrites, so the URL is /privacy.html; /privacy is not guaranteed. `npm run build` put privacy.html in dist/ (dist removed afterward).

## Disagreements with the brief
- Brief says the switch has "a consent step". No consent dialog exists on this branch (grep for consent: none in Swift). The page says "while it is on" and does not claim a consent step.
