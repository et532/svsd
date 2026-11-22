# m5a validation (task/m5a-r3, 472d08d vs 6146e9f): PASS

1. Files: only Shell.swift, AskBar.swift, MindmapView.swift, ConnectionsView.swift. PASS.
2. Band: PASS by code reading (not seen on device). MindmapView.map has .ignoresSafeArea() on the GeometryReader holding the Canvas (MindmapView.swift:85), so orbs are full-bleed. Shell.swift: ground (flat #ededed on mindmap, AuraBackground on Connections) sits outside the receding container with .ignoresSafeArea(). Scale/offset are 1/0 when nav.tab == .mindmap. Dimming is a black overlay, not container opacity. Connections content still scales, but its ground is separate and unscaled. Not a mere recolour. The flat #ededed ground only shows if the Canvas does not paint something there.
3. Reveal origins: PASS. revealOrigin is the open origin set by AskBar (0.4,0.95 text/mic; 0.92,0.95 add). closeOrigin is the X centre from syncOrigin. Transition is asymmetric. Caveat: closeOrigin defaults to (0.1,0.1) until measured, and the AskBar values are approximate.
4. X fade: PASS. easeOut 0.1s on close, rotate-in kept.
5. Gradient: PASS. Identical to ProfileView lines 78-79, allowsHitTesting(false).
6. Reduce Motion: PASS. Transition falls back to opacity, no scale/offset. The 0.1s X fade ignores reduce, harmless.
7. Build: xcodegen + xcodebuild generic/platform=iOS Simulator: BUILD SUCCEEDED.

Residual band risks at rest: TopControls and the AskBar have no opaque backgrounds, so no. The AskBar gradient is a deliberate dark tint at the bottom, not light. The tab crossfade (Group transition) briefly blends #ededed and the aura, with no gap. If the draw() Canvas does not paint orbs up to the edges at rest (for example ungrouped), the flat #ededed shows, which is the intended ground. Needs device check: mid swipe-back and the tab switch.
