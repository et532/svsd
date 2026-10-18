import type { Person } from '../data/people'

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

// Soft pastel palettes for the gradient orb avatars: [glow, accent, base].
const orbPalettes = [
  ['#ffb48f', '#ff9fc4', '#ffe6d9'],
  ['#a8b6ff', '#d6b8ff', '#eef0ff'],
  ['#8fe0c6', '#b6dcff', '#ecfbf5'],
  ['#ffd27f', '#ffa3a3', '#fff3dc'],
  ['#c4a8ff', '#92d4ff', '#f1ebff'],
  ['#ff9fca', '#ffc7a6', '#fff0f6'],
]

function orbPalette(id: string) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return orbPalettes[(hash >>> 0) % orbPalettes.length]
}

// A person's main pastel color, used for their glowing dot on the map (matches their avatar).
export function personColor(id: string): string {
  return orbPalette(id)[0]
}

// Different looks for the gradient orb avatars. The colors are the same per person
// (from orbPalette); only the shape/arrangement of the gradient changes.
export type PfpStyle = 'sphere' | 'soft' | 'duotone' | 'mesh' | 'aurora' | 'vivid'

export const pfpStyles: { id: PfpStyle; name: string }[] = [
  { id: 'sphere', name: 'Sphere' },
  { id: 'soft', name: 'Soft' },
  { id: 'duotone', name: 'Duotone' },
  { id: 'mesh', name: 'Mesh' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'vivid', name: 'Vivid' },
]

// A gradient for a person's avatar, stable for each person, in the chosen style.
export function orbBackground(id: string, style: PfpStyle = 'sphere'): string {
  const [glow, accent, base] = orbPalette(id)
  switch (style) {
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
