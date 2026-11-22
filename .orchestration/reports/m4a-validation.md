# m4a validation: PASS (commit 9001fbc)
- Diff vs d81a407 touches only PastelAura.swift (new), AddView, FindView, ProfileView: allowed.
- xcodegen + xcodebuild generic iOS Simulator: BUILD SUCCEEDED (detached worktree, removed without force).
- PastelAura: no .blur; TimelineView(.animation(minimumInterval: 1/30, paused: reduceMotion)) with t = 0 when reduced, so static.
- Scroll: ProfileView.aura is re-evaluated on scroll (scrolled @State) but PastelAura is Equatable, used via .equatable(), and compares only orbs (constants), so body is not redone. Not profiled at runtime.
- Colors: same hexes, sizes, offsets (Profile uses blob.soft); 0.6 opacity moved into gradient stops (0.6/0.35/0) as an approximation of the blur look. Visual match not verified on device.
- Optional 5.7: hero avatar scale 1 to 0.85 plus fade via existing `scrolled`. Present.
- Not run: tests (per brief), simulator visuals.
