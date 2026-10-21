import type { Person } from '../data/people'
import type { AskResult, Match } from './ask'
import { readDb, writeDb } from './localDb'

// Search by meaning, fully on this machine: a small embedding model (all-MiniLM-L6-v2, ~25 MB, downloaded once and
// then cached by the browser) turns text into vectors, so "pickleball" lands near "tennis" and "racquet sports".
// Not an LLM; it only compares meanings. Each person is cut into small chunks (job, each sentence of their story,
// each tag, to-dos, and every sentence of every moment you logged with them, which count a little extra); a person
// scores as their best chunk, and that chunk is the "why" (for a moment: what happened, and when).

const MIN_SCORE = 0.35 // below this is noise: real matches score 0.45–0.6, one-word chunks like "food" drift to ~0.3
const CLOSE_TO_BEST = 0.15 // and a result has to be within this of the best one, so a strong match isn't buried in weak ones
const MAX_RESULTS = 10
const mock = new URLSearchParams(window.location.search).has('mock')

type Extract = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>

let model: Promise<Extract> | undefined
const loadModel = () =>
  (model ??= import('@huggingface/transformers').then(
    (m) => m.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' }) as unknown as Extract,
  ))

// chunk text -> vector. Kept in the browser (IndexedDB) so the next start doesn't re-embed anyone.
type Vectors = Record<string, number[]>
let cache: Promise<Vectors> | undefined
const vectors = () => (cache ??= mock ? Promise.resolve({} as Vectors) : readDb<Vectors>('vectors').then((v) => v ?? {}))

async function embed(texts: string[]): Promise<number[][]> {
  const have = await vectors()
  const missing = [...new Set(texts.filter((t) => !have[t]))]
  if (missing.length) {
    const run = await loadModel()
    for (let i = 0; i < missing.length; i += 16) {
      const batch = missing.slice(i, i + 16)
      const out = (await run(batch, { pooling: 'mean', normalize: true })).tolist()
      batch.forEach((t, j) => (have[t] = out[j].map((x) => Math.round(x * 1e4) / 1e4)))
    }
    if (!mock) writeDb('vectors', have)
  }
  return texts.map((t) => have[t])
}

// A piece of what you know about someone. Pieces from a logged moment carry where they came from ("Coffee near
// Union Square, Oct 2026"), because what actually happened with someone is the best evidence for a match.
type Chunk = { text: string; from?: string }

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
const MOMENT_BONUS = 0.04 // a real moment beats a profile line that is only about as close
const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.split(/\s+/).length >= 4)

const chunksOf = (p: Person): Chunk[] => {
  const profile = [p.profession, ...p.story.split(/(?<=[.!?])\s+/), ...p.tags, ...(p.todos ?? []).map((t) => t.text)]
  // Every moment, including the voice note from when you first met: each sentence, labeled with its moment
  const moments = (p.moments ?? []).flatMap((m) =>
    sentences(m.transcript ?? m.text ?? m.title).map((text) => ({ text, from: `${m.title}, ${when(m.date)}` })),
  )
  const seen = new Set<string>()
  return [...profile.map((text) => ({ text: text.trim() })), ...moments].filter((c) => c.text && !seen.has(c.text) && seen.add(c.text))
}

// Load the model and embed everyone ahead of time (when Find opens), so the answer is quick.
export function warmUp(people: Person[]) {
  if (!mock) embed(people.flatMap(chunksOf).map((c) => c.text)).catch(() => {})
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)

// Everyone, closest to the query first, each with the piece of what you know that matched best.
async function rank(query: string, people: Person[]) {
  const chunks = people.map(chunksOf)
  const [q, ...all] = await embed([query, ...chunks.flat().map((c) => c.text)])
  let at = 0
  const scored = people.map((person, i) => {
    let best = { score: -1, chunk: chunks[i][0] }
    for (const chunk of chunks[i]) {
      const score = dot(q, all[at++]) + (chunk.from ? MOMENT_BONUS : 0)
      if (score > best.score) best = { score, chunk }
    }
    return { person, ...best }
  })
  return scored.sort((a, b) => b.score - a.score)
}

export async function semanticSearch(query: string, people: Person[]): Promise<AskResult> {
  const scored = await rank(query, people)
  const floor = Math.max(MIN_SCORE, scored[0].score - CLOSE_TO_BEST)
  const matches: Match[] = scored
    .filter((s) => s.score >= floor)
    .slice(0, MAX_RESULTS)
    .map(({ person, chunk }) => ({
      person,
      // A moment reads as what happened, with when; a profile line as itself
      why: chunk.from ? `${chunk.text.replace(/\.$/, '')} (${chunk.from})` : person.tags.includes(chunk.text) ? `Into ${chunk.text}` : chunk.text.replace(/\.$/, ''),
    }))
  const title = matches.length
    ? `${matches.length} ${matches.length === 1 ? 'person' : 'people'} closest to “${query}”`
    : `No one matches “${query}” yet`
  return { kind: 'people', title, matches }
}

// What the keyword rules found first (exact words, places, how you know them), then the people closest in meaning.
export async function findPeople(query: string, people: Person[], rules: AskResult): Promise<AskResult> {
  const scored = await rank(query, people)
  const closest = await semanticSearch(query, people)
  // Exact matches are ordered by how close they are in meaning, so someone who is all about coffee comes before
  // someone who mentioned it once
  const order = new Map(scored.map((s, i) => [s.person.id, i]))
  const exact = (rules.kind === 'people' ? [...rules.matches] : []).sort((a, b) => order.get(a.person.id)! - order.get(b.person.id)!)
  const seen = new Set(exact.map((m) => m.person.id))
  // Plenty of exact matches already (say, "friends in New York"): adding looser ones would only be noise
  const more = exact.length >= 5 ? [] : (closest.kind === 'people' ? closest.matches : []).filter((m) => !seen.has(m.person.id))
  const matches = [...exact, ...more].slice(0, MAX_RESULTS)
  const title = matches.length
    ? `${matches.length} ${matches.length === 1 ? 'person' : 'people'} for “${query}”`
    : `No one matches “${query}” yet`
  return { kind: 'people', title, matches }
}
