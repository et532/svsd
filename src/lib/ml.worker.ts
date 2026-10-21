// The two local models run here, in a background thread, so the screen never freezes while they work (embedding
// everyone's moments and transcribing speech are heavy and used to block typing and taps).
import { pipeline } from '@huggingface/transformers'

type Embed = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>
type Transcribe = (audio: Float32Array) => Promise<{ text: string }>

export type Request =
  | { id: number; kind: 'embed'; texts: string[] }
  | { id: number; kind: 'transcribe'; audio: Float32Array }
  | { id: number; kind: 'preload'; model: 'whisper' | 'embed' }

let embedder: Promise<Embed> | undefined
let whisper: Promise<Transcribe> | undefined
const loadEmbedder = () =>
  (embedder ??= pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' }) as unknown as Promise<Embed>)
const loadWhisper = () =>
  (whisper ??= pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', { dtype: 'q8' }) as unknown as Promise<Transcribe>)

self.onmessage = async (e: MessageEvent<Request>) => {
  const m = e.data
  try {
    if (m.kind === 'embed') {
      const out = (await (await loadEmbedder())(m.texts, { pooling: 'mean', normalize: true })).tolist()
      self.postMessage({ id: m.id, result: out })
    } else if (m.kind === 'transcribe') {
      self.postMessage({ id: m.id, result: (await (await loadWhisper())(m.audio)).text })
    } else {
      await (m.model === 'whisper' ? loadWhisper() : loadEmbedder())
      self.postMessage({ id: m.id, result: true })
    }
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err) })
  }
}
