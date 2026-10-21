import { startLive } from './live'
import { preload, transcribeAudio } from './ml'

// Voice-to-text. First choice is the browser's built-in speech recognition (Chrome / Edge / Safari): live words,
// but Chrome sends the audio to Google. Brave, Firefox and other builds cannot use that service ("network" error,
// or no API at all), so there the mic is recorded and transcribed on this machine by Whisper (a ~40 MB model,
// downloaded once, then cached). Whisper is not streaming, so the recording so far is re-transcribed every half second
// of seconds: the words appear a beat behind you and are corrected as more context arrives.

type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  abort(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

const w = window as unknown as {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}
const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition

const BLOCKED = ['not-allowed', 'service-not-allowed', 'audio-capture']

// Starts listening and returns a stop function, or null when there is no way to hear (an insecure page with no mic
// API at all), so the caller can fall back to the scripted demo.
// - onText: everything heard so far (the whole text, replacing the last).
// - onFail: the reason when the mic is blocked or nothing works.
// - onBusy: true while the last of a local recording is being transcribed after stop (text is coming).
// - onLoading: true while the local voice model is still getting ready (first use downloads it), so nothing shows yet.
// Whether the mic is heard by the local models (Brave, Firefox...) rather than the browser's own speech service
export const usesLocalVoice = !Ctor || 'brave' in navigator

export function listen(
  onText: (text: string) => void,
  onFail: (reason: string) => void,
  onBusy: (busy: boolean) => void,
  onLoading: (loading: boolean) => void = () => {},
): (() => void) | null {
  if (!Ctor && !navigator.mediaDevices?.getUserMedia) return null
  let stopLocal = () => {}
  const fallToWhisper = () => (stopLocal = recordLocal(onText, onFail, onBusy, onLoading))
  // Brave has the built-in API but blocks the Google service behind it, so it would only fail after a delay
  if (!Ctor || usesLocalVoice) {
    fallToWhisper()
    return () => stopLocal()
  }

  const rec = new Ctor()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = navigator.language || 'en-US'
  let on = true
  let before = ''
  let heard = ''
  rec.onresult = (e) => {
    const now = Array.from(e.results, (r) => r[0].transcript).join(' ')
    heard = `${before} ${now}`.replace(/\s+/g, ' ').trim()
    onText(heard)
  }
  const fail = (reason: string) => {
    if (!on) return
    on = false
    rec.abort()
    if (BLOCKED.includes(reason)) onFail(reason)
    else fallToWhisper() // the speech service is unreachable here: record and transcribe locally instead
  }
  // Silence ("no-speech") just ends the session and is restarted below; anything else is a real failure.
  rec.onerror = (e) => e.error !== 'no-speech' && e.error !== 'aborted' && fail(e.error)
  let quick = 0
  let startedAt = Date.now()
  rec.onend = () => {
    if (!on) return
    // Sessions that end at once, over and over, mean it is broken: stop instead of flashing the mic forever.
    quick = Date.now() - startedAt < 1000 ? quick + 1 : 0
    if (quick >= 3) return fail('unavailable')
    before = heard
    startedAt = Date.now()
    try {
      rec.start()
    } catch {
      fail('unavailable')
    }
  }
  try {
    rec.start()
  } catch {
    fallToWhisper()
  }
  return () => {
    on = false
    rec.abort()
    stopLocal()
  }
}

const RATE = 16000 // what Whisper wants
const TICK_MS = 500 // how often the recording so far is transcribed (a tick is skipped while the last one is still running)
const MAX_SEGMENT = 25 * RATE // Whisper reads 30 s at a time: past ~25 s the text so far is kept and a new piece starts

const join = (a: Float32Array[]) => {
  const out = new Float32Array(a.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of a) out.set(c, (at += c.length) - c.length)
  return out
}
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / (a.length || 1))

// Records the mic as 16 kHz mono. While it runs, Vosk (live.ts) shows each word as it is said; if that model isn't
// available (still downloading, or offline) Whisper passes over the recording so far fill in instead. When stopped,
// Whisper transcribes the whole recording for the accurate final text.
function recordLocal(
  onText: (t: string) => void,
  onFail: (reason: string) => void,
  onBusy: (b: boolean) => void,
  onLoading: (b: boolean) => void,
) {
  let stopped = false
  let release = () => {}
  let chunks: Float32Array[] = []
  let committed = '' // text of finished 25 s pieces
  let working: Promise<void> = Promise.resolve()
  let failed = false
  let live: ReturnType<typeof startLive> | undefined
  onLoading(true)
  // The word-by-word model downloads first; Whisper (for the final text) only after it, so they don't compete
  const seen = (t: string) => (onLoading(false), onText(t))

  const transcribe = async () => {
    const audio = join(chunks)
    // Too short, or silence (Whisper invents words like " you" for silence): nothing to say yet
    if (audio.length < RATE * 0.8 || rms(audio) < 0.003) return
    const text = await transcribeAudio(audio)
    // A pass that finished after the live words took over would only make the text jump back: drop it
    if (!live?.failed && !stopped) return
    const clean = text.replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/\s+/g, ' ').trim() // drop "[BLANK_AUDIO]" style tags
    const all = `${committed} ${clean}`.trim()
    if (all) seen(all)
    if (audio.length > MAX_SEGMENT) {
      committed = all
      chunks = [join(chunks).slice(audio.length)] // keep only what was recorded while transcribing
    }
  }
  // One transcription at a time, in order; a tick that finds one still running is skipped
  const run = () =>
    (working = working.then(transcribe).catch(() => {
      if (!failed) onFail('unavailable')
      failed = true
    }))
  let isBusy = false
  const tick = setInterval(() => {
    // Whisper passes only stand in when the word-by-word model could not load
    if (isBusy || stopped || !live?.failed) return
    isBusy = true
    run().finally(() => (isBusy = false))
  }, TICK_MS)

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      const ctx = new AudioContext({ sampleRate: RATE })
      const source = ctx.createMediaStreamSource(stream)
      // ponytail: ScriptProcessor is deprecated but works in every browser without a separate worklet file
      const tap = ctx.createScriptProcessor(4096, 1, 1)
      live = startLive(ctx.sampleRate, seen, () => {
        onLoading(false)
        preload('whisper').catch(() => {})
      })
      tap.onaudioprocess = (e) => {
        const samples = new Float32Array(e.inputBuffer.getChannelData(0))
        chunks.push(samples)
        live?.feed(new Float32Array(samples))
      }
      const mute = ctx.createGain()
      mute.gain.value = 0 // the processor only runs while connected to the output
      source.connect(tap)
      tap.connect(mute).connect(ctx.destination)
      release = () => {
        tap.disconnect()
        source.disconnect()
        stream.getTracks().forEach((t) => t.stop())
        void ctx.close()
      }
      if (stopped) release()
    })
    .catch(() => {
      clearInterval(tick)
      onFail('not-allowed')
    })

  return () => {
    if (stopped) return
    stopped = true
    clearInterval(tick)
    release()
    live?.stop()
    // The last words: queued after any transcription in flight, over everything recorded
    onBusy(true)
    run().finally(() => onBusy(false))
  }
}
