import type { LifeStage } from '../people'
import type { Seed } from '../seed'
import { seedA } from '../seedA'
import { seedB } from '../seedB'
import { collegeRows } from './collegeRows'
import { homeRows } from './homeRows'
import { firstJobRows, nycWorkRows } from './workRows'
import { socialRowsA } from './socialRowsA'
import { socialRowsB } from './socialRowsB'

// The 200 people of the New York persona: 50 from the original cast (re-slotted into the persona's life story here)
// and 150 written for it. See supabase/seed/README.md for the timeline everything must fit.

type Patch = Partial<Seed> & { stage: LifeStage }
const n: LifeStage = 'networking'
const s: LifeStage = 'nyc-social'
const c: LifeStage = 'college'
const f: LifeStage = 'family'

// Where each original person fits: how you know them, and the neighborhood for those who live in New York. A few
// meetings are moved so they agree with the persona (Michigan 2015-19, a semester in Copenhagen, born 1997 in
// Naperville).
const patches: Record<string, Patch> = {
  'maya-chen': { stage: n, hood: 'Bed-Stuy' },
  'daniel-okafor': { stage: n },
  'sofia-ramirez': { stage: n },
  'liam-oconnor': {
    stage: c,
    met: ['Copenhagen', 'Study abroad'],
    since: '2018-09-04',
    first: 'Met Liam O’Connor on the first day of our semester in Copenhagen, he lived across the hall. Software engineer, from Dublin, plays bass. We stayed up until four talking about nothing.',
  },
  'aisha-khan': { stage: n, hood: 'Gramercy' },
  'kenji-watanabe': { stage: n },
  'priya-nair': { stage: n },
  'tom-becker': { stage: n },
  'grace-kim': { stage: c, met: ['Ann Arbor', 'College'], since: '2015-08-28' },
  'lucas-silva': { stage: n },
  'hannah-cohen': { stage: n, hood: 'Tribeca' },
  'omar-haddad': { stage: n },
  'emma-wright': {
    stage: 'hometown',
    met: ['Naperville, IL', 'Elementary school'],
    since: '2007-09-04',
    story: 'Teaches middle school science in Melbourne. Childhood best friend, her family spent two years in Naperville before moving home to Sydney. Runs a book club that has read the same thriller four times by accident.',
    first: 'Emma Wright, my best friend since fifth grade in Naperville, when her family moved there for two years. She sat next to me and shared her pencils on the first day. Now she is a science teacher in Melbourne.',
  },
  'noah-patel': { stage: n },
  'ana-ruiz': { stage: n, hood: 'Chelsea' },
  'jordan-smith': { stage: s, hood: 'Hell’s Kitchen' },
  'zara-ahmed': { stage: s, hood: 'Bushwick' },
  'marcus-bell': { stage: s, hood: 'Prospect Heights' },
  'dana-reyes': { stage: s, hood: 'Astoria' },
  'theo-park': { stage: s, hood: 'Red Hook' },
  'nina-volkov': { stage: c, met: ['Ann Arbor', 'College'], since: '2015-09-14' },
  'rachel-lin': { stage: f, since: '1997-06-01' },
  'mei-lin': { stage: f, hood: 'Flushing', since: '1997-03-14' },
  'andre-lin': {
    stage: f,
    first: 'Andre is my brother, born when I was eight. I held him the day he came home and was terrified of dropping him.',
  },
  'ben-adler': { stage: n },
  'camila-torres': { stage: n, hood: 'West Village' },
  'yusuf-demir': { stage: s, hood: 'Greenpoint' },
  'ines-moreau': { stage: n },
  'felix-wagner': { stage: n },
  'amara-osei': { stage: s, hood: 'Crown Heights' },
  'victor-huang': { stage: s, hood: 'Upper West Side' },
  'lila-sharma': {
    stage: s,
    met: ['Brooklyn, NY', 'Apartment building'],
    first: 'Met Lila Sharma in my first sublet on the Lower East Side, she lived next door and fed my cat when I was locked out of town. ER nurse, from Mumbai. Instant friend.',
  },
  'rohan-mehta': { stage: n },
  'sasha-ivanova': { stage: n },
  'caleb-foster': { stage: n },
  'mia-tanaka': { stage: n },
  'owen-murphy': { stage: n },
  'elena-rossi': { stage: n, hood: 'Harlem' },
  'jamal-washington': { stage: n },
  'anika-rao': { stage: n },
  'sophie-laurent': { stage: n },
  'kwame-boateng': { stage: n },
  'olivia-grant': { stage: s, hood: 'West Village' },
  'arjun-kapoor': { stage: n },
  'tessa-nguyen': { stage: n },
  'gabe-silverman': { stage: s, hood: 'Park Slope' },
  'nora-lindqvist': { stage: n },
  'santiago-ortiz': { stage: n },
  'hana-yoshida': { stage: n },
}

const original = [...seedA, ...seedB].map((x) => {
  const { stage, ...patch } = patches[x.id] ?? { stage: n }
  return { ...x, ...patch, stage }
})

export const nycSeeds: Seed[] = [...original, ...homeRows, ...collegeRows, ...firstJobRows, ...nycWorkRows, ...socialRowsA, ...socialRowsB]
