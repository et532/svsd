# Peepl iOS: animation plan

Source: static review of `ios/Peepl` (2026-11-22). Nothing here was run on a device; test every item on hardware with Reduce Motion on and off.

Paths are relative to `ios/Peepl/`. Line numbers are from the time of review and will drift.

## 0. Current state

**Already good (keep):**
- Circle reveal for Add/Find (`Components/Reveal.swift`, `Screens/Shell.swift:63`).
- Tab blob spring (`Components/TopControls.swift:23`).
- Profile scroll-driven top bar fade (`Screens/ProfileView.swift:145`).
- Edge-swipe back that follows the finger (`Shell.swift:134`).
- Composer send button scale/opacity (`Components/Composer.swift:60`).
- Mindmap physics: float, parallax, momentum, orb blending, all honoring Reduce Motion (`Screens/MindmapModel.swift`).
- Aura drift honoring Reduce Motion (`Components/AuraBackground.swift`).
- Haptics on tab change, layer push, toast, to-do tick (`Shell.swift:84-86`, `ProfileView.swift:217`).

**The gaps, in order of impact:**
1. No press feedback anywhere (every button is `.buttonStyle(.plain)`).
2. Content swaps hard-cut: Add phases, Find thinking to results, moment expand, to-do tick, inline fields.
3. One generic timing (`easeInOut 0.3`) and no shared tokens.
4. Reduce Motion only respected in the aura and mindmap.
5. Missing haptics on mindmap select, mic start/stop, send, copy.

---

## 1. Foundation (do first, everything else uses it)

Create `Motion.swift`:

```swift
import SwiftUI

enum Motion {
    static let snap   = Animation.snappy(duration: 0.28)                         // toggles, chips, small state
    static let smooth = Animation.smooth(duration: 0.4)                          // content swaps, expand/collapse
    static let pop    = Animation.spring(response: 0.45, dampingFraction: 0.72)  // pop-ins, blob, toast
    static let layer  = Animation.spring(response: 0.5, dampingFraction: 0.9)    // screen push/pop

    /// Stagger delay for the i-th item of a list entrance.
    static func stagger(_ i: Int, step: Double = 0.04, cap: Int = 10) -> Animation {
        smooth.delay(Double(min(i, cap)) * step)
    }
}

/// Replaces `.buttonStyle(.plain)` on anything tappable.
struct PressStyle: ButtonStyle {
    var scale = 0.94
    func makeBody(configuration c: Configuration) -> some View {
        c.label
            .scaleEffect(c.isPressed ? scale : 1)
            .opacity(c.isPressed ? 0.88 : 1)
            .animation(.snappy(duration: 0.18), value: c.isPressed)
    }
}

/// Entrance for one item of a stagger: use with `.appear(i)`.
struct AppearModifier: ViewModifier {
    let index: Int
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    func body(content: Content) -> some View {
        content
            .opacity(shown || reduce ? 1 : 0)
            .offset(y: shown || reduce ? 0 : 12)
            .onAppear { withAnimation(Motion.stagger(index)) { shown = true } }
    }
}
extension View { func appear(_ i: Int) -> some View { modifier(AppearModifier(index: i)) } }
```

**Press scale by element:**

| Element | Scale |
|---|---|
| List rows, cards, Find example cards | `PressStyle(scale: 0.98)` |
| Pills, chips, text buttons | `PressStyle(scale: 0.95)` |
| Round buttons (add person, send, close, back) | `PressStyle(scale: 0.92)` |

**Reduce Motion rule:** every new animation either goes through `Motion` plus a check of `@Environment(\.accessibilityReduceMotion)`, or is a transition that degrades to `.opacity`. Looping animations (shimmer, pulse) must stop completely.

**Acceptance:** `grep -rn "buttonStyle(.plain)" Peepl` returns only non-interactive uses. No raw `.easeInOut` left in `Shell.swift`.

---

## 2. Global shell (`Screens/Shell.swift`, `Components/AskBar.swift`, `Components/TopControls.swift`)

### 2.1 Layer push/pop
- `Shell.swift:82`: change `.animation(.easeInOut(duration: 0.3), value: nav.layers)` to `.animation(Motion.layer, value: nav.layers)`.
- **Depth effect:** when a profile layer is on top, the content below (tab content, `AskBar`, `TopControls`) scales to 0.96, dims to 0.85 opacity and shifts left ~30pt. Drive it from `nav.layers.last?.isProfile`. Remove it for Add/Find (they use the circle reveal).
- While the edge-swipe is dragging (`dragX` in `LayerHost`), tie the underlying page's offset and dim to `dragX / width` so it follows the finger.

### 2.2 Tab switch
- `Shell.swift:52`: the `switch nav.tab` relies on the spring in `TopControls` to animate. Make it explicit: put `.transition(.opacity)` on both `MindmapView()` and `ConnectionsView()` and `.animation(Motion.smooth, value: nav.tab)` on the ZStack child. Target feel: 0.4-0.5s crossfade (the web used 0.5s).
- Keep the `AuraBackground` always mounted behind so the crossfade never flashes bare ground.

### 2.3 Toast (`Shell.swift:66-80`)
- Replace `.move(edge: .bottom).combined(with: .opacity)` with `.move(edge: .bottom).combined(with: .opacity).combined(with: .scale(0.92))` and animate with `Motion.pop`.
- Checkmark icon: `.symbolEffect(.bounce, value: toast)`.
- Toast changing text while visible (two quick saves): `.contentTransition(.opacity)` on the `Text`.
- Move the animation from `.animation(…, value: nav.toast)` (line 83) to `Motion.pop`.

### 2.4 Close ✕ on Add/Find (`Shell.swift:123`)
- `PressStyle(scale: 0.92)`.
- Rotate the glyph from -90° to 0° and fade in as the reveal grows (delay 0.15s). On close it rotates back out.
- Optional (matches the web): on dismiss, shrink the reveal into the ✕ button position instead of the original origin. Needs the ✕ frame passed into `revealOrigin` on pop.

### 2.5 Ask bar (`Components/AskBar.swift`)
- **"← Name" pill and filter pill** (lines 9 and 20): add `.transition(.move(edge: .bottom).combined(with: .opacity))` to each, and `.animation(Motion.snap, value: nav.focus?.id)` / `.animation(Motion.snap, value: nav.showFilter)` on the outer VStack, so the bar eases up instead of jumping.
- All four buttons: `PressStyle`.
- Mic: when Find opens in voice mode, `.symbolEffect(.pulse)` on the mic while listening (see 8.3).
- Filter pill ✕: `PressStyle(scale: 0.85)`.

### 2.6 Top controls (`Components/TopControls.swift`)
- Already springs. Change `withAnimation(.spring(response: 0.4, dampingFraction: 0.7))` to `Motion.pop` for consistency.
- Icons: `.symbolEffect(.bounce, value: tab)` on the newly selected icon.

---

## 3. Connections list (`ConnectionsView.swift`)

| # | Change | Detail |
|---|---|---|
| 3.1 | Row press | `PressStyle(scale: 0.98)` on the row button (line 36). |
| 3.2 | First-load stagger | `.appear(index)` on the first ~10 rows only (use `enumerated()`); rows past 10 get no delay. Only on first appearance of the screen, not on every filter change. |
| 3.3 | Scroll-edge fade | Mask the scroll content: 56pt gradient fade at top (under the top controls) and bottom (under the ask bar), matching the web `.list-screen` mask. Alternative: `.scrollEdgeEffectStyle(.soft, for: [.top, .bottom])`. |
| 3.4 | `scrollTransition` | On each row: `.scrollTransition { c, phase in c.opacity(phase.isIdentity ? 1 : 0.6).scaleEffect(phase.isIdentity ? 1 : 0.96) }`. Subtle. Skip if it costs frames with 500 rows. |
| 3.5 | Filter changes | When `nav.showFilter` changes, wrap in `withAnimation(Motion.smooth)` so rows animate out and in (rows need stable `id`, which they already have). |
| 3.6 | Title/ellipsis | The ellipsis `Menu` label gets `PressStyle`. |
| 3.7 | Empty to sample people | In `EmptyPeople` (line 76): fade and scale the empty state out (`Motion.smooth`) before the rows stagger in. "Try with sample people" button: `PressStyle`. |
| 3.8 | Swipe/delete (optional) | If rows get swipe actions later, spring back with `Motion.snap`. |

---

## 4. Mindmap (`Screens/MindmapView.swift`, `Components/MindmapPill.swift`, `Components/MindmapFilters.swift`)

The graph itself is a `Canvas` driven by `MindmapModel`, so SwiftUI transitions only apply to overlays.

- **4.1 Name pill** (`MindmapView.swift:65`): appears and disappears with no transition. Add `.transition(.scale(scale: 0.92, anchor: .top).combined(with: .opacity))` and `.animation(Motion.pop, value: selectedId)` on the container. Also animate the pill's switch between two people (different `id`, so use `.id(person.id)` to trigger the transition).
- **4.2 Pill press:** `PressStyle(scale: 0.96)`.
- **4.3 Selection dimming:** verify in `MindmapModel` that the dim to 55% and 8% opacity fades over about 0.25s instead of snapping. If it snaps, add a per-node `opacity` that eases toward its target each frame in `model.frame`.
- **4.4 Haptics:**
  - `.sensoryFeedback(.selection, trigger: selectedId)`.
  - Light impact when the pinch hits the rubber-band limit (fire once per overshoot, not per frame).
  - `.selection` when the group-by changes.
- **4.5 Filters pill** (`MindmapFilters.swift`): `PressStyle(scale: 0.96)` and `.contentTransition(.opacity)` if the label ever shows the current grouping.
- **4.6 Group-by:** orb blending already exists (`blendDur`). Add a short fade (0.25s) on the group labels appearing and disappearing, so they don't pop.
- **4.7 Fly-to** (`flyTo` from a profile's "View connections"): confirm the camera uses an ease-in-out curve, not linear.
- **4.8 Power:** `AuraBackground` runs `TimelineView(.animation)` at full refresh rate. Use `.animation(minimumInterval: 1/30, paused: reduceMotion)`; the drift is slow enough that nobody can tell.

---

## 5. Profile (`Screens/ProfileView.swift`)

### 5.1 Hero avatar transition (signature animation, P2)
Avatar flies from the tapped list row, mindmap pill or mutual into the 88pt hero avatar.
- Add a `@Namespace` to `RootView` and pass it down via environment.
- `matchedGeometryEffect(id: person.id, in: ns)` on `Avatar` in `Row`, `MindmapPill`, `FindCard`, the mutuals row and the hero.
- The profile layer must not use `.move(edge: .trailing)` while the avatar flies; use opacity + the matched avatar instead, or keep the slide and fade the avatar in at the end. Prototype on one source (the list row) first.
- Note: the app uses custom layers, not `NavigationStack`, so `.navigationTransition(.zoom)` is not available.

### 5.2 Content entrance (P1)
Apply `.appear(i)` to `summary`, `todos`, `where_`, `mutualsRow`, `momentsList` (i = 0 to 4), 40ms apart. Run once on first appear, not on every re-render.

### 5.3 Moment expand/collapse (**bug fix, P0**, line 301)
```swift
Button { withAnimation(Motion.smooth) { openMoment = open ? nil : m.id } } label: { … }
```
- Expanded content: `.transition(.opacity.combined(with: .move(edge: .top)))`.
- Chevron `rotationEffect` then animates for free.
- Blue border (line 322): `.animation(Motion.snap, value: open)` so it fades in.
- When a moment is saved from the Composer (`openMoment = m.id`, line 53), scroll the new card into view with `ScrollViewReader` and `withAnimation(Motion.smooth)`, and let it enter with `.transition(.scale(0.96).combined(with: .opacity))`.

### 5.4 To-dos (line 210)
- Wrap `t.done.toggle()` in `withAnimation(Motion.snap)`.
- Animate strikethrough and opacity together; add a leading circle that fills with a `symbolEffect(.bounce)` checkmark.
- Row press: `PressStyle(scale: 0.99)`.
- Keep the existing `.selection` haptic.
- New to-do added: the row enters with `.transition(.move(edge: .top).combined(with: .opacity))` inside `withAnimation(Motion.smooth)`.

### 5.5 Inline "+ tag" and "Add something to do"
- Wrap `addingTag = true` / `addingTodo = true` and the `finish` callbacks in `withAnimation(Motion.snap)`.
- Field and button swap: `.transition(.scale(scale: 0.9, anchor: .leading).combined(with: .opacity))`.
- A newly added chip enters with `.transition(.scale.combined(with: .opacity))` (the `FlowLayout` needs `.animation(Motion.snap, value: person.tags)` on its container to reflow smoothly).
- Tag ideas row: fade and slide in 6pt.
- Chip press: `PressStyle(scale: 0.94)`.

### 5.6 Voice note (`VoiceNote`, line 379)
- Play/pause icon: `.contentTransition(.symbolEffect(.replace))`, with `withAnimation(Motion.snap)` around `playing.toggle()`.
- Waveform bars: `.animation(.linear(duration: 0.14), value: at)` on each bar's fill so the colour change flows.
- Transcript words: they appear in steps of 140ms. Add `.animation(.easeOut(duration: 0.12), value: said)` or `.contentTransition(.opacity)` so words fade in.
- Play button: `PressStyle(scale: 0.9)`.

### 5.7 Top bar and banner
- Already scroll-driven. Optional: scale the hero avatar from 1.0 to 0.85 and fade it as the banner collapses (use the existing `scrolled` state).
- Back and delete buttons: `PressStyle(scale: 0.92)`.
- Delete flow: after "Delete person" the profile slides out (existing 450ms delay). Add a `.warning` haptic on confirm.

### 5.8 Mutuals row
- Mutual avatar buttons: `PressStyle(scale: 0.92)`.
- "Add" dashed circle: `.symbolEffect(.bounce)` on tap.
- "View connections": `PressStyle`.

### 5.9 Aura
- `aura` (line 110) is two blurred circles with `blur(radius: 90)`. Static. Optionally add a slow drift (see 7.9) and make sure the blur is not re-rendered on scroll (`.drawingGroup()` or rasterize).

---

## 6. Add (`Screens/AddView.swift`)

This is the biggest hard-cut area.

### 6.1 Phase transitions
`phase` goes `idle -> creating -> done` through a plain `switch` with no animation.
- Wrap every `phase = …` assignment (lines 124, 125, 137, 140, 147) in `withAnimation(Motion.smooth)`.
- Give each phase's root content a transition: `.transition(.opacity.combined(with: .offset(y: 12)))`.
- Add `.animation(Motion.smooth, value: phaseKey)` where `phaseKey` is a small enum or Int derived from `phase` (since `Phase` has associated values and is not `Equatable`).

### 6.2 User bubble
- `bubble` (line 102) slides up from the composer: `.transition(.move(edge: .bottom).combined(with: .opacity))`.
- Anchor the bubble at trailing alignment with a slight scale-from-trailing (0.9 to 1, anchor `.bottomTrailing`).

### 6.3 Heading
- `title(_:)` text change ("Tell me about…" to "Creating a new profile for X…" to "Which Jordan did you catch up with?"): `.contentTransition(.opacity)` plus `.animation(Motion.smooth, value: s)`.

### 6.4 Shimmer to result card
- Replace `Shimmer` (line 187) with a moving highlight (see 9.1).
- Shimmer card and `ResultCard` share `matchedGeometryEffect(id: "result", in: ns)` (add a local `@Namespace`) so the placeholder morphs into the real card.
- `ResultCard` arrival: scale from 0.96 and opacity from 0 with `Motion.pop`. Fire `.sensoryFeedback(.success, trigger: …)` when the card lands.
- Multi-person (`doneMany`): cards stagger in, 80ms apart.
- "were met together" note fades in after the last card.

### 6.5 Candidate rows ("Which Jordan?")
- Stagger in with `.appear(i)`, 50ms apart.
- Row press: `PressStyle(scale: 0.98)`.
- "Neither, add a new profile": `PressStyle(scale: 0.96)`.

### 6.6 Aura
- `AddAura` (line 196) is static and duplicates `FindAura`. Extract one shared `PastelAura` view with a slow drift (see 7.9).

### 6.7 Result tap
- Tapping the result card to open the profile: `PressStyle(scale: 0.98)`. It already uses `replaceTop`, so the circle reveal shrinks while the profile slides in. Check this doesn't look doubled; if it does, make `replaceTop` use a crossfade.

---

## 7. Find (`Screens/FindView.swift`)

### 7.1 Idle to thinking to results
- Wrap `asked = nil; pending = text` and `pending = nil; asked = …` (lines 120, 133) in `withAnimation(Motion.smooth)`.
- Each state root gets `.transition(.opacity)`.

### 7.2 Result card stagger
- `group(_:_:)` (line 108): `.appear(index)` per card, 60ms apart, cap at 6.
- "Show all N" button and the notes fade in after the last card.

### 7.3 Thinking status line
- `Thinking` (line 217): the status text changes with no transition. Add `.contentTransition(.opacity)` and `.animation(Motion.snap, value: step)`, or `.id(step).transition(.opacity.combined(with: .offset(y: 6)))`.
- The placeholder cards: replace the pulse with the real shimmer (9.1) and stagger the two cards.
- Respect Reduce Motion (see 9.2).

### 7.4 Example cards (idle)
- `PressStyle(scale: 0.98)` (line 55).
- Entrance: `.appear(i)` stagger.

### 7.5 Draft flow (`FindCard`)
- "Draft a message" button to editable bubble (line 186): wrap in `withAnimation(Motion.smooth)`; the button collapses and the field expands with `.transition(.scale(scale: 0.95, anchor: .top).combined(with: .opacity))`.
- While `writing`: a subtle shimmer over the field plus a pulsing "Writing…" prompt.
- When the text arrives: `.contentTransition(.opacity)` or typewriter-fade of the first lines.
- "Copy Text": swap its label to "Copied ✓" for 1.5s with `.contentTransition(.symbolEffect(.replace))` or `.opacity`, and fire `.sensoryFeedback(.success, trigger: copiedCount)`.
- Pills and Share: `PressStyle(scale: 0.95)`.
- The to-do on the person ticking itself off (line 149): no animation is visible here; it shows when the profile is next opened. No change needed.

### 7.6 Hand-off beat
- The 900ms "Opening Jordan…" note (lines 135-143): crossfade the note in, then let the profile slide in. Consider a short progress dot trio instead of dead time.

### 7.7 "Add someone new" and "Show all" buttons (`wide`, line 75)
- `PressStyle(scale: 0.97)`.

### 7.8 FindAura
- Remove (shared `PastelAura`, see 6.6).

### 7.9 Aura drift (shared)
Create `PastelAura` with four orbs that wander on 14-25s eased loops, like `AuraBackground`. Use `TimelineView(.animation(minimumInterval: 1/30, paused: reduceMotion))` and a `Canvas` with radial gradients (no `.blur(radius: 90)`, which is expensive on large circles). Use it on Add, Find and Profile (tinted with the person's blob colors).

---

## 8. Composer (`Components/Composer.swift`)

- **8.1 Mic to stop swap (line 42-54):** `.transition(.scale.combined(with: .opacity))` on both, inside `.animation(Motion.snap, value: recording)`.
- **8.2 Waveform:** enters with `.transition(.opacity.combined(with: .scale(scale: 0.8, anchor: .leading)))`.
- **8.3 Mic listening state:** `.symbolEffect(.pulse)` on the mic, or a soft expanding ring behind the stop button while recording.
- **8.4 Haptics:** `.impact(.medium)` on recording start, `.impact(.light)` on stop, `.impact(.light)` on send (`onSend`), `.warning` on a voice error message.
- **8.5 Height growth:** the field grows with `lineLimit(1...6)`; add `.animation(Motion.snap, value: text.count > 0 ? lines : 0)` or wrap the composer in an `animation(value:)` keyed on the line count so growth is a spring, not a jump.
- **8.6 Focus:** a faint border or shadow brightening when `focused`.
- **8.7 Voice message line (line 37):** `.transition(.opacity.combined(with: .move(edge: .top)))`.
- **8.8 Send, mic, stop buttons:** `PressStyle(scale: 0.9)`.
- **8.9 Name outlines (`NameNote`, `NameOutlines`):** new outlines fade in over 0.2s; tapping a word to fix it animates the dark outline and caret in (`Motion.snap`).

---

## 9. Shared loading and Reduce Motion

### 9.1 Real shimmer
Replace the opacity pulse in `Shimmer` (`AddView.swift:187`) and `Thinking` (`FindView.swift:231`) with a moving highlight:

```swift
struct Shimmer: View {
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var x: CGFloat = -1
    var body: some View {
        Color.white.opacity(0.7)
            .overlay {
                if !reduce {
                    GeometryReader { g in
                        LinearGradient(colors: [.clear, .white.opacity(0.9), .clear], startPoint: .leading, endPoint: .trailing)
                            .frame(width: g.size.width * 0.5)
                            .offset(x: x * g.size.width)
                    }
                }
            }
            .clipped()
            .onAppear { if !reduce { withAnimation(.linear(duration: 1.3).repeatForever(autoreverses: false)) { x = 1.5 } } }
    }
}
```
Define it once (e.g. `Components/Shimmer.swift`) and delete the two private copies.

### 9.2 Reduce Motion audit
- **Shimmer / Thinking pulse:** static (see above).
- **Springs and slides:** under Reduce Motion, use `.transition(.opacity)` and `Motion.*` with `.linear(duration: 0.15)`. Easiest: a `Motion.animation(_:reduce:)` helper or an environment-aware wrapper.
- **Circle reveal:** under Reduce Motion, crossfade instead of the growing circle.
- **Stagger / `.appear`:** already shows immediately under Reduce Motion.
- **Symbol effects:** `.symbolEffect` is skipped automatically under Reduce Motion for some effects; check each.

---

## 10. Haptics summary

| Moment | Haptic | Status |
|---|---|---|
| Tab change | `.selection` | exists |
| Layer push | `.impact(.light)` | exists |
| Toast shown | `.success` | exists |
| To-do tick | `.selection` | exists |
| Mindmap node select | `.selection` | add |
| Mindmap rubber-band limit | `.impact(.light)` | add |
| Group-by change | `.selection` | add |
| Mic start | `.impact(.medium)` | add |
| Mic stop | `.impact(.light)` | add |
| Send | `.impact(.light)` | add |
| Add result card lands | `.success` | add |
| Draft copied | `.success` | add |
| Delete person confirmed | `.warning` | add |

Keep it to these. More haptics become noise.

---

## 11. Rollout

### P0: biggest improvement, lowest effort
1. `Motion.swift`: tokens, `PressStyle`, `.appear`.
2. Replace `.buttonStyle(.plain)` on all interactive elements.
3. Moment expand fix (5.3).
4. Add phase transitions and bubble (6.1, 6.2, 6.3).
5. Find thinking to results crossfade and stagger (7.1, 7.2, 7.3).
6. Ask bar pill transitions (2.5).
7. Reduce Motion fixes for shimmers (9.1, 9.2).
8. Layer and toast timings (2.1, 2.3).

### P1
9. Connections row stagger and scroll-edge fade (3.2, 3.3).
10. Mindmap pill transition and haptics (4.1, 4.4).
11. To-do tick, inline field swaps, voice-note animations (5.4, 5.5, 5.6).
12. Composer button swaps and haptics (8).
13. Profile content stagger (5.2).
14. Tab crossfade made explicit (2.2).
15. Shimmer to result card morph (6.4).
16. Draft bubble expand and Copied state (7.5).

### P2: polish
17. Hero avatar `matchedGeometryEffect` (5.1).
18. Shared `PastelAura` with drift on Add, Find and Profile (6.6, 7.9, 5.9).
19. Layer depth effect and swipe-follow on the underlying page (2.1).
20. Close ✕ rotate and shrink-into-button dismiss (2.4).
21. Aura frame-rate cap (4.8).
22. Avatar scale on banner collapse (5.7).

## 12. Verification checklist

- [ ] On device (not just Simulator), 60/120 Hz: no dropped frames on the list stagger, mindmap pill and Add phases.
- [ ] Settings > Accessibility > Motion > Reduce Motion ON: no looping animations, no large slides; everything still usable.
- [ ] Rapid taps: double-tap a row, spam the tab toggle, send twice in Add. No stuck transitions or duplicated layers.
- [ ] Interrupting: start a swipe-back and release halfway; start Find, then back out during "Thinking".
- [ ] Dynamic Type at the largest size: animated layouts (toast, pills, chips) still fit.
- [ ] Dark/low-power mode: aura drift still capped; battery impact acceptable.
- [ ] `npx tsc`-style check equivalent: `xcodebuild` builds clean, UI tests (`M5FlowUITests`, `VoiceFlowUITests`) still pass (animations may need `UIView.setAnimationsEnabled(false)` or longer waits in tests).

## 13. Decisions to confirm before building

- Hero avatar transition: worth the effort given custom layers instead of `NavigationStack`?
- Scroll-edge fade: custom mask (matches web) or system `scrollEdgeEffectStyle`?
- Should the shared Add/Find/Profile aura drift, or stay static for battery?
