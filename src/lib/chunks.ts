import type { Person } from '../data/people'

// A piece of what you know about someone. Pieces from a logged moment carry where they came from ("Coffee near
// Union Square, Oct 2026"), because what actually happened with someone is the best evidence for a match.
export type Chunk = { text: string; from?: string; kind: 'profile' | 'tag' | 'todo' | 'moment'; momentId?: string }

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
const SENTENCE = /(?<!\b(?:Dr|Mr|Mrs|Ms|St|Prof|Jr|Sr)\.)(?<=[.!?])\s+/ // not after "Dr." and the like
const sentences = (t: string) => t.split(SENTENCE).map((x) => x.trim()).filter((x) => x.split(/\s+/).length >= 4)

export const chunksOf = (p: Person): Chunk[] => {
  const profile: Chunk[] = [
    { text: p.profession, kind: 'profile' },
    ...p.story.split(SENTENCE).map((text): Chunk => ({ text, kind: 'profile' })),
    ...p.tags.map((text): Chunk => ({ text, kind: 'tag' })),
    ...(p.todos ?? []).map((t): Chunk => ({ text: t.text, kind: 'todo' })),
  ]
  // Every moment, including the voice note from when you first met: each sentence, labeled with its moment
  const moments = (p.moments ?? []).flatMap((m) =>
    sentences(m.transcript ?? m.text ?? m.title).map((text): Chunk => ({ text, kind: 'moment', momentId: m.id, from: `${m.title}, ${when(m.date)}` })),
  )
  const seen = new Set<string>()
  return [...profile.map((c) => ({ ...c, text: c.text.trim() })), ...moments].filter((c) => c.text && !seen.has(c.text) && seen.add(c.text))
}
