import { createModel, type Model } from 'vosk-browser'

// Word-by-word speech-to-text on this device: Vosk, a small streaming recognizer (it runs in its own worker thread),
// hears the audio as it arrives and reports each word at once. It is less accurate than Whisper (names especially),
// so it only drafts the words while you talk; Whisper then redoes the whole recording when you stop.
// The ~40 MB model is fetched once (from the vosk-browser project's public host) and cached by the browser.
const MODEL = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz'

// Kept in the browser's Cache Storage, so it is downloaded once and never again (the host's own caching headers
// would have it fetched again every few minutes).
async function modelUrl() {
  try {
    const cache = await caches.open('peepl-models')
    let res = await cache.match(MODEL)
    if (!res) {
      await cache.add(MODEL)
      res = await cache.match(MODEL)
    }
    return URL.createObjectURL(await res!.blob())
  } catch {
    return MODEL // no Cache Storage: fetch it the plain way
  }
}

let model: Promise<Model> | undefined
export const loadLive = () => (model ??= modelUrl().then(createModel).catch((e) => ((model = undefined), Promise.reject(e))))

// Feed it audio (mono, any rate); onText gets everything heard so far, again each time a word lands.
// `ready` turns true once the model has loaded; until then audio is kept and fed in as soon as it can.
export function startLive(rate: number, onText: (text: string) => void, onReady: () => void) {
  let stopped = false
  let ready = false
  let failed = false
  let done = '' // finished phrases
  const waiting: Float32Array[] = []
  let recognizer: InstanceType<Model['KaldiRecognizer']> | undefined

  loadLive()
    .then((m) => {
      if (stopped) return
      recognizer = new m.KaldiRecognizer(rate)
      recognizer.on('result', (e) => {
        if (e.event !== 'result') return
        done = `${done} ${e.result.text}`.trim()
        onText(done)
      })
      recognizer.on('partialresult', (e) => {
        if (e.event === 'partialresult') onText(`${done} ${e.result.partial}`.trim())
      })
      for (const a of waiting) recognizer.acceptWaveformFloat(a, rate)
      waiting.length = 0
      ready = true
      onReady()
    })
    .catch(() => (failed = true)) // no model (offline): the caller falls back to Whisper passes

  return {
    get ready() {
      return ready
    },
    get failed() {
      return failed
    },
    feed: (samples: Float32Array) => (recognizer ? recognizer.acceptWaveformFloat(samples, rate) : waiting.push(samples)),
    stop: () => {
      stopped = true
      recognizer?.remove()
    },
  }
}
