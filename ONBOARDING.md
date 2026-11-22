# Peepl onboarding spec (O1)

Status: approved flow (user, 2026-11-22). iOS only, no account, skippable, 6 screens plus in-app tips. Spec only; builders implement it in SwiftUI after the open-design mockups (O2) are approved. Where a mockup and this file disagree on layout, the mockup wins; copy, keys and gate logic here win.

## 1. Principles and research

1. Brief, optional, interactive, permissions in context, contextual tips over one long flow, never block the start. Apple HIG: https://developer.apple.com/design/human-interface-guidelines/onboarding
2. Let people do the real thing before any commitment. Duolingo gives a real lesson before signup; delaying signup gave about +20% DAU. https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/ and https://goodux.appcues.com/blog/duolingo-user-onboarding. Peepl has no account at all, so the first action is the real Add composer (screen 6).
3. One short question that makes the app feel made for you. Headspace asks 3 questions; Irrational Labs found perceived fit doubled course starts. https://irrationallabs.com/case-studies/headspace-doubled-course-starts/ and https://goodux.appcues.com/blog/headspaces-mindful-onboarding-sequence. We ask one (screen 4).
4. Teach one core loop and skip secondary features. Strava: record, see, share. https://screensdesign.com/articles/strava-onboarding-design/. Peepl's loop: Capture, Browse, Find. Filters, group by, backups and nudges are not taught in the flow.
5. Ask for a permission in context, one at a time, with a Settings fallback; the iOS prompt can only be shown once. https://www.nngroup.com/articles/permission-requests/ and https://developer.apple.com/design/human-interface-guidelines/patterns/accessing-private-data. The mic is asked only when the user taps record (screen 6).

Feel: warm, not transactional; personal and private; as quick as a voice memo.

## 2. Gate, persistence, entry and exit

Persistence (UserDefaults.standard, all on device, never sent anywhere):

| Key | Type | Meaning |
|---|---|---|
| `peepl.onboardingDone` | Bool | Set when the flow ends by any path (finish, skip, restore, samples, Later) |
| `peepl.meetWhere` | [String] | Screen 4 answers, raw values of `MeetWhere` (see 3.4); empty = none chosen |
| `peepl.tipsSeen` | [String] | Ids of tips already shown: `mindmapDot`, `askBar`, `reachOut` |
| `peepl.micPrimerSeen` | Bool | The one-sentence mic primer was shown and answered; never show it again |

Gate (evaluated once at launch in `RootView`, before the first frame so there is no flash of the list):

```
show onboarding = !defaults.bool("peepl.onboardingDone")
                  && peopleCount == 0
                  && !defaults.bool("PeeplSkipOnboarding")
```

- Existing installs with people never see it. If `peopleCount > 0` and the flag is unset, set `peepl.onboardingDone = true` silently so a later "delete everyone" does not trigger it.
- Test flag: launch argument `-PeeplSkipOnboarding YES` skips it. UI tests launched with `-PeeplInMemory YES` must be updated to also pass it (they load samples, so `peopleCount > 0` already skips it in practice; the flag is the explicit guarantee and is needed with `-PeeplNoSeed YES`). A new onboarding UI test passes `-PeeplNoSeed YES` and not the skip flag.
- Replay from Settings ("How Peepl works") shows the same flow with `replay = true`: no gate, no persistence writes except `peepl.meetWhere`, skipping screens 5 and 6's creation actions (screen 6 becomes "Try it" and ends on Done), and closing returns to Settings.
- Exit paths: Skip (top right on screens 2 to 5) jumps straight to the app and sets done. Finish on screen 6 sets done. "Restore a backup" (screen 1) runs the Backup restore flow and, on success, sets done and lands in the list. "Try with sample people" calls `Seed.loadSamples(context)`, sets done, lands in the list. "Later" sets done, lands in the empty list (which still has its own Try with sample people and Restore buttons).
- The flow is a full-screen cover above `RootView`, not a navigation stack. Swiping back is allowed between screens; the first screen has no back.

## 3. Screens

Common layout: `PastelAura`/`AuraBackground` style ground on light screens (screens 2 to 6); screen 1 is dark. Page dots at the bottom (6 dots), Skip top right in `Theme.font(15, .medium)`, primary button full width, 56pt tall, `Theme.night` fill, white text, bottom padding on safe area plus 16. Secondary buttons are text buttons, `Theme.inkMuted`. Cards use `.glass()` / `Theme.pastel`. No Liquid Glass (2026-11-22 iOS look decision). Headings `Theme.font(32, .regular)` tracking -0.04em equivalent; body `Theme.font(17)`; meta `Theme.mono(12)`. All copy is final and has no em dashes.

### 3.1 Welcome (dark)
- Ground `Theme.night` (#1c1522) with three blurred orbs (blur about 90pt): yellow bottom-left, blue top-right, pink bottom-right (pitch deck). Slow drift, 14 to 25 s loops, off for Reduce Motion.
- Wordmark "Peepl" `Theme.font(56, .semibold)`, white. Tagline: "Remember the stories of the people you meet."
- Primary: "Get started". Secondary: "Restore a backup" (opens the same document picker + Merge / Replace choice as `Services/Backup.swift`; no new restore code).
- No Skip here; "Get started" is the way in and Restore the other.

### 3.2 Problem
- Visual: 150 dots in a loose disc (reuse the mindmap's white disc dot look, `MindmapView` / `ForceGraph` positions are not needed; a seeded static scatter is enough). The inner 30 dots are solid white-on-pastel; the outer dots fade to about 20% opacity toward the edge.
- Heading: "Meeting people is easy. Remembering them is hard."
- Sub: "Researchers say we keep about 150 meaningful relationships. The people on the outer edge are often the ones who help most, so they are the ones worth remembering."
- Primary: "Next".

### 3.3 How it works (three swipeable cards, a TabView page style inside the screen)
Each card: a small live demo (looping once, then rests; static final state under Reduce Motion), a title, one line.
1. "Capture": demo types the note "Jordan Lee, met at Demo Day. Founder at Voltcell, battery recycling for e-bikes. From Seattle, lives in Brooklyn now. Climbs Tuesdays. Owe them a hardware engineer intro." then a profile card appears (Jordan Lee, Founder @ Voltcell, Brooklyn). Line: "Talk or type for 20 seconds. Peepl fills in who, where, what and your follow-ups."
2. "See how they connect": a few mindmap dots with dashed lines. Line: "Lines show who knows who. Bigger dots are people you know better."
3. "Ask in your own words": ask bar types "climbing buddy", result card shows Jordan Lee, a why line ("Climbs Tuesdays"), and a drafted message bubble. Line: "Every answer says why, from your own notes. Peepl drafts the message. You decide."
- Demos are plain SwiftUI views with hard-coded text; they do not touch the store or the AI.
- Primary: "Next" on cards 1 and 2 (also swipe), "Continue" on card 3.

### 3.4 One question
- Heading: "Where do you meet people?" Sub: "Pick any. This only tunes the examples you see. It stays on your phone."
- Multi-select chips (min height 48, wrap): "Conferences and work events" (`events`), "Coffee chats" (`coffee`), "Classes and campus" (`campus`), "Local community" (`community`), "A new city" (`newcity`). Stored as the raw values above in `peepl.meetWhere`.
- Primary: "Next" (enabled with zero chips selected; zero is fine). Skip works as usual.
- Tailoring (first selected value wins; none selected = today's defaults): Add composer placeholder and Find's idle example cards.

| Value | Add placeholder | Find example card (replaces the "Occasion" card) |
|---|---|---|
| events | "Who did you meet at the event?" | "Someone I met at a conference" |
| coffee | "Who did you have coffee with?" | "Someone to catch up with over coffee" |
| campus | "Who did you meet in class?" | "Someone from my classes" |
| community | "Who did you meet in your community?" | "Someone from my neighborhood" |
| newcity | "Who did you meet in your new city?" | "Someone who knows this city" |
| none | "Who did you meet?" (unchanged) | existing cards unchanged |

Find cards keep the tuple shape in `FindView.swift` (icon, label, shown text, query); the query for each new card must be a phrase the rules / embeddings can answer without a network (e.g. "conference", "coffee", "class", "neighborhood", "city").

### 3.5 Privacy promise
- Heading: "Your notes on people. No one else sees them."
- Three rows with SF Symbols: "Everything stays on this phone" (iphone), "No account, nothing to sign up for" (person.crop.circle.badge.xmark), "AI help from OpenAI is off until you turn it on in Settings" (switch.2).
- Fine print (mono 12): "Moving to a new phone? Back up from Settings and restore the file there."
- Primary: "Next".
- Truth check, done against the code on 2026-11-22:
  - TRUE: `AIClient.enabled` = `peepl.openaiEnabled` AND `Consent.agreed`; both default false, and every request in `AIClient` is guarded by `enabled`. The Settings toggle is labelled "Use OpenAI" and opens `ConsentView` first.
  - TRUE: on-device AI (Foundation Models, MiniLM embeddings) runs locally.
  - CAVEAT: `Services/Speech.swift` sets `requiresOnDeviceRecognition = rec.supportsOnDeviceRecognition`. On a device or language where on-device recognition is not supported, Apple's Speech framework may send audio to Apple. So "everything stays on this phone" is not strictly true for voice in that case. Do not claim more than the code does. Required copy under row 1 (mono 12): "Voice notes are turned into text on your phone when your iPhone supports it." Builders must not remove that line. Vince to decide whether to also state this in the privacy page.
  - The Settings "About" text says "Nothing leaves this phone unless you turn on AI help from OpenAI", which has the same voice caveat; flagged for Vince, not changed by this spec.

### 3.6 Try it
- Heading: "Who did you meet recently?" Sub: "Tell Peepl in a sentence or two. You can fix anything later."
- Body: the real `Composer` (`Components/Composer.swift`) with the tailored placeholder from 3.4, autofocus off until the user taps the field (so the keyboard does not cover the heading on entry), sending through the same code path as `AddView` (`createPerson` / parse with rules and on-device model). While it works show the same "Creating a new profile..." shimmer that `AddView` uses. Reuse `AddView` internals where possible; do not fork the parsing.
- Ends on the person's card (the same dark blob-colored card `AddView` shows). Tapping it finishes onboarding and opens their profile. Primary after creation: "Open their profile".
- Alternatives, shown as text buttons under the composer: "Try with sample people" (`Seed.loadSamples`, finish) and "Later" (finish, empty list). Skip is the same as Later.
- Mic primer (only when the user taps the mic and `peepl.micPrimerSeen` is false and the system status is not determined): a small `.glass()` sheet with one sentence: "Peepl listens only while you hold the mic, to turn your voice into a note." Buttons "Allow microphone" (then calls `AppleSpeechRecognizer.authorize()`, which raises the system prompts for speech and microphone) and "Type instead". Set `peepl.micPrimerSeen` after either choice. Never shown on launch or on any earlier screen. In `replay` mode the primer follows the same rule.
- Denied (authorize returns false): the mic button stays, tapping it shows an inline line, not an alert: "Microphone is off. You can type instead, or turn it on in Settings." with a button "Open Settings" (`UIApplication.openSettingsURLString`, same as `SettingsView`). The composer keeps working for typing.
- If the sample or Add creation fails, show the existing error behaviour of `AddView`; the user can still tap "Later".

## 4. Motion, haptics, accessibility

- Screen transitions: `Motion.layer` slide for forward and back; content appear uses `.appear(i)` stagger from `Motion.swift`. Chip select uses `Motion.snap`; card pop-ins `Motion.pop`.
- Reduce Motion: use `Motion.animation(_, reduce:)`; no orb drift, no looping demos (show final frame), cross-fade between screens.
- Haptics: light impact on chip select and primary taps, success on first profile created (use the existing haptics helper).
- Dynamic Type: all text uses `Theme.font` (scales); content sits in a `ScrollView` so XL sizes scroll and the primary button stays pinned in a bottom safe-area inset. Test at the largest accessibility size.
- VoiceOver: each screen is one heading (`.accessibilityAddTraits(.isHeader)`) then content; the dot scatter is `accessibilityHidden` with a text equivalent label "150 dots, the outer ones fading"; demos get a single label describing the end state; chips are toggles with `.isSelected`; page dots hidden and replaced by "Step N of 6" on the primary container. Skip is labelled "Skip introduction".
- Targets 44pt minimum (chips 48, buttons 56). Contrast: white text on night; light screens use `Theme.ink` on pastel. Do not rely on color alone for chip selection (add a check mark).

## 5. After onboarding: contextual tips (each shown once)

Small `.glass()` callout with an arrow, dismiss on tap or on doing the thing; ids stored in `peepl.tipsSeen`.
- `mindmapDot`: first time the Mindmap tab is shown with 2 or more people. Copy: "Tap a dot to see who they know."
- `askBar`: first time the list or mindmap is shown with 1 or more people, after the first-profile screen is closed. Copy: "Ask in your own words, like climbing buddy."
- `reachOut`: the first time the Reach out section appears on Connections (`Services/Nudges.swift`, `ConnectionsView`). Copy: "These are people you have not talked to in a while."
- Never two tips at once; never during Add / Find / a profile; not shown while replaying onboarding. Settings gets a row "How Peepl works" (Section "About" or above it) that re-opens the flow.

## 6. Files touched (summary)

New: `Screens/Onboarding/OnboardingFlow.swift`, `Screens/Onboarding/OnboardingScreens.swift` (welcome, problem, how it works, question, privacy), `Screens/Onboarding/TryItView.swift`, `Services/OnboardingState.swift` (keys, gate, meetWhere tailoring, tips), `Components/TipCallout.swift`.
Edited: `Screens/Shell.swift` (RootView gate + cover), `Screens/AddView.swift` (placeholder from meetWhere; expose shared creation), `Screens/FindView.swift` (example cards), `Screens/SettingsView.swift` (How Peepl works), `ConnectionsView.swift` and `Screens/MindmapView.swift` (tip anchors), `Services/Backup.swift` (callable from Welcome; no behaviour change), `Services/Speech.swift` (none expected; primer sits above `authorize()`), `PeeplUITests/*` (skip flag).

## 7. Build tasks (sequential, each under about 5 files)

### T1: flow shell, static screens, gate, RootView hook
Files: `Services/OnboardingState.swift`, `Screens/Onboarding/OnboardingFlow.swift`, `Screens/Onboarding/OnboardingScreens.swift`, `Screens/Shell.swift`, `Services/Backup.swift` (expose restore entry only).
Does: keys, gate, screens 1 to 5 with final copy, page dots, Skip, screen 6 as a placeholder with "Later" and "Try with sample people" only, Restore and sample paths, meetWhere saved.
Acceptance: (a) `xcodebuild build` for the simulator passes; (b) a unit test for the gate: empty store + flag unset shows; people present hides and sets done; `-PeeplSkipOnboarding YES` hides; done flag hides; (c) launching with `-PeeplInMemory YES -PeeplNoSeed YES` shows the Welcome, Get started goes through to screen 6, Later lands on the empty list and a relaunch does not show onboarding; (d) all existing tests still pass with the skip flag.

### T2: Try it step and mic primer
Files: `Screens/Onboarding/TryItView.swift`, `Screens/AddView.swift`, `Screens/FindView.swift`, `Screens/Onboarding/OnboardingFlow.swift` (replace the placeholder).
Does: real Composer, shared creation path, first profile card, tailored Add placeholder and Find example cards (3.4 table), mic primer and denied state (3.6).
Acceptance: (a) typing "Dana Reyes, met at a design meetup" in Try it creates one person and shows their card; tapping it opens the profile and sets done; (b) the primer shows only on the first mic tap and never again (`peepl.micPrimerSeen`); (c) with meetWhere = `coffee` the Add placeholder reads "Who did you have coffee with?" and Find shows the coffee card; with no selection both are unchanged; (d) unit tests for the tailoring table; (e) build passes.

### T3: in-app tips, Settings replay, tests
Files: `Components/TipCallout.swift`, `Screens/SettingsView.swift`, `ConnectionsView.swift`, `Screens/MindmapView.swift`, `PeeplUITests/OnboardingUITests.swift` (plus the skip flag in existing UI tests).
Does: the three tips with once-only logic, Settings "How Peepl works" replay, VoiceOver labels and Reduce Motion checks, UI and unit tests.
Acceptance: (a) each tip appears once and never again after dismiss or relaunch; (b) replay opens the flow, makes no person, and closing returns to Settings; (c) UI test: full path Get started to Later with `-PeeplNoSeed YES`; (d) every existing UI test passes with `-PeeplSkipOnboarding YES`; (e) manual: largest Dynamic Type, VoiceOver pass, Reduce Motion on.

## 8. Mockup brief (for open-design, iPhone 15 Pro, 393 x 852)

Mock these 7 screens / states with the Peepl tokens (Geist, pastel glass, night `#1c1522`, no Liquid Glass):
1. Welcome (dark, three blurred orbs, wordmark, tagline, Get started, Restore a backup).
2. Problem (150 dot disc fading outward, heading, sub, Next, Skip).
3. How it works: show card 1 (note to profile card) with page dots; note the other two cards (mindmap, ask result with drafted message) as smaller variants.
4. One question (five chips, one or two selected, Next, Skip).
5. Privacy promise (three rows, fine print, Next).
6. Try it: composer empty with keyboard, plus the state after creation (first profile card, Open their profile); include the mic primer sheet and the denied inline message as two extra frames.
7. A tip callout on the mindmap and the Settings "How Peepl works" row.

## 9. Open items for Vince

- Voice caveat in 3.5 (on-device recognition not always available). Decide whether the privacy page and Settings About text should say so.
- Whether the Welcome orbs should match the pitch deck exactly or the app aura palette.
