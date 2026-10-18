import type { Context, Moment, Person, Place } from '../data/people'

// Voice capture is a scripted demo: tapping the mic "hears" these lines word by word, and each line
// fills in a prompt when it finishes. Typing a note instead fills the same prompts by simple parsing.

export type PersonField = 'name' | 'met' | 'does' | 'knows' | 'remember' | 'follow'
export type MomentField = 'what' | 'learned' | 'follow'
export type Field = PersonField | MomentField

// What capture has understood so far. `context`, `from`, `lives` and `knowsIds` fill silently (no prompt).
export type Draft = Partial<Record<Field, string>> & {
  context?: Context
  from?: string
  lives?: string
  knowsIds?: string[]
}

export type Line = { text: string; set: Draft }

export const personPrompts: [PersonField, string][] = [
  ['name', 'Their name'],
  ['met', 'Where and how you met'],
  ['does', 'What they do'],
  ['knows', 'Anyone you both know'],
  ['remember', 'One thing to remember'],
  ['follow', 'Anything to follow up on'],
]

export const momentPrompts: [MomentField, string][] = [
  ['what', 'What happened'],
  ['learned', 'Something new about them'],
  ['follow', 'Anything to follow up on'],
]

export const personScript: Line[] = [
  { text: 'Just met Jordan Lee at Climate Demo Day.', set: { name: 'Jordan Lee', met: 'Climate Demo Day', context: 'work' } },
  { text: 'Founder, they do battery recycling for e-bikes.', set: { does: 'Founder, e-bike batteries' } },
  { text: 'Aisha Khan introduced us.', set: { knows: 'Aisha Khan', knowsIds: ['aisha-khan'] } },
  { text: 'Grew up in Seattle, just moved to Brooklyn.', set: { from: 'Seattle', lives: 'Brooklyn' } },
  { text: 'Climbs on Tuesdays and wants a climbing buddy.', set: { remember: 'Climbs Tuesdays, wants a climbing buddy' } },
  { text: 'Asked me for an intro to someone in hardware.', set: { follow: 'Intro to someone in hardware' } },
]

export function momentScript(first: string): Line[] {
  return [
    { text: `Grabbed coffee with ${first} near Union Square.`, set: { what: 'Coffee near Union Square' } },
    { text: 'They just closed their pre-seed round.', set: { learned: 'Closed their pre-seed round' } },
    { text: 'I should intro them to Priya for battery data.', set: { follow: 'Intro to Priya for battery data' } },
  ]
}

// The demo person's story and tags, as if summarized from the voice note.
const scriptedStory =
  'Building battery recycling for e-bikes. Grew up in Seattle, just moved to Brooklyn. Climbs Tuesdays and wants a climbing buddy.'
const scriptedTags = ['climate tech', 'founder', 'climbing', 'e-bikes']

export const typedExample =
  'Jordan Lee, met at Demo Day. Founder at [Startup], battery recycling for e-bikes. Knows Aisha. From Seattle, lives in Brooklyn now. Climbs Tuesdays. Owe them a hardware intro.'

export const typedMomentExample = 'Grabbed coffee near Union Square. They closed their round. Intro them to Priya.'

const cut = (v: string) => (v.length <= 44 ? v : v.slice(0, 44).replace(/\s+\S*$/, '') + '…')

// Pulls prompt answers out of a typed note about someone new. `people` is used to spot mutuals by name.
export function parsePerson(text: string, people: Person[]): Draft {
  const out: Draft = {}
  const t = text.trim()
  if (!t) return out
  const name =
    t.match(/\b(?:[Mm]et|[Mm]eet|[Mm]eeting)\s+([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)/) ??
    t.match(/^(?!(?:Just|Met|I|Today|We)\b)([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)/)
  if (name) out.name = name[1]
  const firstSentence = t.split(/[.!?]/)[0]
  const met =
    t.match(/\bat ([A-Z][^.,]+)/) ??
    t.match(/met (?:at|in|through|during) ([^.,]+)/i) ??
    firstSentence.match(/\bat (?:an? |the )?([^.,]+)/i)
  if (met) out.met = met[1].trim()
  const does = t.match(/\b(founder|co-?founder|engineer|designer|investor|student|researcher|artist|writer|recruiter|PM|manager)\b[^.,]*/i)
  if (does) out.does = cut(does[0].trim())
  const rem = t.match(/\b(climbs?|loves?|likes?|plays?|runs?|has an?|collects?|training)\b[^.,]*/i)
  if (rem) out.remember = cut(rem[0].trim())
  const fol = t.match(/\b(owe|intro|follow up|send|asked me|ask about)\b[^.]*/i)
  if (fol) out.follow = cut(fol[0].trim())
  const from = t.match(/\b[Ff]rom ([A-Z][a-z]+(?: [A-Z][a-z]+)?)(?!'s)/)
  if (from) out.from = from[1]
  const lives = t.match(/lives? in ([A-Z][a-z]+(?: [A-Z][a-z]+)?)/)
  if (lives) out.lives = lives[1]

  // Mutuals: anyone already in your people whose full or first name appears (not the new person).
  const newFirst = out.name?.split(' ')[0]
  const mutuals = people.filter((p) => {
    const first = p.name.split(' ')[0]
    if (first === newFirst) return false
    return t.includes(p.name) || new RegExp(`\\b${first}\\b`).test(t)
  })
  if (mutuals.length) {
    out.knowsIds = mutuals.map((p) => p.id)
    out.knows = mutuals.map((p) => p.name).join(', ')
  }

  const m = `${out.met ?? ''} ${t}`
  out.context = /demo day|conference|summit|office|work|pitch|founders?|climate week|config/i.test(m)
    ? 'work'
    : /party|dinner|bar|friend/i.test(m)
      ? 'social'
      : /class|club|school|meetup|crit|church|gym/i.test(m)
        ? 'community'
        : /family|cousin|mom|dad|sister|brother|aunt|uncle/i.test(m)
          ? 'family'
          : 'unsorted'
  return out
}

// A typed moment: first sentence is what happened, a sentence with an action word is the follow-up,
// and the next other sentence is something new.
export function parseMoment(text: string): Draft {
  const out: Draft = {}
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim().replace(/[.!?]$/, ''))
    .filter(Boolean)
  if (sentences[0]) out.what = cut(sentences[0])
  const follow = sentences.slice(1).find((x) => /\b(intro|send|follow up|remind|ask|owe)\b/i.test(x))
  if (follow) out.follow = cut(follow)
  const learned = sentences.slice(1).find((x) => x !== follow)
  if (learned) out.learned = cut(learned)
  return out
}

// Rough coordinates for the places capture knows about. Anything else lands in New York.
const places: Record<string, [number, number]> = {
  seattle: [47.606, -122.332],
  brooklyn: [40.678, -73.944],
  manhattan: [40.776, -73.971],
  queens: [40.728, -73.794],
  'new york': [40.713, -74.006],
  'jersey city': [40.718, -74.043],
  boston: [42.36, -71.059],
  'san francisco': [37.775, -122.419],
  'los angeles': [34.052, -118.244],
  chicago: [41.878, -87.63],
  austin: [30.267, -97.743],
  toronto: [43.653, -79.383],
  london: [51.507, -0.128],
  paris: [48.857, 2.352],
  berlin: [52.52, 13.405],
  tokyo: [35.676, 139.65],
  seoul: [37.567, 126.978],
  shanghai: [31.23, 121.474],
  taipei: [25.033, 121.565],
}

function place(name: string | undefined, fallback: string): Place {
  const city = name?.trim() || fallback
  const [lat, lng] = places[city.toLowerCase()] ?? places['new york']
  return { city, lat, lng }
}

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'person'
  )
}

// "Loves pottery" -> "pottery"; "Climbs Tuesdays" -> "climbs".
function interest(remember?: string) {
  const words = remember?.toLowerCase().split(/\s+/) ?? []
  return /^(loves?|likes?|plays?|collects?|has|into)$/.test(words[0] ?? '') ? words[1] : words[0]
}

const today = () => new Date().toISOString().slice(0, 10)
const uid = () => Math.random().toString(36).slice(2, 8)

// Turns a finished capture into a new person.
export function draftToPerson(draft: Draft, how: { voice: boolean; text: string; seconds: number }, taken: Set<string>): Person {
  const name = draft.name?.trim() || 'New person'
  let id = slug(name)
  while (taken.has(id)) id = `${slug(name)}-${uid()}`
  const story = how.voice ? scriptedStory : how.text.trim()
  const tags = how.voice
    ? scriptedTags
    : [draft.does?.split(/[ ,]/)[0].toLowerCase(), interest(draft.remember)].filter((x): x is string => !!x)
  const todos = [draft.follow, draft.remember].filter((x): x is string => !!x).map((text) => ({ id: uid(), text, done: false }))
  return {
    id,
    name,
    context: draft.context ?? 'unsorted',
    profession: how.voice ? 'Founder @ [Startup]' : (draft.does ?? '').split(/,| at /)[0] || 'Unknown',
    story,
    tags: tags.length ? tags : ['new'],
    from: place(draft.from, 'Unknown'),
    met: { ...place(undefined, 'New York'), context: draft.met ?? 'Somewhere' },
    livesNow: place(draft.lives, 'Unknown'),
    lastContacted: today(),
    knows: draft.knowsIds ?? [],
    closeness: 1,
    todos,
    moments: [
      {
        id: uid(),
        date: today(),
        firstMeeting: true,
        title: how.voice ? `Voice note · ${formatTime(how.seconds)}` : 'Typed note',
        transcript: how.text.trim(),
        seconds: how.voice ? how.seconds : undefined,
      },
    ],
  }
}

// Turns a finished capture into a moment, plus the follow-up for "things to talk about".
export function draftToMoment(draft: Draft, how: { voice: boolean; text: string; seconds: number }): Moment {
  return {
    id: uid(),
    date: today(),
    title: draft.what ?? 'New moment',
    text: draft.learned ? `${draft.what}. ${draft.learned}.` : undefined,
    transcript: how.text.trim(),
    seconds: how.voice ? how.seconds : undefined,
  }
}

export function newTodo(text: string) {
  return { id: uid(), text, done: false }
}

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
