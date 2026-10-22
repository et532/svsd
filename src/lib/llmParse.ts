import { refined, type Draft } from './capture'
import { preload, runParse } from './ml'

// Reads a note about someone new with a small local language model (no API key, runs in the ml worker) and keeps
// what it found in `refined`, which parsePerson prefers over its regex. Anything that goes wrong (model still
// downloading, bad JSON, timeout) just leaves the regex answer in place.

const SYSTEM = `You read a short note about a person the user just met. Reply with one JSON object and nothing else, with these keys: "name" (full name), "does" (their job title only, e.g. "designer"), "company", "from" (where they grew up), "lives" (where they live now), "met" (where or how the user met them, e.g. "pickleball meetup"), "remember" (something they like or do), "goal" (something they want to do), "follow" (something the user owes or should do for them). Use null for anything the note does not say. Never invent anything.`

// One worked example, as an earlier turn of the chat: a 0.5B model copies a shown answer far better than it follows rules
const EXAMPLE_NOTE = 'Met Sam Ortiz at a pottery class. He is an architect at Gensler, grew up in Denver and now lives in Chicago. Loves hiking and wants to run a marathon. I owe him a book recommendation.'
const EXAMPLE_REPLY = '{"name":"Sam Ortiz","does":"architect","company":"Gensler","from":"Denver","lives":"Chicago","met":"pottery class","remember":"loves hiking","goal":"run a marathon","follow":"send a book recommendation"}'

// Experimental, so off unless the page is opened with ?llm: the 0.5B model is a ~480 MB download and, in testing, did not
// follow the JSON format reliably (a bigger one, Qwen2.5-1.5B at 1.2 GB, was too slow to judge). Try bigger models in
// ml.worker.ts (LLM) before turning it on for everyone.
const ON = new URLSearchParams(location.search).has('llm')

// The first use also downloads the model, so don't make anyone wait for it forever
const WAIT_MS = 8000

export const warmUpParser = () => {
  if (ON) preload('llm').catch((e) => console.warn('Language model failed to load:', e))
}

const cut = (v: string) => (v.length <= 44 ? v : v.slice(0, 44).replace(/\s+\S*$/, '') + '…')

export async function refine(text: string): Promise<void> {
  const t = text.trim()
  if (!ON || !t || refined.has(t)) return
  try {
    const raw = await Promise.race([
      runParse([
        { role: 'system', content: SYSTEM },
        { role: 'user', content: EXAMPLE_NOTE },
        { role: 'assistant', content: EXAMPLE_REPLY },
        { role: 'user', content: t },
      ]),
      new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), WAIT_MS)),
    ])
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Record<string, unknown>
    const get = (k: string) => (typeof json[k] === 'string' ? (json[k] as string).trim() : '')
    const out: Draft = {}
    // Names and places must really be in the note: a small model sometimes makes them up
    const grounded = (k: 'name' | 'company' | 'from' | 'lives') => {
      const v = get(k)
      if (v && t.toLowerCase().includes(v.toLowerCase())) out[k] = v
    }
    grounded('name')
    grounded('company')
    grounded('from')
    grounded('lives')
    for (const [k, to] of [['does', 'does'], ['met', 'met'], ['remember', 'remember'], ['follow', 'follow']] as const) {
      const v = get(k)
      if (v) out[to] = cut(v)
    }
    const goal = get('goal')
    if (goal) out.goal = cut(/^wants? to/i.test(goal) ? goal : `Wants to ${goal}`)
    refined.set(t, out)
  } catch (e) {
    // keep the regex answer
    console.warn('Language model parse skipped:', e)
  }
}
