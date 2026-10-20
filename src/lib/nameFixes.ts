import type { Person } from '../data/people'
import { parsePerson } from './capture'

// Speech-to-text gets names wrong. When the user corrects one, the fix is kept (what it heard -> what they meant,
// per browser) and applied to every later transcript. Names may be first name only.

const KEY = 'peepl.nameFixes.v1'
const mock = new URLSearchParams(window.location.search).has('mock')

function load(): Record<string, string> {
  if (mock) return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

let fixes = load()

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const word = (name: string) => new RegExp(`\\b${esc(name)}\\b`, 'gi')

export function replaceName(text: string, from: string, to: string) {
  return text.replace(word(from), to)
}

// Remembers heard -> meant. A full name also fixes the first name alone ("Jorden" -> "Jordan") when the last name matches.
export function saveFix(heard: string, meant: string) {
  const next = { ...fixes }
  const h = heard.split(' ')
  const m = meant.split(' ')
  const pairs = [[heard, meant]]
  if (h.length > 1 && h[h.length - 1] === m[m.length - 1]) pairs.push([h[0], m[0]])
  for (const [a, b] of pairs) {
    if (a.toLowerCase() === b.toLowerCase()) delete next[a.toLowerCase()]
    else next[a.toLowerCase()] = b
  }
  fixes = next
  if (!mock)
    try {
      localStorage.setItem(KEY, JSON.stringify(fixes))
    } catch {
      // Not saved; still applies this session.
    }
}

// Applies the remembered fixes. `fixed` lists [heard, meant] for what changed, to show the "Jorden → Jordan" chip.
export function applyFixes(text: string): { text: string; fixed: [string, string][] } {
  const fixed: [string, string][] = []
  // Longest first, so "Jorden Lee" wins over "Jorden"
  for (const heard of Object.keys(fixes).sort((a, b) => b.length - a.length)) {
    const hit = text.match(word(heard))
    if (hit && hit[0] !== fixes[heard]) {
      fixed.push([hit[0], fixes[heard]])
      text = replaceName(text, heard, fixes[heard])
    }
  }
  return { text, fixed }
}

// Names in a note: the one capture reads as new, plus anyone you know (full name if said, else first name).
export function detectNames(text: string, people: Person[]): string[] {
  const out: string[] = []
  const add = (n?: string) => {
    if (n && !out.some((o) => o.toLowerCase() === n.toLowerCase())) out.push(n)
  }
  add(parsePerson(text, people).name)
  for (const p of people) {
    const first = p.name.split(' ')[0]
    if (text.includes(p.name)) add(p.name)
    else if (word(first).test(text)) add(first)
  }
  // Not "Jordan" when "Jordan Lee" is already there
  return out.filter((n) => text.includes(n) && !out.some((o) => o !== n && word(n).test(o)))
}

// The note cut around its names: plain text at even indexes, a name at odd ones.
export function splitNames(text: string, names: string[]): string[] {
  const longestFirst = [...names].sort((a, b) => b.length - a.length)
  return text.split(new RegExp(`\\b(${longestFirst.map(esc).join('|')})\\b`, 'gi'))
}

// Links a correction to someone you know: a first name that only one person has becomes their full name.
export function resolveName(typed: string, people: Person[]): string {
  const t = typed.trim().toLowerCase()
  const exact = people.find((p) => p.name.toLowerCase() === t)
  if (exact) return exact.name
  if (t.includes(' ')) return typed.trim()
  const same = people.filter((p) => p.name.split(' ')[0].toLowerCase() === t)
  return same.length === 1 ? same[0].name : typed.trim()
}
