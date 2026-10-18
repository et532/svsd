import { samplePeople, type Context, type Person } from '../data/people'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

// Matches name, work, story, tags, places, and where you met.
export function matchesQuery(person: Person, query: string): boolean {
  const q = normalize(query.trim())
  if (!q) return true
  const haystack = [
    person.name,
    person.profession,
    person.story,
    ...person.tags,
    person.from.city,
    person.met.city,
    person.met.context,
    person.livesNow.city,
  ]
    .map(normalize)
    .join(' ')
  return q.split(/\s+/).every((word) => haystack.includes(word))
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Peepl foundation: hue = how you know someone. [core, deep, wash] per context.
const contextHues: Record<Context, [string, string, string]> = {
  work: ['#2f4fd0', '#1b2c86', '#dde3fb'],
  social: ['#ec5a32', '#8f2f16', '#fde0d4'],
  community: ['#e8c22e', '#6e5600', '#fbf0c4'],
  family: ['#d6347f', '#8a1a50', '#fadbe8'],
  unsorted: ['#a99d93', '#5b5361', '#ebe5de'],
}

// The core color for a kind of relationship (work, social...), for legends.
export const contextColor = (c: Context) => contextHues[c][0]

function personById(id: string): Person | undefined {
  return samplePeople.find((p) => p.id === id)
}

function hues(id: string) {
  return contextHues[personById(id)?.context ?? 'unsorted']
}

// Aura depth 1-3 = how close you are. There is no closeness field yet, so it follows how recently
// you were in touch: this month = 3, last four months = 2, longer = 1.
export function auraDepth(id: string, now = new Date()): 1 | 2 | 3 {
  const last = personById(id)?.lastContacted
  if (!last) return 1
  const days = (now.getTime() - new Date(last).getTime()) / 86_400_000
  return days <= 30 ? 3 : days <= 120 ? 2 : 1
}

// Initials sit on the core color: white on the dark cores, ink on the light ones.
export function orbTextColor(id: string): string {
  const ctx = personById(id)?.context ?? 'unsorted'
  return ctx === 'community' || ctx === 'unsorted' ? 'var(--ink)' : '#ffffff'
}

// A person's core hue, used for their glowing dot on the map (matches their avatar).
export function personColor(id: string): string {
  return hues(id)[0]
}

// Different looks for the gradient orb avatars. The colors are the same per person
// (from orbPalette); only the shape/arrangement of the gradient changes.
export type PfpStyle = 'aura' | 'sphere' | 'soft' | 'duotone' | 'mesh' | 'aurora' | 'vivid'

export const pfpStyles: { id: PfpStyle; name: string }[] = [
  { id: 'aura', name: 'Aura' },
  { id: 'sphere', name: 'Sphere' },
  { id: 'soft', name: 'Soft' },
  { id: 'duotone', name: 'Duotone' },
  { id: 'mesh', name: 'Mesh' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'vivid', name: 'Vivid' },
]

// A gradient for a person's avatar, stable for each person, in the chosen style.
export function orbBackground(id: string, style: PfpStyle = 'sphere'): string {
  const [glow, deep, base] = hues(id)
  const accent = glow
  switch (style) {
    case 'aura': {
      // Foundation aura: depth 1 flat core to wash, 2 two-tone, 3 deep heart with a highlight.
      const d = auraDepth(id)
      if (d === 1) return `radial-gradient(circle at 50% 50%, ${glow} 0%, ${base} 74%)`
      if (d === 2)
        return [
          `radial-gradient(circle at 40% 38%, ${glow} 0%, transparent 58%)`,
          `radial-gradient(circle at 66% 68%, ${glow} 0%, transparent 62%)`,
          base,
        ].join(', ')
      return [
        `radial-gradient(circle at 46% 48%, ${deep} 0%, transparent 34%)`,
        `radial-gradient(circle at 32% 30%, ${glow} 0%, transparent 58%)`,
        'radial-gradient(circle at 74% 26%, #fff 0%, transparent 18%)',
        base,
      ].join(', ')
    }
    case 'soft':
      return [
        'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.9) 0, rgba(255,255,255,0) 46%)',
        `radial-gradient(circle at 78% 80%, ${accent} 0, transparent 72%)`,
        `radial-gradient(circle at 20% 82%, ${glow} 0, transparent 70%)`,
        base,
      ].join(', ')
    case 'duotone':
      return `linear-gradient(140deg, ${glow} 0%, ${accent} 100%)`
    case 'mesh':
      return [
        `radial-gradient(circle at 16% 18%, ${glow} 0, transparent 52%)`,
        `radial-gradient(circle at 84% 22%, ${accent} 0, transparent 52%)`,
        `radial-gradient(circle at 22% 86%, ${accent} 0, transparent 50%)`,
        `radial-gradient(circle at 82% 82%, ${glow} 0, transparent 52%)`,
        base,
      ].join(', ')
    case 'aurora':
      return [
        'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.8) 0, rgba(255,255,255,0) 38%)',
        `conic-gradient(from 210deg at 50% 50%, ${glow}, ${accent}, ${base}, ${glow})`,
      ].join(', ')
    case 'vivid':
      return [
        'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.92) 0, rgba(255,255,255,0) 22%)',
        `radial-gradient(circle at 72% 74%, ${accent} 0, transparent 52%)`,
        `radial-gradient(circle at 24% 78%, ${glow} 0, transparent 48%)`,
        base,
      ].join(', ')
    case 'sphere':
    default:
      return [
        'radial-gradient(circle at 30% 26%, rgba(255,255,255,0.95) 0, rgba(255,255,255,0) 34%)',
        `radial-gradient(circle at 76% 78%, ${accent} 0, transparent 62%)`,
        `radial-gradient(circle at 22% 80%, ${glow} 0, transparent 58%)`,
        base,
      ].join(', ')
  }
}

export function timeSince(isoDate: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(isoDate).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// Symmetric, de-duplicated links between the given people (ignores ids that aren't in the list).
export function linksOf(people: Person[]): [string, string][] {
  const ids = new Set(people.map((p) => p.id))
  const seen = new Set<string>()
  const links: [string, string][] = []
  for (const p of people)
    for (const other of p.knows) {
      const key = [p.id, other].sort().join('|')
      if (!ids.has(other) || other === p.id || seen.has(key)) continue
      seen.add(key)
      links.push([p.id, other])
    }
  return links
}
