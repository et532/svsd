# The persona behind the 200 sample people

The app is seeded for one person ("you"): a 29-year-old product designer living in **Bushwick, Brooklyn**. Every
person, meeting date and "met at" place has to fit this life (`npm run validate` checks it):

| Years | Where | Life stage (`lifeStage`) |
|---|---|---|
| 1997 | Born in **Naperville, IL**. Parents (Taipei-born), younger brother Andre (b. 2005), grandparents, cousins in Seattle and Queens | `family`, `hometown` (before 2011) |
| 2011-2015 | Naperville Central: cross country, robotics club, a bookstore job | `high-school` |
| 2015-2019 | **University of Michigan**: design major, student newspaper, club ultimate, dorm and house-shares, a semester in Copenhagen (fall 2018) | `college` |
| 2019-2021 | **Chicago**, first job at Brightwork Studio (design agency) | `first-job` |
| Aug 2021 - | **New York**: LES sublet, then Bushwick (from Jan 2022). Fathom (Flatiron startup) Sept 2021 - Mar 2024, then Ardent (larger company) | `nyc-work`, `nyc-social` |
| 2021 - | Networking: Config, Demo Day, Climate Week, supper clubs, a pickleball league, run club, a book club, mentors, recruiters, two exes, a possible co-founder | `networking` |

Targets (checked): 200 people, 95-115 in the New York area, each person 2-7 moments dated after the day you met,
every place and neighborhood in `src/data/gazetteer.ts`, links all valid.

Demo guards (also checked): only Jordan Lee and Zara Ahmed mention climbing; only Ana Ruiz, Aisha Khan (and Jordan's
to-do) mention hardware; 6+ fashion people in New York (a stylist in Bushwick, a vintage shop in Williamsburg, a
tailor in Jackson Heights, a college friend who designs, a magazine editor...) and **nobody who does portraits in
New York**, so the "no one matches" screen can be shown.

Files: `src/data/nyc/*Rows.ts` (150 new people), `src/data/nyc/index.ts` (the 50 original people re-slotted).
Load into Supabase with `npm run seed` (see `scripts/seed.ts`).
