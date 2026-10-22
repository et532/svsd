import type { Context, LifeStage } from '../../data/people'
import { filler, related } from '../ask'
import { homePlace, resolvePlace, type PlaceRec } from '../places'

// A question -> what has to be true (hard) and what only makes someone a better fit (soft). Rules and the
// gazetteer, no LLM. The key rule: an in-person plan makes where you live a hard gate; asking who knows about
// something, or for an introduction, does not.

export type Weights = Partial<Record<Context, number>>

type Activity = { id: string; label: string; re: RegExp; contexts: Weights; theme?: string[] }

const PARTY: Weights = { social: 1, community: 0.7, family: 0.4, work: 0.3 }
const ANYONE: Weights = { social: 1, community: 0.8, work: 0.8, family: 0.5 }
const FRIENDS: Weights = { social: 1, community: 0.9, work: 0.4, family: 0.3 }

// Order matters: the first one that reads in the question wins ("house party" before "party").
const activities: Activity[] = [
  { id: 'house-party', label: 'a house party', re: /\b(house ?party|housewarming|house warming|birthday party|party)\b/, contexts: PARTY },
  { id: 'dinner', label: 'dinner', re: /\b(dinner|supper|brunch|lunch)\b/, contexts: { ...PARTY, family: 0.6 } },
  { id: 'drinks', label: 'drinks', re: /\b(drinks?|happy hour|beers?|cocktails?)\b/, contexts: PARTY },
  { id: 'coffee', label: 'coffee', re: /\b(coffee|cafe)\b/, contexts: ANYONE },
  { id: 'game-night', label: 'a game night', re: /\bgame night\b/, contexts: PARTY, theme: ['games'] },
  { id: 'climbing', label: 'climbing', re: /\b(climb|climbing|boulder|bouldering)\b/, contexts: FRIENDS, theme: ['climbing', 'bouldering'] },
  { id: 'running', label: 'a run', re: /\b(run|running|jog|jogging)\b/, contexts: FRIENDS, theme: ['running', 'run club', 'marathon'] },
  { id: 'hiking', label: 'a hike', re: /\b(hike|hiking)\b/, contexts: FRIENDS, theme: ['hiking'] },
  { id: 'pickleball', label: 'pickleball', re: /\b(pickleball|tennis|padel)\b/, contexts: FRIENDS, theme: ['pickleball', 'tennis'] },
  { id: 'workout', label: 'a workout', re: /\b(workout|gym|yoga|pilates)\b/, contexts: FRIENDS, theme: ['fitness'] },
  { id: 'concert', label: 'a concert', re: /\b(concert|gig|live music)\b/, contexts: PARTY, theme: ['music'] },
  { id: 'museum', label: 'a gallery', re: /\b(museum|gallery|exhibit|exhibition)\b/, contexts: FRIENDS, theme: ['art'] },
  { id: 'movie', label: 'a movie', re: /\b(movie|movies|cinema|film screening)\b/, contexts: FRIENDS, theme: ['film'] },
]

// How you know them, when the question says so ("friends", "family", "coworkers").
const relations: [RegExp, Weights][] = [
  [/\b(family|relatives?|cousins?|siblings?)\b/, { family: 1 }],
  [/\b(coworkers?|colleagues?|co-workers?|professional)\b/, { work: 1 }],
  [/\b(friends?|social)\b/, { social: 1, community: 0.6 }],
  [/\b(community|neighbou?rs?)\b/, { community: 1 }],
]

// Where in your life they come from ("college friends who moved to New York").
const stages: [RegExp, LifeStage][] = [
  [/\bcollege\b/, 'college'],
  [/\bhigh ?school\b/, 'high-school'],
  [/\b(hometown|grew up with|childhood)\b/, 'hometown'],
  [/\b(first job|chicago job|old job)\b/, 'first-job'],
]

// Words about how the question is phrased, not what it is about.
const askWords = new Set(
  (
    'themed theme vibe invite inviting host hosting over around near nearby moved move moving fun cool good great nice best ' +
    'next month week weekend tonight tomorrow soon free thing things kind sort type totally really maybe ask grab hang come ' +
    'talk talking speak chat right now currently mine ours join along how night evening afternoon morning day time quiet chill relaxed easy casual cozy lively small big birthday anniversary celebration holiday'
  ).split(' '),
)

export type Constraints = {
  text: string
  intent: 'plan' | 'knowledge' | 'find'
  activity?: Activity
  // The place that gates the results. `named` is true when the question said it; otherwise it is home.
  place?: PlaceRec
  named: boolean
  stage?: LifeStage
  contexts: Weights // how well each way of knowing someone fits (empty = no preference)
  theme: string[] // words to look for in what you know about them (empty = a plain social plan)
  groups: string[][] // exact-match terms: every group has to be mentioned (any synonym in a group will do)
  metAt?: string // "people I met at Climate Week": where you met them is a filter, not a topic
  embedText: string // what to embed for meaning (empty = nothing to search by meaning)
  explain: string[] // what was understood, for the answer's first line
}

export function parseQuery(input: string): Constraints {
  const clean = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[?.!;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  let rest = ` ${clean} `
  const explain: string[] = []

  const found = resolvePlace(clean)
  if (found) rest = ` ${found.rest} `

  // "met at Supper club": where you met them is a filter, not a topic (and not a dinner plan)
  const metAt = rest.match(/\bmet (?:at|through|via|in)\s+(?:the\s+)?(.+?)\s*$/)?.[1]
  if (metAt) rest = rest.replace(/\bmet (?:at|through|via|in)\s+(?:the\s+)?.+$/, ' ')

  // "who knows about coffee" is a topic, not a coffee date
  const topicOnly = /\b(who knows|knows about|know (about|anything|how)|expert|good at|help (me )?with|advice|teach)\b/.test(clean)
  const activity = topicOnly ? undefined : activities.find((a) => a.re.test(rest))
  if (activity) rest = rest.replace(activity.re, ' ')

  const stage = stages.find(([re]) => re.test(rest))?.[1]
  if (stage) rest = rest.replace(stages.find(([re]) => re.test(rest))![0], ' ')

  let contexts: Weights = activity?.contexts ?? {}
  for (const [re, w] of relations)
    if (re.test(rest)) {
      contexts = w
      rest = rest.replace(re, ' ')
      break
    }

  const plan = !!activity || /\b(invite|hang out|hang with|come over|join me|go out with|meet ?up|catch up with)\b/.test(clean)
  const knowledge = !plan && /\b(who knows|knows about|know (about|anything|how)|expert|good at|help (me )?with|does my|advice|teach)\b/.test(clean)
  const intent: Constraints['intent'] = plan ? 'plan' : knowledge ? 'knowledge' : 'find'

  const words = rest
    .split(/[\s/]+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ''))
    .filter((w) => w.length > 2 && !filler.has(w) && !askWords.has(w) && !/^(for|the|who|how|that|this|than|then|there|not|any|but)$/.test(w))
  const theme = [...new Set([...(activity?.theme ?? []), ...words])]

  // Synonyms ("fashion" -> style, stylist, vintage…) so a stylist counts even if nobody wrote "fashion". The
  // activity's own words are alternatives ("pickleball" or "tennis"); the words the person added all have to appear.
  const expand = (w: string) => {
    const stem = w.replace(/(ers|ing|ies|es|s)$/, '')
    return related[w] ?? [w, stem.length >= 4 ? stem : w]
  }
  // "a plumber or handyman": words joined by "or" are alternatives, not all required
  const wanted = / or /.test(rest) ? [words.flatMap(expand)] : words.map(expand)
  const groups = [...(activity?.theme ? [activity.theme.flatMap(expand)] : []), ...wanted].map((g) => [...new Set(g)])

  // In-person plans are gated to a place: the one named, or home. Knowledge and introductions are not, unless a place is named.
  const place = found?.place ?? (intent === 'plan' ? homePlace() : undefined)
  if (place) explain.push(found ? `in ${place.name}` : `near home (${place.name})`)
  if (activity) explain.push(activity.label)
  if (theme.length) explain.push(`about ${theme.join(', ')}`)
  if (stage) explain.push(`from ${stage.replace('-', ' ')}`)
  if (metAt) explain.push(`met at ${metAt}`)

  const synonyms = theme.flatMap((w) => related[w] ?? []).filter((t) => !theme.includes(t))
  const embedText = theme.length ? [...theme, ...synonyms.slice(0, 5)].join(', ') : ''
  return { text: input, intent, activity, place, named: !!found, stage, metAt, contexts, theme, groups, embedText, explain }
}
