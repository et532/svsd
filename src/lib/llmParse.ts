import { ai } from './ai'
import { refined, type Draft } from './capture'

// Reads a note about someone new with the AI (the "parse" task, see server/ai.ts) and keeps what it found in `refined`,
// which parsePerson prefers over its regex. If the AI is unavailable the regex answer stands.

const cut = (v: string) => (v.length <= 44 ? v : v.slice(0, 44).replace(/\s+\S*$/, '') + '…')

export async function refine(text: string): Promise<void> {
  const t = text.trim()
  if (!t || refined.has(t)) return
  const json = await ai<Record<string, unknown>>('parse', { text: t })
  if (!json) return
  const get = (k: string) => (typeof json[k] === 'string' ? (json[k] as string).trim() : '')
  const out: Draft = {}
  // Names and places must really be in the note: a model sometimes makes them up
  for (const k of ['name', 'company', 'from', 'lives'] as const) {
    const v = get(k)
    if (v && t.toLowerCase().includes(v.toLowerCase())) out[k] = k === 'name' ? v.replace(/^(?:Dr|Mr|Mrs|Ms|Prof)\.?\s+/, '') : v
  }
  for (const k of ['does', 'met', 'remember', 'follow'] as const) {
    const v = k === 'met' ? get(k).replace(/^(?:at|in|through)\s+/i, '').replace(/^(?:an?|the)\s+/i, '') : get(k)
    if (v) out[k] = cut(v)
  }
  // An interest ("rock climbing") reads like the regex's ("Loves rock climbing"), which tags and to-dos expect
  if (out.remember && !/^(?:loves?|likes?|enjoys?|into|plays?|climbs?|runs?|collects?|obsessed|passionate)\b/i.test(out.remember)) out.remember = cut(`Loves ${out.remember}`)
  const goal = get('goal')
  if (goal) out.goal = cut(/^wants? to/i.test(goal) ? goal : `Wants to ${goal}`)
  refined.set(t, out)
}
