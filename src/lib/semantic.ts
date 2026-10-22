import type { Person } from '../data/people'
import { filler, type AskResult, type Match } from './ask'
import { readDb, writeDb } from './localDb'
import { embedTexts } from './ml'
import { chunksOf } from './chunks'
import type { Hit } from './rank'
import { bestHits } from './rank/hits'

// Search by meaning, fully on this machine: a small embedding model (all-MiniLM-L6-v2, ~25 MB, downloaded once and
// then cached by the browser) turns text into vectors, so "pickleball" lands near "tennis" and "racquet sports".
// Not an LLM; it only compares meanings. Each person is cut into small chunks (job, each sentence of their story,
// each tag, to-dos, and every sentence of every moment you logged with them, which count a little extra); a person
// scores as their best chunk, and that chunk is the "why" (for a moment: what happened, and when).

const MIN_SCORE = 0.35 // below this is noise: real matches score 0.45–0.6, one-word chunks like "food" drift to ~0.3
const CLOSE_TO_BEST = 0.1 // and a result has to be within this of the best one, so a strong match isn't buried in weak ones
const MAX_RESULTS = 10
const MOMENT_BONUS = 0.04 // a real moment beats a profile line that is only about as close
const NEAR_SCORE = 0.3 // under MIN_SCORE but still in the same area: worth showing as "closest, but not quite"
const mock = new URLSearchParams(window.location.search).has('mock')

// chunk text -> vector. Kept in the browser (IndexedDB) so the next start doesn't re-embed anyone.
type Vectors = Record<string, number[]>
let cache: Promise<Vectors> | undefined
const vectors = () => (cache ??= mock ? Promise.resolve({} as Vectors) : Promise.all([readDb<Vectors>('vectors'), shipped()]).then(([mine, theirs]) => ({ ...theirs, ...mine })))

// Vectors for the sample people, computed once when the data was built (scripts/seed.ts) and shipped as
// public/vectors.json (each as signed bytes, base64), so the first search never has to read 700+ sentences.
async function shipped(): Promise<Vectors> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}vectors.json`)
    if (!res.ok) return {}
    const raw = (await res.json()) as Record<string, string>
    return Object.fromEntries(
      Object.entries(raw).map(([text, b64]) => [text, Array.from(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), (b) => ((b << 24) >> 24) / 300)]),
    )
  } catch {
    return {}
  }
}

// How far the first reading of everyone's moments has got (for the "Reading your moments…" line)
let progress = { done: 0, total: 0 }
export const searchProgress = () => progress

// One request at a time, so a search asked while the warm-up is still running waits for its work instead of
// repeating it
let queue: Promise<unknown> = Promise.resolve()
export const embed = (texts: string[]) => {
  const next = queue.then(() => embedNow(texts))
  queue = next.catch(() => {})
  return next
}

async function embedNow(texts: string[]): Promise<number[][]> {
  const have = await vectors()
  const missing = [...new Set(texts.filter((t) => !have[t]))]
  if (missing.length) {
    progress = { done: 0, total: missing.length }
    // In the background worker, a batch at a time, so the screen stays responsive and a question can slip in between
    for (let i = 0; i < missing.length; i += 16) {
      const batch = missing.slice(i, i + 16)
      const out = await embedTexts(batch)
      batch.forEach((t, j) => (have[t] = out[j].map((x) => Math.round(x * 1e4) / 1e4)))
      progress = { done: Math.min(i + 16, missing.length), total: missing.length }
    }
    if (!mock) writeDb('vectors', have)
  }
  return texts.map((t) => have[t])
}

// Load the model and embed everyone ahead of time (when Find opens), so the answer is quick.
export function warmUp(people: Person[]) {
  return mock ? Promise.resolve() : embed(people.flatMap(chunksOf).map((c) => c.text)).then(() => {}, () => {})
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)

// Everyone, closest to the query first, each with the piece of what you know that matched best.
// "someone who does my taxes" -> "taxes": the little words in how people ask make every job title look close
const topic = (query: string) => {
  const words = query.toLowerCase().replace(/[^\p{L}\p{N}\s'’-]/gu, ' ').split(/\s+/).filter((w) => w && !filler.has(w) && !/^(do|does|did|make|makes|can|help|need|want|my|me)$/.test(w))
  return words.join(' ') || query
}

// The candidate step of a search: embed the question, then pick each person's best sentence. Everything but the
// question is already embedded (see shipped()).
export async function localHits(text: string, people: Person[]): Promise<Hit[]> {
  const [q, ...all] = await embed([text, ...people.flatMap(chunksOf).map((c) => c.text)])
  const vec = new Map(people.flatMap(chunksOf).map((c, i) => [c.text, all[i]]))
  return bestHits(q, people, (t) => vec.get(t))
}

async function rank(query: string, people: Person[]) {
  const chunks = people.map(chunksOf)
  const [q, ...all] = await embed([topic(query), ...chunks.flat().map((c) => c.text)])
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

// A moment reads as what happened, with when; a profile line as itself
const toMatch = ({ person, chunk }: { person: Person; chunk: { text: string; from?: string } }): Match => ({
  person,
  why: chunk.from ? `${chunk.text.replace(/\.$/, '')} (${chunk.from})` : person.tags.includes(chunk.text) ? `Into ${chunk.text}` : chunk.text.replace(/\.$/, ''),
})

// The n people closest in meaning, however close: candidates for the AI to judge (src/lib/ai.ts)
export async function closestMatches(query: string, people: Person[], n: number): Promise<Match[]> {
  return (await rank(query, people)).slice(0, n).map(toMatch)
}

export async function semanticSearch(query: string, people: Person[]): Promise<AskResult> {
  const scored = await rank(query, people)
  const floor = Math.max(MIN_SCORE, scored[0].score - CLOSE_TO_BEST)
  const matches: Match[] = scored.filter((s) => s.score >= floor).slice(0, MAX_RESULTS).map(toMatch)
  const title = matches.length
    ? `${matches.length} ${matches.length === 1 ? 'person' : 'people'} closest to “${query}”`
    : `No one matches “${query}” yet`
  // Nothing close enough: still offer the nearest few, clearly as "not quite"
  const near = matches.length ? undefined : scored.filter((s) => s.score >= NEAR_SCORE).slice(0, 2).map(toMatch)
  return { kind: 'people', title, matches, near }
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
  const loose = closest.kind === 'people' ? closest.matches.filter((m) => !seen.has(m.person.id)) : []
  // Several things had to hold and nobody has them all: the meaning search scores one best sentence, so whoever fits
  // just one part ("pickleball") would look like a match. Offer them as "not quite" instead.
  const partial = exact.length === 0 && rules.kind === 'people' && (rules.criteria ?? 0) >= 2
  const more = exact.length >= 5 || partial ? [] : loose
  const matches = [...exact, ...more].slice(0, MAX_RESULTS)
  const title = matches.length
    ? `${matches.length} ${matches.length === 1 ? 'person' : 'people'} for “${query}”`
    : `No one matches “${query}” yet`
  // With no real match at all, keep the nearest few the search found, so the screen can offer them as "not quite"
  const near = matches.length ? undefined : partial ? loose.slice(0, 2) : closest.kind === 'people' ? closest.near : undefined
  return { kind: 'people', title, matches, near }
}
