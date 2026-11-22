# m4b validation: FAIL (one defect, shrink-into-X target)
Branch task/m4b f155295 vs d81a407.
- Files: only ios/Peepl/Screens/Shell.swift and ios/Peepl/Components/TopControls.swift changed. No nav/layer files touched (Nav lives in Shell.swift, allowed). Reveal.swift not touched.
- Build: xcodegen + xcodebuild generic iOS Simulator = BUILD SUCCEEDED.
- Reduce Motion: depth scale/offset skipped when reduce (opacity dim stays, ok); glyph rotate skipped; animations via Motion.animation. OK.
- Depth not applied to Add/Find: depth = 0 unless nav.layers.last is a profile. OK.
- Swipe-follow: nav.dragProgress = min(1, dragX/UIScreen.main.bounds.width), depth = 1 - dragProgress; reset on cancel and after pop. OK.
- Tab bounce: per-icon counter bumped only when tab != t. OK.
- Close glyph reverse: glyphShown=false then pop. OK.

Critical Bug: Shrink-into-X origin uses the wrong coordinate space
Shell.swift ~L145-148 computes the X center with .frame(in: .global) and divides by UIScreen.main.bounds.size. But RevealTransition/CircleReveal (Reveal.swift) resolves the UnitPoint against the clipped LayerHost's own rect, which is the safe-area-inset size (only the backgrounds use ignoresSafeArea). So the unit point is relative to the full screen but applied to the safe-area rect: y is off by roughly the top inset (about 50pt on a notched iPhone), so the circle shrinks toward a point below the X rather than into it. x is nearly right.
**Fix Required:** compute the center in the layer's own space, e.g. .frame(in: .named("layer")) with .coordinateSpace(name: "layer") on LayerHost's ZStack, and divide by that container's size (GeometryProxy size of the ZStack), not UIScreen.main.bounds.
Not verified at runtime (no simulator); the mismatch is from reading the code.
Minor: nav.revealOrigin is overwritten by the X on every geometry change, so later opens rely on the ask bar resetting it (it does, AskBar.swift L46/51/58).
