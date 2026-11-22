# Peepl onboarding spec (O1, v5)

Status: v5 (user decisions, 2026-11-22; v5 changes: steps 5 and 6 show the real UI as 3D panels with no phone frame, a three-segment progress bar, past-date rules for yesterday / last night and friends, Contacts import out of scope). iOS only, no account, skippable. 8 onboarding steps in 3 acts, then a first-run flow inside the real app. Spec only; builders implement it in SwiftUI after the open-design mockups (O2) are approved. Where a mockup and this file disagree on layout, the mockup wins; copy, keys, gate logic and parsing rules here win. v4 replaces v3 (6 screens plus a "Try it" step): there are no interactive tasks in onboarding any more. The real how-to happens in the real app straight after (section 6).

## 1. Principles and research

1. Brief, optional, permissions in context, contextual tips over one long flow, never block the start. Apple HIG: https://developer.apple.com/design/human-interface-guidelines/onboarding
2. Let people do the real thing, in the real UI. Duolingo gives a real lesson before signup. https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/ and https://goodux.appcues.com/blog/duolingo-user-onboarding. v4 does not fake a task inside onboarding: it shows the real screens doing the job on their own (steps 5 and 6), then hands the user the real Add screen with a coach and a checklist (section 6).
3. One short question that makes the app feel made for you (step 7). https://irrationallabs.com/case-studies/headspace-doubled-course-starts/
4. Teach one core loop: Capture, Connect, Ask. Filters, group by, backups and nudges are not taught in the flow. https://screensdesign.com/articles/strava-onboarding-design/
5. Ask for a permission in context, one at a time, with a Settings fallback; the iOS prompt can only be shown once. https://www.nngroup.com/articles/permission-requests/ The mic is asked only when the user first taps the mic in the real Add screen (section 6f).

Feel: warm, not transactional, personal and private; premium and effortless motion (section 4). Never a wall of text: each step is one idea, one heading, at most two lines of narration.

## 2. Gate, persistence, entry and exit

Persistence (UserDefaults.standard, all on device, never sent anywhere):

| Key | Type | Meaning |
|---|---|---|
| `peepl.onboardingDone` | Bool | Set when the flow ends by any path (Add your first friend, Skip then finish, Restore, Later via the empty state) |
| `peepl.meetWhere` | [String] | Step 7 answers, raw values of `MeetWhere` (see 3.7); empty = none chosen |
| `peepl.tipsSeen` | [String] | Ids of tips already shown: `mindmapDot`, `askBar`, `reachOut` |
| `peepl.micPrimerSeen` | Bool | The one-sentence mic primer was shown and answered; never show it again (kept from v3) |
| `peepl.firstRunCoachSeen` | Bool | NEW. The empty-state coach callout on the add-person button was shown once |
| `peepl.firstAddSeen` | Bool | NEW. The "Try to cover" checklist is finished with (see 6b for when it is set) |

Removed: nothing else is stored for onboarding. The v3 Try it step wrote no key of its own, so no key is dropped; its screen, its `TryItView.swift` file and its tests are deleted. Pip's blob is not stored (recomputed at flow start, section 3.0).

Gate (evaluated once at launch in `RootView`, before the first frame so there is no flash of the list):

```
show onboarding = !defaults.bool("peepl.onboardingDone")
                  && peopleCount == 0
                  && !defaults.bool("PeeplSkipOnboarding")
```

- Existing installs with people never see it. If `peopleCount > 0` and the flag is unset, set `peepl.onboardingDone = true` silently so a later "delete everyone" does not trigger it.
- Test flag: launch argument `-PeeplSkipOnboarding YES` skips it. UI tests launched with `-PeeplInMemory YES` must also pass it (they load samples, so `peopleCount > 0` already skips it in practice; the flag is the explicit guarantee and is needed with `-PeeplNoSeed YES`). The onboarding UI test passes `-PeeplNoSeed YES` and not the skip flag.
- Skip (top right, steps 2 to 7) jumps to step 8, not past it, so the privacy promise is always seen. It does not set done. Step 8 has no Skip. Step 1 has no Skip and no Back.
- Back (top left, steps 2 to 8) goes exactly one step back. Swiping back from the left edge does the same. Step 1 has no Back.
- Finish: the primary button on step 8, "Add your first friend", sets `peepl.onboardingDone = true`, dismisses the cover, lands on the empty Mindmap / Connections with the coach callout (6a).
- "Restore a backup" (step 1 only) runs the Backup restore flow (`Services/Backup.swift`, document picker plus Merge / Replace; no new restore code) and, on success, sets done and lands on the list.
- "Try with sample people" is NOT in the flow any more. It already exists on the empty state (Connections' empty screen shows "Try with sample people" and "Restore a backup"); it calls `Seed.loadSamples(context)`. Do not duplicate it in onboarding.
- Replay from Settings ("How Peepl works") plays steps 1 to 8 with the same rules and `replay = true`: no gate, no persistence write except `peepl.meetWhere` (step 7), no Restore button on step 1, step 8 ends with the primary "Done" (not "Add your first friend") and returns to Settings. Back, Skip (to step 8) and the 1 s Next delay behave the same. Replay never sets `peepl.firstRunCoachSeen`, never opens Add.
- The flow is a full-screen cover above `RootView`, not a navigation stack.

## 3. Screens

### 3.0 Common shell (all steps)

- Header, one row, 56pt tall under the status bar: Back (left, chevron plus "Back", `Theme.font(15, .medium)`, hidden on step 1), then the act title centered above the progress bar, Skip (right, hidden on steps 1 and 8). There is NO "Part 1 of 3" text and NO replay button anywhere.
- Act titles (mono 12, uppercase tracking): steps 1 to 4 "The story", steps 5 and 6 "Learn by doing", steps 7 and 8 "Make it yours". The title cross-fades (0.3 s ease-in-out) only when the act changes.
- Progress bar: three 4pt capsule segments, one per act (The story 4 steps, Learn by doing 2, Make it yours 2), with 4pt gaps between them, spanning from Back to Skip (the whole header width minus the two buttons and 12pt gaps; segment widths are proportional to their step counts, 4 : 2 : 2). Each segment fills incrementally per step within its act: step s of an act with n steps fills s / n of that segment (step 1 = 1/4 of the first segment, step 4 = full; steps 5 and 6 = 1/2 and full; steps 7 and 8 = 1/2 and full); earlier segments are full, later ones empty. The fill is `Theme.night` on light steps, white on step 1 (track at 20% of the fill color). The fill animates with the motion spec's "Progress bar fill" row (scaleX from the left, `--ease-io`, 0.6 s, `Motion.easeSlow`, section 4), starting with the page transition; going Back reverses it. Under Reduce Motion it jumps (or a 150 ms fade). The act title stays; there is no "Part x of 3".
- Next: the primary button (full width, 56pt, `Theme.night` fill, white text, bottom padding safe area plus 16) is not shown for the first 1 second of each step. At 1.0 s it fades and rises 8pt over 0.3 s ease-in-out and becomes tappable. Timer restarts on every step change, on Back, and on replay. Auto demos keep running regardless. With VoiceOver on, or Reduce Motion on, it is shown at once. Primary labels: steps 1 "Get started", 2 to 6 "Next", 7 "Next", 8 "Add your first friend" (replay: "Done").
- Ground: `PastelAura` / `AuraBackground` on light steps (2 to 8), dark `Theme.night` with three blurred orbs on step 1. Cards use `.glass()` / `Theme.pastel`. No Liquid Glass.
- Headings `Theme.font(32, .regular)` tracking -0.04em equivalent; narration `Theme.font(17)`; meta `Theme.mono(12)`. All copy has no em dashes.
- Pip (steps 5 and 6 only, appears from step 5): the guide character, one of the blob characters in `Blobs.all` (`Blobs.swift`, 18 entries; jordan-lee is `mint`, jordan's connector aisha-khan is `indigo`). Rule: Pip is never Jordan's blob and never the blob of the user's first friend. Blobs are a hash of the person id (`Blobs.name(for:)`, with the `assigned` table for sample ids), so Pip is picked at flow start at runtime: `Blobs.all.map(\.name)` minus `Blobs.name(for: "jordan-lee")` minus, if the store has any person (replay only), `Blobs.name(for:)` of the oldest person; take the first remaining in a fixed order (alphabetical), so it is stable and never changes mid flow. Also exclude `indigo` (Aisha) so Pip is not confused with a demo character. First-run onboarding has no first friend yet, so only Jordan's blob (and Aisha's) is excluded there; Pip only exists in onboarding, so a later first friend never clashes. Pip shows at 56pt with the 2pt white ring (`Avatar` style), bottom-left of the narration, with a speech line in `.glass()` bubble.
- Reuse of real views, by name: `Composer` and `NameNote` (outline style, `Components/NameNote.swift`), `AskBar` (`Components/AskBar.swift`), the `ProfileView` hero (blob base color, 60pt avatar, name 20 medium, "Met ..." line) and its summary card, `MindmapView` disc dots and dashed links (`MindmapModel` / `ForceGraph` positions; drawn in a Canvas, so the demo uses a small sandboxed `MindmapModel` fed with 3 hard-coded ids, not the store), and `ResultCard` (currently `private` in `AddView.swift`; T2 makes it internal). Demos are driven by hard-coded text and fixed timelines. They never read or write the store, never call the AI, never ask for permissions.
- 3D: steps 2 to 4 put the real-app view on a tilted, layered plane: `.rotation3DEffect(.degrees(±8 to 14), axis: (x: 1, y: 0.3, z: 0), perspective: 0.6)`, with a 2 to 3 layer parallax (cards float 12 to 24pt above the plane via `.offset` and a soft shadow). The plane slowly eases between two tilts (6 s ease-in-out loop, 3 degrees apart). **Steps 5 and 6 have NO phone frame, device bezel or screen plane.** The real app UI pieces (Composer, name outlines, result card, mindmap Canvas, AskBar, `ResultCard`) are shown directly, each made 3D itself: separate panels in layers at different depths (translateZ about 0, +40, +80 as in the motion spec), each with its own `.rotation3DEffect` and perspective 0.6, layered shadows, the motion spec's idle float (7 s loop, layers offset 0.4 s) and parallax (front layers move 1.3x). They are large enough to read: all note and card text at least 15 pt (`Theme.font(15)` or larger; scale the whole panel up rather than shrink the type, and let panels bleed to the screen edges if needed). Step 1, 7, 8 stay flat. Under Reduce Motion: tilt is fixed, no loop.

### 3.1 Step 1, Cold open (dark)
- Ground `Theme.night` (#1c1522), three blurred orbs (blur about 90pt): yellow bottom-left, blue top-right, pink bottom-right, slow drift 14 to 25 s loops (off for Reduce Motion).
- Heading (white, `Theme.font(40, .regular)`): "Every person you meet has a story."
- Sub (white at 70%): "Peepl keeps it for you."
- Wordmark "Peepl" `Theme.font(20, .semibold)` small at the top (in the header's act-title slot the title reads "The story").
- Primary "Get started". Secondary text button "Restore a backup" (3 per section 2). No Skip, no Back.
- Storyboard (total 2.4 s, then rests): 0.0 orbs fade in (0.6 s ease-in-out); 0.3 heading words appear one by one (6 words, each 0.35 s fade plus 6pt rise, ease-in-out, 0.12 s apart); 1.3 sub fades in (0.5 s); 1.0 Next appears (global rule); 1.6 wordmark fades in. Reuses: none (pure SwiftUI).
- 3D: none.

### 3.2 Step 2, You meet Jordan, then "Three weeks later"
- Heading (appears at 0.0): "You meet Jordan." After the sequence it changes to "Three weeks later, it is gone."
- Narration line (under the card): "You remember the feeling, not the details."
- Demo (one auto sequence, total 9.0 s, rests on the faded state): a tilted real-app profile card (3D plane) for "Jordan" built from the real `ProfileView` hero: mint blob avatar, name "Jordan Lee", job line "Founder @ Voltcell", a small summary card under it with the detail words as separate chips: "Voltcell", "battery recycling", "from Seattle", "lives in Brooklyn", "climbs Tuesdays", "hardware intro".
  - 0.0 to 1.2: the plane eases in from 40pt below, tilt 10 degrees, avatar pops (`Motion.pop`), name types in.
  - 1.2 to 3.0: the detail chips float up one by one (0.15 s stagger, 0.4 s ease-in-out), layered at different depths above the plane.
  - 3.0 to 4.0: hold; a mono 12 caption "Demo Day, Oct" fades in.
  - 4.0 to 4.6: caption cross-fades to "Three weeks later" (ease-in-out 0.6 s); the heading changes in step.
  - 4.6 to 8.2: the chips dissolve: each blurs (radius 0 to 8), fades to 0 and drifts up 20pt, staggered 0.2 s in random fixed order; the name and job line fade to 35% and the avatar desaturates (saturation 1 to 0.2).
  - 8.2 to 9.0: only "Jordan" and a blank card remain; settles.
- Under Reduce Motion: show the final state only (name and blank card), cross-fade heading.
- Primary "Next" (at 1.0 s as always).

### 3.3 Step 3, The edge
- Heading: "You can only hold about 150 people."
- Narration: "Researchers say we keep about 150 meaningful relationships. The people on the outer edge are the ones worth remembering."
- Demo (total 8.0 s, rests): the 150-dot scatter (reuse the v3 3.2 seeded static scatter: 150 dots in a loose disc, white disc dot look from the mindmap, `accessibilityHidden`). Inner 30 dots solid white-on-pastel; outer dots toward 20% opacity.
  - 0.0 to 1.0: the mint avatar (Jordan from step 2, now small, 40pt, ringed) shrinks and settles into the disc as one dot (0.9 s ease-in-out, scale 1 to 0.3 and moves to its place).
  - 1.0 to 2.5: the 149 other dots fade in outward from the centre (ripple, 0.012 s per ring step, ease-in-out).
  - 2.5 to 4.5: the camera pulls back (scale 1 to 0.82, 2 s ease-in-out); the outer dots fade to 20%.
  - 4.5 to 6.5: one outer faded dot lights up with a ring, a small label "Angela Lee" appears (mono 12) and a one-line card: "Angela Lee, someone from the edge. She introduced you to your next hire." (card in `.glass()`, 0.5 s ease-in-out).
  - 6.5 to 8.0: hold; the card rests.
- 3D: the dot disc is on a tilted plane (rotation 12 degrees on x), the label card floats 20pt above it.
- Under Reduce Motion: final frame only.

### 3.4 Step 4, Peepl keeps the story
- Heading: "Peepl keeps the story."
- Narration: "Say it out loud once. Peepl keeps it, in your words."
- Demo (total 8.0 s, rests): the faded chips from step 2 reassemble into the real profile card.
  - 0.0 to 1.0: scattered words (the same chips) fade back in around the card position at random depths.
  - 1.0 to 4.0: they fly into the layout (0.4 s ease-in-out each, 0.2 s stagger) and settle as: the `ProfileView` hero (mint blob, "Jordan Lee", "Founder @ Voltcell, Brooklyn", "Met Oct 2026"), the summary card story ("Met Jordan at Demo Day. Battery recycling for e-bikes. Climbs Tuesdays."), tags (founder, climbing), a to-do row "Intro Jordan to a hardware engineer" with its check ring, and a moments row "Met at Demo Day".
  - 4.0 to 5.0: the card lifts (3D tilt 10 to 4 degrees, shadow grows).
  - 5.0 to 6.5: the to-do ring ticks itself (Motion.snap), a light haptic.
  - 6.5 to 8.0: hold.
- Reuses the real `ProfileView` hero and its summary, to-do and moment row styles as read-only sub-views (T2 extracts them so the demo does not instantiate the whole `ProfileView`).
- Under Reduce Motion: final frame only.

### 3.5 Step 5, Capture (Pip narrates; auto demo of real UI pieces in 3D, no phone frame)
- Act title "Learn by doing". Pip enters (0.5 s pop) bottom-left with the line: "Misheard a name? Tap it later to fix it."
- Demo (total 14.0 s, rests): real pieces of the Add flow shown directly, with no phone frame: the `AddView` heading "Tell me about a new person or moment" on the back layer, the real `Composer` (mic state, `Waveform` blue) with `NameNote` outlines as a large middle panel (note text 15 pt or larger), and later the result card as a front layer. Each panel is tilted about 10 degrees in perspective with its own layered shadow, idle float and parallax.
  - 0.0 to 1.0: the panels ease in back to front (80 ms apart); mic button highlights (a ring pulse, no tap, no cursor).
  - 1.0 to 6.0: the words stream into the Composer as if spoken, at about 3 words per second: "Met Jorden Lee at Demo Day. Founder at Voltcell, battery recycling for e-bikes. From Seattle, lives in Brooklyn now. Climbs Tuesdays. Owe them a hardware intro." The `Waveform` animates; names and the company are outlined faintly as they appear (the real `NameNote` outline style; this is the 2026-10-20 Misheard names design).
  - 6.0 to 6.8: stop (waveform flattens); the note shows as review text.
  - 6.8 to 9.5: the fix, shown automatically: "Jorden" gets the dark outline and caret, the faded old spelling stays, "Jor" is typed over (letters appear at 0.18 s each) so it reads "Jordan"; a small caption chip near Pip: "I heard Jorden. Tap a name to fix it, once." (no tap is asked; this caption is separate from Pip's line).
  - 9.5 to 12.0: "Creating a new profile for Jordan Lee..." shimmer (`Shimmer.swift`) then the dark blob-colored card slides up (mint, 60pt avatar, "Jordan Lee", "Founder @ Voltcell, Brooklyn", "Met Oct 2026") with Motion.pop.
  - 12.0 to 14.0: hold; the card tilts toward the viewer by 4 degrees.
- 3D: the heading, Composer and result card are separate layered panels (no screen plane); the result card floats 20 to 40pt above the Composer panel.
- Under Reduce Motion: final state only (review text with the fixed name, and the card).

### 3.6 Step 6, Connect and ask (Pip narrates; auto demo of real UI pieces in 3D, no phone frame)
- Pip line: "Everyone connects. Then you can just ask."
- Demo (total 16.0 s, rests): same layered 3D panel language, no phone frame, two scenes; text 15 pt or larger.
  - Scene A, the mindmap (0.0 to 7.0): a sandboxed `MindmapView`-style Canvas panel (large, tilted in perspective, layered shadow) with 3 existing disc dots on a pastel aura (Aisha Khan indigo, Daniel Okafor sky, Priya Nair lilac) and dashed links. At 1.0 Jordan Lee's mint disc "plops" in (the same effect as 6e: scale overshoot, ring ripple, nearby dots nudge, link draws in to Aisha Khan, 0.5 s). At 3.0 a name pill (`MindmapPill` look) "Jordan Lee, Founder @ Voltcell" settles; a mono 12 caption "Jordan knows Aisha" fades in (0.4 s). Hold to 7.0.
  - 7.0 to 7.8: the mindmap panel swings away and the Find panels take its place (cross-fade with a 12 degree tilt swap).
  - Scene B, ask (7.8 to 16.0): the real `AskBar` panel text types "coffee in SF" (0.1 s per char), a "thinking" beat (dots, 0.8 s), then a real `ResultCard` for Theo Park (Furniture maker, Gowanus; blob per his id) rises with the why line "Met at a studio open house; always up for coffee when in SF." and a drafted message bubble: "Hey Theo, I am in San Francisco next week. Coffee?" (a hard-coded text; the real Find also shows why and a draft). The card floats 20 to 40pt above the AskBar panel, ease-in-out 0.5 s.
  - 14.0 to 16.0: hold.
  - Note on the example: Theo Park is the "coffee in SF" answer (kept from the web demo); his seed city differs (Gowanus, LA origin), so the demo is hard-coded and not a claim about the real Find result.
- Under Reduce Motion: show Scene A final frame, then Scene B final frame, with a cross-fade only.

### 3.7 Step 7, Where do you meet people?
- Act title "Make it yours". The only interactive step; flat (no 3D).
- Heading: "Where do you meet people?" Sub: "Pick any. This only tunes the examples you see. It stays on your phone."
- Multi-select chips (min height 48, wrap): "Conferences and work events" (`events`), "Coffee chats" (`coffee`), "Classes and campus" (`campus`), "Local community" (`community`), "A new city" (`newcity`). Stored as the raw values above in `peepl.meetWhere`. Zero picks is fine.
- Storyboard (total 2.0 s, then user input): heading 0.0 to 0.4; chips appear with `.appear(i)` stagger (0.06 s step, 0.4 s ease-in-out); selecting a chip uses `Motion.snap`, check mark appears, light haptic. Reuses: none beyond Theme chip style.
- Primary "Next" (enabled with zero chips). Skip works as usual (to step 8).
- Tailoring (first selected value wins; none selected = today's defaults): Add composer placeholder and Find's idle example cards. Unchanged from v3.

| Value | Add placeholder | Find example card (replaces the "Occasion" card) |
|---|---|---|
| events | "Who did you meet at the event?" | "Someone I met at a conference" |
| coffee | "Who did you have coffee with?" | "Someone to catch up with over coffee" |
| campus | "Who did you meet in class?" | "Someone from my classes" |
| community | "Who did you meet in your community?" | "Someone from my neighborhood" |
| newcity | "Who did you meet in your new city?" | "Someone who knows this city" |
| none | "Who did you meet?" (unchanged) | existing cards unchanged |

Find cards keep the tuple shape in `FindView.swift` (icon, label, shown text, query); the query for each new card must be a phrase the rules / embeddings can answer without a network (e.g. "conference", "coffee", "class", "neighborhood", "city").

### 3.8 Step 8, Privacy promise
- Heading: "Your notes on people. No one else sees them."
- Three rows with SF Symbols, appearing with `.appear(i)` (0.06 s step, 0.4 s ease-in-out): "Everything stays on this phone" (iphone), "No account, nothing to sign up for" (person.crop.circle.badge.xmark), "AI help from OpenAI is off until you turn it on in Settings" (switch.2).
- REQUIRED voice caveat line under row 1 (mono 12): "Voice notes are turned into text on your phone when your iPhone supports it." Builders must not remove it.
- Fine print (mono 12): "Moving to a new phone? Back up from Settings and restore the file there."
- Primary "Add your first friend" (replay: "Done"). No Skip.
- Storyboard (total 2.0 s, then rests): heading 0.0 to 0.4; rows 0.3 to 1.2; caveat line 0.9; fine print 1.4; button at 1.0 (global).
- Truth check, done against the code on 2026-11-22 (unchanged from v3):
  - TRUE: `AIClient.enabled` = `peepl.openaiEnabled` AND `Consent.agreed`; both default false, and every request in `AIClient` is guarded by `enabled`. The Settings toggle is labelled "Use OpenAI" and opens `ConsentView` first.
  - TRUE: on-device AI (Foundation Models, MiniLM embeddings) runs locally.
  - CAVEAT: `Services/Speech.swift` sets `requiresOnDeviceRecognition = rec.supportsOnDeviceRecognition`. Where on-device recognition is not supported, Apple's Speech framework may send audio to Apple, so "everything stays on this phone" is not strictly true for voice there. The required line above states this. Vince to decide whether to also state it in the privacy page.
  - The Settings "About" text says "Nothing leaves this phone unless you turn on AI help from OpenAI", which has the same voice caveat; flagged for Vince, not changed by this spec.

## 4. Motion, haptics, accessibility

- Motion source of truth: the "Peepl motion spec" below (copied from the motion research note, 2026-11-22, so the repo does not depend on a temp file). It wins over the interim rules that follow; where they differ, use the table and update `Motion.swift` tokens, not call sites.

### Peepl motion spec

House tokens:
- **Ease-in-out (default for things that move):** `--ease-io: cubic-bezier(0.45,0,0.55,1)` (gentle). For larger moves use `cubic-bezier(0.65,0,0.35,1)`.
- **Entrance:** M3 emphasized-decelerate `(0.05,0.7,0.1,1)`.
- **Exit:** emphasized-accelerate `(0.3,0,0.8,0.15)`.
- **Springs:** use the SwiftUI form. On the web, `--ios-spring` / CSS `linear()` approximates `.smooth`.
- **Reduce Motion (global):** keep fades, cut translations, scales and loops. Opacity changes finish in 150-200 ms. Haptics stay.

| Element | Animation | Easing / spring (SwiftUI) | Duration | Delay / stagger | Reduce motion |
|---|---|---|---|---|---|
| Page transition (step to step) | Outgoing slides x -30% and fades to 0. Incoming slides from +100%. Shared elements (avatar, card) use a matched-geometry hero. | `.smooth(duration: 0.5)`; web `(0.2,0,0,1)` | 500 ms | Incoming content starts 80 ms in | 250 ms crossfade |
| Act / background change | Aura orbs crossfade colors and drift to new spots. Grain stays put. | `--ease-io`; `.easeInOut(duration: 1.2)` | 1000-1200 ms | Starts with the page transition | Instant color swap, or a 300 ms fade |
| Text entrance (headline, body) | Per line: opacity 0→1, y +12 pt→0, blur 4→0 (optional). | `(0.05,0.7,0.1,1)`; `.smooth(duration: 0.45)` | 450 ms | 60 ms between lines; body starts 120 ms after headline | Opacity only, 200 ms |
| Word-by-word reveal (headline accent, transcript) | Each word goes from opacity 0 and y +6 to visible. | `.easeOut(duration: 0.25)` per word | 250 ms per word | 35-50 ms between words (headline). At speech pace about 330 ms per word (≈180 wpm) for the voice demo. | Whole line fades in, 200 ms |
| Card entrance (example, result cards) | y +24→0, scale 0.97→1, opacity 0→1 | `.snappy(duration: 0.45)` (small bounce) | 450 ms | 70 ms between cards, max 5 cards | Fade, 200 ms |
| 3D tilted screen: entrance | Phone or screen comes from rotateX 25°, rotateY -20°, z -200, opacity 0 to its rest pose rotateX 10°, rotateY -14°, rotateZ 2°. Perspective 1400 px (SwiftUI `.rotation3DEffect(..., perspective: 0.6)`). Layered cards in front sit at translateZ +40/+80 and move 1.3× faster (parallax). Contact shadow scales 0.8→1 and its opacity goes 0→0.25. | `.smooth(duration: 0.9, extraBounce: 0.05)`; web `(0.2,0,0,1)` | 900 ms | Layers 80 ms apart, back to front | Flat screen at rest pose, 250 ms fade |
| 3D tilted screen: idle float | translateY ±5 pt, rotateY ±1.5°, rotateX ±1°, shadow breathes ±0.03 alpha | `--ease-io`; `.easeInOut(duration: 3.5).repeatForever(autoreverses: true)` | 7 s loop (3.5 s each way) | Each layer offset by 0.4 s so they don't move in sync | No loop (static) |
| Auto-typing demo | Characters appear with a blinking caret. Pauses at punctuation. | Linear per character; caret blinks 530 ms on and off | 45 ms per character ±15 ms jitter. Pause 300 ms at `,` and 500 ms at `.` | Starts 400 ms after the screen settles | Full text fades in at once |
| Voice waveform | 20-28 rounded bars, each height = smoothed amplitude (demo uses a scripted envelope). When idle, a 0.15-amplitude sine "breath". | Each bar eases to its target. `.easeInOut(duration: 0.08)`; idle `.easeInOut(1.2).repeatForever` | 80 ms smoothing; 1.2 s idle loop | 15 ms phase offset per bar (wave travels left to right) | Static mid-height bars plus a pulsing mic dot, opacity only |
| Name-fix highlight | Outline draws in around the misheard word: opacity 0→1, scale 1.06→1. On fix, old letters crossfade to new ones and the outline flashes a tint, then settles. | In: `(0.2,0,0,1)` 200 ms. Fix: `.snappy(duration: 0.3)` | 200 / 300 ms | Outlines appear 60 ms apart, after the transcript finishes | Outline appears at once, plain text swap |
| Profile card assembly | Avatar scales 0.6→1. Name, job and city fly from the transcript into the card (`matchedGeometryEffect`). Tags pop in. The card background fills from the avatar's color. | Avatar `.bouncy(duration: 0.5)` (0.3). Fields `.smooth(duration: 0.55)`. Tags `.snappy(0.35)` | 500-550 ms | Avatar at 0, name +120 ms, meta +180, tags 40 ms apart from +260 | Card fades in whole, 250 ms |
| Chip select | Fill color changes, check icon scales 0→1, chip scales 0.96→1.0 | `.snappy(duration: 0.3)`; color `(0.2,0,0,1)` | 300 ms (color 200 ms) | None | Color change only |
| Progress bar fill | Width (as `scaleX` from the left) eases to the new step. Leading edge glows. | `--ease-io`; `.easeInOut(duration: 0.6)` | 600 ms | Starts with the page transition | Jumps, or a 150 ms fade |
| Button press | Press: scale 0.96 and fill darkens 4%. Release: spring back. | Down `(0.2,0,0,1)` 100 ms; up `.spring(duration: 0.35, bounce: 0.2)` | 100 / 350 ms | None; starts on touch down | Darken only, no scale |
| Ripple-plop on mindmap | 1) Disc scales 0→1.15→1 (rest at 1) with opacity 0→1 in the first 120 ms. 2) A ring at the dot: scale 0.5→2.6, stroke 2→0.5 pt, opacity 0.5→0. A second ring follows. 3) Neighbors within 2 disc radii move outward 6-10 pt (falls off with distance) and spring back. 4) Link lines draw from the dot (trim 0→1). 5) Haptic `.impact(.soft)` on land. | 1) `.bouncy(duration: 0.55, extraBounce: 0.05)` (≈0.35) 2) `(0.2,0,0,1)` 3) `.spring(duration: 0.6, bounce: 0.25)` 4) `--ease-io` | 1) 550 ms 2) 700 ms 3) 600 ms 4) 400 ms | Ring 1 at +60 ms, ring 2 at +180 ms. Neighbor nudge +80 ms, plus 30 ms per 100 pt of distance. Links +200 ms | Dot fades in, 200 ms; one static ring fades out, 300 ms; no nudge |
| Checklist item tick | Circle fills from the center, checkmark stroke draws (trim), circle scales 1→1.15→1, text gets struck through and dims to 50%. Haptic `.success`. | Fill `(0.2,0,0,1)` 150 ms; stroke `--ease-io` 250 ms; scale `.bouncy(duration: 0.4)`; strike `(0.2,0,0,1)` 250 ms | about 500 ms total | Stroke +100 ms after fill; strike +150 ms | Check appears plus dim, 150 ms fade |

**Number count-up** (for example, "remember 150 people"): `.contentTransition(.numericText())` driven by `.easeOut(duration: 1.0)`. On the web, a rAF tween with `(0.2,0,0,1)` over 800-1200 ms. Under Reduce Motion, show the final number.

**Rules**
- One hero motion per act.
- Everything is interruptible: springs pick up from the current velocity.
- Demos auto-play once, then loop the last 3-4 s, or hold with a "Replay" option (does not apply to onboarding: no replay button; demos play once and hold the last frame).
- Never block "Continue" on an animation.
- Plop values come from:
  - Apple's guidance: bounce ≤ 0.4.
  - The Material ripple model: a circle expanding from the touch point that fades out (https://m3.material.io/foundations/interaction/states).
  - Pin-drop and home-screen-icon "settle" behavior, which I observed and is not documented.

- Interim rules: every content piece animates (text, cards, dots, chips, buttons), mostly ease-in-out, premium and effortless: nothing snaps, nothing bounces except the deliberate overshoots (plop, `Motion.pop`). New tokens in `Motion.swift`: `Motion.ease = Animation.timingCurve(0.42, 0, 0.58, 1, duration: 0.4)`, `Motion.easeSlow = ... duration: 0.6`, `Motion.easeFast = ... duration: 0.25`. Existing `Motion.snap` (0.28 s snappy) for toggles and ticks, `Motion.pop` for pop-ins, `Motion.layer` for step slide (forward and back), `.appear(i)` stagger from `Motion.swift` (step 0.04 to 0.06 s, cap 10). Text appears by word or line with 6pt rise and fade; stagger never exceeds 0.2 s per item.
- Step transitions: forward slides content 24pt and cross-fades (0.5 s); back reverses. The header does not move.
- Reduce Motion: use `Motion.animation(_, reduce:)`; no orb drift, no 3D tilt loop, no looping or timed demos (show the final frame, cross-fade between), Next shown at once, progress bar segments jump.
- Haptics: light impact on chip select and primary taps, light impact on the in-demo to-do tick (step 4), success on the first real profile saved (use the existing haptics helper).
- Dynamic Type: all text uses `Theme.font` (scales); content sits in a `ScrollView` so XL sizes scroll and the primary button stays pinned in a bottom safe-area inset. Demos scale down (`.scaleEffect`) rather than overflow. Test at the largest accessibility size.
- VoiceOver: each step is one heading (`.accessibilityAddTraits(.isHeader)`) then content; demos are `accessibilityElement(children: .ignore)` with one label describing the end state (for example step 5 "Jordan Lee's profile created from a spoken note, with the name fixed from Jorden"); the dot scatter is hidden with the label "150 dots, the outer ones fading"; chips are toggles with `.isSelected`; the three-segment progress bar is one element labelled "Step N of 8, act name" (for example "Step 5 of 8, Learn by doing"); Pip is hidden (decoration), the narration line is read. Back is "Back", Skip is "Skip introduction", Next appears immediately. Auto demos do not block VoiceOver focus.
- Targets 44pt minimum (chips 48, buttons 56). Contrast: white text on night; light steps use `Theme.ink` on pastel. Do not rely on color alone for chip selection (check mark).

## 5. After onboarding: contextual tips (each shown once)

Small `.glass()` callout with an arrow, dismiss on tap or on doing the thing; ids stored in `peepl.tipsSeen`. Built in `Components/TipCallout.swift` (does not exist yet in the code: T4 creates it; the first-run coach in section 6a reuses it with a longer body).
- `mindmapDot`: first time the Mindmap tab is shown with 2 or more people. Copy: "Tap a dot to see who they know."
- `askBar`: first time the list or mindmap is shown with 1 or more people, after the Add layer is closed. Copy: "Ask in your own words, like climbing buddy."
- `reachOut`: the first time the Reach out section appears on Connections (`Services/Nudges.swift`, `ConnectionsView`). Copy: "These are people you have not talked to in a while."
- Never two tips at once; never during Add / Find / a profile; not shown while replaying onboarding; never while the first-run coach is showing. Settings gets a row "How Peepl works" (Section "About" or above it) that re-opens the flow.

## 6. First-run in the app

Replaces the v3 "Try it" step. Everything here is the real app, the real Add screen, the real store.

### 6a. Coach callout on the empty screen
- After onboarding ends with "Add your first friend", the cover dismisses and, 0.4 s later, a `TipCallout` opens anchored to the add-person button in `Components/AskBar.swift` (anchor via a preference key on the button). Title: "Add your first friend." Body: "Tap here, then talk off the top of your head about everything you know about them." Set `peepl.firstRunCoachSeen` when it is shown.
- Also shown once (same key) on the first launch of an empty store after onboarding when the user did not come via "Add your first friend" (for example after Restore of an empty backup, or a launch after force quit), without the 0.4 s rule.
- Dismiss: tap the add-person button (opens Add, the normal path), or tap anywhere else (callout fades 0.25 s, the empty state stays).
- Not shown when people exist, and never during replay.

### 6b. Add screen "Try to cover" checklist
- New `Components/CoverChecklist.swift`, shown in `AddView`'s `.idle` phase above the Composer, only while `peepl.firstAddSeen` is false.
- Decision: it stays until the user has saved 3 people, counted from the store (`people.count >= 3` ends it; nothing new is stored beyond setting `peepl.firstAddSeen` once that is observed at the end of a save). It is never collapsed: it stays visible above the keyboard as 6 compact rows in two columns of 3.
- Rows (copy): "Name", "When you met", "Where you met", "Where they are from / live", "What they do", "Something to remember or follow up".
- Each row has a ring that fills with a check (`Motion.snap`, light haptic on the first tick only, never repeated) and VoiceOver reads "Name, covered" / "Name, not covered yet".
- Live ticking from the Draft, never the saved Person:

| Row | Ticks when |
|---|---|
| Name | `draft.name != nil` |
| When you met | `Capture.parseMetDate(text, today:) != nil` (the new parser, 6c) or a life-stage phrase matched |
| Where you met | `draft.met != nil` |
| Where they are from / live | `draft.from != nil || draft.lives != nil` |
| What they do | `draft.does != nil || draft.company != nil` |
| Something to remember or follow up | `draft.remember != nil || draft.goal != nil || draft.follow != nil` |

- Rules: ticks are monotonic within one Add session (a tick never un-ticks until the checklist resets on "Add another" or on closing Add), because speech streams interim text that can briefly stop matching. Evaluate on a debounce of about 300 ms after the last text change, off the main actor if needed, using `Capture.parsePerson(text, people:)` and `Capture.parseMetDate` only: no AI, no on-device model, no network.
- Gaps in `Capture.parsePerson` (checked 2026-11-22 against `Logic/Capture.swift`) that this checklist will inherit; list them in the build task, fix only (2) cheaply:
  1. There is no when-you-met detection at all (`Draft` has name, does, company, from, lives, met, remember, goal, follow, knows, context; `timeRx` only strips "last night / yesterday" from the place). `parseMetDate` (6c) is new.
  2. Name needs "met / with / named X" or a capitalised first word (`nameRx1` / `nameRx2`). A lowercased voice transcript or a note that starts with a verb may not tick Name. Mitigation: the note is mostly capitalised by the speech recogniser; do not change the parser in this task, accept the limit.
  3. `parsePerson` is regex over the whole text on every call, so ticking needs the 300 ms debounce; it must not call AI.
  4. `draft.met` is nil when no place is found, and `PeopleStore.createPerson` then stores `"Somewhere"`; the checklist must therefore tick off the Draft, never the saved `Person`.
  5. `from` / `lives` need a capitalised place and the exact phrases in `fromRx` / `livesRx`.
  6. "now in X" works for lives; "I grew up near Boston" does not match `fromRx`.
  7. Speech streams interim text, so ticks can appear then disappear in the raw Draft; hence monotonic ticks.

### 6c. Past meetings set the met date
New `Capture.parseMetDate(_ text: String, today: Date) -> String?` in `Logic/Capture.swift`. `today` is always injected (tests use a fixed date, never `Date()`; `Capture.today()` stays as the string helper for the app). It returns a precision string, no schema change:

- `"yyyy-MM-dd"` exact day, `"yyyy-MM"` month known, `"yyyy"` year only. It is the value stored in the existing `Moment.date` (a `String`, currently "ISO day"); `Person` has no met-date field, `Models.swift` is NOT changed.
- A life-stage phrase ("back in college", "in high school", "in grad school", "as kids / in childhood") returns nil and sets `Person.lifeStage` instead (`Person.lifeStage` exists as `String?`; today `createPerson` always writes nil). A second function `Capture.parseLifeStage(_ text: String) -> String?` returns `"college"`, `"high-school"`, `"grad-school"` or `"childhood"`.
- Rules: only the FIRST match wins; the met sentence (a sentence containing met / meet / ran into / bumped into / introduced / know / knew / "friends since") takes priority over other sentences, and a bare year or relative phrase in a non-met sentence is ignored ("we founded it in 2019" must not set a met year). "yesterday / last night / today / this week" are accepted in any sentence. Valid explicit year range 1950 to the current year; a future year returns nil.
- Seasons use the middle month: summer 07, winter 01, spring 04, fall / autumn 10; a season alone with no year means the most recent past occurrence; if no year can be inferred, return nil.
- Relative years subtract from the current year: "a year ago" 1, "a couple of years ago" 2, "a few years ago" 3, "N years ago" N (digits or words one to ten), "last year" 1.
- Relative months subtract N months and return `yyyy-MM`; "last month" is 1 (month precision); "this month" is the current month.
- Relative days (all use the local calendar day of the injected `today`, never UTC): "yesterday" and "last night" = the previous calendar day (`yyyy-MM-dd`, never saved as today); "last night" said after midnight and before 5 am also means the previous calendar day (the same rule, so a 2 am note gets yesterday's date); "the day before yesterday" = 2 days back (match it before "yesterday"); "today", "this morning" and "tonight" = today (`yyyy-MM-dd`); "last week" = 7 days back (`yyyy-MM-dd`, shown by month only, see the display rule; match it before "last month" / "last year" so it is not misread).
- Month alone ("last March", "this March", "in March") means the most recent past March (current year if that month has passed or is the current month, else the previous year); `yyyy-MM`.

Examples (fixed `today` = 2026-11-22; table is the unit-test table, 30 rows):

| Phrase in the note | Expected |
|---|---|
| "met them three years ago" | `2023` |
| "met them 3 years ago" | `2023` |
| "met a couple of years ago" | `2024` |
| "met a few years ago" | `2023` |
| "met a year ago" | `2025` |
| "met them last year" | `2025` |
| "met six months ago" | `2026-05` |
| "we met last month" | `2026-10` |
| "met in 2023" | `2023` |
| "back in 2019 we met" | `2019` |
| "met in March 2022" | `2022-03` |
| "met in Mar 2022" | `2022-03` |
| "met last March" | `2026-03` |
| "met last summer" | `2026-07` |
| "met in the summer of 2019" | `2019-07` |
| "met last winter" | `2026-01` |
| "met them yesterday" | `2026-11-21` |
| "met them last night" | `2026-11-21` |
| "met them last night" with `today` = 2026-11-22 02:00 local | `2026-11-21` |
| "met them the day before yesterday" | `2026-11-20` |
| "met them this morning" | `2026-11-22` |
| "met them today" | `2026-11-22` |
| "met them tonight" | `2026-11-22` |
| "met them last week" | `2026-11-15` |
| "met in 2031" | `nil` (future) |
| "met in 1920" | `nil` (out of range) |
| "we founded it in 2019. Met Sam at a bar." | `nil` (year not in the met sentence) |
| "met in college" | `nil` date; `parseLifeStage` = `college` |
| "met in high school" | `nil` date; `parseLifeStage` = `high-school` |
| "Met Sam at Demo Day." | `nil` (no date: stays today) |

Display rule: year only when the month is unknown ("Met 2023"); month plus year otherwise ("Met Mar 2022"); an exact day shows "Met Nov 2026" (month plus year, as now; yesterday on the 1st of a month shows the previous month, which is correct); "last week" is stored as an exact day but shows month plus year only; a life stage shows "Met in college" / "Met in high school" / "Met in grad school" / "Met in childhood".

Where it lands (files, no schema change):
- `Services/PeopleStore.swift` `createPerson`: the first `Moment.date` = `parseMetDate(...) ?? today`; `lifeStage` = `parseLifeStage(...)`; `lastContacted` stays `today` (existing behaviour, kept on purpose: they are talking about them now, so the losing-touch nudge effect is nil for a new person).
- `Screens/ProfileView.swift` `metDate` (line about 28): today it does `String(iso.prefix(10))` with a `yyyy-MM-dd` formatter, so "2023" or "2023-05" fail to parse and it returns an empty string (a conflict with the new strings). Rewrite to switch on length: 10 or 7 chars to "MMM yyyy" (`yyyy-MM-dd` / `yyyy-MM` formatter), 4 chars to "yyyy"; if `person.lifeStage` is `college`, `high-school`, `grad-school` or `childhood`, show "Met in ..." first. NB: the seed data uses `lifeStage` as an 8-value category (`nyc-social`, `college`, `networking`, `nyc-work`, `first-job`, `high-school`, `hometown`, `family`), so sample people with `college` (91) and `high-school` (37) will now read "Met in college" / "Met in high school", which is acceptable for demo data; other values are ignored by the display. `lifeStage` is not displayed anywhere today.
- `Screens/AddView.swift` card (`monthYear(Capture.today())`, line about 171): use the same length-based formatter on the saved first moment date. Share one helper (`MetDate.label(_:lifeStage:)`) between ProfileView and AddView.
- Other readers of `Moment.date` / strings that must tolerate short strings (grep result 2026-11-22):
  - `Screens/ProfileView.swift` `moments` sorted by `$0.date > $1.date` (line about 26) and `dayLabel` (line about 105): `dayLabel` falls back to the raw string when parsing fails, which prints "2023"; acceptable, but the sort puts "2023" before "2023-05" and "2023-05-10" lexicographically because a shorter prefix sorts lower; stated and accepted (a year-only first meeting sorts as the oldest of that year, which is true to life).
  - `Logic/Search.swift` line about 41 (same sort) and line about 69 (recency: `iso.date(from: String(s.prefix(10))) ?? epoch`): a short string parses to nil and becomes epoch, so the moment looks ancient, only affecting recency weighting; acceptable, but T3 should pad short strings in `Search.swift` (`"2023"` to `"2023-07-01"`, `"2023-05"` to `"2023-05-15"`) so recency is sensible.
  - `Logic/Ask.swift` (line about 102 `date(_:)` and about 254 `monthYear.string(...)`): same epoch fallback; the reason text would say "Jan 1970". Must pad the same way.
  - `Logic/Semantic.swift` `when(_:)` (line about 15): handles `yyyy-MM` and falls back to the raw string for `yyyy`; fine.
  - `Services/Backup.swift` (lines about 8, 28, 70, 91): `date` is a plain `String` copied through; no validation of its format found; fine.
  - `Services/Nudges.swift` (line about 21): uses `lastContacted` (always a full day), not `Moment.date`; unaffected.
  - `Logic/MindmapMath.swift` (line about 25): uses `lastContacted`; unaffected.
- Tests: `PeeplTests/CaptureTests.swift`: the table above, run with `today` = 2026-11-22; plus a `metDate` label test (10, 7, 4 chars, life stage) and a `createPerson` test ("met three years ago" gives first moment date `2023`, `lastContacted` = today).

### 6d. After save: "Add another"
- `AddView.Phase` has `idle, choosing, creating, done(Person), doneMany`, and today the layer closes with `nav.pop()`. On `done` and `doneMany` the result card stays, and below it a primary "Add another" (`Theme.night`) and a secondary text button "Open profile".
- "Add another": `phase = .idle`, `note = ""`, checklist ticks cleared, the Composer keeps focus (keyboard stays up), mic idle, a 0.25 s ease-in-out content swap (`Motion.easeFast`); no bouncing through screens. `mutualOf` is not used for Add another.
- A saved-count line "3 added" (mono 12) shows above the card from the second save on.
- The plop of each saved person is queued, not played now: `Nav.justAdded` (6e) is set by `AddView` / `createPerson`; it plays when Add finally closes (X or "Done").

### 6e. The plop on the mindmap
User-facing: back on the mindmap the new person "plops" in: scale-in with an overshoot spring, a ring ripple that expands and fades, nearby nodes nudge outward, links draw in, light haptic.

Code facts (checked 2026-11-22) and the hard bits:
- `MindmapView.sync()` runs on `.onChange(of: people.map(\.id) + people.flatMap(\.knows))` and calls `MindmapModel.sync(...)`, which rebuilds `ForceGraph(ids:pairs:prev:)` whenever the id / pair signature changes. It keeps old x, y via `prev`, places a NEW node on a spiral by index (angle `i * 2.4`, radius `20 + 6i`, i.e. near the centre, not near its mutuals), clears `selected` / `focus`, sets `fitted = false` and restarts the layout (alpha), so existing nodes already drift.
- There is no per-node birth time, no ripple and no link draw-in. Nodes and links are drawn in a Canvas `draw()` (`MindmapView`) from `model.graph`; `MindmapModel.Dot` holds only float / depth (`ux, uy, vx, vy, f, d, op`).
- The Mindmap tab is mounted UNDER the Add layer, so `.onChange` fires while Add is still open. The plop must be triggered when the Add layer is dismissed (`Nav.layers` change), not at insert.
- Spec:
  - `Nav` (in `Screens/Shell.swift`): add `var justAdded: [String] = []`. `AddView` / `createPerson` appends the new ids.
  - `MindmapView`: consume `justAdded` on appear and when `nav.layers` loses the Add layer; for each id call `model.plop(id)` and clear the list.
  - `MindmapModel`: `born: [String: TimeInterval]`; `plop(_ id:)` sets `born[id] = now`, queued 0.35 s apart; at most 3 queued, further ones just fade in (no plop).
  - `draw()` in `MindmapView`: node scale 0 to 1 with an overshoot spring (response about 0.5 s, damping 0.6); a ring that expands to about 2.2x the disc radius over 0.7 s ease-out while fading; its links drawn with a trim 0 to 1 over 0.5 s, staggered 0.1 s; for nodes within 1.6 disc radii a transient outward offset of at most 10pt easing back over 0.6 s, through the existing float spring channel `stepFloat` (do not move layout positions).
  - `ForceGraph.init`: seed the new node's initial position near the centroid of its mutuals (or the centre if none) by passing a synthetic `prev` entry for the new id, so the plop lands where it will live. This touches the `prev` handling; the spiral stays as the fallback.
  - `.sensoryFeedback(.impact(weight: .light), trigger:)` on the landing.
  - A person with no links still plops.
  - Reduce Motion: node and links appear with a 0.2 s fade; no ripple, no nudge, no overshoot.
- Hard bits, stated plainly: (1) `sync` wipes `selected` and `focus` on every people change, so a plop in the middle of a selection clears it (accepted; the plop plays after Add closes, when nothing is selected); (2) `ForceGraph` is rebuilt wholesale on every sync, not updated, so the seeding hack must survive the rebuild; (3) only one rebuild runs per people change, so rapid "Add another" saves can queue several plops, hence the queue (0.35 s apart, cap 3, then fade).

### 6f. Mic primer moves here
- The mic pre-permission primer moves to the first mic tap in the real Add screen (it was on the v3 Try it step). Same copy as v3 and the same key `peepl.micPrimerSeen`.
- Shown only when the user taps the Composer's mic, `peepl.micPrimerSeen` is false and the system status is not determined: a small `.glass()` sheet with one sentence: "Peepl listens only while you hold the mic, to turn your voice into a note." Buttons "Allow microphone" (then `AppleSpeechRecognizer.authorize()` in `Services/Speech.swift`, which raises the system prompts for speech and microphone) and "Type instead". Set `peepl.micPrimerSeen` after either choice. Never shown on launch or in onboarding.
- Denied (authorize returns false): the mic button stays; tapping it shows an inline line, not an alert: "Microphone is off. You can type instead, or turn it on in Settings." with a button "Open Settings" (`UIApplication.openSettingsURLString`, same as `SettingsView`). The composer keeps working for typing. Unchanged from v3.

## 7. Files touched (summary)

New: `Screens/Onboarding/OnboardingFlow.swift` (shell, header, progress, 1 s Next), `Screens/Onboarding/OnboardingSteps.swift` (steps 1, 7, 8), `Screens/Onboarding/OnboardingDemos.swift` (steps 2 to 6, Pip, 3D plane), `Services/OnboardingState.swift` (keys, gate, meetWhere tailoring, tips), `Components/TipCallout.swift`, `Components/CoverChecklist.swift`.
Edited: `Screens/Shell.swift` (RootView gate and cover; `Nav.justAdded`), `Logic/Capture.swift` (`parseMetDate`, `parseLifeStage`), `Screens/ProfileView.swift` (`metDate`), `Screens/AddView.swift` (checklist, Add another, card date, placeholder from meetWhere, `ResultCard` internal), `Screens/MindmapView.swift` and `Screens/MindmapModel.swift` (plop), `Logic/ForceGraph.swift` (seed near mutuals), `Components/AskBar.swift` (coach anchor), `Services/PeopleStore.swift` (met date into the first Moment, `lifeStage`), `Screens/FindView.swift` (example cards), `Screens/SettingsView.swift` (How Peepl works), `Logic/Search.swift` and `Logic/Ask.swift` (pad short dates), `Services/Backup.swift` (callable from step 1; no behaviour change), `Services/Speech.swift` (none; primer sits above `authorize()`), `Motion.swift` (ease tokens), `PeeplUITests/*` (skip flag), `PeeplTests/CaptureTests.swift`.
NOT changed: `Models.swift` (no schema change).
Deleted: `Screens/Onboarding/TryItView.swift` and its tests (the v3 Try it step).

## 8. Build tasks (sequential; each under about 5 files)

### T1: onboarding flow and gate
Files: `Services/OnboardingState.swift`, `Screens/Onboarding/OnboardingFlow.swift`, `Screens/Onboarding/OnboardingSteps.swift`, `Screens/Shell.swift`, `Services/Backup.swift` (expose restore entry only).
Does: keys (section 2), gate, header (act title, Back, Skip, the three-segment progress bar, no "Part x of 3", no replay button), the 1 s Next delay, steps 1, 7 and 8 with final copy, steps 2 to 6 as empty placeholders that only show their heading, Restore, `meetWhere` saved, RootView hook.
Acceptance: (a) `xcodebuild build` for the simulator passes; (b) a unit test for the gate: empty store + flag unset shows; people present hides and sets done; `-PeeplSkipOnboarding YES` hides; done flag hides; (c) launching with `-PeeplInMemory YES -PeeplNoSeed YES` shows step 1, Get started goes through to step 8, "Add your first friend" lands on the empty list and a relaunch does not show onboarding; (d) the progress bar has three segments (4 : 2 : 2) that fill per step within their act (unit test on the fill fractions: step 1 gives 0.25 / 0 / 0, step 4 gives 1 / 0 / 0, step 5 gives 1 / 0.5 / 0, step 8 gives 1 / 1 / 1) and its accessibility label reads "Step N of 8, act name"; Skip from step 3 lands on step 8, Back from 8 lands on 7, step 1 has no Back and no Skip, step 8 has no Skip; (e) Next is not hittable before 1 s and is hittable after (UI test with a 1.2 s wait); (f) all existing tests pass with the skip flag.

### T2: auto demos, 3D, Pip
Files: `Screens/Onboarding/OnboardingDemos.swift`, `Screens/Onboarding/OnboardingFlow.swift`, `Components/Motion.swift` (ease tokens), `Screens/AddView.swift` (make `ResultCard` internal), `Screens/ProfileView.swift` (extract the hero / summary / to-do rows as reusable read-only sub-views).
Does: steps 2 to 6 with the storyboards and timings in section 3; steps 2 to 4 on the tilted plane; steps 5 and 6 as directly shown real views made 3D themselves (SwiftUI `rotation3DEffect` with perspective 0.6 on the reused real views `Composer`, `NameNote`, `AskBar`, `MindmapView` dots, `ResultCard`, layered shadows, idle float, parallax; NO device bezel or phone frame view; note text at least 15 pt); Pip (blob chosen at flow start per 3.0), the `ProfileView` hero reuse; Reduce Motion final frames.
Acceptance: (a) build passes; (b) Pip's blob is never `mint` (Jordan) and never the blob of the oldest person in a replay test with a person present (unit test on the pick function, 18 blobs); (c) each step's timeline total matches section 3 within 0.3 s (a deterministic clock injected in tests); (d) with Reduce Motion on, every demo renders its final frame and shows no timers; (e) screenshot check: the tilt is visible on steps 2 to 6, steps 5 and 6 show no phone frame or bezel and their text is at least 15 pt, and steps 1, 7, 8 are flat; (f) demos do not read the store or call `AIClient` (grep in review).

### T3: first-run coach, Add checklist, past-date parsing
Files: `Logic/Capture.swift`, `Components/CoverChecklist.swift`, `Screens/AddView.swift`, `Services/PeopleStore.swift`, `Screens/ProfileView.swift` (plus `Logic/Search.swift` and `Logic/Ask.swift` for padded dates; if this exceeds 5 files, split the padding into T4).
Does: `parseMetDate`, `parseLifeStage`, the checklist (6b) with a 300 ms debounce and monotonic ticks, the card and profile date display (6c), first Moment date and `lifeStage` in `createPerson`, the mic primer move (6f).
Acceptance: (a) the 30 row table (yesterday / last night giving the previous day, last night at 02:00 giving the previous day, this morning / today / tonight giving today, the day before yesterday 2 days back, last week 7 days back, last month at month precision, plus a month-boundary case with `today` = 2026-12-01 giving yesterday `2026-11-30`) and the `nil` cases pass in `CaptureTests` with the fixed `today`; (b) typing "Met Sam at Demo Day, three years ago. Founder at Acme. From Austin." ticks Name, When you met, Where you met, Where they are from / live, What they do (5 of 6), and not the last row; clearing the text does not un-tick; (c) "met in 2023" saves a profile that reads "Met 2023"; "met in college" reads "Met in college"; a plain note reads "Met Nov 2026" (frozen date); (d) the primer shows only on the first mic tap and never again; denied state shows the inline line; (e) the checklist stays until 3 people exist and then `peepl.firstAddSeen` is true; (f) build passes.

### T4: Add another, plop, tips, Settings replay, tests
Files: `Screens/MindmapView.swift`, `Screens/MindmapModel.swift`, `Logic/ForceGraph.swift`, `Screens/Shell.swift` (`Nav.justAdded`), `Components/TipCallout.swift` (plus `Components/AskBar.swift` for the coach anchor, `Screens/SettingsView.swift`, `ConnectionsView.swift`, and the UI tests; split across two sub-tasks if over 5 files).
Does: "Add another" (6d), the coach (6a), the plop (6e), the three tips, Settings replay (ends on Done, writes only `peepl.meetWhere`), VoiceOver and Reduce Motion checks, tests.
Acceptance: (a) "Add another" saves two people in a row with the keyboard staying up and the checklist reset, then closing Add plays two plops 0.35 s apart; (b) a new node with mutuals starts within 100pt of their centroid (unit test on `ForceGraph`), a person with no links still plops; (c) Reduce Motion: 0.2 s fade, no ripple (a test on the draw parameters); (d) the coach shows once and not again after dismiss or relaunch, and only with an empty store; (e) each tip appears once; (f) replay opens the flow, ends on Done, creates no person, and `peepl.onboardingDone`, `firstRunCoachSeen` and `firstAddSeen` are unchanged; (g) UI test: Get started to Add your first friend with `-PeeplNoSeed YES`; (h) every existing UI test passes with `-PeeplSkipOnboarding YES`; (i) manual: largest Dynamic Type, VoiceOver pass, Reduce Motion on.

## 9. Mockup brief (for open-design, iPhone 15 Pro, 393 x 852)

Mock these screens and states with the Peepl tokens (Geist, pastel glass, night `#1c1522`, no Liquid Glass). Show the header on every light step: Back left, act title, Skip right, three-segment progress bar (4 : 2 : 2, small gaps, filled per step) in between, no "Part 1 of 3", no replay button.
1. Step 1 Cold open (dark, three blurred orbs, heading, sub, Get started, Restore a backup).
2. Step 2 You meet Jordan: two frames (card with detail chips floating, then "Three weeks later" with the chips dissolving), tilted 3D plane.
3. Step 3 The edge: 150-dot disc fading outward, Angela Lee label card floating above.
4. Step 4 Peepl keeps the story: chips reassembling and the final profile card in perspective.
5. Step 5 Capture: no phone frame; layered 3D panels (heading, large Composer panel, text 15 pt or larger) with streaming words and the name fix mid-way (Jorden, dark outline and caret, faded old spelling), Pip bottom-left with its line "Misheard a name? Tap it later to fix it."; plus the result card frame.
6. Step 6 Connect and ask: no phone frame, layered 3D panels; two frames (Jordan mint dot with a dashed line to Aisha on the mindmap; ask bar "coffee in SF" with the Theo Park result card and the drafted message).
7. Step 7 chips (five chips, one or two selected, Next).
8. Step 8 Privacy promise (three rows, the voice caveat line, fine print, "Add your first friend").
9. The empty-state coach callout on the add-person button.
10. Add with the "Try to cover" checklist, partly ticked (3 of 6), keyboard up.
11. Add "Add another" done state (result card, primary "Add another", "Open profile", "2 added" count).
12. The plop mid-animation on the mindmap (new disc overshooting, ring ripple, a dashed link drawing, neighbours nudged).
13. The mic primer sheet and the denied inline message as two extra frames; a tip callout on the mindmap and the Settings "How Peepl works" row.

## 10. Out of scope and open items for Vince

Out of scope for now (decision 2026-11-22): importing from iOS Contacts. It is its own flow (Contacts permission, consent line, matching), not part of onboarding.

Open:

- Voice caveat in 3.8 (on-device recognition not always available). Decide whether the privacy page and Settings About text should say so.
- Whether the Welcome orbs should match the pitch deck exactly or the app aura palette.
- Motion tokens: the interim ease tokens in section 4 should be reconciled with the motion spec table (house curves `(0.45,0,0.55,1)` / `(0.65,0,0.35,1)`).
- Seed `lifeStage` values double as display text for `college` and `high-school` (6c); say if sample people should keep showing the dated "Met" line instead.
