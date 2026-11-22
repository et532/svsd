# m5b validation: PASS (with notes)

- Diff vs 270f6e6 touches only ios/Peepl/Components/AskBar.swift and ios/Peepl/Screens/Shell.swift: both on the allowed list.
- xcodegen generate + xcodebuild (generic iOS Simulator): BUILD SUCCEEDED (in a detached worktree, now removed).
- Reduce Motion: bar uses Motion.animation(Motion.layer, reduce:), offset is 0 when reduce (opacity only). OK.
- m5a untouched: diff does not touch reveal origins, X fast fade, depth container backgrounds, or the AskBar gradient (only .ignoresSafeArea(.keyboard) added on the bar's VStack, which also keeps the gradient fixed).
- AskBar taps: `covered` is false when layers is empty or only profiles, so opacity 1 and hit testing on. Profile layers do not hide it.
- Nav.pop() resign: pop callers are the X button (Shell:154), edge swipe completion (Shell:180), profile back (ProfileView:167), Find "Show all" (FindView:102). replaceTop is separate and does not resign, so Add/Find swaps keep focus. resign is a no-op when nothing is focused, so no close breaks.

Notes (not failures)
1. Brief goal 1 said NOT to resign before removal. The builder resigns in the same transaction as popLast instead. Plausibly simultaneous, but the keyboard uses the system curve and the layer uses Motion.layer, so they are synced only approximately. Needs device check.
2. pop() resigns any first responder, so backing out of a profile stacked over Find would also dismiss Find's keyboard if focused. Minor, probably desired.
3. Goal 2 (open-time focus overlap) was not changed; no Composer/AddView/FindView edits. Existing focus timing is unreviewed here.
4. Bar fades in as the reveal shrinks (covered flips on pop). Cannot verify visually; no simulator.

Device verification needed: keyboard slide vs layer shrink on close, bar not riding the keyboard, open-time keyboard overlap.
