# Peepl

A private, personal "people log": remember everyone you meet, where you met them, and their story. This repo is a clickable prototype of two screens from the PRD: the **people list** and the **map**. Everything is private to the user; no social features.

**Keep this file up to date.** Whenever a design decision is made or changed, a feature is added, or a next step is finished, update the relevant section here in the same change, so work can continue on any device.

## Running it

- `npm install` once, then `npm run dev` → http://localhost:5173
- Check before committing: `npx tsc -b && npx eslint src`
- Stack: React 19 + TypeScript + Vite, MapLibre GL (globe map), plain CSS in `src/index.css`. No backend; data is sample data in code.

## Layout

- `src/Prototype.tsx` — the phone screen: search bar on top, current screen, bottom nav. Holds the tab, search query, and map mode state.
- `src/App.tsx` — wraps it in an iPhone 15 frame on desktop and scales the frame to fit the window.
- `src/screens/` — `ListScreen`, `MapScreen`, `MindmapScreen` (placeholder).
- `src/components/` — `SearchBar` (with suggestions dropdown), `FilterMenu` (map filter chip + bottom sheet), `BottomBar`, `StatusBar`, `Icons`.
- `src/data/people.ts` — 15 sample people. `src/modes.ts` — the three map modes. `src/lib/people.ts` — search matching and helpers.

## Design decisions (agreed with the user)

**Overall**
- Matches the user's wireframes: search bar at top; bottom-left floating pill nav with three icon-only tabs (Mindmap, People list, Map); round **+** button bottom-right.
- Sizes are about 5% smaller than the first version. The user found 15% smaller too small.
- On desktop, the app sits in an iPhone frame with a fake status bar (9:41, signal, Wi-Fi, battery), Dynamic Island, and home bar. On a real phone (under 600px wide) the frame and fake status bar are hidden. Use `var(--safe-top)` / `var(--safe-bottom)` for spacing, not `env()` directly.
- The search input text stays 16px so iPhones don't zoom in on tap.

**People list**
- Each card shows only the initials avatar, the name, and a right arrow. No subtitles or dates. The user asked for names only.
- Sorted A–Z. The arrow doesn't open anything yet (there's no profile screen).

**Search**
- Searches name, job, story, tags, all three cities, and where you met (ignores accents).
- Dropdown before typing: **People** (4 most recently contacted) and **Places** (3 most common). These are real rows, not tag chips.
- Dropdown while typing: People, Places, Interests. People rows show the name only.
- Section headings are regular black subheadings, not all-caps.
- On the map, the search moves the map to fit whoever matches.

**Map**
- Opens as a 3D globe; zooming in turns it into a flat street map. Pins cluster; tap a cluster to zoom in, tap a pin for a name popup.
- Three modes, **always in this order: Where they're from → Where you met → Where they live now.** Default is "Where they're from".
- Pin color matches the mode: from = amber `#D9822B`, met = coral `#E4572E`, lives now = green `#2F8F6B`.
- The filter is a **pill-shaped chip inside the right end of the search bar**, tinted in the mode color, showing an icon and a short word (From / Met / Now). It only appears on the map screen.
- Tapping the chip opens a **bottom sheet** that slides up. It has a left-aligned "Show on map" title, **no X button**, three radio rows, and an **Apply** button. It closes on tapping the backdrop, swiping down, or pressing Esc.
- The map's attribution / info icon was removed at the user's request.

**Rejected alternatives (don't bring back unless asked):** labeled, expanding, or docked nav bars; a filter bar under the search bar; timeline, segmented, swipe-card, center pop-up, or anchored dropdown filters; a wide labeled filter pill; and a side button next to the search bar.

## Next steps / open items

- **+ button:** does nothing yet. The user chose "button only" for now. The PRD calls for voice capture and manual entry.
- **Person profile screen:** list arrows and map pins should open it (photo, story, tags, where you met, timeline).
- **Mindmap:** placeholder "coming soon" screen only.
- **Map credits:** the map uses OpenStreetMap data (via OpenFreeMap tiles), which requires attribution. That's fine for a private prototype, but add a credit (e.g. in a settings/About screen) before any public release.
- No persistence: people live in `src/data/people.ts`.
