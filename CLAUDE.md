# Peepl

A private, personal "people log": remember everyone you meet, where you met them, and their story. This repo is a clickable prototype of the PRD's **people list**, **mindmap**, capture flow and person profile. (A map screen existed and was removed at the user's request.) Everything is private to the user; no social features.

**Keep this file up to date.** Whenever a design decision is made or changed, a feature is added, or a next step is finished, update the relevant section here in the same change, so work can continue on any device.

## Running it

- `npm install` once, then `npm run dev` → http://localhost:5173
- Check before committing: `npx tsc -b && npx eslint src`
- Stack: React 19 + TypeScript + Vite, plain CSS in `src/index.css`. No backend; data is sample data in code.

## Layout

- `src/Prototype.tsx` — the phone screen: search bar on top, current screen (Mindmap or People), bottom nav. Holds the tab, search query and layers.
- `src/App.tsx` — wraps it in an iPhone 15 frame on desktop and scales the frame to fit the window. There is no side panel any more: the style playground was removed at the user's request, with its last settings (Frost glass, Cream background, Sphere avatars) baked into the defaults.
- `src/screens/` — `ListScreen`, `MindmapScreen` (the people graph), plus the capture / saved / profile layers below. The mindmap's color filter is `src/components/SearchFilter.tsx`; `src/lib/mindmapColors.ts` holds what the colors can mean and the key.
- `src/components/` — `SearchBar` (with suggestions dropdown), `BottomBar` (Mindmap tab, Ask mic, People tab), `StatusBar`, `Icons`.
- **Ask** (voice AI search): `src/screens/AskScreen.tsx` (the sheet), `src/lib/ask.ts` (`interpret()`: turns a request into an action, plus the demo requests).
- `src/lib/forceGraph.ts` — hand-rolled force simulation for the mindmap (no dependency). `src/data/mockPeople.ts` — seeded generator of fabricated people (mostly social, some work, few family; each knows 1-3 others, max 5, a few know nobody); open `/?mock=200` (up to 500) to stress-test the whole app with that many.
- `src/data/people.ts` — 17 sample people (Ana Ruiz, a hardware engineer, and Jordan Lee were added for the pitch demo; Zara got a climbing note and Aisha invests in hardware) (each has a `knows` list of ids; links are symmetric). `src/lib/people.ts` — search matching and helpers.
- `src/lib/peopleStore.ts` — everyone in the app (sample people + people added with **+**, plus logged moments, to-dos and closeness), via `usePeople()`. Additions and changes are saved in `localStorage` (`peepl.people.v1`), never in mock mode. To reset to the sample people, clear the site's data in the browser (the reset button lived in the removed style panel; `resetPeople()` still exists).
- Capture / profile (Scarlett's part): `src/screens/CaptureScreen.tsx` (add a person or log a moment), `SavedScreen.tsx` (new person joins the network), `ProfileScreen.tsx`. `src/lib/capture.ts` holds the voice scripts, prompts, typed-note parsing and how a capture becomes a `Person` or `Moment`. They open as full-screen **layers** above the tabs (`layers` in `Prototype.tsx`; back / close pops the top one).

## Design decisions (agreed with the user)

**Visual style** (from the user's reference images: soft, clean, modern, light, pastel)
- Base is black and white: white background, near-black text (`--ink: #111113`), grey secondary text. Light and semibold weights are mixed for headlines (e.g. "Mindmap is **coming soon**").
- **Fonts:** Geist for everything (`--font-body`, and `--font-heading` for headings with `--heading-tracking: -0.04em`), Geist Mono for meta (`--font-mono`), set in `:root` and loaded from Google Fonts in `index.html`. **The serif (Instrument Serif) was dropped at the user's request**; heading sizes were scaled to ~82% when it went. Any new heading should use `var(--font-heading)` and `letter-spacing: var(--heading-tracking)`.
- Color comes only from soft pastel gradients. A drifting "aura" of blurred peach, pink, lavender, mint and butter orbs sits behind every screen (`.aura` in `Prototype.tsx`). Motion stops when the user prefers reduced motion.
- Glassmorphism uses **two looks** (both frosted translucent white: `backdrop-filter` blur, white edge, soft lavender-tinted shadow). The **search bar, nav pill and mindmap controls** use the "Frost" look (`--glass*`: blur 34 / saturate 150 / fill 0.78, strong fill 1.0, edge 0.92), picked in the old style panel and now fixed in `:root`. The **other glass items** — list cards, search dropdown and profile sheet — use the `--glass-vivid*` set. The phone background `--bg` is Cream (`#f4efe7`).
- Avatars are gradient "orbs" in the **Sphere** style (soft highlight), from `orbBackground(id)` in `src/lib/people.ts`, stable per person (people have no color field). The other explored styles were dropped with the style panel.
- Black accents: the active nav tab, the **+** button and the Apply button are black, with a subtle gradient. The + button has a plain neutral shadow. The user removed its pastel glow.
- Desktop device frame is light silver, not black.
- Glass surfaces create a containing block for `position: fixed`, so any full-screen overlay opened from inside a glass element must be portalled into `.phone`.

**iOS feel**
- No visible scrollbars anywhere (global rule in `index.css`); it's a mobile app. Scrolling still works.
- Motion uses `--ios-spring` (UIKit-like spring curve). Buttons shrink on press (`scale(.92)`), rows dim and shrink slightly. Screens fade in on tab change and the search dropdown scales in from the top. All off for reduced motion.

**Overall**
- Search bar at top. **Bottom nav: Mindmap and People tabs placed symmetrically either side of the Ask mic** (see Ask below). **The + button was removed** at the user's request; people are added through Ask ("add someone new" opens capture). Capture still opens directly from a profile's Log a moment.
- Sizes are about 5% smaller than the first version. The user found 15% smaller too small.
- On desktop, the app sits in a light silver iPhone frame with a fake status bar (9:41, signal, Wi-Fi, battery), Dynamic Island, and home bar. On a real phone (under 600px wide) the frame and fake status bar are hidden. Use `var(--safe-top)` / `var(--safe-bottom)` for spacing, not `env()` directly.
- The search input text stays 16px so iPhones don't zoom in on tap.

**People list**
- Each card shows only the initials avatar, the name, and a right arrow. No subtitles or dates. The user asked for names only.
- Sorted A–Z. Tapping a row opens the profile.

**Search**
- Searches name, job, story, tags, all three cities, and where you met (ignores accents).
- Dropdown before typing: **Recent searches** (last 3 chosen, in `localStorage`, with Clear), **People** (3 most recently contacted), **Catch up** (2 you've lost touch with longest, with "Last talked …"), and **Places** (3 most common). These are real rows, not tag chips.
- Dropdown while typing: People (ranked: name starts with > word starts with > contains > other), Places, Interests. A person row gets a one-line "why" (e.g. "Interested in baseball") when they matched on something other than their name. Matching tolerates one typo in a name word and also searches relationship type (work / family…). Rows fade in staggered (off for reduced motion).
- Section headings are regular black subheadings, not all-caps.

**Mindmap** (look C "glass", chosen by the user)
- Obsidian-style graph of everyone; no central "you" node. Links are the explicit `knows` lists on people (`linksOf` in `src/lib/people.ts`). Densely linked groups clump tighter (link strength grows with mutual neighbors).
- **Dots** are small gradient orbs (the person's avatar, no white ring), so the color is how you know them (work / social / community / family). **The color filter lives in the search bar** (mindmap tab only; the search placeholder shortens to "Search people"). The old top-left panel is gone. Its panel content follows the earlier B / D layouts the user liked: **Color by** (Relationship / City / Job / Last seen) and a **Key** of what each color means; choices apply immediately, and `colorBy` lives in `Prototype.tsx`. **The filter button (chosen by the user):** a plain filter icon at the end of the search bar while the colors show the default (Relationship); once something else is picked it becomes a chip naming that filter (e.g. "City ▾"), and picking Relationship again turns it back into the icon. Either one opens a **sheet that slides up** (direction D) titled "Filters", with Sort by as chips, the Key, and Done. (The other layouts compared, i.e. icon + pop-up with rows, icon + slide-up with rows, and chip + pop-up, were dropped.) The six most common values get a color, the rest grey. Size grows a little with link count. The glass look is on the filter, labels and territory names.
- **Group-by control removed for now** (user's request): the vertical None / City / Met at / Job stack on the right is gone, so the graph is never grouped. The grouping logic and territory clouds are still in `MindmapScreen.tsx` (`groupBy` is fixed to `'none'`); restore the control from git history (before this change) if it comes back. The top search bar narrows the graph, **except when it matches exactly one person**: then the whole graph stays and that person is selected like a tap (zoom, name pill, first-degree links lit; `focusId` in `Prototype.tsx` → `MindmapScreen`).
- Tap a node: the view zooms to center it with its direct connections in frame (the user can then pan freely). It lights up, direct connections dim to 55% and everyone else fades to about 8% (only first-degree links are shown). A fully round glass pill shows name, job and a black **View** button that opens their profile. Drag a dot to move it (only zoomed in past about 0.6x; zoomed out, dragging anywhere pans), drag background to pan, wheel / pinch to zoom, with rubber-band limits: zooming out past 85% of the "everyone in frame" zoom (or in past 3x) stretches with resistance, then springs back on release (pinch end, or 140ms after the wheel stops; `settle()` in `MindmapScreen.tsx`). The view auto-fits until the user pans, zooms or taps a person. Reduced motion settles instantly.

**Capture (+ button and Log a moment)** — Scarlett's flow, ported from her coded prototype
- One screen for both: "Tell me about them" (new person) or "What happened with Jordan?" (moment). An orb in a dashed ring, a heading, and a **Try to cover** checklist that fills in as you talk. Person prompts: name, where you met, what they do, anyone you both know, one thing to remember, follow-up. Moment prompts: what happened, something new, follow-up.
- **Voice is a scripted demo** (the user's call: no real mic). Tap to talk plays the Jordan Lee script word by word with a live transcript, timer and waveform; each line ticks a prompt. Pause / Done (✓) sit in the recording pill; Done enables once there's a name (or "what happened").
- **Keyboard button** switches to a typed note (and the mic button back), morphing with a view transition. Typing fills the same checklist by simple parsing; mutuals are spotted by matching names of people you already have.
- Saving a person shows **Saved**: they land in the middle of their bit of the network (solid lines to people they know, dashed to suggestions: same "met at" or same city). Actions: **View profile** (primary), **Add another**, X to close.
- Saving a moment returns to the profile with the new moment open, bumps closeness one step (Just met → Getting to know → Know well), and adds the follow-up to "Things to talk about".

**Ask (voice AI search)** — the mic in the middle of the nav, on both Mindmap and People. **It matches the Figma file "Peepl" → page "Ask flow"** (figma.com/design/bV6DQFxu5SHuF6hE5NIDeb, node 94:2), which was made from this code: 01 idle, 02 listening, 03/05/07 results, 04/06/08 drafts, 09 sent toast, 10 Jordan's profile with follow-ups done. The user chose this over a full-screen chat version (built and then dropped); keep it looking exactly like the Figma.
- **Opening sheet: the minimal "Welcome, Emily" version** (the user's pick, replacing Figma frame 01's five action cards): just the close button, the pastel AI orb (`--ai-orb`), **"Welcome, Emily"** in Instrument Serif (`.ask-title.is-welcome`, the one serif moment; the font is loaded in `index.html` for it), and one line: "Add a new person, or ask me to find specific people by their interests, work, or how you know them." **No status label anywhere in Ask** (user's call, a change from the Figma): the "Ask Peepl" / "Listening…" / "Looking through your people…" subtitle at the top left of the sheet was removed from every step; the sheet head holds only the close button (right-aligned). The draft panel keeps its own "Message" / "Plan coffee" / "Draft intro" title.
- **Voice is a scripted demo**, like capture (no real mic): **Tap to talk** "says" the next example request (from `demoRequests`) word by word with a live waveform; tap again to stop early. The **keyboard** button switches to typing any request.
- `interpret()` in `src/lib/ask.ts` is a rule-based stand-in for a real model (works offline, no API key). It understands: **add someone** ("add someone new" → opens capture, already recording), **log a moment** ("log a moment with Maya" → capture for Maya), **open a profile** ("open Aisha's profile"), **catching up** ("who haven't I talked to in a while" → longest-ago first; "recently" → newest first), and **finding people** by any mix of interests / work (tags, job, story, with related words, e.g. sports → baseball, running, hiking), places ("in London", "from Lagos", "met at Climate Week"), and how you know them (family / work / friends / community). All conditions must hold.
- Results: a title ("3 people · baseball"), up to 6 rows (avatar, name, why they matched) that open the profile on top of Ask (back returns to the results), and **Show all N in your list / on the mindmap**, which closes Ask and narrows that screen to them. A glass pill above the nav ("baseball · 3", ×) shows the narrowing until cleared.
- **Demo: only the climbing-buddy flow for now** (user's call): the mic always "says" *I want a climbing buddy. Who in the city can I reach out to?* (`storyRequest()` returns `storyAsks[0]`), matching Figma flow Ask 1 (01 idle → 02 listening → 03 results: Jordan, then Zara → 04 draft "Message Jordan"). **Jordan Lee is built into the sample people** (`src/data/people.ts`, as capture would have saved him: founder, Brooklyn, climbing, follow-ups for Priya / hardware / climbing buddy, two moments) so no one has to be added first; a Jordan saved earlier in the browser is ignored as a duplicate (`peopleStore.build()`). Typed requests still go through `interpret()`, including the SF and hardware questions. The full story (add Jordan → log a moment → cycle the three questions) is in git history.
- **Richer answers** for those three (`buddy()`, `trip()`, `intro()` in `ask.ts`): each result card shows why they match, a **Say:** opener from your notes, an optional tag (Jordan's follow-up / Overdue to catch up / Can connect you), and a drafted next step (**Message**, **Plan coffee**, **Draft intro**). The intro answer is grouped: **You know directly** and **One step away**. Results come from the data, not hard-coded: open to-dos, stories, tags, cities ("SF" = San Francisco + Oakland + Berkeley; "the city" = New York boroughs), last talked.
- **Draft panel**: tapping the action opens an editable draft over the results ("Peepl drafts it; you decide whether to send"). **Send** closes it with a toast; when the draft answers a follow-up (the Priya intro, the hardware intro), sending **ticks that to-do off on the person's profile**, which closes the loop of the demo.
- To swap in real AI later: replace `interpret()` with a call to Claude (needs an Anthropic API key and a small local server so the key isn't in the browser); speech could use the browser's speech recognition.
- **Nav: the floating pill** (chosen by the user over a docked full-width bar; after Luma / Trainline references): a wide rounded glass pill floating above the bottom, icon + label tabs (Mindmap, People) filling each side, the current tab a light grey fully round selection inset evenly ~6px from the pill's edge, and the Ask mic (the pastel AI orb, 72px, white ring) centered and raised so it overlaps the pill's top edge. **Everything mirrors exactly around the mic** (equal tab widths either side).

**Person profile**
- Opens from a list row, the mindmap's **View**, a mutual on another profile, or after saving.
- Night hero tinted by how you know them (context core / deep), avatar, name, job · city, closeness and context chips. Then: field notes + tags, things to talk about (checkable), location trio (From / Met / Lives now), mutuals with **View connections**, and moments (collapsed by default; tap to expand; voice notes have a play button and transcript). Sticky bar: **Log a moment** + mic (starts recording right away).
- **View connections** switches to the mindmap and focuses the person (`navFocus` in `Prototype.tsx`); a black "← Jordan" pill gets back to the profile.
- `closeness` (1-3) on a person drives aura depth when set; otherwise depth still follows how recently you were in touch.
- New screens use only the foundation tokens in `:root` (plus `--grain`, `--shadow-float`, `--on-dark-*`), so a design system update there restyles them.

**Removed at the user's request (don't bring back unless asked):** the map screen (globe, map looks, glowing pins, From / Met / Now filter chip and its bottom sheet) and the side panels (style playground, fonts, chip layouts). **Rejected nav options:** labeled, expanding, or docked nav bars.

## Earlier versions kept as branches

To go back to an earlier iteration, switch to (or copy code from) these branches:
- `archive/original-filters-and-plus-button` (commit `c5c1d60`): the **+** button at the bottom right, and the mindmap's original filters, i.e. the always-open color key panel at the top left (tap / hold-and-drag the black pill to change what colors mean) and the **group-by** stack on the right (None / City / Met at / Job). This is from before Ask.
- `archive/plus-button-and-collapsible-filters` (commit `245cb5d`): the **+** button next to the Ask mic (four nav layouts), and the four **collapsible top-left filter** layouts (A Collapse arrow, B Filter button, C Dots preview, D Filter + current) at `#/filter-looks`.

## Next steps / open items

- **Ask (voice AI search):** built (see above) with a scripted voice demo and a rule-based interpreter. Real speech and a real model are possible next steps.

- **+ button:** built (capture flow above). Voice is scripted; real speech-to-text and AI field extraction are not planned yet.
- **Person profile screen:** built (above). Stubs that only show a toast: + tag, + Add something to do, Link.
- **Mindmap:** built (see above). Capture fills `knows` from mutuals mentioned (scripted: Aisha Khan; typed: any existing name), and **View** opens the profile.
- **Mindmap looks A, B, D** were generated with OpenDesign and rejected; no need to keep them.
- Persistence is per browser (`localStorage`, see `peopleStore.ts`); the sample people still live in `src/data/people.ts`.
