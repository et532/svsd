# mvp3-a validation: PASS (attempt 2, commit 5385908)

Diff 45fc327..5385908: only LocalAI.swift (+1 line: return nil when the re-run has no matches but the instant answer had some) and LocalAIUpgradeTests.swift (+16, three empty cases). Retrieval code untouched, so no eval rerun; attempt 1 eval matched main (arm a 66% / 56%, arm b 88% / 83%, no-match 5/5 and 3/3, invalid 0).

Suite on own simulator: 144 tests, 1 skipped, 0 failures. Simulator deleted.

Corrected rule: every shown person comes from code retrieval via explain's guard; the model never injects ids. All earlier checks hold (allowed files only, guard unchanged, instant result first, stale upgrade ignored by seq, OpenAI path untouched, specials never upgraded). The empty re-run no longer replaces a non-empty instant result.

Note: test case (2) asserts nothing if the upgrade returns nil, which is fine.
