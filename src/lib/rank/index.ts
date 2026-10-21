import type { Person } from '../../data/people'
import type { Match } from '../ask'
import { firstName, timeSince } from '../people'
import { hierarchyFit, placeChip, placeOfPerson } from '../places'
import type { Constraints } from '../query'

// Turns a question's constraints and what the search found into ranked, explained people. Pure: no model, no
// network, so it is testable. A "hit" is the best-matching piece of what you know about one person.
//
// Score = 0.40 theme + 0.20 relationshipFit + 0.15 proximity + 0.10 evidence + 0.10 warmth + 0.05 graph.
// A feature the question doesn't use (no place, no theme, no kind of relationship) is dropped and the rest are
// rescaled, so "who knows about taxes" isn't punished for having no neighborhood.

export type Hit = { personId: string; text: string; from?: string; sim: number }

const W = { theme: 0.4, rel: 0.2, near: 0.15, evidence: 0.1, warmth: 0.1, graph: 0.05 }
const THEME_FLOOR = 0.35 // a theme score below this is not "into it"
const NEAR_FLOOR = 0.2 // ...but this close is worth showing as "closest, but not quite"
const MAX_RESULTS = 10
const DAY = 86_400_000

export type Ranked = { match: Match; score: number }
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

function keyword(p: Person, hit: Hit | undefined, terms: string[]) {
  if (!terms.length) return false
  const hay = norm([p.profession, ...p.tags, hit?.text ?? ''].join(' | '))
  return terms.some((t) => new RegExp(`\\b${norm(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay))
}

function themeScore(p: Person, hit: Hit | undefined, c: Constraints) {
  const meaning = hit ? clamp((hit.sim - 0.28) / 0.32) : 0
  return clamp(meaning + (keyword(p, hit, c.terms) ? 0.35 : 0))
}

const relFit = (p: Person, c: Constraints) => Math.max(c.contexts[p.context] ?? 0, (p.alsoContext && c.contexts[p.alsoContext]) || 0)

function warmth(p: Person, now: number) {
  const d = days(p.lastContacted, now)
  const recent = d <= 30 ? 1 : d <= 120 ? 0.6 : d <= 365 ? 0.3 : 0.1
  return 0.6 * ((p.closeness ?? 2) / 3) + 0.4 * recent
}

const jobOf = (p: Person) => norm(p.profession).replace(/\s+@.*$/, '')

export function rankPeople(c: Constraints, hits: Hit[], people: Person[], now = Date.now()): Outcome {
  const best = new Map<string, Hit>()
  for (const h of hits) if (!best.has(h.personId) || h.sim > best.get(h.personId)!.sim) best.set(h.personId, h)

  const target = c.place
  const fit = (p: Person) => (target ? hierarchyFit(target, placeOfPerson(p)) : 1)
  const inArea = (p: Person) => fit(p) > 0
  const stageOk = (p: Person) => !c.stage || p.lifeStage === c.stage
  const themed = c.theme.length > 0
  const th = new Map(people.map((p) => [p.id, themed ? themeScore(p, best.get(p.id), c) : 0]))
  // Everyone clearly into the theme, wherever they live: who the connectors might know
  const experts = people.filter((p) => stageOk(p) && (th.get(p.id) ?? 0) >= THEME_FLOOR)

  const card = (p: Person): Match => {
    const hit = best.get(p.id)
    const place = placeOfPerson(p)
    const d = days(p.lastContacted, now)
    const evidence = hit && (keyword(p, hit, c.terms) || th.get(p.id)! >= THEME_FLOOR)
    const why = evidence
      ? `${hit.text.replace(/\.$/, '')}${hit.from ? ` (${hit.from})` : ''}`
      : [relationWord(p), p.profession, `last talked ${timeSince(p.lastContacted).toLowerCase()}`].filter(Boolean).join(' · ')
    return {
      person: p,
      why,
      chip: target && place ? placeChip(target, place) : undefined,
      via: d > 180 ? 'Reconnect first' : undefined,
    }
  }

  const score = (p: Person, graph: number) => {
    const hit = best.get(p.id)
    const parts: [number, number][] = []
    if (themed) {
      parts.push([W.theme, th.get(p.id)!])
      parts.push([W.evidence, hit?.from && th.get(p.id)! >= THEME_FLOOR ? 1 : keyword(p, hit, c.terms) ? 0.5 : 0])
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
  const pool = people.filter((p) => inArea(p) && stageOk(p) && (!themed || th.get(p.id)! >= THEME_FLOOR))
  const level1 = diversify(pool.map((p) => ({ match: card(p), score: score(p, graphOf(p)) })))
  if (level1.length) return { matches: level1, level: 1 }

  const where = target?.name ?? 'your area'
  const what = c.theme.join(' / ')
  // Nothing is both nearby and into it. Offer the people who know someone who is, then the nearby people who would still be good company.
  if (target && themed) {
    const nearby = people.filter((p) => inArea(p) && stageOk(p))
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
  const near = [...people]
    .filter((p) => stageOk(p) && (!themed || (best.get(p.id)?.sim ?? 0) >= NEAR_FLOOR + 0.1 || th.get(p.id)! >= NEAR_FLOOR))
    .sort((a, b) => th.get(b.id)! - th.get(a.id)!)
    .slice(0, 2)
    .map(card)
  return { matches: [], near: themed ? near : [], level: 4, note: target && !people.some(inArea) ? `No one in ${where} yet.` : undefined }
}

const relationWord = (p: Person) => ({ family: 'Family', work: 'From work', social: 'Friend', community: 'Community', unsorted: '' })[p.context]

// Best first, but a second person with the same job as one already chosen has to be clearly better to take a spot
function diversify(all: Ranked[], cap = MAX_RESULTS): Match[] {
  const left = [...all].sort((a, b) => b.score - a.score)
  const out: Match[] = []
  const jobs = new Map<string, number>()
  while (left.length && out.length < cap) {
    const next = left.reduce((a, b) => (b.score - 0.06 * (jobs.get(jobOf(b.match.person)) ?? 0) > a.score - 0.06 * (jobs.get(jobOf(a.match.person)) ?? 0) ? b : a))
    left.splice(left.indexOf(next), 1)
    out.push(next.match)
    jobs.set(jobOf(next.match.person), (jobs.get(jobOf(next.match.person)) ?? 0) + 1)
  }
  return out
}
