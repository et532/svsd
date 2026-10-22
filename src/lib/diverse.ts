import type { Person } from '../data/people'

// Picks `n` people who are as different from each other as possible: each pick is the person whose job, tags and
// where-you-met are least like what is already chosen (so a question like "someone to play pickleball with" finds a
// couple of people, not ten). `keep` are always in. Deterministic: ties go to the earlier person.
const norm = (s: string) => s.toLowerCase().replace(/\s+@.*$/, '').trim()

// Things you'd ask for "someone to do X with": each is a trait of its own so only a couple of people per activity get in.
const activities: [string, RegExp][] = [
  ['pickleball', /\b(pickleball|tennis|padel)\b/],
  ['climbing', /\b(climb\w*|boulder\w*)\b/],
  ['running', /\b(running|run club|marathon|jogging)\b/],
  ['hiking', /\b(hik(e|es|ing))\b/],
  ['fitness', /\b(yoga|pilates|gym|crossfit|workout)\b/],
  ['music', /\b(concerts?|live music|gigs?|band|guitar)\b/],
  ['art', /\b(museums?|galler(y|ies)|exhibit\w*)\b/],
  ['film', /\b(movies?|cinema|film)\b/],
  ['games', /\b(game night|board games?|chess|poker)\b/],
]
const textOf = (p: Person) => [p.profession, p.story, ...p.tags, ...(p.moments ?? []).map((m) => `${m.title} ${m.text ?? ''}`)].join(' ').toLowerCase()

const PER_ACTIVITY = 3 // at most this many people per activity (until nobody else is left)

export function pickDiverse(people: Person[], n: number, keep: Set<string> = new Set()): Person[] {
  const seen = new Map<string, number>()
  const traits = (p: Person) => [
    ...p.tags.map((t) => [`t:${norm(t)}`, 3] as const),
    [`j:${norm(p.profession)}`, 6] as const,
    [`m:${norm(p.met.context)}`, 4] as const,
    [`c:${p.livesNow.hood ?? p.livesNow.city}`, 1] as const,
    ...activities.filter(([, re]) => re.test(textOf(p))).map(([a]) => [`a:${a}`, 10000] as const),
  ]
  const take = (p: Person) => traits(p).forEach(([k]) => seen.set(k, (seen.get(k) ?? 0) + 1))
  const chosen = people.filter((p) => keep.has(p.id))
  chosen.forEach(take)
  const pool = people.filter((p) => !keep.has(p.id))
  while (chosen.length < n && pool.length) {
    let best = 0
    let bestCost = Infinity
    const room = (p: Person) => activities.every(([a, re]) => (seen.get(`a:${a}`) ?? 0) < PER_ACTIVITY || !re.test(textOf(p)))
    const open = pool.some(room)
    pool.forEach((p, i) => {
      if (open && !room(p)) return
      const cost = traits(p).reduce((s, [k, w]) => s + w * (seen.get(k) ?? 0), 0)
      if (cost < bestCost) [best, bestCost] = [i, cost]
    })
    const [p] = pool.splice(best, 1)
    chosen.push(p)
    take(p)
  }
  return people.filter((p) => chosen.includes(p)) // keep the original order
}
