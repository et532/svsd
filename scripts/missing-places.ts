// Lists places used by the seed rows that the gazetteer doesn't know: npx tsx scripts/missing-places.ts
import { nycSeeds } from '../src/data/nyc'
import { lookupPlace } from '../src/lib/places'
const miss = new Set<string>()
for (const s of nycSeeds) for (const c of [s.from, s.met[0], s.lives, s.hood]) if (c && !lookupPlace(c)) miss.add(c)
console.log([...miss].join(' | ') || 'none')
