import type { Context, Moment, Person, Place } from './people'

// A compact way to write the sample people: `seed()` fills in places, ids, to-dos and moments, and `linkAll()`
// makes every "knows" link two-way (so each person only needs listing on one side).

const PLACES: Record<string, [number, number]> = {
  'Brooklyn, NY': [40.678, -73.944],
  'Manhattan, NY': [40.776, -73.971],
  'Queens, NY': [40.728, -73.794],
  'New York': [40.741, -73.99],
  'Jersey City, NJ': [40.718, -74.043],
  'San Francisco': [37.776, -122.417],
  'Oakland, CA': [37.804, -122.271],
  'Berkeley, CA': [37.872, -122.272],
  'Los Angeles': [34.052, -118.244],
  Portland: [45.515, -122.679],
  Seattle: [47.606, -122.332],
  Denver: [39.739, -104.99],
  Austin: [30.267, -97.743],
  Houston: [29.76, -95.37],
  Chicago: [41.878, -87.63],
  Boston: [42.36, -71.059],
  Philadelphia: [39.952, -75.165],
  'Washington, DC': [38.907, -77.037],
  Atlanta: [33.749, -84.388],
  Toronto: [43.653, -79.383],
  Vancouver: [49.283, -123.121],
  'Mexico City': [19.432, -99.133],
  'Buenos Aires': [-34.604, -58.382],
  'São Paulo': [-23.551, -46.633],
  Lagos: [6.524, 3.379],
  Accra: [5.604, -0.187],
  Nairobi: [-1.292, 36.822],
  London: [51.507, -0.128],
  Dublin: [53.349, -6.26],
  Paris: [48.857, 2.352],
  Berlin: [52.52, 13.405],
  Hamburg: [53.551, 9.993],
  Copenhagen: [55.676, 12.568],
  Milan: [45.464, 9.19],
  Lisbon: [38.722, -9.139],
  Beirut: [33.894, 35.502],
  Karachi: [24.861, 67.01],
  Mumbai: [19.076, 72.878],
  Bangalore: [12.972, 77.595],
  Taipei: [25.033, 121.565],
  Tokyo: [35.676, 139.65],
  Osaka: [34.694, 135.502],
  Seoul: [37.566, 126.978],
  Sydney: [-33.869, 151.209],
  Melbourne: [-37.814, 144.963],
}

const place = (city: string): Place => {
  const at = PLACES[city]
  if (!at) throw new Error(`seed: no coordinates for ${city}`)
  return { city, lat: at[0], lng: at[1] }
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
    livesNow: place(s.lives),
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
