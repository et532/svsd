# rel-d report
Files: ios/Peepl/Screens/ConsentView.swift (new, Consent + sheet), SettingsView.swift (toggle intercept, onAppear reset), AIClient.swift (enabled getter also needs Consent.agreed), PeeplTests/ConsentTests.swift (4 tests). Consent line added in AIClientTests, AIOptInTests, AIRankDraftTests, AppAttestTests, LocalAIDraftTests.
Tests: 162 run, 1 skipped, 0 failures.
Corrections applied: policy URL is https://peepl-steel.vercel.app/privacy.html; consent text lists the exact payloads (note; question + short facts about up to 12 people; draft: first name + what you know, introduction: other person's name).
Not checked: sheet visuals on screen; the Settings toggle flow itself is not unit tested (logic is in the view).
