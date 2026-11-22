# m4b validation 2 (874583c): PASS
- Build: xcodegen + xcodebuild generic iOS Simulator succeeded (detached worktree, removed without force).
- Scope: `git diff 9001fbc...task/m4b` = Shell.swift, TopControls.swift only (the plain two-dot diff also lists PastelAura/Add/Find/Profile, but that is just main moving past the branch base, not branch changes). Reveal.swift untouched; no extra files.
- X fix: X centre measured via .onGeometryChange in .named("host"), the coordinateSpace set on LayerHost's own ZStack (before .offset(dragX)), divided by host size (onGeometryChange) into nav.revealOrigin. CircleReveal resolves origin as fraction of the clipped content's rect, which is that same LayerHost frame, so spaces match (and safe area cancels, since both use the same frame). Origin is set at appear, before pop, so the removal transition uses it. Not run on device.
- Reduce Motion: scale/offset off, glyph rotation off, Motion.animation helper used, transition falls back to opacity.
- Depth: only when top layer is a profile; Add/Find excluded. Includes AskBar/TopControls (inner ZStack). 0.96 scale, 0.85 dim, -30 shift as specified.
- Swipe-follow: nav.dragProgress = dragX/screen width, reset on end/pop.
- Tab bounce: per-icon counter incremented only for newly selected tab.
- Note (minor, not a fail): swipe uses UIScreen width, not container width; close glyph reverse animation is simple fade/rotate before pop.
