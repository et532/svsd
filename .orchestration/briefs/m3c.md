# Task c: Find
Owner: lead   Builder: sonnet
Goal: Plan 7.1-7.7 (skip 7.8/7.9 aura). Use shared Shimmer (delete private Thinking pulse).
Files you may touch: ios/Peepl/Screens/FindView.swift
Do not touch: any other file (esp. Motion.swift, Shimmer.swift, other screens)
Branch task/c from main HEAD 1bb4fb9 (verify `git log -1` in your worktree; if not, `git reset --hard 1bb4fb9`). Spec: ios/ANIMATION_PLAN.md (read the listed sections plus 1, 9.2, 10). Main has ios/Peepl/Motion.swift (Motion tokens, PressStyle, .appear, Motion.animation(_:reduce:)) and Components/Shimmer.swift; use them, do not redefine. Reduce Motion: honor via Motion.animation helper or .opacity transitions; no looping animation under Reduce Motion. Include the section 10 haptics belonging to these files (.sensoryFeedback). Do not commit ios/build or the xcodeproj; commit your work on the branch (git add only listed files).
Acceptance check: in ios/: xcodegen generate && xcodebuild build -project Peepl.xcodeproj -scheme Peepl -destination "generic/platform=iOS Simulator" -derivedDataPath build succeeds (no simulator runtime; do not run tests). Validator should also check: no file changed outside the list (git diff --stat main...branch), diff matches the listed plan items, Reduce Motion honored.
If blocked: stop and report. Do not guess at scope changes.
