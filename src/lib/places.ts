import { METROS, PLACES, type PlaceRec } from '../data/gazetteer'

// Place understanding without a geocoder: text -> a place in the gazetteer, and how near two places are.

export type { PlaceRec }

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9.\s,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const byId = new Map(PLACES.map((p) => [p.id, p]))
// Every name a place is known by -> the place. Longest names are tried first, so "Long Island City" beats "City".
const names = new Map<string, PlaceRec>()
for (const p of PLACES) for (const n of [p.name, ...(p.aliases ?? [])]) names.set(norm(n), p)
const bySize = [...names.keys()].sort((a, b) => b.length - a.length)

export const placeById = (id: string) => byId.get(id)

// An exact place name ("Brooklyn, NY", "Bed-Stuy"), for turning stored text into a place.
export const lookupPlace = (name: string | undefined) => (name ? names.get(norm(name)) : undefined)

// The longest place named inside a sentence, and the sentence with that name taken out.
export function resolvePlace(text: string): { place: PlaceRec; rest: string } | undefined {
  const t = ` ${norm(text).replace(/,/g, ' ')} `
  for (const name of bySize) {
    const key = ` ${name.replace(/,/g, ' ').replace(/\s+/g, ' ')} `
    const at = t.indexOf(key)
    if (at >= 0) return { place: names.get(name)!, rest: (t.slice(0, at) + ' ' + t.slice(at + key.length)).replace(/\s+/g, ' ').trim() }
  }
}

export const metroOf = (p: PlaceRec | undefined) => p?.metro

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// In the area of a place: its metro, or (for a city with none) within 40 km.
export function sameMetro(target: PlaceRec, other: PlaceRec | undefined): boolean {
  if (!other) return false
  if (target.metro || other.metro) return target.metro === other.metro
  return distanceKm(target, other) <= 40
}

const chain = (p: PlaceRec) => {
  const out = [p]
  for (let q = p.parent ? byId.get(p.parent) : undefined; q; q = q.parent ? byId.get(q.parent) : undefined) out.push(q)
  return out
}

// 1 = the same neighborhood, 0.9 = same borough (or a named city / borough you're in), 0.75 = same metro, 0 = out of area
export function hierarchyFit(target: PlaceRec, other: PlaceRec | undefined): number {
  if (!other || !sameMetro(target, other)) return 0
  if (target.id === other.id) return 1
  const mine = chain(target)
  const theirs = chain(other)
  // A broad target ("New York", "Brooklyn") is satisfied by anyone inside it
  if (target.kind !== 'hood' && theirs.some((q) => q.id === target.id)) return 0.9
  // The same borough (a level above the neighborhoods)
  const shared = mine.find((q) => q.kind === 'borough' && theirs.some((r) => r.id === q.id))
  return shared ? 0.9 : 0.75
}

// How a person's place reads next to the one asked about: "Bed-Stuy, 3 km from Bushwick".
export function placeChip(target: PlaceRec, other: PlaceRec): string {
  if (target.id === other.id) return other.name
  const km = distanceKm(target, other)
  return target.kind === 'hood' ? `${other.name}, ${km < 1 ? 'under 1' : Math.round(km)} km from ${target.name}` : other.name
}

// Home is where the person using the app lives; a place named in a question overrides it.
let home = 'new-york'
export const homePlace = () => byId.get(home)!
export const setHome = (id: string) => void (byId.has(id) && (home = id))
export const homeMetro = () => METROS[homePlace().metro ?? '']?.name ?? homePlace().name

// Where someone lives, as a place: their neighborhood if known, otherwise their city.
export function placeOfPerson(p: { livesNow: { city: string; hood?: string } }): PlaceRec | undefined {
  return lookupPlace(p.livesNow.hood) ?? lookupPlace(p.livesNow.city)
}
