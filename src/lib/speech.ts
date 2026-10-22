import { aiReady, startAiLive, transcribeWithAi } from './ai'

// Voice-to-text. First choice is the browser's built-in speech recognition (Chrome / Edge / Safari): live words, but
// Chrome sends the audio to Google. Brave, Firefox and other builds cannot use that service ("network" error, or no API
// at all), so there the mic is recorded and OpenAI does the listening (ai.ts): the words stream in about a second behind
// you, and after Stop the whole recording is transcribed once more for the accurate final text. There are no local speech
// models any more (user's call 2026-10-22: no download, the AI will work); without OpenAI (no key, offline) those
// browsers get "type instead".

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

// Brave has the built-in API but blocks the Google service behind it, so it would only fail after a delay
const recordsMic = !Ctor || 'brave' in navigator

// Starts listening and returns a stop function, or null when there is no way to hear (an insecure page with no mic
// API at all), so the caller can fall back to the scripted demo.
// - onText: everything heard so far (the whole text, replacing the last).
// - onFail: the reason when the mic is blocked or nothing works.
// - onBusy: true while the last of a recording is being transcribed after stop (text is coming).
// - hints: names that may be said (people you know), to help the transcription spell them right.
export function listen(
  onText: (text: string) => void,
  onFail: (reason: string) => void,
  onBusy: (busy: boolean) => void,
  hints: () => string[] = () => [],
): (() => void) | null {
  if (!Ctor && !navigator.mediaDevices?.getUserMedia) return null
  let stopMic = () => {}
  const fallToMic = () => (stopMic = recordMic(onText, onFail, onBusy, hints))
  if (recordsMic) {
    fallToMic()
    return () => stopMic()
  }

  const rec = new Ctor!()
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
    else fallToMic() // the speech service is unreachable here: record and let OpenAI listen instead
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
    fallToMic()
  }
  return () => {
    on = false
    rec.abort()
    stopMic()
  }
}

const RATE = 16000 // what the recording is kept at, and what is sent to OpenAI for the final text

const join = (a: Float32Array[]) => {
  const out = new Float32Array(a.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of a) out.set(c, (at += c.length) - c.length)
  return out
}
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / (a.length || 1))

// Records the mic as 16 kHz mono and lets OpenAI listen. While it runs, the words stream in as they are said (ai.ts
// startAiLive); when stopped, OpenAI transcribes the whole recording for the accurate final text (a Vercel function takes
// ~2 minutes of speech; a longer one keeps the streamed words). If OpenAI isn't available, voice says so and the
// caller drops back to typing.
function recordMic(onText: (t: string) => void, onFail: (reason: string) => void, onBusy: (b: boolean) => void, hints: () => string[]) {
  let stopped = false
  let release = () => {}
  const chunks: Float32Array[] = []
  let heard = false

  // The OpenAI connection opens now, at the tap, so it is ready by the time the mic permission is answered (audio is
  // kept until it is open)
  const ailive = startAiLive((t) => {
    heard = true
    onText(t)
  })
  const fail = (reason: string) => {
    if (stopped) return
    stopped = true
    release()
    ailive.stop()
    onFail(reason)
  }
  void aiReady().then((ready) => ready || fail('unavailable'))

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      const ctx = new AudioContext({ sampleRate: RATE })
      const source = ctx.createMediaStreamSource(stream)
      // ponytail: ScriptProcessor is deprecated but works in every browser without a separate worklet file
      const tap = ctx.createScriptProcessor(4096, 1, 1)
      tap.onaudioprocess = (e) => {
        const samples = new Float32Array(e.inputBuffer.getChannelData(0))
        chunks.push(samples)
        ailive.feed(samples, ctx.sampleRate)
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
    .catch(() => fail('not-allowed'))

  return () => {
    if (stopped) return
    stopped = true
    release()
    ailive.stop()
    // The final text: OpenAI reads the whole recording once more. If that fails the streamed words stay; if there are
    // none either, voice isn't working. (Silence or a tap that was too short has nothing to transcribe.)
    const audio = join(chunks)
    if (audio.length < RATE * 0.8 || rms(audio) < 0.003) return
    onBusy(true)
    void transcribeWithAi(audio, RATE, hints())
      .then((text) => {
        const clean = text?.replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
        if (clean) onText(clean)
        else if (!heard) onFail('unavailable')
      })
      .finally(() => onBusy(false))
  }
}
