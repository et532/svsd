# rel-a validation: PASS (with 2 non-blocking findings)

- Acceptance: due() truth table, launch-hook test, cleanup test present and green. Suite on own sim: 152 tests, 1 skipped, 0 failures.
- Files: only brief files plus .orchestration/reports/rel-a.md. merge-tree clean against main (tree c517250). No secrets, build or xcodeproj committed. No network code.
- Reminder rule: correct. Zero people false; 7 day gap via lastBackupReminderAt; baseline and firstLaunchAt set on first launch, so no nag on fresh install; runs in .task after Seed.loadIfEmpty and only says a toast, never blocks. Not on every launch (tested).
- lastBackupAt written at export, not on share completion: brief says "when an export is shared", a ShareSheet cancel still counts. Acceptable deviation (sheet gives no completion signal here); low severity.
- Cleanup: sheet onDismiss deletes lastShared, fires on cancel too. Finding 1 (minor): Backup.swift export(), if the re-read validation guard throws, the temp file already written is not removed (stray file until OS clears temp). Not a data risk.
- Finding 2 (edge, low): release install tapping "Try with sample people" after first launch (baseline 0) gets a reminder after next launch for 500 samples. Brief's baseline rule is honored; it is a one-time nag, then 7 day gap. Not blocking; could reset baseline in Seed.loadSamples.
