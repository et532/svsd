# Task onb-spec-v5: ONBOARDING.md v5 spec edits
Owner: lead (spec text)   Branch: task/onb-spec-v5
Files: ONBOARDING.md only (DECISIONS.md entries added by lead after merge).
Acceptance (read the diff against these; no em dashes added):
1. Steps 5 and 6: no phone frame / device bezel; real UI pieces shown directly, made 3D themselves (layered panels, perspective, idle float, parallax), note text >= 15 pt. Storyboards, 3D notes, T2 (rotation3DEffect with perspective on reused real views, layered shadows, no device bezel view) updated; mockup brief consistent.
2. Progress bar: three segments (The story 4 steps, Learn by doing 2, Make it yours 2), small gaps, spanning Back to Skip, each fills incrementally per step within its act with the motion spec progress fill; act title stays; no "Part x of 3". Header spec, VoiceOver label "Step N of 8, act name", T1 acceptance updated; no leftover "step / 8" single-bar value.
3. Pip step 5 line is "Misheard a name? Tap it later to fix it."
4. Contacts import removed from open items, recorded as out of scope for now (own flow).
5. Past-date parsing: yesterday and last night = previous calendar day (local; last night after midnight before 5 am also previous day); this morning / today / tonight = today; day before yesterday = 2 days back; last week = 7 days back, display month; last month = month precision. Table, display rule, T3 unit tests updated; the old "yesterday stores today" open item removed; table row count correct.
6. The "Met in college" / lifeStage open item unchanged.
