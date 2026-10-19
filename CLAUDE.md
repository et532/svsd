# Peepl

A private, personal "people log": remember everyone you meet, where you met them, and their story. This repo is a clickable prototype of the PRD's **people list**, **mindmap**, capture flow and person profile. (A map screen existed and was removed at the user's request.) Everything is private to the user; no social features.

**Keep this file up to date.** Whenever a design decision is made or changed, a feature is added, or a next step is finished, update the relevant section here in the same change, so work can continue on any device.

## Running it

- `npm install` once, then `npm run dev` → http://localhost:5173
- Check before committing: `npx tsc -b && npx eslint src`
- Stack: React 19 + TypeScript + Vite, plain CSS in `src/index.css`. No backend; data is sample data in code.

## Layout

- `src/Prototype.tsx` — the phone screen: top controls, current screen (Mindmap or Connections list), the ask bar at the bottom. Holds the tab, mindmap grouping, layers and toasts. It also makes people / moments from captures (`createPerson`, `addMoment`).
- `src/App.tsx` — wraps it in an iPhone 15 frame on desktop and scales the frame to fit the window. There is no side panel any more: the style playground was removed at the user's request, with its last settings (Frost glass, Cream background, Sphere avatars) baked into the defaults.
- `src/screens/` — `ListScreen`, `MindmapScreen` (the people graph), `CaptureScreen` (add a person / moment), `AskScreen` (find someone), `ProfileScreen`. `src/lib/mindmapColors.ts` still holds what the dot colors can mean, but there is no UI for it now (always Relationship).
- `src/components/` — `TopControls` (view toggle + Filters), `AskBar` (bottom), `Composer` (the shared input: type or scripted voice), `Wave`, `StatusBar`, `Icons`.
- `src/lib/ask.ts` — `interpret()`: turns a find request into results / an action (rule-based stand-in for a model).
- `src/lib/forceGraph.ts` — hand-rolled force simulation for the mindmap (no dependency). `src/data/mockPeople.ts` — seeded generator of fabricated people (mostly social, some work, few family; each knows 1-3 others, max 5, a few know nobody); open `/?mock=200` (up to 500) to stress-test the whole app with that many.
- `src/data/people.ts` — 17 sample people (Ana Ruiz, a hardware engineer, and Jordan Lee were added for the pitch demo; Zara got a climbing note and Aisha invests in hardware) (each has a `knows` list of ids; links are symmetric). `src/lib/people.ts` — search matching and helpers.
- `src/lib/peopleStore.ts` — everyone in the app (sample people + people added with **+**, plus logged moments, to-dos and closeness), via `usePeople()`. Additions and changes are saved in `localStorage` (`peepl.people.v1`), never in mock mode. To reset to the sample people, clear the site's data in the browser (the reset button lived in the removed style panel; `resetPeople()` still exists).
- `src/lib/capture.ts` — the voice script text, typed-note parsing (`parsePerson`, `parseMoment`), `momentCandidates` (does a note read as a moment with someone you know?) and how a capture becomes a `Person` or `Moment`. Capture, Ask and profiles open as full-screen **layers** above the tabs (`layers` in `Prototype.tsx`; back / close pops the top one).

## Design decisions (agreed with the user)

**Visual style** (from the user's reference images: soft, clean, modern, light, pastel)
- Base is black and white: white background, near-black text (`--ink: #111113`), grey secondary text. Light and semibold weights are mixed for headlines (e.g. "Mindmap is **coming soon**").
- **Fonts:** Geist for everything (`--font-body`, and `--font-heading` for headings with `--heading-tracking: -0.04em`), Geist Mono for meta (`--font-mono`), set in `:root` and loaded from Google Fonts in `index.html`. **The serif (Instrument Serif) was dropped at the user's request**; heading sizes were scaled to ~82% when it went. Any new heading should use `var(--font-heading)` and `letter-spacing: var(--heading-tracking)`.
- Color comes only from soft pastel gradients. A drifting "aura" of blurred peach, pink, lavender, mint and butter orbs sits behind every screen (`.aura` in `Prototype.tsx`). Motion stops when the user prefers reduced motion.
- Glassmorphism uses **two looks** (both frosted translucent white: `backdrop-filter` blur, white edge, soft lavender-tinted shadow). The **top controls, ask bar and composer** use the "Frost" look (`--glass*`: blur 34 / saturate 150 / fill 0.78, strong fill 1.0, edge 0.92), picked in the old style panel and now fixed in `:root`. The **other glass items** — list cards, find results and profile sheet — use the `--glass-vivid*` set. The phone background `--bg` is Cream (`#f4efe7`).
- Avatars are gradient "orbs" in the **Sphere** style (soft highlight), from `orbBackground(id)` in `src/lib/people.ts`, stable per person (people have no color field). The other explored styles were dropped with the style panel.
- Black accents: the active nav tab, the **+** button and the Apply button are black, with a subtle gradient. The + button has a plain neutral shadow. The user removed its pastel glow.
- Desktop device frame is light silver, not black.
- Glass surfaces create a containing block for `position: fixed`, so any full-screen overlay opened from inside a glass element must be portalled into `.phone`.

**iOS feel**
- No visible scrollbars anywhere (global rule in `index.css`); it's a mobile app. Scrolling still works.
- Motion uses `--ios-spring` (UIKit-like spring curve). Buttons shrink on press (`scale(.92)`), rows dim and shrink slightly. Screens fade in on tab change and the search dropdown scales in from the top. All off for reduced motion.

**Figma "V1" flow (current design)** — figma.com/design/bV6DQFxu5SHuF6hE5NIDeb, page frames under the "V1" section (node 104:6248): Add person / Add moment, Find someone, Person profile, Mindmap, Connections. The prototype follows those frames; this replaced the older nav-with-Ask-mic version (Ask sheet, floating nav pill, search bar and the + / mic in the nav are all gone; they're in git history).

**Overall**
- **Top controls**: a glass pill top-left toggles Mindmap / Connections list; on the Mindmap a **Filters** pill top-right opens the **Group by** menu (None / City / Met at / Job, with a check on the current one). There is no search bar and no color filter any more (dot colors are always the relationship colors).
- **Bottom ask bar**: a wide glass pill **"Ask me about people"** with a mic (tap the text to type, the mic to speak; both open the Find flow) and a round **add person** button on its right (opens the Add flow).
- Sizes are about 5% smaller than the first version. The user found 15% smaller too small.
- On desktop, the app sits in a light silver iPhone frame with a fake status bar (9:41, signal, Wi-Fi, battery), Dynamic Island, and home bar. On a real phone (under 600px wide) the frame and fake status bar are hidden. Use `var(--safe-top)` / `var(--safe-bottom)` for spacing, not `env()` directly.
- Inputs stay 16px so iPhones don't zoom in on tap.

**Connections list**
- Title "Connections", then one glass row per person: initials avatar, name, right arrow. Sorted A–Z. Tapping a row opens the profile.

**Mindmap** (look C "glass", chosen by the user)
- Obsidian-style graph of everyone; no central "you" node. Links are the explicit `knows` lists on people (`linksOf` in `src/lib/people.ts`). Densely linked groups clump tighter (link strength grows with mutual neighbors).
- **Dots** are small gradient orbs (the person's avatar, no white ring), so the color is how you know them (work / social / community / family). Size grows a little with link count. Initials sit on the dots.
- **Group by** (Filters menu): a group pulls its people together and gets a soft pastel "territory" cloud with its name. Tap the name to isolate that group (everyone else fades); tap empty space to clear. Groups of one person stay ungrouped. `groupBy` lives in `Prototype.tsx` → `MindmapScreen`.
- Tap a node: the view zooms to center it with its direct connections in frame (the user can then pan freely). It lights up, direct connections dim to 55% and everyone else fades to about 8% (only first-degree links are shown). A fully round glass pill shows name, job and a black **View** button that opens their profile. Drag a dot to move it (only zoomed in past about 0.6x; zoomed out, dragging anywhere pans), drag background to pan, wheel / pinch to zoom, with rubber-band limits: zooming out past 85% of the "everyone in frame" zoom (or in past 3x) stretches with resistance, then springs back on release (pinch end, or 140ms after the wheel stops; `settle()` in `MindmapScreen.tsx`). The view auto-fits until the user pans, zooms or taps a person. Reduced motion settles instantly.

**Add (the add-person button)** — `CaptureScreen`, "Tell me about a new person or moment"
- A full-screen pastel aura with a close button, the heading, and the shared **Composer** at the bottom ("Who did you meet?"). It opens focused for typing; the mic "records" (**scripted demo**, no real mic): the Jordan Lee note appears word by word with a blue waveform, stop turns it into editable text, the arrow sends.
- One input for both. **A note about someone new** → "Creating a new profile for Jordan Lee…" → a dark gradient card (avatar, name, job · city, "Met Oct 2026"); tap the card to open the profile. If you already have someone with that exact name (Jordan Lee is built in), their card shows instead of adding a duplicate. **A note about someone you know** (reads like a moment: "caught up with", "grabbed coffee"… and a name in it) → one match saves a moment straight away; two matches ask **"Which Jordan did you catch up with?"** with their cards ("Last updated Oct 2026") and a black **Neither, add a new profile** button (`momentCandidates`, Jordan Smith exists for this). Saving a moment opens that profile with the moment open, bumps closeness one step, adds any follow-up to the to-dos, and shows the **New moment saved** toast.

**Find (the ask bar)** — `AskScreen`, "Search for someone by…"
- Same aura / close / Composer ("Ask me about people"). Idle: three example cards (Interest, Occasion, Location; not tappable). Mic or typing then send: the request becomes the heading, then result cards: avatar, name, job · city, a divider, **why** they match, and a black action (**Draft a message**, **Plan coffee**, **Draft intro**). The demo mic says *I want to find someone to go climbing with me* → Jordan Lee, then Zara Ahmed. Tapping the head opens the profile on top (back returns to the results). **Show all N in your list / on the mindmap** closes Find and narrows that screen; a glass pill above the bar ("climbing · 2", ×) shows it until cleared.
- `interpret()` in `src/lib/ask.ts` is a rule-based stand-in for a model (offline, no API key). It understands: add someone (hands off to the Add flow), log a moment / open a profile (opens the profile), catching up ("who haven't I talked to in a while"), richer answers (`buddy()`, `trip()`, `intro()`), and finding people by interests / work / places / how you know them. Draft panel: editable draft over the results; **Send** closes it with a toast and ticks off the follow-up it answers on the profile.
- To swap in real AI later: replace `interpret()` with a call to Claude (needs an Anthropic API key and a small local server so the key isn't in the browser); speech could use the browser's speech recognition.
- **Jordan Lee is built into the sample people** (`src/data/people.ts`) so the climbing answer works without adding anyone first; a Jordan saved earlier in the browser is ignored as a duplicate (`peopleStore.build()`).

**Person profile**
- Opens from a list row, the mindmap's **View**, a mutual on another profile, an Add card, or a Find result. It opens as an 80% sheet and grows to full screen on the first scroll.
- Night hero tinted by how you know them (context core / deep): avatar, name, job · city, "Met Oct 2026". Back and **⋯** buttons sit on a bar that fills in with their color and shows their name once you scroll past the hero. Then: **Summary** (story + tags), **Things to do with Jordan** (tap a row to tick it off), **Where** (From / Met / Lives now), **Mutuals** (a dashed **Add** circle first, **View connections**), and **Moments** (collapsed; the open one gets a blue border; voice notes have a play / pause button, a waveform and a transcript that fills in as it plays).
- The bottom bar is the Composer, **"Add a moment"**: type, or the mic plays a scripted note about the person; send saves it with the **New moment saved** toast (black pill, lime check).
- **View connections** switches to the mindmap and focuses the person (`navFocus` in `Prototype.tsx`); a black "← Jordan" pill gets back to the profile.
- `closeness` (1-3) on a person drives aura depth when set; otherwise depth still follows how recently you were in touch.
- New screens use only the foundation tokens in `:root` (plus `--grain`, `--shadow-float`, `--on-dark-*`), so a design system update there restyles them.

**Not carried over from the Figma yet:** the smiley faces on avatars, the "introduced you / cofounder" captions under mutuals, the neutral grey ground with a dot grid (the prototype keeps the cream foundation ground), the mindmap zoomed-in node labels, and the Figma's AI-written moment titles (titles here are the first words of the note). The fake iOS keyboard in the frames is not drawn.

**Removed at the user's request (don't bring back unless asked):** the map screen (globe, map looks, glowing pins, From / Met / Now filter chip and its bottom sheet) and the side panels (style playground, fonts, chip layouts). **Replaced by the V1 flow:** the search bar and its dropdown, the mindmap color filter, the bottom nav pill with the Ask mic, the Ask sheet, the "Try to cover" capture screen, and the Saved network screen.

## Earlier versions kept as branches

To go back to an earlier iteration, switch to (or copy code from) these branches:
- `archive/original-filters-and-plus-button` (commit `c5c1d60`): the **+** button at the bottom right, and the mindmap's original filters, i.e. the always-open color key panel at the top left (tap / hold-and-drag the black pill to change what colors mean) and the **group-by** stack on the right (None / City / Met at / Job). This is from before Ask.
- `archive/plus-button-and-collapsible-filters` (commit `245cb5d`): the **+** button next to the Ask mic (four nav layouts), and the four **collapsible top-left filter** layouts (A Collapse arrow, B Filter button, C Dots preview, D Filter + current) at `#/filter-looks`.

## Next steps / open items

- **Figma V1 flow:** built (see above). Remaining Figma differences are listed under "Not carried over from the Figma yet".
- **Real AI / speech:** the voice is scripted and `interpret()` is rule-based. Real speech-to-text and a real model are possible next steps.
- **Person profile stubs** that only show a toast: + tag, + Add something to do, Add (mutual), the ⋯ menu.
- Persistence is per browser (`localStorage`, see `peopleStore.ts`); the sample people still live in `src/data/people.ts`.
