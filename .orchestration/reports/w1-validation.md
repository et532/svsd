# w1 validation: PASS
Branch task/w1-localai @ 5e346a4 (checked in its existing worktree .claude/worktrees/agent-affb335bb35e1f3dd, since the branch was already checked out there).
- Full suite: 136 tests, 0 failures, TEST SUCCEEDED (first run crashed with "Test crashed with signal kill before establishing connection"; after shutting down and rebooting the simulator, the rerun passed).
- Changed files vs 3420145: only the 5 allowed files (LocalAI.swift, FoundationModelsEvalTests.swift, eval-questions.json, w1-eval.md/.json).
- Dormant: LocalAI is referenced only in LocalAI.swift and the eval test; none in Screens/, ConnectionsView or other Logic/.
- explain (LocalAI.swift ~L164-190): output ids come only from `pool` (a prefix of candidates) by index; out-of-range and duplicate picks are dropped. Eval asserts invalidIds == 0 in arms a, b and c (FoundationModelsEvalTests.swift:188,196,198).
- Failure paths: unavailable, empty candidates, timeout and throw all return nil (`within`); non-FM builds return nil. FoundationModels import and use are under `#if canImport(FoundationModels)`. Note: an empty `fits` returns [] (the model says none fit), not nil; this is intended.
- Demo answers (climbing, SF trip, hardware intro) asserted in arm a (test lines 190-193).
- No secrets (only a doc line mentioning env var names), no xcodeproj or ios/build tracked.
- Test run rewrites w1-eval.md/.json in the worktree (uncommitted); expected.
