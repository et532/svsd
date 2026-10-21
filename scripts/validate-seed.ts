// Checks the 200-person dataset against the persona's timeline and the distribution targets. Run: npm run validate
import { nycSeeds } from '../src/data/nyc'
import { samplePeople } from '../src/data/people'
import { homePlace, lookupPlace, placeOfPerson, sameMetro } from '../src/lib/places'

const TODAY = '2026-10-20'
const BORN = '1997-03-14'
const errors: string[] = []
const fail = (who: string, msg: string) => errors.push(`${who}: ${msg}`)

// When each kind of acquaintance can have started (the persona's life: Naperville -> Michigan -> Chicago -> NYC)
const windows: Record<string, [string, string]> = {
  family: [BORN, TODAY],
  hometown: [BORN, '2011-08-14'],
  'high-school': ['2011-08-15', '2015-07-31'],
  college: ['2015-08-01', '2019-06-30'],
  'first-job': ['2019-05-01', '2021-08-14'],
  'nyc-work': ['2021-08-15', TODAY],
  'nyc-social': ['2021-08-15', TODAY],
  networking: ['2021-08-15', TODAY],
}
// [min, max] per stage for the 200
const targets: Record<string, [number, number]> = {
  family: [8, 12], hometown: [8, 14], 'high-school': [6, 12], college: [28, 38], 'first-job': [14, 22], 'nyc-work': [20, 30], 'nyc-social': [50, 70], networking: [28, 40],
}
const BANNED = /lorem|ipsum|\bTODO\b|\bTBD\b|placeholder|as an ai|n\/a/i

const ids = new Set<string>()
const names = new Set<string>()
for (const p of samplePeople) {
  if (ids.has(p.id)) fail(p.id, 'duplicate id')
  if (names.has(p.name)) fail(p.id, `duplicate name ${p.name}`)
  ids.add(p.id)
  names.add(p.name)
}

for (const s of nycSeeds)
  for (const k of s.knows ?? []) if (!ids.has(k)) fail(s.id, `knows unknown id ${k}`)

for (const p of samplePeople) {
  const stage = p.lifeStage
  if (!stage) fail(p.id, 'no life stage')
  const moments = p.moments ?? []
  if (moments.length < 2 || moments.length > 7) fail(p.id, `${moments.length} moments (want 2-7)`)
  const first = moments.find((m) => m.firstMeeting)
  const since = first?.date
  const newest = moments.map((m) => m.date).sort().at(-1)
  if (!since) fail(p.id, 'no first-meeting moment')
  else {
    if (stage && windows[stage] && (since < windows[stage][0] || since > windows[stage][1])) fail(p.id, `met ${since} does not fit stage ${stage}`)
    for (const m of moments) if (!m.firstMeeting && m.date <= since) fail(p.id, `moment "${m.title}" ${m.date} is not after meeting date ${since}`)
  }
  if (newest && p.lastContacted < newest) fail(p.id, `last contacted ${p.lastContacted} is before newest moment ${newest}`)
  if (p.lastContacted > TODAY) fail(p.id, 'last contacted in the future')
  for (const [label, place] of [['from', p.from], ['met', p.met], ['lives', p.livesNow]] as const)
    if (!lookupPlace(place.city)) fail(p.id, `${label} ${place.city} is not in the gazetteer`)
  if (p.livesNow.hood) {
    const hood = lookupPlace(p.livesNow.hood)
    if (!hood) fail(p.id, `neighborhood ${p.livesNow.hood} is not in the gazetteer`)
    else if (!sameMetro(hood, lookupPlace(p.livesNow.city))) fail(p.id, `${p.livesNow.hood} is not in ${p.livesNow.city}`)
  }
  for (const text of [p.story, p.profession, ...p.tags, ...moments.map((m) => m.text ?? m.transcript ?? '')])
    if (BANNED.test(text) && p.id !== 'jordan-lee') fail(p.id, `filler text: ${text.slice(0, 40)}`)
  if (!p.closeness) fail(p.id, 'no closeness')
}

// Distribution
const home = homePlace()
const count = (f: (p: (typeof samplePeople)[number]) => boolean) => samplePeople.filter(f).length
if (samplePeople.length !== 200) fail('dataset', `${samplePeople.length} people (want 200)`)
const nyc = count((p) => sameMetro(home, placeOfPerson(p)))
if (nyc < 95 || nyc > 115) fail('dataset', `${nyc} people in the New York area (want 95-115)`)
for (const [stage, [lo, hi]] of Object.entries(targets)) {
  const n = count((p) => p.lifeStage === stage)
  if (n < lo || n > hi) fail('dataset', `${n} people at stage ${stage} (want ${lo}-${hi})`)
}

// The demo answers must still be possible (they are checked end to end in tests/demo.test.ts)
const inNyc = (p: (typeof samplePeople)[number]) => sameMetro(home, placeOfPerson(p))
const mentions = (re: RegExp) => samplePeople.filter((p) => re.test([p.story, p.profession, ...p.tags, ...(p.todos ?? []).map((t) => t.text)].join(' ').toLowerCase())).map((p) => p.id)
const climbers = mentions(/climb|boulder/)
if (climbers.sort().join() !== ['jordan-lee', 'zara-ahmed'].join()) fail('demo', `climbing mentions ${climbers.join(', ')} (want only jordan-lee, zara-ahmed)`)
const hw = mentions(/hardware/).sort().join()
if (hw !== ['aisha-khan', 'ana-ruiz', 'jordan-lee'].join()) fail('demo', `hardware mentions ${hw} (want only ana-ruiz, aisha-khan, and jordan-lee who asks for the intro)`)
const fashion = samplePeople.filter((p) => inNyc(p) && /fashion|vintage|styl|tailor/.test([p.profession, ...p.tags].join(' ').toLowerCase()))
if (fashion.length < 6) fail('demo', `${fashion.length} fashion people in New York (want 6+)`)
const portraits = samplePeople.filter((p) => inNyc(p) && /portrait|photograph/.test([p.profession, p.story, ...p.tags].join(' ').toLowerCase()))
if (portraits.length) fail('demo', `portrait/photography people in New York (the empty-state demo needs none): ${portraits.map((p) => p.id).join(', ')}`)
if (!['san francisco', 'oakland', 'berkeley'].every((c) => samplePeople.some((p) => p.livesNow.city.toLowerCase().startsWith(c)))) fail('demo', 'SF trip needs people in SF, Oakland and Berkeley')

const byStage: Record<string, number> = {}
for (const p of samplePeople) byStage[p.lifeStage ?? '?'] = (byStage[p.lifeStage ?? '?'] ?? 0) + 1
console.log(`${samplePeople.length} people · ${nyc} in the New York area · ${JSON.stringify(byStage)}`)
if (errors.length) {
  console.error(`\n${errors.length} problems:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log('seed data OK')
