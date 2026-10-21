import type { Context, Moment, Person, Place } from '../data/people'

// Capture turns one typed or "spoken" note into a person or a moment by simple parsing. The voice is a scripted
// demo: the mic "hears" voiceScript (and the profile's momentScript) word by word.

export type PersonField = 'name' | 'met' | 'does' | 'knows' | 'remember' | 'follow'
export type MomentField = 'what' | 'learned' | 'follow'
export type Field = PersonField | MomentField

// What capture has understood so far. `context`, `from`, `lives` and `knowsIds` fill silently (no prompt).
export type Draft = Partial<Record<Field, string>> & {
  context?: Context
  from?: string
  lives?: string
  knowsIds?: string[]
  company?: string
}

// The company in "Founder at Voltcell" / "works for Acme Labs" (a capitalized name after a role and at / @ / for).
export function parseCompany(text: string): string | undefined {
  return text.match(
    /\b(?:[Ff]ounders?|[Cc]o-?founders?|[Ee]ngineers?|[Dd]esigners?|[Ii]nvestors?|[Rr]esearchers?|[Mm]anagers?|[Rr]ecruiters?|CEO|CTO|PM|works?|working)\s+(?:at|@|for)\s+([A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*)*)/,
  )?.[1]
}

// The demo person's story and tags, as if summarized from the voice note.
const scriptedStory =
  'Building battery recycling for e-bikes. Grew up in Seattle, just moved to Brooklyn. Climbs Tuesdays and wants a climbing buddy.'
const scriptedTags = ['climate tech', 'founder', 'climbing', 'e-bikes']

export const voiceScript =
  'Jorden Lee, met at Demo Day. Founder at Voltsel, battery recycling for e-bikes. From Seattle, lives in Brooklyn now. Climbs Tuesdays. Owe them a hardware intro.'

export const momentScript = (first: string) =>
  `Came across ${first} on my way home and he said how much he hates his job search and that the job market is cooked. He hates his current job and wants out`

// A note about someone you already know (rather than someone new): "caught up with Jordan over coffee".
const momentWords = /\b(caught up|catch up|grabbed|hung out|hang out|talked|chatted|ran into|bumped into|saw|had (?:coffee|lunch|dinner)|over coffee)\b/i

// Who a note is about, when it reads like a moment: everyone whose first (or full) name appears in it.
// [] means it reads as someone new. Several (two Jordans) means the user has to pick.
export function momentCandidates(text: string, people: Person[]): Person[] {
  if (!momentWords.test(text)) return []
  return people.filter((p) => text.includes(p.name) || new RegExp(`\\b${p.name.split(' ')[0]}\\b`).test(text))
}

// A note about several new people: "Dinner with Maya Chen and Theo Park. Maya is a designer at Kiln. Theo coaches
// climbing." The people are listed after with / met (two or more names).
const NAME = "[A-Z][\\w'-]+(?:\\s+[A-Z][\\w'-]+)?"
const LIST = new RegExp(`\\b(?:[Ww]ith|[Mm]et|[Mm]eet|[Mm]eeting)\\s+(${NAME}(?:\\s*(?:,|and|&)\\s*${NAME})+)`)

export type PersonNote = { name: string; text: string }

// One note per person: the sentences that name them, the ones that name nobody, and how you met ("Met at dinner.").
// [] when the note is about one person or none.
export function splitPeople(text: string): PersonNote[] {
  const list = text.match(LIST)
  if (!list) return []
  const names = list[1]
    .split(/\s*(?:,|and|&)\s*/)
    .map((n) => n.trim())
    .filter(Boolean)
  if (names.length < 2) return []
  const sentences = text.trim().split(/(?<=[.!?])\s+/)
  const at = sentences.findIndex((x) => LIST.test(x))
  const intro = sentences[at]
  const im = intro.match(LIST)!
  const before = intro.slice(0, im.index).trim()
  const after = intro.slice((im.index ?? 0) + im[0].length).replace(/[.!?]/g, '').trim()
  const named = (x: string, n: string) => new RegExp(`\\b${n.split(' ')[0]}\\b`).test(x)
  return names.map((name) => {
    // "Dinner with Maya Chen and Theo Park." -> "Met at dinner."; otherwise the same sentence with just this person
    const how = !after && /^\w+$/.test(before) ? `Met at ${before.toLowerCase()}.` : intro.replace(im[1], name)
    const own = sentences.filter((x, i) => i !== at && (!names.some((n) => named(x, n)) || named(x, name)))
    return { name, text: [`${name}.`, how, ...own].join(' ') }
  })
}

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
  out.company = parseCompany(t)
  const firstSentence = t.split(/[.!?]/)[0]
  const met =
    t.match(/met (?:at|in|through|during) ([^.,]+)/i) ??
    t.match(/\bat ([A-Z][^.,]+)/) ??
    firstSentence.match(/\bat (?:an? |the )?([^.,]+)/i)
  if (met) out.met = met[1].trim()
  const does = t.match(/\b(founder|co-?founder|engineer|designer|investor|student|researcher|artist|writer|recruiter|PM|manager|climbing coach|coach)\b[^.,]*/i)
  if (does) out.does = cut(does[0].trim())
  const rem = t.match(/\b(climbs?|loves?|likes?|plays?|runs?|has an?|collects?|training)\b[^.,]*/i)
  if (rem) out.remember = cut(rem[0].trim())
  const fol = t.match(/\b(owe|intro|follow up|send|asked me|ask about)\b[^.]*/i)
  if (fol) out.follow = cut(fol[0].trim())
  const from = t.match(/\b[Ff]rom ([A-Z][a-z]+(?: [A-Z][a-z]+)?)(?!'s)/)
  if (from) out.from = from[1]
  const lives = t.match(/(?:lives?|based|living|works?|working|coach|designer|engineer|manager|writer|artist) in ([A-Z][a-z]+(?: [A-Z][a-z]+)?)/)
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

// "Designer @ Kiln" from "designer at Kiln"; just the role when there is no company.
function professionOf(draft: Draft) {
  const role = (draft.does ?? '').split(/,| at | in /)[0].trim()
  if (!role) return 'Unknown'
  const title = role[0].toUpperCase() + role.slice(1)
  return draft.company ? `${title} @ ${draft.company}` : title
}

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
    profession: how.voice ? `Founder @ ${draft.company ?? '[Startup]'}` : professionOf(draft),
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
        title: draft.met ? `Met at ${draft.met}` : 'First meeting',
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
