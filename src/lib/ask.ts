import type { Context, Person } from '../data/people'
import { firstName, timeSince } from './people'

// The voice AI search ("Ask"): turns what the user says into an action. It's a rule-based stand-in for a
// real model, so the prototype works offline with no API key: it understands adding someone, logging a
// moment, opening a profile, and finding people by interests, work, places, how you know them, or how
// long it's been.

// A suggested next step on a result: Peepl drafts the message, the user decides whether to send it.
export type Action = {
  kind: 'message' | 'coffee' | 'intro'
  label: string
  to: string // who the draft goes to
  draft: string
  // Sending it ticks off this follow-up (a to-do on someone's profile), closing the loop.
  closes?: { personId: string; todoId: string }
}

export type Match = { person: Person; why: string; say?: string; via?: string; action?: Action }

export type AskResult =
  // generic: found by the plain keyword filters (not a special answer), so meaning-based results can be added
  | { kind: 'people'; title: string; matches: Match[]; groups?: { label: string; matches: Match[] }[]; generic?: boolean; near?: Match[] }
  | { kind: 'add' }
  | { kind: 'moment'; person: Person }
  | { kind: 'profile'; person: Person }
  | { kind: 'none'; title: string }

// The pitch demo, in story order: add Jordan, log a coffee with him, then three questions (see storyRequest).
export const storyAsks = [
  'I want to find someone to go climbing with me',
  'I’m traveling to SF next month. Who can I grab a coffee with?',
  'I just met a founder looking for a hardware engineer. Who can I introduce?',
]

// What the mic "says" next. For now (the user's call) only the Figma's first flow, the climbing buddy question;
// Jordan is built into the sample people so the answer matches. The full story (add Jordan, log a moment, then
// cycle through storyAsks) is in git history if it comes back.
export function storyRequest(people: Person[]): string {
  void people
  return storyAsks[0]
}

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
export const filler = new Set(
  (
    'who whos whom what which where when do does did i im ive me my mine you your know knows known people person ' +
    'everyone everybody anyone someone somebody all show find search look looking for get give list tell about ' +
    'that thats is are was were be been being the a an and or of to with into in at on from by like likes liked ' +
    'love loves into interested interest interests can could would please any some who’s that’s there their them ' +
    'they he she his her it its just also really guys folks lot lots much many works working work does do into ' +
    'lives live living met meet meeting play plays playing played want wants need needs something'
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

  // The richer answers: buddies for an activity, who to see on a trip, who to introduce
  const special = buddy(text, people) ?? trip(text, people) ?? intro(text, people)
  if (special) return special

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
        // What actually happened with them comes first; the profile (tags, job, story) is the fallback reason
        const moment = inMoments(p, terms)
        if (moment) return moment
        const tag = p.tags.find((t) => terms.some((term) => norm(t).includes(term)))
        if (tag) return `Into ${tag}`
        if (terms.some((term) => norm(p.profession).includes(term))) return p.profession
        // Just the sentence of their story that matches, not all of it
        const line = p.story.split(/(?<=[.!?])\s+/).find((x) => terms.some((term) => norm(x).includes(term)))
        return line ? line.replace(/\.$/, '') : null
      },
    })
  }

  if (named && filters.length === 0) return { kind: 'profile', person: named }
  if (filters.length === 0) return { kind: 'none', title: 'I’m not sure what to look for' }

  const matches: Match[] = []
  for (const person of people) {
    const reasons = filters.map((f) => f.test(person))
    // A moment ("… (Coffee, Oct 2026)") is the best reason: say that, not every filter's reason
    const moment = reasons.find((r) => r && /\(.+, [A-Z][a-z]{2} \d{4}\)$/.test(r))
    if (reasons.every(Boolean)) matches.push({ person, why: moment ?? [...new Set(reasons)].join(' · ') })
  }
  const about = filters.map((f) => f.label).join(', ')
  const title =
    matches.length === 0
      ? `No one matches “${about}” yet`
      : `${matches.length} ${matches.length === 1 ? 'person' : 'people'} · ${about}`
  return { kind: 'people', title, matches, generic: true }
}

// What happened with someone that mentions one of the words: the sentence from a logged moment, and when.
function inMoments(p: Person, terms: string[]): string | undefined {
  const re = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`)
  for (const m of p.moments ?? []) {
    const hit = (m.transcript ?? m.text ?? m.title).split(/(?<=[.!?])\s+/).find((x) => re.test(norm(x)))
    if (hit) return `${hit.replace(/\.$/, '')} (${m.title}, ${new Date(m.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`
  }
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

// ---- Richer answers: each result says why, what to say, and offers a drafted next step ----

const HOME = ['brooklyn', 'manhattan', 'new york', 'queens'] // "the city" for this user
const near = (p: Person) => HOME.some((c) => norm(p.livesNow.city).includes(c))
const overdue = (p: Person) => (Date.now() - new Date(p.lastContacted).getTime()) / 86_400_000 > 45
const sentence = (story: string, term: RegExp) => story.split(/(?<=\.)\s+/).find((x) => term.test(norm(x)))?.replace(/\.$/, '')
const openTodos = (p: Person) => (p.todos ?? []).filter((t) => !t.done)

const activities: [RegExp, RegExp, string, string][] = [
  [/\b(climb|climbing|boulder|bouldering)\b/, /climb|boulder/, 'climbing', 'climbing buddy'],
  [/\b(run|running|jog)\b/, /\brun|marathon|jog/, 'running', 'running buddy'],
  [/\b(hike|hiking)\b/, /hik/, 'hiking', 'hiking buddy'],
]

// "I want a climbing buddy. Who in the city can I reach out to?"
function buddy(text: string, people: Person[]): AskResult | null {
  if (!/\b(buddy|partner|someone to|go with|join me)\b/.test(text)) return null
  const hit = activities.find(([ask]) => ask.test(text))
  if (!hit) return null
  const [, term, activity, label] = hit
  const inCity = /\b(city|nearby|near me|around here|local|new york|nyc|brooklyn)\b/.test(text)
  const said = (p: Person) => [p.story, ...p.tags, ...openTodos(p).map((t) => t.text)].some((x) => term.test(norm(x)))
  const matches = people
    .filter((p) => said(p) && (!inCity || near(p)))
    // People who said they want a buddy first, then whoever you talked to most recently
    .sort((a, b) => Number(!!wants(b, term)) - Number(!!wants(a, term)) || b.lastContacted.localeCompare(a.lastContacted))
    .map((person): Match => {
      const first = firstName(person.name)
      const why = wants(person, term) ?? sentence(person.story, term) ?? `Into ${activity}`
      const hook = wants(person, term) ? `you said you were looking for a ${label}` : `you mentioned getting into ${activity}`
      return {
        person,
        why,
        say: wants(person, term) ? `“Still up for ${activity}? I’m in.”` : `Ask how the ${activity} is going, then invite them along.`,
        action: { kind: 'message', label: 'Draft a message', to: person.name, draft: `Hey ${first}! Last time ${hook}. Want to go ${activity} this week?` },
      }
    })
  const where = inCity ? ' in the city' : ''
  return { kind: 'people', title: matches.length ? `${matches.length} ${matches.length === 1 ? 'person' : 'people'} for ${activity}${where}` : `No one into ${activity}${where} yet`, matches }
}

// Something they said about wanting a buddy (from their notes or to-dos), if any.
function wants(p: Person, term: RegExp): string | undefined {
  return [...openTodos(p).map((t) => t.text), ...p.story.split(/(?<=\.)\s+/)].find((x) => term.test(norm(x)) && /buddy|partner|someone/.test(norm(x)))?.replace(/\.$/, '')
}

const cityAliases: [RegExp, string[], string][] = [
  [/\b(sf|san francisco|bay area|the bay)\b/, ['san francisco', 'oakland', 'berkeley'], 'the Bay Area'],
  [/\b(la|los angeles)\b/, ['los angeles'], 'Los Angeles'],
  [/\b(london)\b/, ['london'], 'London'],
  [/\b(austin)\b/, ['austin'], 'Austin'],
  [/\b(toronto)\b/, ['toronto'], 'Toronto'],
  [/\b(tokyo)\b/, ['tokyo'], 'Tokyo'],
  [/\b(boston)\b/, ['boston'], 'Boston'],
  [/\b(berlin)\b/, ['berlin'], 'Berlin'],
  [/\b(paris)\b/, ['paris'], 'Paris'],
]

// "I'm traveling to SF next month. Who can I grab a coffee with?"
function trip(text: string, people: Person[]): AskResult | null {
  if (!/\b(travel|traveling|travelling|trip|visiting|heading|going|flying|in town|next (week|month))\b/.test(text)) return null
  const hit = cityAliases.find(([re]) => re.test(text))
  if (!hit) return null
  const [, cities, area] = hit
  const there = people.filter((p) => cities.some((c) => norm(p.livesNow.city).includes(c)))
  // Who you owe something to, who you're overdue with
  const promisedBy = (p: Person) => people.find((o) => o.id !== p.id && openTodos(o).some((t) => norm(t.text).includes(norm(firstName(p.name)))))
  const matches = there
    .sort((a, b) => Number(!!promisedBy(b)) - Number(!!promisedBy(a)) || a.lastContacted.localeCompare(b.lastContacted))
    .map((person): Match => {
      const first = firstName(person.name)
      const owed = promisedBy(person)
      const last = `last talked ${timeSince(person.lastContacted).toLowerCase()}`
      const why = `${person.profession} · ${person.livesNow.city.split(',')[0]} · ${last}`
      const say = owed
        ? `Bring up ${firstName(owed.name)}: you promised them an intro to ${first}.`
        : overdue(person)
          ? `It’s been a while. Ask about ${sentence(person.story, /./)?.toLowerCase() ?? person.tags[0]}.`
          : `Ask about ${person.tags[0]}.`
      const todo = owed ? openTodos(owed).find((t) => norm(t.text).includes(norm(first))) : undefined
      return {
        person,
        why,
        say,
        via: owed ? `${firstName(owed.name)}’s follow-up` : overdue(person) ? 'Overdue to catch up' : undefined,
        action: {
          kind: 'coffee',
          label: 'Plan coffee',
          to: person.name,
          draft: `Hi ${first}! I’m in ${area === 'the Bay Area' ? 'SF' : area} next month and would love to grab a coffee.${owed ? ` I also want to introduce you to ${owed.name}, who I think you’d get along with.` : ''} Any morning free?`,
          closes: owed && todo ? { personId: owed.id, todoId: todo.id } : undefined,
        },
      }
    })
  return { kind: 'people', title: matches.length ? `${matches.length} ${matches.length === 1 ? 'person' : 'people'} in ${area}` : `No one in ${area} yet`, matches }
}

// "I just met a founder looking for a hardware engineer. Who can I introduce?"
function intro(text: string, people: Person[]): AskResult | null {
  if (!/\b(introduce|intro|connect|refer)\b/.test(text)) return null
  const role = text.match(/\b(?:looking for|needs?|hiring|wants?|searching for) (?:an? )?([a-z ]+?)(?: who| that| can|$| i | what)/)?.[1]?.trim()
  if (!role) return null
  const words = role.split(' ').filter((w) => !filler.has(w))
  const key = words.find((w) => !/^(engineer|designer|person|someone|developer|expert)$/.test(w)) ?? words[0]
  if (!key) return null
  const has = (p: Person, w: string) => [p.profession, ...p.tags].some((x) => norm(x).includes(w))
  // The person asking: someone with an open intro to-do that mentions the role, most recently met first
  const asker = people
    .filter((p) => openTodos(p).some((t) => /intro/.test(norm(t.text)) && norm(t.text).includes(key)))
    .sort((a, b) => b.lastContacted.localeCompare(a.lastContacted))[0]
  const askerTodo = asker ? openTodos(asker).find((t) => /intro/.test(norm(t.text)) && norm(t.text).includes(key)) : undefined
  const direct = people.filter((p) => p.id !== asker?.id && words.every((w) => has(p, w) || norm(p.story).includes(w)))
  const connectors = people.filter((p) => p.id !== asker?.id && !direct.includes(p) && norm(p.story).includes(key))
  const founder = asker ? asker.name : 'the founder'
  const blurb = asker ? sentence(asker.story, /./) ?? asker.profession : ''
  const toMatch = (person: Person, viaWhy?: string): Match => {
    const first = firstName(person.name)
    const keen = sentence(person.story, /advise|mentor|help|looking|open to/)
    return viaWhy
      ? {
          person,
          why: viaWhy,
          via: 'Can connect you',
          say: `Ask who on their team or portfolio does ${key}.`,
          action: { kind: 'message', label: `Ask ${first}`, to: person.name, draft: `Hi ${first}! I just met ${founder}, who’s looking for a ${role}. Anyone you’d recommend?` },
        }
      : {
          person,
          why: [person.profession, keen].filter(Boolean).join(' · '),
          say: keen ? `They said they ${keen.replace(/^wants/i, 'want').toLowerCase()}.` : `Ask if they’d be open to a chat.`,
          action: {
            kind: 'intro',
            label: 'Draft intro',
            to: asker ? `${person.name} and ${asker.name}` : person.name,
            draft: `Hi ${first}, meet ${founder}.${blurb ? ` ${blurb}.` : ''} They’re looking for a ${role}.${keen ? ` You mentioned you ${keen.replace(/^wants/i, 'want').toLowerCase()}, so I thought of you two.` : ''}`,
            closes: asker && askerTodo ? { personId: asker.id, todoId: askerTodo.id } : undefined,
          },
        }
  }
  const groups = [
    { label: 'You know directly', matches: direct.map((p) => toMatch(p)) },
    { label: 'One step away', matches: connectors.map((p) => toMatch(p, sentence(p.story, new RegExp(key)) ?? p.profession)) },
  ].filter((g) => g.matches.length)
  const matches = groups.flatMap((g) => g.matches)
  return { kind: 'people', title: matches.length ? `Who could help with a ${role}` : `No ${role} in your people yet`, matches, groups }
}
