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
- `src/screens/` — `ListScreen`, `MindmapScreen` (the people graph), plus the capture / saved / profile layers below.
- `src/components/` — `SearchBar` (with suggestions dropdown), `BottomBar`, `StatusBar`, `Icons`.
- `src/lib/forceGraph.ts` — hand-rolled force simulation for the mindmap (no dependency). `src/data/mockPeople.ts` — seeded generator of fabricated people (mostly social, some work, few family; each knows 1-3 others, max 5, a few know nobody); open `/?mock=200` (up to 500) to stress-test the whole app with that many.
- `src/data/people.ts` — 15 sample people (each has a `knows` list of ids; links are symmetric). `src/lib/people.ts` — search matching and helpers.
- `src/lib/peopleStore.ts` — everyone in the app (sample people + people added with **+**, plus logged moments, to-dos and closeness), via `usePeople()`. Additions and changes are saved in `localStorage` (`peepl.people.v1`), never in mock mode. To reset to the sample people, clear the site's data in the browser (the reset button lived in the removed style panel; `resetPeople()` still exists).
- Capture / profile (Scarlett's part): `src/screens/CaptureScreen.tsx` (add a person or log a moment), `SavedScreen.tsx` (new person joins the network), `ProfileScreen.tsx`. `src/lib/capture.ts` holds the voice scripts, prompts, typed-note parsing and how a capture becomes a `Person` or `Moment`. They open as full-screen **layers** above the tabs (`layers` in `Prototype.tsx`; back / close pops the top one).

## Design decisions (agreed with the user)

**Visual style** (from the user's reference images: soft, clean, modern, light, pastel)
- Base is black and white: white background, near-black text (`--ink: #111113`), grey secondary text. Light and semibold weights are mixed for headlines (e.g. "Mindmap is **coming soon**").
- **Fonts:** Geist for UI text (`--font-body`), Instrument Serif for one display moment per screen (`--font-heading`), Geist Mono for meta (`--font-mono`), all set in `:root` and loaded from Google Fonts in `index.html`. Any new heading should use `var(--font-heading)`.
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
- Matches the user's wireframes: search bar at top; bottom-left floating pill nav with two icon-only tabs (Mindmap, People list); round **+** button bottom-right.
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
- **Dots** are small gradient orbs (the person's avatar, no white ring), so the color is how you know them (work / social / community / family). The color key is a glass panel under the search bar (top left) that is always visible: a black pill naming the current mode, with the list of values below. **Tap** the pill (or **hold and drag** it, releasing on one) to swap the list for Relationship / City / Job / Last seen; picking one switches back to the key. The six most common values get a color, the rest grey. Size grows a little with link count. The glass look is on the legend, group chips, labels and territory names.
- **Group-by** is a vertical glass stack at the top right, level with the color pill (None / City / Met at / Job). The group stack, color pill and dropdowns use the same `--glass*` look as the search bar and nav pill. A group pulls its people together and gets a soft pastel "territory" cloud with its name. Tap the name to isolate that group (everyone else fades); tap empty space to clear. Groups of one person stay ungrouped. The top search bar also narrows the graph, **except when it matches exactly one person**: then the whole graph stays and that person is selected like a tap (zoom, name pill, first-degree links lit; `focusId` in `Prototype.tsx` → `MindmapScreen`).
- Tap a node: the view zooms to center it with its direct connections in frame (the user can then pan freely). It lights up, direct connections dim to 55% and everyone else fades to about 8% (only first-degree links are shown). A fully round glass pill shows name, job and a black **View** button that opens their profile. Drag a dot to move it (only zoomed in past about 0.6x; zoomed out, dragging anywhere pans), drag background to pan, wheel / pinch to zoom, with rubber-band limits: zooming out past 85% of the "everyone in frame" zoom (or in past 3x) stretches with resistance, then springs back on release (pinch end, or 140ms after the wheel stops; `settle()` in `MindmapScreen.tsx`). The view auto-fits until the user pans, zooms or taps a person. Reduced motion settles instantly.

**Capture (+ button and Log a moment)** — Scarlett's flow, ported from her coded prototype
- One screen for both: "Tell me about them" (new person) or "What happened with Jordan?" (moment). An orb in a dashed ring, a serif title, and a **Try to cover** checklist that fills in as you talk. Person prompts: name, where you met, what they do, anyone you both know, one thing to remember, follow-up. Moment prompts: what happened, something new, follow-up.
- **Voice is a scripted demo** (the user's call: no real mic). Tap to talk plays the Jordan Lee script word by word with a live transcript, timer and waveform; each line ticks a prompt. Pause / Done (✓) sit in the recording pill; Done enables once there's a name (or "what happened").
- **Keyboard button** switches to a typed note (and the mic button back), morphing with a view transition. Typing fills the same checklist by simple parsing; mutuals are spotted by matching names of people you already have.
- Saving a person shows **Saved**: they land in the middle of their bit of the network (solid lines to people they know, dashed to suggestions: same "met at" or same city). Actions: **View profile** (primary), **Add another**, X to close.
- Saving a moment returns to the profile with the new moment open, bumps closeness one step (Just met → Getting to know → Know well), and adds the follow-up to "Things to talk about".

**Person profile**
- Opens from a list row, the mindmap's **View**, a mutual on another profile, or after saving.
- Night hero tinted by how you know them (context core / deep), avatar, name, job · city, closeness and context chips. Then: field notes + tags, things to talk about (checkable), location trio (From / Met / Lives now), mutuals with **View connections**, and moments (collapsed by default; tap to expand; voice notes have a play button and transcript). Sticky bar: **Log a moment** + mic (starts recording right away).
- **View connections** switches to the mindmap and focuses the person (`navFocus` in `Prototype.tsx`); a black "← Jordan" pill gets back to the profile.
- `closeness` (1-3) on a person drives aura depth when set; otherwise depth still follows how recently you were in touch.
- New screens use only the foundation tokens in `:root` (plus `--grain`, `--shadow-float`, `--on-dark-*`), so a design system update there restyles them.

**Removed at the user's request (don't bring back unless asked):** the map screen (globe, map looks, glowing pins, From / Met / Now filter chip and its bottom sheet) and the side panels (style playground, fonts, chip layouts). **Rejected nav options:** labeled, expanding, or docked nav bars.

## Next steps / open items

- **AI search (requested, not started):** the user wants an AI search that sits "before the list page". They describe it as a general free-text filter, e.g. "everyone interested in baseball", that returns matching people. Still to decide with the user: where it lives (a new nav tab before People, a screen that opens first, or an AI mode in the search bar) and whether it uses real Claude (needs an Anthropic API key and a small local server) or a simulated matcher. Sample people will need richer interests (e.g. baseball).

- **+ button:** built (capture flow above). Voice is scripted; real speech-to-text and AI field extraction are not planned yet.
- **Person profile screen:** built (above). Stubs that only show a toast: + tag, + Add something to do, Link.
- **Mindmap:** built (see above). Capture fills `knows` from mutuals mentioned (scripted: Aisha Khan; typed: any existing name), and **View** opens the profile.
- **Mindmap looks A, B, D** were generated with OpenDesign and rejected; no need to keep them.
- Persistence is per browser (`localStorage`, see `peopleStore.ts`); the sample people still live in `src/data/people.ts`.
