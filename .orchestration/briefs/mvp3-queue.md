# MVP-3 queue (PLAN.md 12.3 W2-W5), flat fallback
Base: main after task/w1b-fix is merged. Each task: builder -> independent validator (brief + branch only) -> lead merges on PASS.
1. mvp3-a (W2+W3 Find, adds Search.answer(constraints:) and LocalAI.upgrade). Goes first.
2. In parallel with 1: mvp3-d (W5 Settings status; only SettingsView + its test).
3. After a is merged: mvp3-b (W4 Add parse), then mvp3-c (W4 drafts). b and c both edit LocalAI.swift, so they run in sequence (b then c); b also touches AddView, c touches FindView, so there are no other overlaps.
Parallel pairs: a with d; b with d (if d is still running). Never a, b, c together (shared LocalAI.swift).
One simulator per agent (Peepl-W1, Peepl-MVP1).
After all merge: full suite, then update PLAN.md 12.3 (W2-W5) and run the eval with TEST_RUNNER_PEEPL_RUN_EVAL=1 for a regression check.
