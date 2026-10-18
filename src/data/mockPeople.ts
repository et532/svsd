import type { Context, Person, Place } from './people'

// Fabricated people for stress-testing the mindmap: open the app with ?mock=200 (any count up to 500).
// Seeded, so the same people appear every time. Links are mostly inside a "circle" (same city), with a few bridges between circles and a handful of loners.

const first = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jon', 'Kai', 'Lia', 'Mo', 'Noa', 'Omar', 'Priya', 'Quinn', 'Rae', 'Sam', 'Tara', 'Uma', 'Vik', 'Wren', 'Xavi', 'Yara', 'Zed', 'Maya', 'Aisha', 'Hannah', 'Zara', 'Daniel', 'Grace', 'Liam', 'Emma', 'Mateo', 'Sofia', 'Jin', 'Lena', 'Theo', 'Nina']
const last = ['Chen', 'Okafor', 'Ramirez', 'Khan', 'Cohen', 'Ahmed', 'Nair', 'Haddad', 'Park', 'Silva', 'Novak', 'Ito', 'Moreau', 'Singh', 'Costa', 'Berg', 'Adeyemi', 'Kowalski', 'Tanaka', 'Rossi', 'Lindqvist', 'Mensah', 'Dubois', 'Patel', 'Kim', 'Reyes', 'Weiss', 'Haas', 'Ortiz', 'Lopez']

const cities: Place[] = [
  { city: 'New York', lat: 40.71, lng: -74.0 },
  { city: 'San Francisco', lat: 37.77, lng: -122.42 },
  { city: 'Los Angeles', lat: 34.05, lng: -118.24 },
  { city: 'Chicago', lat: 41.88, lng: -87.63 },
  { city: 'Austin', lat: 30.27, lng: -97.74 },
  { city: 'Boston', lat: 42.36, lng: -71.06 },
  { city: 'London', lat: 51.51, lng: -0.13 },
  { city: 'Berlin', lat: 52.52, lng: 13.4 },
  { city: 'Lagos', lat: 6.52, lng: 3.38 },
  { city: 'Mumbai', lat: 19.08, lng: 72.88 },
  { city: 'Tokyo', lat: 35.68, lng: 139.69 },
  { city: 'Seoul', lat: 37.57, lng: 126.98 },
  { city: 'Sydney', lat: -33.87, lng: 151.21 },
  { city: 'Mexico City', lat: 19.43, lng: -99.13 },
  { city: 'Toronto', lat: 43.65, lng: -79.38 },
]
const jobs = ['Product designer', 'Software engineer', 'Founder', 'Recruiter', 'Nurse', 'Teacher', 'Photographer', 'Chef', 'Architect', 'Investor', 'Journalist', 'Data scientist', 'Musician', 'Lawyer', 'Researcher']
const events = ['Climate Week', 'Config', 'A friend’s wedding', 'Hackathon', 'Run club', 'Dinner party', 'Conference', 'Flight to Denver', 'Coffee shop', 'Gallery opening', 'Alumni mixer', 'Pickup soccer']
const interests = ['baseball', 'climbing', 'film', 'ceramics', 'running', 'jazz', 'chess', 'cooking', 'travel', 'startups', 'books', 'hiking', 'tennis', 'photography']
// Mostly social, then work, then community; family is rare.
const contexts: Context[] = [...Array(8).fill('social'), ...Array(5).fill('work'), ...Array(3).fill('community'), 'family', 'unsorted']

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeMockPeople(count: number): Person[] {
  const rand = rng(7)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  const now = new Date('2026-10-18').getTime()

  const people: Person[] = Array.from({ length: count }, (_, i) => {
    const name = `${pick(first)} ${pick(last)}`
    const tags = [...new Set([pick(interests), pick(interests)])]
    const job = pick(jobs)
    return {
      id: `mock-${i}`,
      name,
      context: pick(contexts),
      profession: job,
      story: `${job} who is into ${tags.join(' and ')}. Met at ${pick(events).toLowerCase()}.`,
      tags,
      from: pick(cities),
      met: { ...pick(cities), context: pick(events) },
      livesNow: pick(cities),
      lastContacted: new Date(now - rand() * 400 * 86_400_000).toISOString().slice(0, 10),
      knows: [],
    }
  })

  // You only know a few people's connections: each person mentions 1-2 others from their own city,
  // plus the odd bridge to another city. About 1 in 12 knows nobody. Nobody has more than 5 links.
  const byCity = new Map<string, Person[]>()
  for (const p of people) byCity.set(p.livesNow.city, [...(byCity.get(p.livesNow.city) ?? []), p])
  const degree = new Map<string, number>()
  const link = (a: Person, b: Person) => {
    if (a === b || a.knows.includes(b.id) || b.knows.includes(a.id)) return
    if ((degree.get(a.id) ?? 0) >= 5 || (degree.get(b.id) ?? 0) >= 5) return
    a.knows.push(b.id)
    for (const x of [a, b]) degree.set(x.id, (degree.get(x.id) ?? 0) + 1)
  }
  const social = people.filter(() => rand() > 0.08)
  for (const p of social) {
    const mates = (byCity.get(p.livesNow.city) ?? []).filter((q) => social.includes(q))
    for (let i = 0; i < 1 + Math.floor(rand() * 2); i++) link(p, pick(mates))
  }
  for (let i = 0; i < count * 0.06; i++) link(pick(social), pick(social))
  return people
}
