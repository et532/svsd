import type { Request } from './ml.worker'

// Asks the background worker (ml.worker.ts) to run a model. One worker, started on first use.

let worker: Worker | undefined
let counter = 0
const waiting = new Map<number, { resolve: (v: never) => void; reject: (e: Error) => void }>()

// Omit that keeps each member of the union apart
type Body = Request extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never

function call<T>(request: Body): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./ml.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const w = waiting.get(e.data.id)
      waiting.delete(e.data.id)
      if (e.data.error) w?.reject(new Error(e.data.error))
      else w?.resolve(e.data.result as never)
    }
  }
  const id = ++counter
  return new Promise<T>((resolve, reject) => {
    waiting.set(id, { resolve: resolve as (v: never) => void, reject })
    worker!.postMessage({ ...request, id })
  })
}

export const embedTexts = (texts: string[]) => call<number[][]>({ kind: 'embed', texts })
export const transcribeAudio = (audio: Float32Array) => call<string>({ kind: 'transcribe', audio })
// Start downloading a model before it is needed
export const preload = (model: 'whisper' | 'embed') => call<true>({ kind: 'preload', model })
