import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'

// The AI behind the app, as one dev-server endpoint: POST /api/ai/<task> with a JSON body answers with JSON. It holds the
// OpenAI key so the browser never sees it (the key is read from .env.local by vite.config.ts). Five tasks:
//   parse  { text }                      a note about a new person -> the profile fields it states
//   rank   { query, candidates[] }       which candidates really fit all of a search -> fits + a one-line why
//   draft  { person, kind, goal }        a short message to someone, in the user's voice
//   transcribe  (a WAV body)             a recording -> { text }
//   live                                 a short-lived key for streaming speech to text from the browser -> { secret }
// Without a key it answers 503 and the app uses its own rules instead (src/lib/ai.ts). Prompts live here, not in the
// browser, so a serverless version of this file can be dropped in for a deployed build.
// ponytail: dev-server only; a static deploy needs these same handlers as a serverless function

// Cheap, fast (no reasoning step) and good at structured output; in testing 5 candidate models read notes equally
// well and this one was the quickest. Override with OPENAI_MODEL in .env.local.
const DEFAULT_MODEL = 'gpt-4.1-mini'

const obj = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties })
const text = { type: ['string', 'null'] }
const PERSON_FIELDS = ['name', 'does', 'company', 'from', 'lives', 'met', 'remember', 'goal', 'follow']

type Task = { system: string; schema: object; user: (body: Record<string, unknown>) => string | null }

const TASKS: Record<string, Task> = {
  parse: {
    system:
      'You read a short note about a person the user just met. Fill in these fields from the note only: name (full name as written, without a title like Dr.), does (their job as a short noun, e.g. "designer" or "baker", never a verb phrase like "bakes bread"), company, from (where they grew up), lives (where they live now), met (the place or event where the user met them, e.g. "pickleball meetup" or "bar": no "at" or "a"), remember (something they like or do), goal (something they want to do, without "wants to"), follow (something the user owes or should do for them). Use null for anything the note does not say. Never invent anything.',
    schema: obj(Object.fromEntries(PERSON_FIELDS.map((f) => [f, text]))),
    user: (b) => (typeof b.text === 'string' && b.text.trim() && b.text.length <= 4000 ? b.text : null),
  },
  rank: {
    system:
      'The user searched their private list of people. Each candidate is numbered. Decide which candidates satisfy EVERY part of the search (a "software engineer who plays pickleball" needs both; someone who only plays pickleball does not fit). Judge only from the facts given; if the facts do not show it, it does not fit. For each fitting candidate give "why": one short plain sentence (under 14 words) quoting the fact that matches. Reply for every candidate.',
    schema: obj({ results: { type: 'array', items: obj({ i: { type: 'integer' }, fits: { type: 'boolean' }, why: { type: 'string' } }) } }),
    user: (b) => (typeof b.query === 'string' && Array.isArray(b.candidates) && b.candidates.length <= 20 ? JSON.stringify({ search: b.query, candidates: b.candidates }) : null),
  },
  draft: {
    system:
      'You write a text message from the user to someone they know. 1-3 short, warm, casual sentences in the first person, the way a friend would text. Use only the facts given and mention one real detail about them if it fits. Say what the goal asks for. No greeting formalities, no emojis, no placeholders like [name], no quotation marks. Reply with just the message.',
    schema: obj({ text: { type: 'string' } }),
    user: (b) => (b.person && typeof b.goal === 'string' ? JSON.stringify({ to: b.person, kind: b.kind, goal: b.goal }) : null),
  },
}

// Speech to text for a voice note, sent as a WAV body (POST /api/ai/transcribe?names=A,B&lang=en). Both OpenAI models
// got every name right in testing (even "Saoirse Gallagher"); the mini one is the cheaper. `names` is a hint of who
// might come up.
const TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe'
const MAX_AUDIO = 24 * 1024 * 1024 // OpenAI takes up to 25 MB

async function transcribe(req: IncomingMessage, url: URL, key: string, model: string): Promise<{ status: number; body: unknown }> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > MAX_AUDIO) return { status: 413, body: { error: 'Recording too long' } }
    chunks.push(chunk)
  }
  const audio = Buffer.concat(chunks)
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

// Live words while you talk: the browser opens its own WebSocket to OpenAI, but with a short-lived key minted here (the
// real key never leaves the server). `gpt-live-transcribe` answers about a second behind the speaker (the other
// streaming models wait for the end of each sentence); it takes no names hint and no turn detection, hence the plain config.
const LIVE_MODEL = 'gpt-live-transcribe'

async function liveSession(key: string, model: string): Promise<{ status: number; body: unknown }> {
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

export function aiPlugin(key: string | undefined, model = DEFAULT_MODEL, transcribeModel = TRANSCRIBE_MODEL, liveModel = LIVE_MODEL): Plugin {
  return {
    name: 'peepl-ai',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const name = url.pathname.replace(/^\//, '')
        if (name === 'transcribe') {
          if (req.method !== 'POST') return send(405, { error: 'POST only' })
          if (!key) return send(503, { error: 'Set OPENAI_API_KEY in .env.local' })
          try {
            const out = await transcribe(req, url, key, transcribeModel)
            return send(out.status, out.body)
          } catch (e) {
            return send(502, { error: e instanceof Error ? e.message : 'request failed' })
          }
        }
        if (name === 'live') {
          if (req.method !== 'POST') return send(405, { error: 'POST only' })
          if (!key) return send(503, { error: 'Set OPENAI_API_KEY in .env.local' })
          try {
            const out = await liveSession(key, liveModel)
            return send(out.status, out.body)
          } catch (e) {
            return send(502, { error: e instanceof Error ? e.message : 'request failed' })
          }
        }
        const task = TASKS[name]
        if (!task) return send(404, { error: 'Unknown task' })
        if (req.method !== 'POST') return send(405, { error: 'POST only' })
        if (!key) return send(503, { error: 'Set OPENAI_API_KEY in .env.local' })
        let raw = ''
        for await (const chunk of req) raw += chunk
        try {
          const user = task.user(JSON.parse(raw) as Record<string, unknown>)
          if (!user) return send(400, { error: 'Bad request body' })
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              model,
              temperature: 0.3,
              messages: [{ role: 'system', content: task.system }, { role: 'user', content: user }],
              response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: task.schema } },
            }),
          })
          if (!r.ok) return send(502, { error: `OpenAI answered ${r.status}` })
          const data = (await r.json()) as { choices: { message: { content: string } }[] }
          send(200, JSON.parse(data.choices[0].message.content))
        } catch (e) {
          send(502, { error: e instanceof Error ? e.message : 'request failed' })
        }
      })
    },
  }
}
