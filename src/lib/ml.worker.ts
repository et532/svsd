// The local search model runs here, in a background thread, so the screen never freezes while it works (embedding
// everyone's moments is heavy and used to block typing and taps). Speech is not local any more: OpenAI does it (ai.ts).
import { pipeline } from '@huggingface/transformers'

type Embed = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>

export type Request = { id: number; kind: 'embed'; texts: string[] }

let embedder: Promise<Embed> | undefined
const loadEmbedder = () =>
  (embedder ??= pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' }) as unknown as Promise<Embed>)

self.onmessage = async (e: MessageEvent<Request>) => {
  const m = e.data
  try {
    const out = (await (await loadEmbedder())(m.texts, { pooling: 'mean', normalize: true })).tolist()
    self.postMessage({ id: m.id, result: out })
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err) })
  }
}
