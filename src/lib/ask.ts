import type { Context, Person } from '../data/people'
import { firstName, timeSince } from './people'

// The voice AI search ("Ask"): turns what the user says into an action. It's a rule-based stand-in for a
// real model, so the prototype works offline with no API key: it understands adding someone, logging a
// moment, opening a profile, and finding people by interests, work, places, how you know them, or how
// long it's been.

export type Match = { person: Person; why: string }

export type AskResult =
  | { kind: 'people'; title: string; matches: Match[] }
  | { kind: 'add' }
  | { kind: 'moment'; person: Person }
  | { kind: 'profile'; person: Person }
  | { kind: 'none'; title: string }

// Example requests, played when the user taps the mic (the voice is a scripted demo, like capture).
export const demoRequests = [
  'Who do I know that’s into baseball?',
  'Show me everyone I met at Climate Week',
  'Who haven’t I talked to in a while?',
  'Add someone new I just met',
  'Who works in climate in New York?',
  'Open Aisha’s profile',
  'Find my friends who like music',
  'Log a moment with Maya',
]

// Words that broaden a request ("sports" should find baseball and running).
const related: Record<string, string[]> = {
  sports: ['baseball', 'basketball', 'soccer', 'running', 'tennis', 'climbing', 'hiking', 'marathon', 'run club', 'sports'],
  sport: ['baseball', 'basketball', 'soccer', 'running', 'tennis', 'climbing', 'hiking', 'marathon', 'sports'],
  outdoors: ['hiking', 'climbing', 'running', 'patagonia', 'outdoors'],
  tech: ['engineering', 'software', 'data', 'robotics', 'startup', 'tech', 'product'],
  music: ['music', 'jazz', 'cello', 'band', 'musician'],
  art: ['art', 'design', 'film', 'ceramics', 'pottery', 'photography', 'sketch', 'gallery'],
  food: ['food', 'chef', 'cooking', 'ramen', 'supper', 'spicy'],
  health: ['health', 'med', 'medical', 'nurse', 'pediatrics'],
  climate: ['climate', 'sustainab', 'wildfire', 'fertilizer', 'passive house'],
  money: ['investing', 'investor', 'vc'],
  startups: ['founder', 'startup', 'startups'],
  books: ['books', 'reading', 'writer', 'journalist'],
}

const relationWords: [RegExp, Context, string][] = [
  [/\b(family|relatives?|cousins?|siblings?)\b/, 'family', 'family'],
  [/\b(work|coworkers?|colleagues?|professional)\b/, 'work', 'from work'],
  [/\b(friends?|social)\b/, 'social', 'friends'],
  [/\b(community|neighbou?rs?)\b/, 'community', 'community'],
]

// Words that carry no meaning for matching.
const filler = new Set(
  (
    'who whos whom what which where when do does did i im ive me my mine you your know knows known people person ' +
    'everyone everybody anyone someone somebody all show find search look looking for get give list tell about ' +
    'that thats is are was were be been being the a an and or of to with into in at on from by like likes liked ' +
    'love loves into interested interest interests can could would please any some who’s that’s there their them ' +
    'they he she his her it its just also really guys folks lot lots much many works working work does do into ' +
    'lives live living met meet meeting'
  ).split(' '),
)

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')

export function interpret(input: string, people: Person[]): AskResult {
  const text = norm(input).replace(/[?.!,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return { kind: 'none', title: 'I didn’t catch that' }

  const named = mentionedPerson(text, people)

  // Actions first
  if (/\b(log|note|record|add)\b.*\b(moment|catch ?up|coffee|chat|call)\b/.test(text) && named) return { kind: 'moment', person: named }
  if (/\b(add|new (person|profile|contact)|create|save|i (just )?met someone|someone new)\b/.test(text) && !named)
    return { kind: 'add' }
  if (named && /\b(open|show|pull up|go to|see|view)\b/.test(text) && /\b(profile|page|card)\b|^(open|show|pull up|go to|see|view) \w+( \w+)?$/.test(text))
    return { kind: 'profile', person: named }

  // How long it's been
  if (/(havent|have not|hasnt|not)( i| we| you)? (talked|spoken|seen|caught up)|lost touch|(been|in) a while|catch up with|reach out|out of touch/.test(text)) {
    const matches = [...people]
      .sort((a, b) => a.lastContacted.localeCompare(b.lastContacted))
      .slice(0, 5)
      .map((person) => ({ person, why: `Last talked ${timeSince(person.lastContacted).toLowerCase()}` }))
    return { kind: 'people', title: 'People you haven’t talked to in a while', matches }
  }
  if (/\b(recently|lately|this week|this month)\b/.test(text) && /\b(talked|spoke|seen|met|saw)\b/.test(text)) {
    const matches = [...people]
      .sort((a, b) => b.lastContacted.localeCompare(a.lastContacted))
      .slice(0, 5)
      .map((person) => ({ person, why: `Last talked ${timeSince(person.lastContacted).toLowerCase()}` }))
    return { kind: 'people', title: 'People you talked to recently', matches }
  }

  // Filters that all have to hold
  type Filter = { label: string; test: (p: Person) => string | null }
  const filters: Filter[] = []
  let rest = ` ${text} `

  for (const [re, context, label] of relationWords) {
    if (re.test(rest) && !/\b(works? (in|at|as)|working)\b/.test(rest.replace(re, ''))) {
      filters.push({ label, test: (p) => (p.context === context ? label[0].toUpperCase() + label.slice(1) : null) })
      rest = rest.replace(re, ' ')
      break
    }
  }

  // Places and events: the longest names first so "New York" wins over "York".
  const places = new Map<string, { field: 'from' | 'met' | 'lives' | 'any'; name: string }>()
  const known = new Set<string>()
  for (const p of people) for (const n of [p.from.city, p.met.city, p.met.context, p.livesNow.city]) known.add(n)
  const names = [...known].sort((a, b) => b.length - a.length)
  for (const name of names) {
    const short = norm(name.split(',')[0])
    if (short.length < 3) continue
    const at = rest.indexOf(` ${short} `)
    if (at < 0) continue
    const before = rest.slice(Math.max(0, at - 16), at)
    const field = /\bfrom\s*$/.test(before) ? 'from' : /\bmet( (at|in))?\s*$/.test(before) ? 'met' : /\b(lives?|living|based)( in)?\s*$/.test(before) ? 'lives' : 'any'
    places.set(short, { field, name: name.split(',')[0] })
    rest = rest.replace(` ${short} `, ' ')
  }
  for (const [short, { field, name }] of places) {
    filters.push({
      label: field === 'from' ? `from ${name}` : field === 'met' ? `met at ${name}` : `in ${name}`,
      test: (p) => {
        const hit = (s: string) => norm(s).includes(short)
        if ((field === 'met' || field === 'any') && (hit(p.met.context) || hit(p.met.city))) return `Met at ${p.met.context} · ${p.met.city}`
        if ((field === 'lives' || field === 'any') && hit(p.livesNow.city)) return `Lives in ${p.livesNow.city}`
        if ((field === 'from' || field === 'any') && hit(p.from.city)) return `From ${p.from.city}`
        return null
      },
    })
  }

  // Whatever is left is about interests or work
  const words = rest.split(' ').filter((w) => w.length > 2 && !filler.has(w))
  for (const word of words) {
    const stem = word.replace(/(ers|ing|ies|es|s)$/, '')
    const terms = related[word] ?? [word, stem.length >= 4 ? stem : word]
    filters.push({
      label: word,
      test: (p) => {
        const tag = p.tags.find((t) => terms.some((term) => norm(t).includes(term)))
        if (tag) return `Into ${tag}`
        if (terms.some((term) => norm(p.profession).includes(term))) return p.profession
        if (terms.some((term) => norm(p.story).includes(term))) return p.story
        return null
      },
    })
  }

  if (named && filters.length === 0) return { kind: 'profile', person: named }
  if (filters.length === 0) return { kind: 'none', title: 'I’m not sure what to look for' }

  const matches: Match[] = []
  for (const person of people) {
    const reasons = filters.map((f) => f.test(person))
    if (reasons.every(Boolean)) matches.push({ person, why: [...new Set(reasons)].join(' · ') })
  }
  const about = filters.map((f) => f.label).join(', ')
  const title =
    matches.length === 0
      ? `No one matches “${about}” yet`
      : `${matches.length} ${matches.length === 1 ? 'person' : 'people'} · ${about}`
  return { kind: 'people', title, matches }
}

// Someone mentioned by full name, or by a first name only one person has.
function mentionedPerson(text: string, people: Person[]): Person | undefined {
  const t = ` ${text} `
  const full = people.find((p) => t.includes(` ${norm(p.name)} `))
  if (full) return full
  const byFirst = people.filter((p) => {
    const f = norm(firstName(p.name))
    return t.includes(` ${f} `) || t.includes(` ${f}s `)
  })
  return byFirst.length === 1 ? byFirst[0] : undefined
}
