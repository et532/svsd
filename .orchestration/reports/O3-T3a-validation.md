# O3-T3a validation: PASS

- Unit (scheme Peepl): TEST SUCCEEDED. UI (scheme PeeplUI): only the two known failures (M5FlowUITests testProfileTodoTagConnectionsDelete, testMomentWithSomeoneYouKnowOpensExpanded); no new failures.
- Files changed are all on the allowed list (SearchTests.swift not touched, optional). Models.swift untouched.
- 6c table: all 30 rows asserted in CaptureTests.testMetDateTable (29 in the loop plus the 02:00 local-time row), each expected string cross-checked against ONBOARDING.md. Month-boundary test present (2026-12-01 -> 2026-11-30), plus a January last-month case.
- parseMetDate / parseLifeStage never call Date(); `today` injected, local Calendar. Only createPerson passes Date() in.
- DECISIONS.md: three 2026-11-22 entries (life stage, Contacts out of scope, v5 polish). ONBOARDING.md updated. No em dashes added.
- Life-stage heuristic: label(for:) shows life stage only if lifeStage is one of the four and (no first moment, or first moment date == lastContacted). Sample people with dated moments keep dates (tested). Matches the brief.
- Padding: Ask.date and Search.days use Capture.padDate; Ask test added ("2023" -> 3y ago). No Search-specific test (only padDate unit test).

Minor risks (non-blocking):
1. Heuristic limit: once a dateless person is contacted on a later day, the date label replaces "Met in college" (documented in code).
2. testPastMeetingSetsFirstMomentDate uses real Date() year; fine until it straddles New Year at test time.
3. ONBOARDING.md 6c text for display was only lightly edited; DECISIONS note supersedes it.
