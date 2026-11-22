# onb-spec validation: PASS

Branch task/onb-spec. Changed files vs main: ONBOARDING.md only (allowed).

Checks
- Em dashes (U+2014): 0.
- Required sections present: per-screen layout with tokens (3.1-3.6), exact copy, motion/Reduce Motion, accessibility, persistence keys table, gate logic + `-PeeplSkipOnboarding` flag, entry/exit/skip paths, files touched (sec 6), T1/T2/T3 with acceptance, 7-screen mockup brief, all requested research links (HIG onboarding, firstround + appcues Duolingo, irrationallabs + appcues Headspace, screensdesign Strava, NN/g, HIG accessing-private-data).
- Flow matches: 1 Welcome, 2 Problem, 3 How it works (3 cards), 4 one question (5 options), 5 Privacy, 6 Try it, 7 tips (sec 5).
- File counts: T1 = 5, T2 = 4, T3 = 5 (plus skip flag edits in existing UI tests). All within ~5.
- Code claims verified under ios/Peepl: AIClient.enabled = openaiEnabled && Consent.agreed; Speech.swift:33 requiresOnDeviceRecognition = supportsOnDeviceRecognition; authorize() exists; Seed.loadSamples (Seed.swift:61); Motion.snap/pop/layer/animation(_,reduce:)/appear; Theme.font/mono/night/ink/inkMuted/glass; PeeplNoSeed and PeeplInMemory (Seed.swift:39-42, M5FlowUITests); "Use OpenAI" toggle and openSettingsURLString in SettingsView; PastelAura, Composer, AddView, FindView ("Occasion" card tuple), Nudges, Backup.restore exist.

Minor notes (non-blocking)
- Spec says "6 screens plus tips" while the flow lists 7 items; consistent since 7 is tips.
- Spec mentions a "haptics helper" without a name; haptics exist in several files but no single helper was confirmed.
- "Theme.pastel" is referenced; not individually grepped (glass() exists).
- Nothing built or run; spec only.
