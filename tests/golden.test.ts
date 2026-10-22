import { describe, expect, it } from 'vitest'
import { samplePeople } from '../src/data/people'
import { homePlace, placeOfPerson, sameMetro } from '../src/lib/places'
import { ask } from '../scripts/nodeSearch'

const byId = new Map(samplePeople.map((p) => [p.id, p]))
const inNyc = (id: string) => sameMetro(homePlace(), placeOfPerson(byId.get(id)!))
const run = async (q: string) => {
  const r = await ask(q)
  if (r.kind !== 'people') throw new Error(`${q}: got ${r.kind}`)
  return { ...r, ids: r.matches.map((m) => m.person.id) }
}

describe('golden queries (real embeddings, 500 people)', () => {
  it('Bushwick fashion party: only New York area, fashion people first', async () => {
    const r = await run('someone for me to invite to a house party in Bushwick that is like fashion themed')
    expect(r.ids.every(inNyc)).toBe(true)
    const top3 = r.ids.slice(0, 3)
    expect(top3).toContain('tamsin-okoro')
    expect(r.ids).toEqual(expect.arrayContaining(['dmitri-sokolov', 'chloe-bernard', 'jules-amato']))
    expect(r.ids).not.toContain('dani-moreno') // fashionable but in LA
  })
  it('chatty phrasing ("talk to", "right now") does not hide the match', async () => {
    const r = await run('i would like to talk to a software engineer who lives in san francisco right now')
    expect(r.ids).toContain('ty-nakamura')
  })
  it('in-person plans never return out-of-area people', async () => {
    for (const q of ['someone to play pickleball with', 'someone to go for a run with', 'a birthday dinner in Astoria', 'coffee in Brooklyn'])
      expect((await run(q)).ids.every(inNyc), q).toBe(true)
  })
  it('pickleball finds the league', async () => {
    const r = await run('someone to play pickleball with')
    expect(r.ids.slice(0, 6)).toEqual(expect.arrayContaining(['marcus-bell', 'dana-reyes']))
  })
  it('knowledge questions ignore location', async () => {
    const r = await run('who knows about taxes')
    expect(r.ids[0]).toBe('wendy-tsai')
  })
  it('honest empty: portraits in New York', async () => {
    const r = await run('portrait photographer in New York')
    expect(r.matches).toHaveLength(0)
    expect(r.near?.length).toBeGreaterThan(0)
  })
  it('honest empty: deep sea welding', async () => {
    expect((await run('who knows about deep sea welding')).matches).toHaveLength(0)
  })
  it('college friends who moved to New York', async () => {
    const r = await run('college friends who moved to New York')
    expect(r.ids.every((id) => byId.get(id)!.lifeStage === 'college' && inNyc(id))).toBe(true)
    expect(r.ids.length).toBeGreaterThan(5)
  })
  it('SF trip only returns the Bay Area', async () => {
    const r = await run('dinner in SF next month')
    expect(r.ids.length).toBeGreaterThan(3)
    expect(r.ids.every((id) => byId.get(id)!.livesNow.city.match(/San Francisco|Oakland|Berkeley/) || placeOfPerson(byId.get(id)!)?.metro === 'bay')).toBe(true)
  })
  it('climbing demo: Jordan then Zara', async () => {
    expect((await run('I want to find someone to go climbing with me')).ids).toEqual(['jordan-lee', 'zara-ahmed'])
  })
  it('hardware intro: Ana direct, Aisha one step away', async () => {
    const r = await run('I just met a founder looking for a hardware engineer. Who can I introduce?')
    expect(r.groups?.[0].matches[0].person.id).toBe('ana-ruiz')
    expect(r.ids).toContain('aisha-khan')
  })
  it('relaxation: no fashion person nearby falls back to good company', async () => {
    // Take out everyone who mentions fashion anywhere in what is written about them
    const fashiony = /fashion|vintage|styl|tailor|costume|textile|runway|apparel|thrift|wardrobe|clothing|sneaker|perfume|interior/i
    const all = (p: (typeof samplePeople)[number]) => [p.profession, p.story, ...p.tags, ...(p.moments ?? []).map((m) => `${m.title} ${m.text ?? ''} ${m.transcript ?? ''}`)].join(' ')
    const { answer } = await import('../src/lib/rank/search')
    const { hitsFor } = await import('../scripts/nodeSearch')
    const people = samplePeople.filter((p) => !fashiony.test(all(p)))
    const r = await answer('someone for a house party in Bushwick that is fashion themed', people, hitsFor)
    if (r.kind !== 'people') throw new Error('no result')
    expect(r.note).toMatch(/No one in Bushwick is clearly into fashion/)
    expect(r.matches.length).toBeGreaterThan(0)
  })
})
