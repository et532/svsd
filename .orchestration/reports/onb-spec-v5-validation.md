# Validation: onb-spec-v5

Verdict: PASS (with one minor note)

- Files changed: ONBOARDING.md and the brief only. Allowed.
- Em dashes added: 0.
- 1. Steps 5/6 (3.0 3D note, 3.5, 3.6, T2, mockup brief items 5/6): no phone frame or bezel, panels made 3D, text >= 15 pt. Pass.
- 2. Progress bar: three segments 4:2:2, gaps, Back to Skip, per-step fill, motion-spec row, act title kept, no "Part x of 3". VoiceOver "Step N of 8, act name" present. No leftover "step / 8" value. Pass.
- 3. Pip step 5 line is "Misheard a name? Tap it later to fix it." Pass.
- 4. Contacts import in section 10 as out of scope; removed from open items. Pass.
- 5. Date rules, table (counted 30 rows, matches), display rule, T3 acceptance (incl. month boundary 2026-12-01) updated; old open item removed. Pass.
- 6. lifeStage open item present, unchanged. Pass.
- Minor: motion-spec row "3D tilted screen: entrance" (ONBOARDING.md line 182) still says "Phone or screen comes from...". Wording only, since steps 5/6 do not use a screen plane. Not blocking.
- Tests/lint: not applicable (docs only).
