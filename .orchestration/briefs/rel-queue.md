# rel-small queue
No human decision, money or accounts needed. Each: builder -> independent validator -> lead merges on PASS. Flat fallback: the orchestrator spawns.
Files are disjoint from mvp3-c (LocalAI.swift, FindView draft Task, LocalAIDraftTests) and from each other:
- rel-a: Backup.swift, SettingsView.swift (sheet onDismiss), Shell.swift (launch hook), BackupReminderTests.
- rel-b: project.yml, BuildInfoTests.
- rel-c: PrivacyInfo.xcprivacy, PrivacyManifestTests.
All three can run in parallel (each with its own simulator, created and deleted by the builder). If only one simulator at a time is wanted: rel-b (smallest), rel-c, rel-a.
Merge order does not matter; after each merge the suite grows by one test file. Open question for Vince (not blocking): does the OpenAI opt-in ship in the MVP (PLAN 12.6 Q1)? It changes rel-c's manifest and the App Store label.
Not included (verified needs a human or conflicts with mvp3-c): privacy policy text, App Store Connect forms, signing / paid account, Supabase decisions.
