# Validation O3-T2b: PASS
Checks run:
- Unit tests (scheme Peepl, iPhone 18 Pro): 181 executed, 1 skipped, 0 failures. PASS.
- UI tests (scheme PeeplUI): 17 executed, 3 failures on the first run.
  - M5FlowUITests.testProfileTodoTagConnectionsDelete: known pre-existing failure.
  - M5FlowUITests.testMomentWithSomeoneYouKnowOpensExpanded: re-run alone on the branch still fails (M5FlowUITests.swift:242). Re-run alone on main also fails, so it is pre-existing and not from this branch. It is not flaky, it fails consistently.
  - OnboardingUITests.testGetStartedThroughToTheEmptyList: failed once at line 19 (onboardingBack/Skip existence assert on step 1). It passed when OnboardingUITests was re-run (2 tests, 0 failures). Treated as a flake. Worth watching.
- Polish 1 (no empty beat): step6 cue[3]=7.0 swing, cue[4]=typing start 7.2, swing end 7.8. Test testStep6TypingStartsBeforeTheMindmapIsGone asserts typing start <= swing end. Total 16.0 asserted in the timeline test. PASS.
- Polish 2: .padding(.top, 36) on the ask bar in FindPanels (OnboardingDemos56.swift). PASS.
- Polish 3: reason "Furniture maker from Gowanus. He is in San Francisco that week, and always up for coffee." The draft bubble is kept. A test checks "San Francisco" and no em dash. PASS.
- No phone frame or bezel: grep test over OnboardingDemos56.swift. Panels use tilted3D layers 0, 1, 2. Text is 15 pt or larger throughout (mono 15, fonts 15 to 22). No em dashes in user-facing text. PASS.
- Reduce Motion: final frames are shown, then a cross-fade to scene B. VoiceOver has one label per demo. Hard-coded data only. PASS.
- ONBOARDING.md diff touches only the section 3.6 lines. PASS.
Files touched vs allowed: ok. OnboardingDemos56.swift is a new T2a-helper-style file under Screens/Onboarding (accepted). OnboardingKit.swift also changed (the step5/step6 DemoScripts); it is a T2a helper under Screens/Onboarding, so it is within the allowed "T2a helper file" clause.
Problems: none blocking. Minor: the step 6 Reduce Motion test coverage is only by code reading (no dedicated test for the final frames beyond the script checks). OnboardingUITests line 19 may be intermittently flaky.
