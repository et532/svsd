import type { Person } from '../../data/people'
import { chunksOf } from '../chunks'
import type { Hit } from '.'

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)
// A real moment wins a near-tie with a profile line; a bare tag ("fashion") is a weak reason to show
const BIAS = { moment: 0.03, profile: 0, todo: -0.02, tag: -0.08 }

// The best-matching piece of what you know about each person for a question's vector. `vecOf` gives the
// (precomputed) vector of any sentence. The score is the best piece; the sentence shown as the reason is the best
// one that is more than a bare tag, when it is nearly as close.
export function bestHits(q: number[], people: Person[], vecOf: (text: string) => number[] | undefined): Hit[] {
  return people.flatMap((person) => {
    let best: Hit | undefined
    let bestText: Hit | undefined
    for (const chunk of chunksOf(person)) {
      const v = vecOf(chunk.text)
      if (!v) continue
      const hit = { personId: person.id, text: chunk.text, from: chunk.from, sim: dot(q, v) + BIAS[chunk.kind] }
      if (!best || hit.sim > best.sim) best = hit
      if (chunk.kind !== 'tag' && (!bestText || hit.sim > bestText.sim)) bestText = hit
    }
    if (!best) return []
    return [bestText && bestText.sim >= 0.35 && bestText.sim >= best.sim - 0.2 ? { ...bestText, sim: best.sim } : best]
  })
}
