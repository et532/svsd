// Try a question against the 200 people: npx tsx scripts/ask.ts "someone for a house party in Bushwick, fashion themed"
import { placeOfPerson } from '../src/lib/places'
import { ask } from './nodeSearch'

for (const q of process.argv.slice(2)) {
  const r = await ask(q)
  console.log(`\n? ${q}`)
  if (r.kind !== 'people') {
    console.log(r.kind === 'none' ? r.title : `(${r.kind})`)
    continue
  }
  console.log(`  ${r.title}${r.note ? `\n  note: ${r.note}` : ''}`)
  const show = (ms: typeof r.matches) =>
    ms.slice(0, 10).forEach((m, i) => console.log(`  ${i + 1}. ${m.person.name} (${placeOfPerson(m.person)?.name}${m.chip ? ` | ${m.chip}` : ''}${m.via ? ` | ${m.via}` : ''}) — ${m.why.slice(0, 110)}`))
  if (r.groups) r.groups.forEach((g) => (console.log(`  [${g.label}]`), show(g.matches)))
  else show(r.matches)
  if (r.near?.length) (console.log('  [closest, not quite]'), show(r.near))
}
