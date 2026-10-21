import { lookupPlace } from '../lib/places'
import type { Context, LifeStage, Moment, Person, Place } from './people'

// A compact way to write the sample people: `seed()` fills in places, ids, to-dos and moments, and `linkAll()`
// makes every "knows" link two-way (so each person only needs listing on one side).

// Places come from the gazetteer (a city, or a neighborhood inside it), so a new city only needs adding there.
const place = (city: string, hood?: string): Place => {
  const at = lookupPlace(hood ?? city)
  if (!at) throw new Error(`seed: ${hood ?? city} is not in the gazetteer`)
  return { city, lat: at.lat, lng: at.lng, ...(hood ? { hood: at.name } : {}) }
}

export type Seed = {
  id: string
  name: string
  ctx: Context
  also?: Context
  job: string
  story: string
  tags: string[]
  from: string
  met: [city: string, where: string]
  since: string // the day you met
  lives: string
  hood?: string // neighborhood you live in
  stage?: LifeStage
  last: string // last time you talked
  knows?: string[]
  close?: 1 | 2 | 3
  // Things to do next; a leading "✓ " marks one already done
  todos?: string[]
  notes?: Record<string, string>
  // What you said when you met them (a voice note)
  first: string
  // Newest first or not (sorted): [date, title, text, voice-note seconds?]. With seconds it is a voice note.
  moments?: [date: string, title: string, text: string, seconds?: number][]
}

const seconds = (text: string) => Math.max(6, Math.round(text.split(/\s+/).length / 2.4))

export function seed(s: Seed): Person {
  const moments: Moment[] = (s.moments ?? []).map(([date, title, text, secs], i) => ({
    id: `${s.id}-m${i}`,
    date,
    title,
    ...(secs ? { transcript: text, seconds: secs } : { text }),
  }))
  moments.push({
    id: `${s.id}-first`,
    date: s.since,
    firstMeeting: true,
    title: `Met at ${s.met[1]}`,
    transcript: s.first,
    seconds: seconds(s.first),
  })
  moments.sort((a, b) => b.date.localeCompare(a.date))
  return {
    id: s.id,
    name: s.name,
    context: s.ctx,
    ...(s.also ? { alsoContext: s.also } : {}),
    profession: s.job,
    story: s.story,
    tags: s.tags,
    from: place(s.from),
    met: { ...place(s.met[0]), context: s.met[1] },
    livesNow: place(s.lives, s.hood),
    ...(s.stage ? { lifeStage: s.stage } : {}),
    lastContacted: s.last,
    knows: s.knows ?? [],
    ...(s.notes ? { mutualNotes: s.notes } : {}),
    ...(s.close ? { closeness: s.close } : {}),
    todos: (s.todos ?? []).map((t, i) => ({
      id: `${s.id}-t${i}`,
      text: t.replace(/^✓ /, ''),
      done: t.startsWith('✓ '),
    })),
    moments,
  }
}

// Makes every link two-way, and drops links to people who don't exist.
export function linkAll(people: Person[]): Person[] {
  const byId = new Map(people.map((p) => [p.id, { ...p, knows: new Set(p.knows) }]))
  for (const p of byId.values())
    for (const id of [...p.knows]) {
      const other = byId.get(id)
      if (other) other.knows.add(p.id)
      else p.knows.delete(id)
    }
  return people.map((p) => ({ ...p, knows: [...byId.get(p.id)!.knows] }))
}
