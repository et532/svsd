# mvp3-c validation: PASS

- Chain in LocalAI.message: switch on -> AIClient.draft only (its own template fallback on failure/empty, unchanged); else on-device; else template. 
- Unavailable case: draft returns nil at the isAvailable guard, so the template appears immediately (no 6 s wait). The 6 s wait happens only while a real model call is in flight.
- Name check (first name required), empty -> template, facts from draftFacts (one person only).
- Copy/Share/tick-off untouched; FindView change is one line. explain/upgrade/parseNote/validated unchanged (diff adds draft pieces only).
- Tests need no model; include switch-on path (testSwitchOnKeepsOpenAIPath). Gap: switch-on with OpenAI failure not tested here (covered by existing AIClient.draft code).
- Files changed all allowed (plus report). Merge-tree into main clean (no conflicts). No build/xcodeproj/secrets tracked.
- xcodebuild test: 154 tests, 1 skipped, 0 failures. Sim deleted.
