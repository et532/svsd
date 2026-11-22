# w1b-fix validation, attempt 2 (69a2998): PASS

- Guard in real path: LocalAI.explain is the only entry returning ids; merge only emits ids from `matches` (picked deduped in model order, then unpicked in retrieval order); empty matches returns [] without a model call; all-invalid/nil reply gives retrieval order. modelPicks is private; parseQuery returns Constraints, not ids.
- testExplainGuard covers the five cases, no model needed.
- Eval skips without PEEPL_RUN_EVAL=1; report "Running it" has full command.
- No prewarm leftovers (grep clean).
- Diff vs c6efed6: LocalAI.swift, FoundationModelsEvalTests.swift, w1b-eval.md/json only. Fixtures unchanged. No xcodeproj, ios/build or secrets tracked.
- Normal suite on own simulator: 137 tests, 1 skipped, 0 failures.
- Eval run (TEST_RUNNER_PEEPL_RUN_EVAL=1): succeeded; arm b no-match 5/5 original, 3/3 held-out, invalid ids 0. Rewritten reports reverted; simulator deleted.
