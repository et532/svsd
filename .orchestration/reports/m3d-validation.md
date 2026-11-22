# Validation m3d: FAIL
Checks run:
- xcodegen generate + xcodebuild (generic iOS Simulator): BUILD SUCCEEDED
- git diff --stat main...task/m3d: only ios/Peepl/Screens/ProfileView.swift (74+/31-)
- Diff vs plan 5.2-5.8: 5.2 appear(0-4), 5.3 (withAnimation smooth, transition, border fade, ScrollViewReader scroll, scale transition), 5.4, 5.5, 5.6, 5.8 bounce, .warning haptic on delete: all present. 5.1 and 5.9 skipped as briefed.
- Reduce Motion: state-change animations go through Motion.animation(reduce:) via go()/tr() and are gated. The following are NOT gated.
Files touched vs allowed: ok
Problems:
1. Waveform bar fade not gated: ProfileView.swift VoiceNote, `.animation(.linear(duration: 0.14), value: at)` on each Capsule uses a raw animation, ignoring `reduce`. Fix: `.animation(reduce ? nil : .linear(duration: 0.14), value: at)`.
2. Transcript word fade not gated: `.animation(.easeOut(duration: 0.12), value: said)` on the transcript Text, same fix.
3. symbolEffect bounce not gated: `.symbolEffect(.bounce, value: t.done)` (to-do checkmark) and `.symbolEffect(.bounce, value: addBounce)` (Add dashed circle). Fix: `.symbolEffect(.bounce, options: .nonRepeating, isActive: !reduce)` style gating, or make the trigger value constant when `reduce` (`value: reduce ? 0 : addBounce`). Note ProfileView's main struct has `reduce`; to-do row is inside it, so available.
4. symbolEffect replace not gated: `.contentTransition(.symbolEffect(.replace))` on play/pause icon. Fix: `reduce ? .identity : .symbolEffect(.replace)`. (The surrounding withAnimation is gated, so the swap fades only if the replace is dropped.)
5. Minor: the to-do row `.transition(.move(edge:.top)...)` on rows relies on tr() (ok), but the delete `.warning` haptic fires on toggle before delete completes (acceptable).
Not verified: runtime behavior (no simulator runtime); scroll-to-new-moment and the P0 expand fix only checked by reading.
