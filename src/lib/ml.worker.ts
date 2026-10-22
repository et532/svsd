// The two local models run here, in a background thread, so the screen never freezes while they work (embedding
// everyone's moments and transcribing speech are heavy and used to block typing and taps).
import { pipeline } from '@huggingface/transformers'

type Embed = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>
type Transcribe = (audio: Float32Array, opts?: { chunk_length_s: number; stride_length_s: number }) => Promise<{ text: string }>

export type Request =
  | { id: number; kind: 'embed'; texts: string[] }
  | { id: number; kind: 'transcribe'; audio: Float32Array }
  | { id: number; kind: 'parse'; messages: { role: string; content: string }[] }
  | { id: number; kind: 'preload'; model: 'whisper' | 'embed' | 'llm' }

type Chat = (
  messages: { role: string; content: string }[],
  opts: { max_new_tokens: number; do_sample: boolean },
) => Promise<{ generated_text: { role: string; content: string }[] }[]>

let embedder: Promise<Embed> | undefined
let llm: Promise<Chat> | undefined
// A small instruct model that turns a note into JSON. WebGPU when there is one, else the q4 WASM build.
const LLM = 'onnx-community/Qwen2.5-0.5B-Instruct'
const loadLlm = () =>
  (llm ??= (
    'gpu' in navigator
      ? (pipeline('text-generation', LLM, { device: 'webgpu', dtype: 'q4f16' }) as unknown as Promise<Chat>).catch(
          () => pipeline('text-generation', LLM, { dtype: 'q4' }) as unknown as Promise<Chat>,
        )
      : (pipeline('text-generation', LLM, { dtype: 'q4' }) as unknown as Promise<Chat>)
  ))
let whisper: Promise<Transcribe> | undefined
const loadEmbedder = () =>
  (embedder ??= pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' }) as unknown as Promise<Embed>)
const wasmWhisper = () =>
  pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', { dtype: 'q8' }) as unknown as Promise<Transcribe>
// WebGPU is several times faster than WASM; q8 doesn't suit the GPU, so it takes fp32 encoder + q4 decoder.
// ponytail: falls back to WASM only if loading fails, not if the first run fails
const loadWhisper = () =>
  (whisper ??= ('gpu' in navigator
    ? (pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
        device: 'webgpu',
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
      }) as unknown as Promise<Transcribe>).catch(wasmWhisper)
    : wasmWhisper()))

self.onmessage = async (e: MessageEvent<Request>) => {
  const m = e.data
  try {
    if (m.kind === 'embed') {
      const out = (await (await loadEmbedder())(m.texts, { pooling: 'mean', normalize: true })).tolist()
      self.postMessage({ id: m.id, result: out })
    } else if (m.kind === 'transcribe') {
      self.postMessage({ id: m.id, result: (await (await loadWhisper())(m.audio, { chunk_length_s: 30, stride_length_s: 5 })).text })
    } else if (m.kind === 'parse') {
      const out = await (await loadLlm())(
        m.messages,
        { max_new_tokens: 160, do_sample: false },
      )
      self.postMessage({ id: m.id, result: out[0].generated_text.slice(-1)[0]?.content ?? '' })
    } else {
      if (m.model === 'llm') {
        // One short answer compiles the WebGPU shaders now, so the first real note isn't slow
        await (await loadLlm())([{ role: 'user', content: 'Hi' }], { max_new_tokens: 1, do_sample: false })
      } else if (m.model === 'whisper') {
        // One second of silence compiles the WebGPU shaders now, so the first real recording isn't slow
        await (await loadWhisper())(new Float32Array(16000))
      } else await loadEmbedder()
      self.postMessage({ id: m.id, result: true })
    }
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err) })
  }
}
