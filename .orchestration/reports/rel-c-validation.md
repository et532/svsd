# rel-c validation: PASS

- Changed files: only ios/PeeplTests/PrivacyManifestTests.swift and .orchestration/reports/rel-c.md. Manifest ios/Peepl/PrivacyInfo.xcprivacy unchanged vs main; plutil -lint OK.
- Manifest: tracking false, domains empty, OtherUserContent (Linked false, Tracking false, AppFunctionality), UserDefaults CA92.1. Test asserts all of these.
- Grep of ios/Peepl: UserDefaults (declared). No file timestamp, disk space, systemUptime, mach_absolute_time or activeInputModes use. FileManager only writes and removes the backup temp file (no timestamp reads).
- Note/question for Vince: CACurrentMediaTime is used in MindmapView.swift and MindmapModel.swift. It wraps mach_absolute_time but is not in Apple's listed required-reason symbols; no declaration added. Low risk, flag if App Store review complains.
- Speech.swift: sets requiresOnDeviceRecognition only when supported, otherwise Apple's own speech service. Audio goes to Apple, not to the developer, so no collected-data declaration needed. Judged, not a failure.
- Suite on own simulator (iOS 27.2): 159 tests, 1 skipped, 0 failures. Sim deleted.
