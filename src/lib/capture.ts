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
  // Something they want to do ("wants to train for a half marathon"), kept as a thing to bring up
  goal?: string
}

// The company in "Founder at Voltcell" / "works for Acme Labs" (a capitalized name after a role and at / @ / for).
const ROLES = 'founder co-?founder engineer designer investor researcher manager recruiter chef architect developer teacher nurse doctor lawyer consultant analyst scientist director editor producer photographer musician artist writer coach professor barista baker pilot plumber electrician carpenter accountant therapist illustrator journalist filmmaker translator interpreter dentist entrepreneur pharmacist'
  .split(' ')
  .map((r) => `[${r[0].toUpperCase()}${r[0]}]${r.slice(1)}s?`)
  .join('|')
const COMPANY = new RegExp(`\\b(?:${ROLES}|CEO|CTO|PM|[Ww]orks?|[Ww]orking)\\s+(?:at|@|for)\\s+(?:the\\s+)?([A-Z][\\w&'-]*(?:\\s+[A-Z][\\w&'-]*)*)`)

export function parseCompany(text: string): string | undefined {
  return text.match(COMPANY)?.[1]
}

// The university or college in a note: "University of Michigan", "Vanderbilt University", or a capitalized name
// after "studied at / graduated from / went to" ("studied at MIT").
export function parseSchool(text: string): string | undefined {
  const cap = "[A-Z][\\w&'-]*"
  return (
    text.match(new RegExp(`\\b((?:${cap}\\s+){0,2}(?:University|College|Institute)(?:\\s+of\\s+${cap}(?:\\s+${cap})*)?)`))?.[1] ??
    text.match(
      new RegExp(
        `\\b(?:[Ss]tudied|[Ss]tudies|[Ss]tudying|[Gg]raduated|[Gg]raduate|[Gg]rad|[Aa]ttended|[Aa]ttends|[Aa]ttending|[Aa]lum(?:ni|nus)?|[Ss]tudent)\\s+(?:at|from|of)\\s+(${cap}(?:\\s+${cap})*)`,
      ),
    )?.[1]
  )
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

// "met Sam", "bumped into Sam", "ran into Sam": how a note says who the person is
const MEET = '[Mm]et|[Mm]eet|[Mm]eeting|[Bb]umped into|[Rr]an into|[Rr]an across|[Cc]ame across|[Ii]ntroduced to|[Tt]alked to|[Cc]hatted with|[Ss]poke (?:to|with)|[Ww]ith(?: my \\w+)?|[Nn]ext to|(?:[Nn]amed|[Cc]alled)'
// One or two capitalized words, letters from any language ("Tomás", "Zoë"), after an optional title ("Dr. ")
const TITLE = '(?:(?:Dr|Mr|Mrs|Ms|Prof)\\.?\\s+)?'
const PERSON = `${TITLE}(\\p{Lu}[\\p{L}'-]+(?:\\s+\\p{Lu}[\\p{L}'-]+){0,2})`
const TIME = /\s+(?:last (?:night|week|weekend|month)|yesterday|today|this (?:morning|week|weekend)|tonight)$/i
const INTO = "(?:is|are|she's|he's|they're|super|really|very|so|also) into|(?<=(?:^|[.!?])\\s*)into|obsessed with|passionate about|a big fan of"

// Where someone is from / lives now ("from Cork", "grew up in Austin", "lives in Brooklyn", "now in Queens"): the Add
// box outlines these too, so a misheard city can be fixed like a name
// One or two capitalized words, letters from any alphabet ("Bogotá", "São Paulo")
const CITY = '\\p{Lu}[\\p{Ll}\\p{M}]+(?: \\p{Lu}[\\p{Ll}\\p{M}]+)?(?![\\p{L}\\p{M}])'

export function parseFrom(text: string): string | undefined {
  return text.match(new RegExp(`\\b(?:[Ff]rom|[Gg]rew up in|[Gg]rown up in|[Bb]orn in|[Rr]aised in) (${CITY})(?!'s)`, 'u'))?.[1]
}

export function parseLives(text: string): string | undefined {
  const m =
    text.match(new RegExp(`(?:lives?|based|living|works?|working|coach|designer|engineer|manager|writer|artist|chef|lawyer|doctor|nurse|teacher|architect|developer|photographer|consultant|analyst|scientist|director|editor|producer|musician|translator|dentist|entrepreneur) in (${CITY})`, 'u')) ??
    text.match(new RegExp(`\\b(?:[Nn]ow in|(?:just )?moved to|moving to) (${CITY})`, 'u'))
  return m?.[1]
}

const cut = (v: string) => (v.length <= 44 ? v : v.slice(0, 44).replace(/\s+\S*$/, '') + '…')

// What the local language model (llmParse.ts) understood from a note, by trimmed note text. It is filled in before a
// profile is made and wins over the regex below wherever it found something.
export const refined = new Map<string, Draft>()

// Pulls prompt answers out of a typed note about someone new. `people` is used to spot mutuals by name.
export function parsePerson(text: string, people: Person[]): Draft {
  const out = parseByRules(text, people)
  return { ...out, ...refined.get(text.trim()) }
}

function parseByRules(text: string, people: Person[]): Draft {
  const out: Draft = {}
  const t = text.trim()
  if (!t) return out
  const name =
    // ("met a Sally Gallagher": an article before the name is fine)
    t.match(new RegExp(`\\b(?:${MEET})\\s+(?:(?:an?|the)\\s+)?${PERSON}`, 'u')) ??
    t.match(new RegExp(`^(?!(?:Just|Met|Bumped|Ran|Came|Talked|Chatted|Spoke|Had|Went|Grabbed|Spent|Dinner|Lunch|Coffee|I|Today|We)\\b)${PERSON}`, 'u'))
  if (name) out.name = name[1]
  out.company = parseCompany(t)
  const firstSentence = t.split(/[.!?]/)[0]
  // "designer at Kiln": a capitalized name after "at" is the company, not where you met
  const notCompany = (m: RegExpMatchArray | null) => (m && out.company && m[1].startsWith(out.company) ? null : m)
  const met =
    // "met Sam Rivera at a pickleball meetup": a name between "met" and "at" must still count; a capitalized
    // place later on is only the fallback
    t.match(new RegExp(`\\b(?:${MEET}) (?:(?:an?|the) )?(?:${PERSON}\\s+)?(?:at|in|through|during|via) ([^.,]+)`, 'iu')) ??
    notCompany(t.match(/\bat ([A-Z][^.,]+)/)) ??
    firstSentence.match(/\bat (?:an? |the )?([^.,]+)/i) ??
    // "Sam from the climbing gym"
    t.match(/\bfrom (?:the |my )?([a-z][^.,]*)/) ??
    // "Went to a wedding and sat next to…"
    t.match(/\b(?:went to|attended) (?:an? |the |my )?([^.,]+?)(?= and |[.,]|$)/i)
  // the place is the last group (the name pattern inside the first regex has one of its own)
  if (met) out.met = met[met.length - 1].trim().replace(TIME, '').replace(/(?<=\S)\s+(?:through|via|who|that|where)\s+.*/i, '').replace(/^(?:an?|the)\s+(?:friend's\s+)?/i, '')
  const does = t.match(/\b((?:(?:product|project|program|engineering|marketing|operations|account|sales|general) manager|(?:software|hardware|mechanical|electrical|data|machine learning|research) (?:engineer|scientist)|(?:(?!an?\b|the\b)[a-z]+ )?(?:architect|chef|teacher|nurse|doctor|lawyer|developer|musician|photographer|filmmaker|professor|consultant|analyst|scientist|director|editor|producer|journalist|therapist|illustrator|accountant|barista|baker|carpenter|plumber|electrician|pilot|translator|interpreter|dentist|entrepreneur|pharmacist)|founder|co-?founder|engineer|designer|investor|student|researcher|artist|writer|recruiter|PM|manager|climbing coach|coach(?:es)?)\b)[^.,]*/i)
  // "barista at Blue Bottle and a big fan of jazz": only the job
  if (does) out.does = cut(does[0].split(/\s+and\s+/)[0].trim())
  else if (/\bteach(?:es|ing)\b/i.test(t)) out.does = 'teacher'
  // "coaches tennis in Miami" -> "tennis coach"
  out.does = out.does?.replace(/^coaches\s+(\w+)\b.*/i, '$1 coach')
  const rem = t.match(new RegExp(`\\b(${INTO}|climbs?|loves?|likes?|enjoys?|plays?|runs(?! club)|has an?|collects?|training)\\b[^.,]*`, 'i'))
  // Only the one thing they like: "loves trail running and wants to train…" stops before "and"
  if (rem) out.remember = cut(rem[0].split(/\s+(?:and|but)\s+/)[0].trim())
  const goal = t.match(/\b(?:wants to|is trying to|hopes to|plans to) ([^.,]+)/i)
  if (goal) out.goal = cut(`Wants to ${goal[1].trim()}`)
  const fol = t.match(/\b(owe|intro|follow up|send|asked me|ask about)\b[^.]*/i)
  if (fol) out.follow = cut(fol[0].trim())
  out.from = parseFrom(t)
  out.lives = parseLives(t)

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
  // "super into ceramics" / "obsessed with ceramics" read as "loves ceramics"
  const words = remember?.toLowerCase().replace(new RegExp(`^(?:${INTO})\\b`), 'loves').split(/\s+/) ?? []
  if (!/^(loves?|likes?|enjoys?|plays?|collects?|has|into)$/.test(words[0] ?? '')) return words[0]
  // "loves trail running on weekends" -> "trail running"
  const rest = words.slice(1).filter((w) => !/^(an?|the|my|every)$/.test(w))
  const end = rest.findIndex((w) => /^(on|at|in|and|to|with|every|for)$/.test(w))
  return rest.slice(0, end < 0 ? 2 : Math.min(end, 2)).join(' ') || undefined
}

// The activity in a place you met ("pickleball meetup" -> "pickleball", "run club" -> "run").
function activity(met?: string) {
  const w = met?.match(/^(.*?)\s+(?:meetups?|clubs?|class(?:es)?|leagues?|groups?|tournaments?|teams?|sessions?|workshops?)\b/i)?.[1]
  const word = w?.split(/\s+/).slice(-1)[0]?.toLowerCase().replace(/[^a-z-]/g, '')
  return word === 'run' ? 'running' : word || undefined
}

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const uid = () => Math.random().toString(36).slice(2, 8)

// "Designer @ Kiln" from "designer at Kiln"; just the role when there is no company.
const roleOf = (draft: Draft) => (draft.does ?? '').split(/,| at | in /)[0].trim() || undefined

function professionOf(draft: Draft) {
  const role = roleOf(draft)
  if (!role) return 'Unknown'
  const title = role[0].toUpperCase() + role.slice(1)
  return draft.company ? `${title} @ ${draft.company}` : title
}

// The to-dos of a new profile, each said once: a follow-up and a goal that are the same sentence ("catch up and grab
// coffee" / "Wants to catch up and grab coffee") become one, and each starts with a capital.
export function dedupeTodos(texts: (string | undefined)[]): string[] {
  const key = (t: string) =>
    t
      .toLowerCase()
      .replace(/^(?:i\s+)?(?:wants?\s+to|should|need\s+to|to)\s+/, '')
      .replace(/[^\p{L}\p{N} ]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
  const kept: { text: string; key: string }[] = []
  for (const t of texts) {
    const text = t?.trim()
    if (!text) continue
    const k = key(text)
    if (!k || kept.some((o) => o.key.includes(k) || k.includes(o.key))) continue
    kept.push({ text: text[0].toUpperCase() + text.slice(1), key: k })
  }
  return kept.map((o) => o.text)
}

// Turns a finished capture into a new person.
export function draftToPerson(draft: Draft, how: { voice: boolean; text: string; seconds: number }, taken: Set<string>): Person {
  const name = draft.name?.trim() || 'New person'
  let id = slug(name)
  while (taken.has(id)) id = `${slug(name)}-${uid()}`
  // Only the scripted demo note gets the made-up story; anything really said or typed is kept as it is
  const demo = how.voice && how.text.includes('battery recycling')
  const story = demo ? scriptedStory : how.text.trim()
  const tags = demo
    ? scriptedTags
    : [...new Set([roleOf(draft)?.toLowerCase(), interest(draft.remember), activity(draft.met)].filter((x): x is string => !!x))]
  const todos = dedupeTodos([draft.follow, draft.goal, draft.remember]).map((text) => ({ id: uid(), text, done: false }))
  return {
    id,
    name,
    context: draft.context ?? 'unsorted',
    profession: demo ? `Founder @ ${draft.company ?? '[Startup]'}` : professionOf(draft),
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
