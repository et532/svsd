import type { Person } from '../data/people'
import { metroRadius } from './places'
import type { Constraints } from './query'
import { chunkRows, personPayload } from './remoteRows'
import type { Hit } from './rank'
import { embed } from './semantic'

// The online store: Supabase over plain HTTP (PostgREST), no client library. With no VITE_SUPABASE_* set the app
// stays fully local (IndexedDB + the shipped sample people). DEMO ONLY: the anon key can read and write
// everything (see the policies at the bottom of the migration).

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const remoteEnabled = !!URL && !!KEY && !new URLSearchParams(window.location.search).has('mock')

async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    method: init.json !== undefined ? 'POST' : init.method,
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...init.headers },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return (res.status === 204 ? undefined : await res.json()) as T
}

const rpc = <T>(fn: string, args: object) => call<T>(`rpc/${fn}`, { json: args })

// Everyone, in one call.
export const remoteList = () => rpc<Person[]>('get_people', {})

// One person with all their moments, to-dos and links. Only their new sentences are embedded (the rest is cached).
export async function remoteUpsert(p: Person) {
  const rows = chunkRows(p)
  const vecs = await embed(rows.map((r) => r.text)).catch(() => [])
  await rpc('upsert_person', { p: personPayload(p), chunk_list: rows.map((r, i) => ({ ...r, embedding: vecs[i] })) })
}

export const remoteDelete = (id: string) => call<void>(`people?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })

// Candidates for a question: the best matching piece per person, with the place gate applied inside Postgres.
// With a gate, a second ungated call finds who is into the theme elsewhere (for "one step away" and "not quite").
export async function remoteHits(c: Constraints, people: Person[]): Promise<Hit[] | null> {
  if (!remoteEnabled) return null
  const [vec] = await embed([c.embedText])
  const words = c.terms.flatMap((t) => t.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length > 2)
  const base = { query_vec: vec, query_text: [...new Set(words)].join(' | '), p_stage: c.stage ?? null }
  const rows = async (gate: object) =>
    rpc<{ person_id: string; chunk_text: string; moment_id: string | null; sim: number }[]>('search_people', { ...base, ...gate })
  const gate = c.place ? { p_lat: c.place.lat, p_lng: c.place.lng, p_radius_km: metroRadius(c.place) } : {}
  const [inside, anywhere] = await Promise.all([rows(gate), c.place ? rows({}) : Promise.resolve([])])
  const byId = new Map(people.map((p) => [p.id, p]))
  const seen = new Set<string>()
  return [...inside, ...anywhere].flatMap((r) => {
    if (seen.has(r.person_id) || !byId.has(r.person_id)) return []
    seen.add(r.person_id)
    const m = r.moment_id ? byId.get(r.person_id)!.moments?.find((x) => x.id === r.moment_id) : undefined
    const from = m && `${m.title}, ${new Date(m.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    return [{ personId: r.person_id, text: r.chunk_text, from, sim: r.sim }]
  })
}
