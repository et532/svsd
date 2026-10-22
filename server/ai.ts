import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

// The AI behind the app, as one endpoint: POST /api/ai/<task> answers with JSON. It holds the OpenAI key so the browser
// never sees it. The same `handleAi` runs in two places: the Vite dev / preview server (aiPlugin below, key from
// .env.local) and, once deployed, a Vercel serverless function (api/ai/[task].ts, key from the project's environment
// variables). Five tasks:
//   parse  { text }                      a note about a new person -> the profile fields it states
//   rank   { query, candidates[] }       which candidates really fit all of a search -> fits + a one-line why
//   draft  { person, kind, goal }        a short message to someone, in the user's voice
//   transcribe  (a WAV body)             a recording -> { text }
//   live                                 a short-lived key for streaming speech to text from the browser -> { secret }
// Without a key it answers 503 and the app uses its own rules instead (src/lib/ai.ts). Prompts live here, not in the
// browser. The deployed site is public, so every call is guarded (see guard below): same-site only, a per-visitor rate
// limit, small inputs and capped answers. The hard backstop is a spending limit on the OpenAI key itself.

export type AiEnv = { key?: string; model?: string; transcribeModel?: string; liveModel?: string }

// Cheap, fast (no reasoning step) and good at structured output; in testing 5 candidate models read notes equally
// well and this one was the quickest. Override with OPENAI_MODEL.
const DEFAULT_MODEL = 'gpt-4.1-mini'
// Speech to text for a voice note, sent as a WAV body (POST /api/ai/transcribe?names=A,B&lang=en). Both OpenAI models
// got every name right in testing (even "Saoirse Gallagher"); the mini one is the cheaper. `names` is a hint of who
// might come up.
const DEFAULT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe'
// Live words while you talk: the browser opens its own WebSocket to OpenAI, but with a short-lived key minted here (the
// real key never leaves the server). `gpt-live-transcribe` answers about a second behind the speaker (the other
// streaming models wait for the end of each sentence); it takes no names hint and no turn detection, hence the plain config.
const DEFAULT_LIVE_MODEL = 'gpt-live-transcribe'

const obj = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties })
const text = { type: ['string', 'null'] }
const PERSON_FIELDS = ['name', 'does', 'company', 'from', 'lives', 'met', 'remember', 'goal', 'follow']

type Task = { system: string; schema: object; maxTokens: number; user: (body: Record<string, unknown>) => string | null }

const TASKS: Record<string, Task> = {
  parse: {
    system:
      'You read a short note about a person the user just met. Fill in these fields from the note only: name (full name as written, without a title like Dr.), does (their job as a short noun, e.g. "designer" or "baker", never a verb phrase like "bakes bread"), company, from (where they grew up), lives (where they live now), met (the place or event where the user met them, e.g. "pickleball meetup" or "bar": no "at" or "a"), remember (an interest or hobby of theirs as a short noun phrase, e.g. "rock climbing" or "film photography": not a personality trait or a skill level), goal (something they want to achieve, without "wants to"), follow (a concrete thing the user said they will or should do, e.g. "send her the darkroom link", "grab coffee"). Put each fact in only ONE field: a plan to meet up or catch up is follow, never also goal; an interest is never also goal or follow. Use null for anything the note does not say. Never invent anything.',
    schema: obj(Object.fromEntries(PERSON_FIELDS.map((f) => [f, text]))),
    maxTokens: 400,
    user: (b) => (typeof b.text === 'string' && b.text.trim() && b.text.length <= 4000 ? b.text : null),
  },
  rank: {
    system:
      'The user searched their private list of people. Each candidate is numbered. Decide which candidates satisfy EVERY part of the search (a "software engineer who plays pickleball" needs both; someone who only plays pickleball does not fit). Judge only from the facts given; if the facts do not show it, it does not fit. For each fitting candidate give "why": one short plain sentence (under 14 words) quoting the fact that matches. Reply for every candidate.',
    schema: obj({ results: { type: 'array', items: obj({ i: { type: 'integer' }, fits: { type: 'boolean' }, why: { type: 'string' } }) } }),
    maxTokens: 1200,
    user: (b) => (typeof b.query === 'string' && b.query.length <= 500 && Array.isArray(b.candidates) && b.candidates.length <= 20 ? JSON.stringify({ search: b.query, candidates: b.candidates }) : null),
  },
  draft: {
    system:
      'You write a text message from the user to someone they know. 1-3 short, warm, casual sentences in the first person, the way a friend would text. Use only the facts given and mention one real detail about them if it fits. Say what the goal asks for. No greeting formalities, no emojis, no placeholders like [name], no quotation marks. Reply with just the message.',
    schema: obj({ text: { type: 'string' } }),
    maxTokens: 300,
    user: (b) => (b.person && typeof b.goal === 'string' && b.goal.length <= 1500 ? JSON.stringify({ to: b.person, kind: b.kind, goal: b.goal }) : null),
  },
}

// ---- Guards: the deployed site is public, so nobody else should be able to spend the key ----

// How many calls one visitor (by IP) may make in 10 minutes, per task. Generous for a person using the app, small for a
// script. Counted in memory, so it is per server instance: a good brake, not a hard wall (the OpenAI spending limit is).
const WINDOW_MS = 10 * 60 * 1000
const LIMITS: Record<string, number> = { parse: 30, rank: 60, draft: 60, transcribe: 20, live: 15 }
const hits = new Map<string, number[]>()

// Seconds until this visitor may call `task` again, or 0 when they may now (and counts this call).
export function rateLimited(ip: string, task: string, now = Date.now()): number {
  const key = `${task}:${ip}`
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= (LIMITS[task] ?? 30)) {
    hits.set(key, recent)
    return Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000))
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k)
  return 0
}

// A request that a browser sent from another website (this API is only for our own pages). Scripts that send no
// browser headers are not caught here: the rate limit and the spending limit deal with those.
export function crossSite(h: IncomingHttpHeaders): boolean {
  const site = h['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return true
  const origin = h.origin
  const host = String(h['x-forwarded-host'] ?? h.host ?? '').split(',')[0].trim()
  if (origin && host) {
    try {
      return new URL(origin).host !== host
    } catch {
      return true
    }
  }
  return false
}

const clientIp = (req: IncomingMessage) => String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown'

const MAX_JSON = 64 * 1024
const MAX_AUDIO = 24 * 1024 * 1024 // OpenAI takes up to 25 MB (a Vercel function itself takes 4.5 MB, about 2 minutes of speech)

// The request body, or null when it is bigger than `max`.
async function readBody(req: IncomingMessage, max: number): Promise<Buffer | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > max) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

type Out = { status: number; body: unknown }

async function transcribe(req: IncomingMessage, url: URL, key: string, model: string): Promise<Out> {
  const audio = await readBody(req, MAX_AUDIO)
  if (!audio) return { status: 413, body: { error: 'Recording too long' } }
  if (audio.length < 1000) return { status: 400, body: { error: 'No audio' } }
  const form = new FormData()
  form.append('file', new File([audio], 'note.wav', { type: 'audio/wav' }))
  form.append('model', model)
  form.append('response_format', 'json')
  const names = (url.searchParams.get('names') ?? '').slice(0, 800)
  if (names) form.append('prompt', `A voice note about people the user met or knows. Names that may come up: ${names}.`)
  const lang = url.searchParams.get('lang') ?? ''
  if (/^[a-z]{2}$/.test(lang)) form.append('language', lang)
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(45000),
  })
  if (!r.ok) return { status: 502, body: { error: `OpenAI answered ${r.status}` } }
  const { text } = (await r.json()) as { text?: string }
  return { status: 200, body: { text: text ?? '' } }
}

async function liveSession(key: string, model: string): Promise<Out> {
  const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ session: { type: 'transcription', audio: { input: { format: { type: 'audio/pcm', rate: 24000 }, transcription: { model } } } } }),
  })
  if (!r.ok) return { status: 502, body: { error: `OpenAI answered ${r.status}` } }
  const { value } = (await r.json()) as { value?: string }
  return value ? { status: 200, body: { secret: value } } : { status: 502, body: { error: 'No session key' } }
}

async function chat(req: IncomingMessage, task: Task, key: string, model: string): Promise<Out> {
  const raw = await readBody(req, MAX_JSON)
  if (!raw) return { status: 413, body: { error: 'Request too large' } }
  let user: string | null
  try {
    user = task.user(JSON.parse(raw.toString('utf8')) as Record<string, unknown>)
  } catch {
    user = null
  }
  if (!user) return { status: 400, body: { error: 'Bad request body' } }
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_completion_tokens: task.maxTokens,
      messages: [{ role: 'system', content: task.system }, { role: 'user', content: user }],
      response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: task.schema } },
    }),
  })
  if (!r.ok) return { status: 502, body: { error: `OpenAI answered ${r.status}` } }
  const data = (await r.json()) as { choices: { message: { content: string } }[] }
  return { status: 200, body: JSON.parse(data.choices[0].message.content) }
}

// One request: /api/ai/<task> (on Vite the "/api/ai" part is already cut off, on Vercel it is not: only the last piece
// of the path counts). Works on plain Node request / response objects, so any host can call it.
export async function handleAi(req: IncomingMessage, res: ServerResponse, env: AiEnv): Promise<void> {
  const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.setHeader('cache-control', 'no-store')
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
    res.end(JSON.stringify(body))
  }
  const url = new URL(req.url ?? '/', 'http://localhost')
  const name = url.pathname.split('/').filter(Boolean).pop() ?? ''
  const task = TASKS[name]
  if (!task && name !== 'transcribe' && name !== 'live') return send(404, { error: 'Unknown task' })
  if (req.method !== 'POST') return send(405, { error: 'POST only' }, { allow: 'POST' })
  if (!env.key) return send(503, { error: 'Set OPENAI_API_KEY (.env.local locally, Environment Variables on Vercel)' })
  if (crossSite(req.headers)) return send(403, { error: 'Not allowed from another site' })
  const wait = rateLimited(clientIp(req), name)
  if (wait) return send(429, { error: 'Too many requests, try again in a moment' }, { 'retry-after': String(wait) })
  try {
    const out =
      name === 'transcribe'
        ? await transcribe(req, url, env.key, env.transcribeModel || DEFAULT_TRANSCRIBE_MODEL)
        : name === 'live'
          ? await liveSession(env.key, env.liveModel || DEFAULT_LIVE_MODEL)
          : await chat(req, task, env.key, env.model || DEFAULT_MODEL)
    send(out.status, out.body)
  } catch (e) {
    send(502, { error: e instanceof Error ? e.message : 'request failed' })
  }
}

// The same endpoint on the Vite dev server and on `vite preview` (a production build run locally)
export function aiPlugin(env: AiEnv): Plugin {
  // (returns nothing: Vite would run a returned function as a "after the other middleware" hook)
  const mount = (server: { middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => unknown } }) => {
    server.middlewares.use('/api/ai', (req, res) => void handleAi(req, res, env))
  }
  return { name: 'peepl-ai', configureServer: mount, configurePreviewServer: mount }
}
