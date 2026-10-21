import type { Person } from '../../data/people'
import type { AskResult } from '../ask'
import { parseQuery } from '../query'
import { remoteHits } from '../supabaseRepo'
import { localHits } from '../semantic'
import { rankPeople, type Hit } from '.'

// The place-aware search: understand the question, fetch candidates (the server when configured, otherwise a scan
// of precomputed vectors in the browser), rank them, and say what was relaxed when nothing fit exactly.

export async function searchPeople(query: string, people: Person[]): Promise<AskResult> {
  const c = parseQuery(query)
  let hits: Hit[] = []
  if (c.embedText) hits = (await remoteHits(c, people).catch(() => null)) ?? (await localHits(c.embedText, people))
  const out = rankPeople(c, hits, people)
  const about = c.explain.join(' · ')
  const title = out.matches.length
    ? `${out.matches.length} ${out.matches.length === 1 ? 'person' : 'people'} · ${about}`
    : `No one matches “${query}” yet`
  return { kind: 'people', title, matches: out.matches, groups: out.groups, near: out.near, note: out.note }
}
