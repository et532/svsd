import { samplePeople } from '../src/data/people'
import { hitsFor } from './nodeSearch'
import { parseQuery } from '../src/lib/query'
for (const q of process.argv.slice(2)) {
  const c = parseQuery(q)
  const hits = (await hitsFor(c, samplePeople)).sort((a, b) => b.sim - a.sim).slice(0, 8)
  console.log(`\n${q} -> "${c.embedText}"`)
  for (const h of hits) console.log(' ', h.sim.toFixed(3), samplePeople.find((p) => p.id === h.personId)!.name, '|', h.text.slice(0, 70))
}
