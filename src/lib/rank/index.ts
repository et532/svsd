import type { Person } from '../../data/people'
import { chunksOf } from '../chunks'
import type { Match } from '../ask'
import { firstName, timeSince } from '../people'
import { hierarchyFit, placeChip, placeOfPerson } from '../places'
import type { Constraints } from '../query'

// Turns a question's constraints and what the search found into ranked, explained people. Pure: no model, no
// network, so it is testable. A "hit" is the best-matching piece of what you know about one person.
//
// Score = 0.40 theme + 0.20 relationshipFit + 0.15 proximity + 0.10 evidence + 0.10 warmth + 0.05 graph.
// A feature the question doesn't use (no place, no theme, no kind of relationship) is dropped and the rest are
// rescaled, so "who knows about taxes" isn't punished for having no neighborhood. These weights are the only copy:
// the SQL (search_people) only finds candidates.

export type Hit = { personId: string; text: string; from?: string; sim: number }

const W = { theme: 0.4, rel: 0.2, near: 0.15, evidence: 0.1, warmth: 0.1, graph: 0.05 }
const NEAR_SIM = 0.45 // a miss this close in meaning is shown as "closest, but not quite"
const MAX_RESULTS = 10
const DAY = 86_400_000

type Ranked = { match: Match; score: number }
export type Outcome = {
  matches: Match[]
  groups?: { label: string; matches: Match[] }[]
  near?: Match[]
  note?: string
  level: 1 | 2 | 3 | 4 // 1 = everything fit; 2-3 = relaxed; 4 = honest empty
}

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '')
const days = (iso: string, now: number) => (now - new Date(iso).getTime()) / DAY

// Everything written about someone, lowercased, for exact-word checks.
const texts = new WeakMap<Person, string>()
const textOf = (p: Person) => {
  let t = texts.get(p)
  if (t === undefined) {
    t = norm([p.profession, p.story, ...p.tags, ...(p.todos ?? []).map((x) => x.text), ...(p.moments ?? []).flatMap((m) => [m.title, m.text ?? '', m.transcript ?? ''])].join(' | '))
    texts.set(p, t)
  }
  return t
}
const esc = (t: string) => norm(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Every group of words has to be mentioned (any word of a group will do): "deep sea welding" needs all three, so
// "deep dish" and "seamstress" don't count.
const keyword = (p: Person, groups: string[][]) => groups.length > 0 && groups.every((g) => g.some((t) => new RegExp(`\\b${esc(t)}`).test(textOf(p))))

// Close enough in meaning to count without the words appearing: "doctor" ~ "physician" (0.67), "lawyer" ~ "attorney"
// (0.61), but "portraits" ~ "painter" (0.58) is only a near miss.
const MEANING_ALONE = 0.64 // (0.7 when the question is two or more ideas: "portrait photographer" shouldn't match a painter)
const meaning = (hit: Hit | undefined) => hit?.sim ?? 0
const qualifies = (p: Person, hit: Hit | undefined, c: Constraints) => keyword(p, c.groups) || meaning(hit) >= (c.groups.length > 1 ? 0.7 : MEANING_ALONE)
// The words appearing and a close meaning together score highest; meaning alone a little lower; a near miss lower still.
const themeScore = (p: Person, hit: Hit | undefined, c: Constraints) => {
  if (keyword(p, c.groups)) return 0.7 + 0.3 * clamp((meaning(hit) - 0.4) / 0.3)
  if (qualifies(p, hit, c)) return 0.55 + 0.3 * clamp((meaning(hit) - 0.64) / 0.1)
  return 0.5 * clamp((meaning(hit) - 0.3) / 0.35)
}

// The sentence that shows why someone fits: the best match if it says the thing itself, otherwise the first sentence
// (a moment before the profile) that mentions it.
function evidence(p: Person, hit: Hit, c: Constraints) {
  const re = new RegExp(`\\b(${c.groups.flat().map(esc).join('|')})`)
  // A bare job title or tag (one or two words) is a weak reason when a sentence says more
  if (c.groups.length === 0 || (re.test(norm(hit.text)) && hit.text.split(/\s+/).length > 2)) return hit
  const chunks = chunksOf(p).filter((ch) => ch.kind !== 'tag' && re.test(norm(ch.text)))
  return chunks.find((ch) => ch.kind === 'moment') ?? chunks[0] ?? hit
}

const relFit = (p: Person, c: Constraints) => Math.max(c.contexts[p.context] ?? 0, (p.alsoContext && c.contexts[p.alsoContext]) || 0)

function warmth(p: Person, now: number) {
  const d = days(p.lastContacted, now)
  const recent = d <= 30 ? 1 : d <= 120 ? 0.6 : d <= 365 ? 0.3 : 0.1
  return 0.6 * ((p.closeness ?? 2) / 3) + 0.4 * recent
}

const jobOf = (p: Person) => norm(p.profession).replace(/\s+@.*$/, '')
const relationWord = (p: Person) => ({ family: 'Family', work: 'From work', social: 'Friend', community: 'Community', unsorted: '' })[p.context]

export function rankPeople(c: Constraints, hits: Hit[], people: Person[], now = Date.now()): Outcome {
  const best = new Map<string, Hit>()
  for (const h of hits) if (!best.has(h.personId) || h.sim > best.get(h.personId)!.sim) best.set(h.personId, h)

  const target = c.place
  const themed = c.theme.length > 0
  const fit = (p: Person) => (target ? hierarchyFit(target, placeOfPerson(p)) : 1)
  const inArea = (p: Person) => fit(p) > 0
  const metAt = c.metAt && norm(c.metAt)
  // Hard filters besides place: the life stage, and where you met
  const allowed = (p: Person) =>
    (!c.stage || p.lifeStage === c.stage) &&
    (!metAt || norm(p.met.context).includes(metAt) || (p.moments ?? []).some((m) => m.firstMeeting && norm(m.title).includes(metAt)))
  const into = (p: Person) => !themed || qualifies(p, best.get(p.id), c)
  const th = new Map(people.map((p) => [p.id, themed ? themeScore(p, best.get(p.id), c) : 0]))
  // Everyone clearly into the theme, wherever they live: who the connectors might know
  const experts = people.filter((p) => themed && allowed(p) && into(p))

  const card = (p: Person): Match => {
    const hit = best.get(p.id)
    const place = placeOfPerson(p)
    const d = days(p.lastContacted, now)
    const proof = themed && hit && into(p) ? evidence(p, hit, c) : undefined
    const why =
      proof
        ? p.tags.includes(proof.text)
          ? `Into ${proof.text}`
          : `${proof.text.replace(/\.$/, '')}${proof.from ? ` (${proof.from})` : ''}`
        : [relationWord(p), (c.stage || c.metAt) && `Met at ${p.met.context}`, p.profession, `last talked ${timeSince(p.lastContacted).toLowerCase()}`].filter(Boolean).join(' · ')
    return { person: p, why, chip: target && place ? placeChip(target, place) : undefined, via: d > 180 ? 'Reconnect first' : undefined }
  }

  const score = (p: Person, graph: number) => {
    const hit = best.get(p.id)
    const parts: [number, number][] = []
    if (themed) {
      parts.push([W.theme, th.get(p.id)!])
      parts.push([W.evidence, hit?.from && into(p) ? 1 : keyword(p, c.groups) ? 0.5 : 0])
    }
    if (Object.keys(c.contexts).length) parts.push([W.rel, relFit(p, c)])
    if (target) parts.push([W.near, fit(p)])
    parts.push([W.warmth, warmth(p, now)], [W.graph, graph])
    return parts.reduce((s, [w, x]) => s + w * x, 0) / parts.reduce((s, [w]) => s + w, 0)
  }
  // Friends of friends: knowing several people who are into the theme
  const expertIds = new Set(experts.map((p) => p.id))
  const graphOf = (p: Person) => clamp(p.knows.filter((k) => expertIds.has(k)).length / 3)

  // Level 1: everything the question asked for holds
  const level1 = diversify(people.filter((p) => inArea(p) && allowed(p) && into(p)).map((p) => ({ match: card(p), score: score(p, graphOf(p)) })))
  if (level1.length) return { matches: level1, level: 1 }

  const where = target?.name ?? 'your area'
  const what = c.theme.join(' / ')
  // Nothing is both nearby and into it. Offer the people who know someone who is, then the nearby people who would
  // still be good company. (Only for an in-person plan: for "who knows about X" that would be filler.)
  if (target && themed && c.intent === 'plan') {
    const nearby = people.filter((p) => inArea(p) && allowed(p))
    const connectors: Match[] = nearby
      .map((p) => ({ p, via: experts.find((e) => p.knows.includes(e.id)) }))
      .filter((x): x is { p: Person; via: Person } => !!x.via)
      .slice(0, 3)
      .map(({ p, via }) => ({ ...card(p), via: 'One step away', why: `Knows ${via.name}, ${via.profession.toLowerCase()}${via.livesNow.city !== p.livesNow.city ? ` in ${via.livesNow.city.split(',')[0]}` : ''}` }))
    const friends = diversify(nearby.map((p) => ({ match: card(p), score: score(p, 0) })), 5)
    if (friends.length || connectors.length) {
      const groups = [
        connectors.length ? { label: 'One step away', matches: connectors } : null,
        friends.length ? { label: 'Good company anyway', matches: friends } : null,
      ].filter((g): g is { label: string; matches: Match[] } => !!g)
      return {
        matches: groups.flatMap((g) => g.matches),
        groups,
        level: connectors.length ? 3 : 2,
        note: `No one in ${where} is clearly into ${what}.${connectors.length ? ` ${firstName(connectors[0].person.name)} knows someone who is.` : ''} ${friends.length ? 'These people would still be good company.' : ''}`.trim(),
      }
    }
  }

  // Honest empty: the closest few are shown as "not quite"
  const near = themed
    ? [...people]
        .filter((p) => allowed(p) && meaning(best.get(p.id)) >= NEAR_SIM)
        .sort((a, b) => th.get(b.id)! - th.get(a.id)! || meaning(best.get(b.id)) - meaning(best.get(a.id)))
        .slice(0, 2)
        .map((p) => ({ ...card(p), why: best.get(p.id)!.text.replace(/\.$/, '') }))
    : []
  return { matches: [], near, level: 4, note: target && !people.some(inArea) ? `No one in ${where} yet.` : undefined }
}

// Best first, but a second person with the same job as one already chosen has to be clearly better to take a spot
function diversify(all: Ranked[], cap = MAX_RESULTS): Match[] {
  const left = [...all].sort((a, b) => b.score - a.score)
  const out: Match[] = []
  const jobs = new Map<string, number>()
  const adjusted = (r: Ranked) => r.score - 0.06 * (jobs.get(jobOf(r.match.person)) ?? 0)
  while (left.length && out.length < cap) {
    const next = left.reduce((a, b) => (adjusted(b) > adjusted(a) ? b : a))
    left.splice(left.indexOf(next), 1)
    out.push(next.match)
    jobs.set(jobOf(next.match.person), (jobs.get(jobOf(next.match.person)) ?? 0) + 1)
  }
  return out
}
