import type { Context, Person } from '../data/people'
import { contextColor } from './people'

// What the mindmap's dot colors mean. Chosen from the filter in the search bar; 'relationship' uses the avatar
// colors, the others rank values by how many people share them.
export type ColorBy = 'relationship' | 'city' | 'job' | 'recent'

export const colorOptions: { id: ColorBy; label: string }[] = [
  { id: 'relationship', label: 'Relationship' },
  { id: 'city', label: 'City' },
  { id: 'job', label: 'Job' },
  { id: 'recent', label: 'Last seen' },
]

export const colorKey: Record<ColorBy, (p: Person) => string> = {
  relationship: (p) => p.context,
  city: (p) => p.livesNow.city,
  job: (p) => p.profession,
  recent: (p) => {
    const days = (Date.now() - new Date(p.lastContacted).getTime()) / 86_400_000
    return days <= 30 ? 'This month' : days <= 120 ? 'Past 4 months' : 'Longer ago'
  },
}

export type KeyEntry = { label: string; color: string }

// The same colors as the avatars on the list
const legend: { id: Context; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'social', label: 'Social' },
  { id: 'community', label: 'Community' },
  { id: 'family', label: 'Family' },
]

const palette = ['#2f4fd0', '#ec5a32', '#e8c22e', '#d6347f', '#2fa38a', '#8a5cd6']
const otherColor = '#b9b2c2'

// A color for each value, most common first; anything past the palette is grey "Other". `entries` is the key.
export function colorScale(people: Person[], colorBy: ColorBy): { of: Map<string, string>; entries: KeyEntry[] } {
  const count = new Map<string, number>()
  for (const p of people) count.set(colorKey[colorBy](p), (count.get(colorKey[colorBy](p)) ?? 0) + 1)
  const ranked = [...count].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  const of = new Map(ranked.map((k, i) => [k, palette[i] ?? otherColor]))
  if (colorBy === 'relationship') return { of, entries: legend.map((l) => ({ label: l.label, color: contextColor(l.id) })) }
  const entries = ranked.slice(0, palette.length).map((k) => ({ label: k, color: of.get(k)! }))
  if (ranked.length > palette.length) entries.push({ label: 'Other', color: otherColor })
  return { of, entries }
}
