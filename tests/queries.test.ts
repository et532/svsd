import { describe, expect, it } from 'vitest'
import { samplePeople } from '../src/data/people'
import { homePlace, placeOfPerson, resolvePlace, sameMetro } from '../src/lib/places'
import { ask } from '../scripts/nodeSearch'

const byId = new Map(samplePeople.map((p) => [p.id, p]))
const run = async (q: string) => {
  const r = await ask(q)
  if (r.kind !== 'people') throw new Error(`${q}: got ${r.kind}`)
  return { ...r, ids: r.matches.map((m) => m.person.id) }
}
const inArea = (q: string) => {
  const target = resolvePlace(q)?.place ?? homePlace()
  return (id: string) => sameMetro(target, placeOfPerson(byId.get(id)!))
}

// In-person plans: everybody returned must live in the place named (or home), whatever the activity or theme.
const plans = [
  'dinner in Williamsburg', 'drinks in the East Village', 'brunch in Park Slope', 'coffee in Harlem', 'game night in Astoria',
  'a concert in Greenpoint', 'a house party in Bushwick', 'pickleball in Brooklyn', 'a run in Queens', 'lunch in Chinatown',
  'a quiet coffee in Brooklyn', 'dinner party in Jersey City', 'a birthday dinner in Astoria', 'drinks in Manhattan',
  'someone to see a movie with', 'a hike this weekend', 'a workout buddy', 'someone to grab a beer with', 'a gallery visit in Bed-Stuy',
  'a music themed house party in Bushwick', 'a vintage themed dinner in Williamsburg', 'a cooking themed dinner in Brooklyn',
  'dinner in London', 'coffee in Chicago', 'lunch in Seattle', 'drinks in Los Angeles', 'dinner in Paris', 'coffee in Boston', 'drinks in Berlin',
]

describe('in-person plans are place-gated', () => {
  it.each(plans)('%s', async (q) => {
    const r = await run(q)
    const ok = inArea(q)
    expect(r.ids.filter((id) => !ok(id)), `out of area: ${r.ids.filter((id) => !ok(id)).join(', ')}`).toEqual([])
    for (const g of r.groups ?? []) for (const m of g.matches) expect(ok(m.person.id)).toBe(true)
  })
})

// Knowledge questions: the named person must be in the results (location is ignored).
const knows: [string, string][] = [
  ['who knows about taxes', 'wendy-tsai'], ['who knows about wine', 'rafael-cruz'], ['I need a doctor', 'naomi-feldman'],
  ['a good lawyer', 'hannah-cohen'], ['who knows about ceramics', 'ayesha-malik'], ['who knows about baking bread', 'bea-lopez'],
  ['who knows about jazz', 'adaeze-obi'], ['an architect', 'emily-chung'], ['who knows about coffee', 'kenneth-ho'],
  ['who knows about film', 'amara-osei'], ['who is a tailor', 'luis-ferreira'], ['a plumber or handyman', 'gideon-reyes'],
  ['someone who sells vintage clothes', 'dmitri-sokolov'], ['a fashion stylist', 'tamsin-okoro'], ['a barber', 'lou-marchetti'],
  ['who knows about poetry', 'odessa-wright'], ['a dentist', 'raymond-liu'], ['who runs a bookstore', 'gus-papadakis'],
  ['a physical therapist', 'marcus-bell'], ['someone in climate tech', 'maya-chen'], ['a recruiter', 'rhonda-pierce'],
  ['a personal trainer', 'bianca-costa'], ['who knows about gardening', 'harlan-boyd'], ['a mural painter', 'benji-stern'],
  ['someone who makes furniture', 'theo-park'], ['a florist', 'phoebe-lawrence'], ['a chess teacher', 'oleg-ivanov'],
  ['who plays the cello', 'zara-ahmed'], ['a sommelier', 'rafael-cruz'], ['an ER nurse', 'lila-sharma'],
]
describe('knowledge questions find the right person', () => {
  it.each(knows)('%s -> %s', async (q, id) => {
    const r = await run(q)
    expect(r.ids.slice(0, 10), q).toContain(id)
  })
})

// Honest empties: nobody has these skills.
const empties = ['who knows about deep sea welding', 'someone who does rocket science', 'who knows about beekeeping', 'a falconer', 'who is a professional wrestler', 'someone who breeds alpacas', 'portrait photographer in New York', 'a taxidermist in Brooklyn']
describe('nothing is invented', () => {
  it.each(empties)('%s', async (q) => {
    const r = await run(q)
    expect(r.matches.map((m) => m.person.name), q).toEqual([])
  })
})

describe('life stage and where you met', () => {
  it.each([['high school friends', 'high-school'], ['college friends', 'college'], ['people from my first job', 'first-job']] as const)('%s', async (q, stage) => {
    const r = await run(q)
    expect(r.ids.length).toBeGreaterThan(3)
    expect(r.ids.every((id) => byId.get(id)!.lifeStage === stage)).toBe(true)
  })
  it.each(['Config', 'Climate Week', 'Pickleball league', 'Supper club', 'Book club'])('people I met at %s', async (event) => {
    const r = await run(`people I met at ${event}`)
    expect(r.ids.length, event).toBeGreaterThan(0)
    expect(r.ids.every((id) => byId.get(id)!.met.context.toLowerCase().includes(event.toLowerCase()) || byId.get(id)!.moments?.some((m) => m.firstMeeting && m.title.toLowerCase().includes(event.toLowerCase()))), event).toBe(true)
  })
})

describe('ordering', () => {
  it('run club leader is first for a run', async () => expect((await run('someone to go for a run with')).ids[0]).toBe('bianca-costa'))
  it('the stylist is first for fashion in Bushwick', async () => expect((await run('fashion themed party in Bushwick')).ids.slice(0, 3)).toContain('tamsin-okoro'))
  it('cellist for a music night', async () => expect((await run('a night of classical music in Brooklyn')).ids.slice(0, 10)).toEqual(expect.arrayContaining(['lucien-bailey'])))
})

describe('every answer is well-formed', () => {
  const sample = [...plans.slice(0, 10), ...knows.slice(0, 10).map(([q]) => q)]
  it.each(sample)('%s', async (q) => {
    const r = await run(q)
    expect(new Set(r.ids).size).toBe(r.ids.length)
    expect(r.matches.length).toBeLessThanOrEqual(10)
    for (const m of r.matches) expect(m.why.length).toBeGreaterThan(3)
  })
})

describe('self-retrieval: asking for someone by what they do finds them', () => {
  it('recall@10 over people with a unique job title', async () => {
    const counts = new Map<string, number>()
    for (const p of samplePeople) counts.set(p.profession.toLowerCase(), (counts.get(p.profession.toLowerCase()) ?? 0) + 1)
    const unique = samplePeople.filter((p) => counts.get(p.profession.toLowerCase()) === 1 && !p.profession.includes('@')).filter((_, i) => i % 3 === 0)
    let hit = 0
    const misses: string[] = []
    for (const p of unique) {
      const r = await run(`who is a ${p.profession.toLowerCase()}`)
      if (r.ids.slice(0, 10).includes(p.id)) hit++
      else misses.push(`${p.name} (${p.profession})`)
    }
    console.log(`recall@10: ${hit}/${unique.length}`, misses.slice(0, 15))
    expect(hit / unique.length).toBeGreaterThan(0.8)
  })
})
