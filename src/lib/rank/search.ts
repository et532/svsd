import type { Person } from '../../data/people'
import { interpret, type AskResult } from '../ask'
import { parseQuery, type Constraints } from '../query'
import { rankPeople, type Hit } from '.'

// The place-aware search. `hitsFor` fetches candidates for a question (the server when configured, otherwise a scan
// of precomputed vectors in the browser; see rank/browser.ts), so this part has no browser or model in it.

export type HitsFor = (c: Constraints, people: Person[]) => Promise<Hit[]>

// The rule-based answers (add someone, open a profile, climbing buddy, a trip, an intro, who to catch up with) stay
// as they are; a plain "find people like this" goes through the ranking.
export const isSpecial = (rules: AskResult) => !(rules.kind === 'none' || (rules.kind === 'people' && (rules.generic || rules.matches.length === 0)))

export async function answer(query: string, people: Person[], hitsFor: HitsFor, rules = interpret(query, people)): Promise<AskResult> {
  if (isSpecial(rules)) return rules
  const c = parseQuery(query)
  const out = rankPeople(c, c.embedText ? await hitsFor(c, people) : [], people)
  const about = c.explain.join(' · ')
  const title = out.matches.length
    ? `${out.matches.length} ${out.matches.length === 1 ? 'person' : 'people'} · ${about}`
    : `No one matches “${query}” yet`
  return { kind: 'people', title, matches: out.matches, groups: out.groups, near: out.near, note: out.note }
}
