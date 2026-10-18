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

export function timeSince(isoDate: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(isoDate).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}
