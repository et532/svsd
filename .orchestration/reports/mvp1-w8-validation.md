# mvp1-w8 validation: PASS (with minor notes)

Commit b67baa5 on task/mvp1-w8, checked in a detached worktree, simulator Peepl-MVP1, local derivedDataPath.

- Acceptance: xcodegen + xcodebuild test: 132 tests, 0 failures, TEST SUCCEEDED (8 new BackupTests incl. 500-person restore).
- Files changed: Backup.swift, SettingsView.swift, ConnectionsView.swift (EmptyPeople only), BackupTests.swift, plus PeopleStoreTests.swift (one-line call-site fix, accepted). No forbidden files touched.
- Restore cannot partially apply: read() validates version, empty/duplicate ids (people, todos, moments) before any change; restore does one context.save(), context.rollback() on throw; name fixes written only after save succeeds. Bad JSON / newer version / dup ids tested to leave store unchanged. Not tested: a throw injected mid-restore (rollback path is by inspection only).
- Replace: file wins for every id in the file (fill() overwrites fields, todos, moments), people not in the file deleted. Ids unique (validated). Links: kept people take the file's knows, so no dangling links; uses context.delete, not PeopleStore.delete, but result is equivalent (test checks only "a" remains and moment count 1). Name fixes replaced wholesale on Replace; merged with phone winning on clash on Merge.
- Merge: adds new, newer lastContacted wins, tie more moments, else phone kept and gains missing moments/todos by id; never deletes.
- Share sheet: temp file `Peepl backup YYYY-MM-DD.json` (POSIX local day), written atomic, re-read and validated (count match) before UIActivityViewController; failure -> nav.say, nothing shared. fileExporter removed. Only unit-tested via export(); the sheet itself not exercised in UI.
- EmptyPeople third button uses same .backupImporter modifier as Settings. No network use. Version/exportedAt/counts optional; old file decodes (tested).
- Minor notes: temp backup files are never deleted; Dictionary(uniqueKeysWithValues:) on phone people would crash if the store ever held duplicate ids; the confirmation dialog's Merge is not visually "prominent" beyond being first (confirmationDialog limits styling); UI flows not run on device.
