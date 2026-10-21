import { readFileSync } from 'node:fs'
import { pipeline } from '@huggingface/transformers'
import { samplePeople } from '../src/data/people'
import { bestHits } from '../src/lib/rank/hits'
import { answer, type HitsFor } from '../src/lib/rank/search'

// Runs the real search in Node: the question is embedded with the same model the browser uses, everything else
// comes from public/vectors.json. Used by scripts/ask.ts and the golden tests.

const raw = JSON.parse(readFileSync(new URL('../public/vectors.json', import.meta.url), 'utf8')) as Record<string, string>
const decode = (b64: string) => Array.from(Buffer.from(b64, 'base64'), (b) => ((b << 24) >> 24) / 300)
const cache = new Map<string, number[]>()
const vecOf = (t: string) => (raw[t] ? (cache.get(t) ?? cache.set(t, decode(raw[t])).get(t)) : undefined)

let model: Promise<(t: string[], o: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>> | undefined
const embed = async (text: string) => {
  model ??= pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' }) as never
  return (await (await model)([text], { pooling: 'mean', normalize: true })).tolist()[0]
}

export const hitsFor: HitsFor = async (c, people) => bestHits(await embed(c.embedText), people, vecOf)
export const ask = (query: string, people = samplePeople) => answer(query, people, hitsFor)
