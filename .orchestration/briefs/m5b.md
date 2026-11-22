# Task m5b: keyboard slide + ask bar / add button transition
Owner: lead   Builder: sonnet
Branch task/m5b from main HEAD 270f6e6 (verify `git log -1`; if stale `git checkout -B task/m5b main`).
Files you may touch: ios/Peepl/Screens/Shell.swift, Components/AskBar.swift, Components/Composer.swift, Screens/AddView.swift, Screens/FindView.swift. Anything else: stop and report.
Read ios/ANIMATION_PLAN.md (sections on layers/keyboard), ios/Peepl/Motion.swift (use tokens, Motion.animation(_:reduce:)).

Problem: closing the keyboard or tapping X removes the background, the keyboard vanishes instantly, and the ask bar and add button just appear.
Goals
1. Keep focus through the close: tapping X (or dismissing) must NOT resign first responder before the layer's removal transition; let the layer's removal and the keyboard's native dismissal run together (the keyboard goes away because the focused view leaves the hierarchy, animated with the system curve), instead of an instant jump. If you must drive it, use the keyboard notification's duration/curve (UIResponder.keyboardWillHideNotification userInfo) for the layer animation.
2. Opening: the keyboard slides up together with the circular reveal (focus timing so the system keyboard animation overlaps the reveal; Composer focus currently may be delayed or immediate, review).
3. The AskBar (ask pill + add button) underneath must transition smoothly with the keyboard/layer: no instant pop-in on close. E.g. keep it mounted and animate its opacity/offset in sync with nav.layers changes (use the same Motion.layer timing) rather than appearing after the layer is gone.
Reduce Motion honored (opacity fallbacks). Do not regress m5a: separate open/close reveal origins, X fast fade, background layers outside the depth container.
Acceptance: in ios/: xcodegen generate && xcodebuild build -project Peepl.xcodeproj -scheme Peepl -destination "generic/platform=iOS Simulator" -derivedDataPath build succeeds. No simulator runtime; do not run tests. Never commit ios/build or the xcodeproj; commit listed files on the branch. Final message: files changed, check result, surprises, what needs device verification (keyboard timing).
