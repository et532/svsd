import type { Person } from '../data/people'
import type { Action, AskResult, Match } from './ask'
import { firstName } from './people'
import { closestMatches } from './semantic'

// The browser side of the AI (the key and prompts are in server/ai.ts, behind the dev server's /api/ai/<task>). Every
// call can come back empty (no key, offline, a static deploy, a slow answer), and every caller then does what the app
// did before AI: regex for notes, rules + meaning search for Find, a template for drafts.

type Task = 'parse' | 'rank' | 'draft' | 'live'

// After the first "not available" (503 no key, 404 no endpoint) stop asking, so there is no failed request per search
let off = false

// Whether the server has an AI key at all: one cheap request, remembered. The voice code uses it to skip downloading
// local speech models (and showing "getting the voice model ready") when OpenAI will do the listening. A network
// error counts as "not ready" for now without switching the AI off for good.
let ready: Promise<boolean> | undefined
export const aiReady = () =>
  (ready ??= fetch('/api/ai/status')
    .then(async (r) => {
      const ok = r.ok && ((await r.json()) as { ready?: boolean }).ready === true
      if (!ok) off = true
      return ok
    })
    .catch(() => false))

export async function ai<T>(task: Task, body: unknown, ms = 10000): Promise<T | null> {
  if (off) return null
  try {
    const r = await fetch(`/api/ai/${task}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    })
    if (r.status === 503 || r.status === 404) off = true
    if (!r.ok || !r.headers.get('content-type')?.includes('json')) return null
    return (await r.json()) as T
  } catch (e) {
    console.debug(`AI ${task} skipped:`, e)
    return null
  }
}

// 16-bit mono WAV, which is what /api/ai/transcribe takes
export function toWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true) // fmt chunk size
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true) // bytes per second
  v.setUint16(32, 2, true) // bytes per sample
  v.setUint16(34, 16, true) // bits
  str(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true))
  return new Blob([buf], { type: 'audio/wav' })
}

// The text of a recording, from OpenAI (more accurate than the local Whisper, and it is told who might be named), or
// null when that isn't available: the caller then uses the local model.
export async function transcribeWithAi(audio: Float32Array, rate: number, names: string[]): Promise<string | null> {
  if (off) return null
  try {
    const params = new URLSearchParams({ names: names.join(', ').slice(0, 800), lang: (navigator.language || 'en').slice(0, 2).toLowerCase() })
    const r = await fetch(`/api/ai/transcribe?${params}`, { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: toWav(audio, rate), signal: AbortSignal.timeout(45000) })
    if (r.status === 503 || r.status === 404) off = true
    if (!r.ok || !r.headers.get('content-type')?.includes('json')) return null
    return ((await r.json()) as { text?: string }).text?.trim() || null
  } catch (e) {
    console.debug('AI transcription skipped:', e)
    return null
  }
}

// The streaming model wants 24 kHz 16-bit PCM, sent as base64; the recorder runs at 16 kHz, so this resamples by 1.5
// (linear interpolation, fine for speech).
const LIVE_RATE = 24000
export function pcm24(samples: Float32Array, rate = 16000): string {
  const n = Math.floor((samples.length * LIVE_RATE) / rate)
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const at = (i * rate) / LIVE_RATE
    const a = Math.floor(at)
    const s = samples[a] * (1 - (at - a)) + samples[Math.min(a + 1, samples.length - 1)] * (at - a)
    out[i] = Math.max(-1, Math.min(1, s)) * 0x7fff
  }
  let bin = ''
  const bytes = new Uint8Array(out.buffer)
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

// Live words while the user talks, streamed from OpenAI (about a second behind the speaker, far more accurate than the
// small local model). Feed it the recorder's audio; `onText` gets everything heard so far. Quietly does nothing when AI
// isn't available (no key, offline), and the caller keeps using its local words. Audio fed before the connection is
// open is kept and sent as soon as it is, so it can be started the moment the mic button is tapped (before the
// browser's permission prompt is answered); each chunk says what rate it was recorded at.
export function startAiLive(onText: (text: string) => void): { feed(samples: Float32Array, rate?: number): void; stop(): void } {
  let ws: WebSocket | undefined
  let over = false // stopped, or the AI isn't available: stop collecting audio
  const queue: string[] = []
  const parts = new Map<string, string>() // what each stretch of speech (an item) says so far, in order of arrival
  const send = (s: WebSocket, audio: string) => s.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }))
  const show = () => onText([...parts.values()].join('').replace(/\s+/g, ' ').trim())

  void ai<{ secret: string }>('live', {}).then((r) => {
    if (!r || over) {
      over = true
      queue.length = 0
      return
    }
    const sock = new WebSocket('wss://api.openai.com/v1/realtime?intent=transcription', ['realtime', `openai-insecure-api-key.${r.secret}`])
    ws = sock
    sock.onopen = () => queue.splice(0).forEach((a) => send(sock, a))
    sock.onmessage = (m) => {
      if (over) return // stopped: the final text takes over, late words would only make it jump
      const ev = JSON.parse(m.data as string) as { type: string; item_id?: string; delta?: string; transcript?: string }
      if (!ev.item_id) return
      if (ev.type === 'conversation.item.input_audio_transcription.delta') parts.set(ev.item_id, (parts.get(ev.item_id) ?? '') + (ev.delta ?? ''))
      else if (ev.type === 'conversation.item.input_audio_transcription.completed') parts.set(ev.item_id, ` ${ev.transcript ?? ''}`)
      else return
      show()
    }
    sock.onerror = sock.onclose = () => {
      over = true
    }
  })

  return {
    feed(samples, rate = 16000) {
      if (over) return
      const audio = pcm24(samples, rate)
      if (ws?.readyState === WebSocket.OPEN) send(ws, audio)
      else queue.push(audio)
    },
    stop() {
      over = true
      ws?.close()
    },
  }
}

const clip = (s: string | undefined, n: number) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : (s ?? ''))

// What the model may know about someone: their profile, never their id. Names only go in a draft (it greets them).
const facts = (p: Person) => ({
  job: p.profession,
  lives: p.livesNow.city,
  from: p.from.city,
  met: p.met.context,
  tags: p.tags,
  story: clip(p.story, 240),
  recent: (p.moments ?? []).slice(0, 2).map((m) => clip(m.transcript ?? m.text ?? m.title, 120)),
})

// Find: the rules and the meaning search suggest people; the AI says which really fit every part of the question
// ("software engineer who plays pickleball" needs both) and why. People the rules matched exactly stay.
const POOL = 12

export async function rankWithAi(query: string, result: AskResult, people: Person[]): Promise<AskResult> {
  if (result.kind !== 'people') return result
  const exact = result.matches
  const seen = new Set(exact.map((m) => m.person.id))
  const pool: Match[] = []
  for (const m of [...(result.near ?? []), ...(await closestMatches(query, people, POOL))])
    if (!seen.has(m.person.id) && !pool.some((x) => x.person.id === m.person.id)) pool.push(m)
  const out = pool.length ? await ai<{ results: { i: number; fits: boolean; why: string }[] }>('rank', { query, candidates: pool.map((m, i) => ({ i, ...facts(m.person) })) }) : null
  if (!out) return result

  const verdict = new Map(out.results.map((r) => [r.i, r]))
  const fit: Match[] = []
  const notQuite: Match[] = []
  pool.forEach((m, i) => {
    const v = verdict.get(i)
    if (v?.fits) fit.push({ ...m, why: v.why || m.why })
    else notQuite.push(m)
  })
  const matches = [...exact, ...fit].slice(0, 10).map((m) => ({ ...m, action: m.action ?? reachOut(m.person, query, m.why) }))
  return {
    kind: 'people',
    title: matches.length ? `${matches.length} ${matches.length === 1 ? 'person' : 'people'} for “${query}”` : `No one matches “${query}” yet`,
    matches,
    near: matches.length ? undefined : notQuite.slice(0, 2),
  }
}

// A "Draft a message" button on any result the AI found; the text is written when it is tapped
const reachOut = (p: Person, query: string, why: string): Action => ({
  kind: 'message',
  label: 'Draft a message',
  to: p.name,
  draft: '',
  // They are the answer to the search, so the message asks them for it directly (not for someone else)
  goal: `The user was looking for: “${query}”, and ${firstName(p.name)} is the person who fits (${why}). Write to ${firstName(p.name)} and ask for exactly that.`,
})

// A message to someone, written from what you know about them. The template draft (or a plain hello) is the fallback.
export async function draftMessage(person: Person, action: Action): Promise<string> {
  const first = firstName(person.name)
  const out = await ai<{ text: string }>('draft', { person: { name: first, ...facts(person) }, kind: action.kind, goal: action.goal ?? action.draft }, 15000)
  return out?.text.trim() || action.draft || `Hey ${first}! Hope you’re doing well. Want to catch up soon?`
}
