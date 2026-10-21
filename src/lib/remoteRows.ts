import type { Person } from '../data/people'
import { chunksOf } from './chunks'
import { lookupPlace } from './places'

// A person as the upsert_person() SQL function wants it (see supabase/migrations/0001_init.sql). Pure, so the
// browser and the seed script (scripts/seed.ts) send exactly the same thing.

export type ChunkRow = { text: string; kind: string; momentId?: string; embedding?: number[] }

export function personPayload(p: Person) {
  const first = p.moments?.find((m) => m.firstMeeting)
  return {
    ...p,
    metOn: first?.date,
    places: { from: lookupPlace(p.from.city)?.id, met: lookupPlace(p.met.city)?.id, lives: (lookupPlace(p.livesNow.hood) ?? lookupPlace(p.livesNow.city))?.id },
  }
}

export const chunkRows = (p: Person): ChunkRow[] => chunksOf(p).map((c) => ({ text: c.text, kind: c.kind, momentId: c.momentId }))
