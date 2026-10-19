import type { Context, Moment, Person, Todo } from '../data/people'
import { getPeople } from './peopleStore'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

// Matches name, work, story, tags, places, and where you met.
export function matchesQuery(person: Person, query: string): boolean {
  const q = normalize(query.trim())
  if (!q) return true
  const haystack = [
    person.name,
    person.profession,
    person.story,
    ...person.tags,
    person.from.city,
    person.met.city,
    person.met.context,
    person.livesNow.city,
    person.context,
  ]
    .map(normalize)
    .join(' ')
  const nameWords = normalize(person.name).split(/\s+/)
  // A word matches as a substring, or (for longer words) as a name with one typo.
  return q.split(/\s+/).every((word) => haystack.includes(word) || (word.length >= 3 && nameWords.some((n) => withinOneEdit(n.slice(0, word.length), word) || withinOneEdit(n, word))))
}

// True when a and b differ by at most one inserted, deleted or changed letter.
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1)
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}

// Lower is better: name starts with it, then a name word starts with it, then name contains it, then the rest.
export function matchRank(person: Person, query: string): number {
  const q = normalize(query.trim())
  const name = normalize(person.name)
  if (name.startsWith(q)) return 0
  if (name.split(/\s+/).some((w) => w.startsWith(q))) return 1
  return name.includes(q) ? 2 : 3
}

// One short line saying why someone matched when it wasn't their name (e.g. "Likes baseball").
export function whyMatched(person: Person, query: string): string | null {
  const q = normalize(query.trim())
  if (!q || normalize(person.name).includes(q)) return null
  const has = (t: string) => normalize(t).includes(q)
  const tag = person.tags.find(has)
  if (tag) return `Interested in ${tag}`
  if (has(person.profession)) return person.profession
  if (has(person.met.city) || has(person.met.context)) return `Met at ${person.met.context} · ${person.met.city}`
  if (has(person.from.city)) return `From ${person.from.city}`
  if (has(person.livesNow.city)) return `Lives in ${person.livesNow.city}`
  if (has(person.context)) return person.context[0].toUpperCase() + person.context.slice(1)
  return null
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Peepl foundation: hue = how you know someone. [core, deep, wash] per context.
const contextHues: Record<Context, [string, string, string]> = {
  work: ['#2f4fd0', '#1b2c86', '#dde3fb'],
  social: ['#ec5a32', '#8f2f16', '#fde0d4'],
  community: ['#e8c22e', '#6e5600', '#fbf0c4'],
  family: ['#d6347f', '#8a1a50', '#fadbe8'],
  unsorted: ['#a99d93', '#5b5361', '#ebe5de'],
}

// The core color for a kind of relationship (work, social...), for legends.
export const contextColor = (c: Context) => contextHues[c][0]

function personById(id: string): Person | undefined {
  return getPeople().find((p) => p.id === id)
}

function hues(id: string) {
  return contextHues[personById(id)?.context ?? 'unsorted']
}

// Aura depth 1-3 = how close you are. There is no closeness field yet, so it follows how recently
// you were in touch: this month = 3, last four months = 2, longer = 1.
export function auraDepth(id: string, now = new Date()): 1 | 2 | 3 {
  const person = personById(id)
  if (person?.closeness) return person.closeness
  const last = person?.lastContacted
  if (!last) return 1
  const days = (now.getTime() - new Date(last).getTime()) / 86_400_000
  return days <= 30 ? 3 : days <= 120 ? 2 : 1
}

// Initials sit on the core color: white on the dark cores, ink on the light ones.
export function orbTextColor(id: string): string {
  const ctx = personById(id)?.context ?? 'unsorted'
  return ctx === 'community' || ctx === 'unsorted' ? 'var(--ink)' : '#ffffff'
}

// A gradient for a person's avatar: a soft sphere with a highlight, stable for each person.
export function orbBackground(id: string): string {
  const [glow, , base] = hues(id)
  return [
    'radial-gradient(circle at 30% 26%, rgba(255,255,255,0.95) 0, rgba(255,255,255,0) 34%)',
    `radial-gradient(circle at 76% 78%, ${glow} 0, transparent 62%)`,
    `radial-gradient(circle at 22% 80%, ${glow} 0, transparent 58%)`,
    base,
  ].join(', ')
}

// The dark gradient card behind someone's name (Add preview, "Which Jordan?"): their color, with a second color glowing in a corner.
export function cardBackground(p: Person): string {
  const other = p.context === 'work' ? 'social' : 'work'
  return [
    `radial-gradient(circle at 96% 110%, var(--${other}-core) 0, transparent 52%)`,
    `linear-gradient(115deg, var(--${p.context}-deep) 8%, var(--${p.context}-core) 90%)`,
  ].join(', ')
}

export function timeSince(isoDate: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(isoDate).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// Symmetric, de-duplicated links between the given people (ignores ids that aren't in the list).
export function linksOf(people: Person[]): [string, string][] {
  const ids = new Set(people.map((p) => p.id))
  const seen = new Set<string>()
  const links: [string, string][] = []
  for (const p of people)
    for (const other of p.knows) {
      const key = [p.id, other].sort().join('|')
      if (!ids.has(other) || other === p.id || seen.has(key)) continue
      seen.add(key)
      links.push([p.id, other])
    }
  return links
}

// Words for aura depth, shown on the profile.
export const closenessLabel = { 1: 'Just met', 2: 'Getting to know', 3: 'Know well' } as const

export const contextLabel: Record<Context, string> = {
  work: 'Work',
  social: 'Social',
  community: 'Community',
  family: 'Family & home',
  unsorted: 'Unsorted',
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

// Foundation aura for a kind of relationship at a depth: 1 flat core to wash, 2 two-tone,
// 3 deep heart with a highlight. Also used before a person exists (the capture orb).
export function auraGradient(context: Context, depth: 1 | 2 | 3): string {
  const [glow, deep, base] = contextHues[context]
  if (depth === 1) return `radial-gradient(circle at 50% 50%, ${glow} 0%, ${base} 74%)`
  if (depth === 2)
    return [
      `radial-gradient(circle at 40% 38%, ${glow} 0%, transparent 58%)`,
      `radial-gradient(circle at 66% 68%, ${glow} 0%, transparent 62%)`,
      base,
    ].join(', ')
  return [
    `radial-gradient(circle at 46% 48%, ${deep} 0%, transparent 34%)`,
    `radial-gradient(circle at 32% 30%, ${glow} 0%, transparent 58%)`,
    'radial-gradient(circle at 74% 26%, #fff 0%, transparent 18%)',
    base,
  ].join(', ')
}

// Sample people have no logged moments or todos yet: their story is the first meeting
export function momentsOf(p: Person): Moment[] {
  // ...as a voice note you can open, read and play
  return (
    p.moments ?? [
      {
        id: `${p.id}-first`,
        date: p.lastContacted,
        firstMeeting: true,
        title: p.met.context ? `Met at ${p.met.context}` : 'First meeting',
        transcript: p.story,
        seconds: Math.max(8, Math.round(p.story.split(' ').length / 2.6)),
      },
    ]
  )
}

export function todosOf(p: Person): Todo[] {
  return p.todos ?? (p.tags[0] ? [{ id: `${p.id}-ask`, text: `Ask about ${p.tags[0]}`, done: false }] : [])
}

