// Embeds every sentence of the 200 sample people once, offline, and loads them. Re-runnable.
//   npm run seed                 -> writes public/vectors.json (the app's first search needs no model work)
//   + SUPABASE_URL and SUPABASE_SERVICE_KEY (or VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) in .env
//                                -> also loads places, people, moments, links and vectors into Supabase
import { writeFileSync } from 'node:fs'
import { pipeline } from '@huggingface/transformers'
import { PLACES } from '../src/data/gazetteer'
import { samplePeople } from '../src/data/people'
import { chunksOf } from '../src/lib/chunks'
import { personPayload } from '../src/lib/remoteRows'

try {
  process.loadEnvFile('.env')
} catch {
  // no .env: local files only
}
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

// The same model and settings as the browser (src/lib/ml.worker.ts), so vectors made here match the question's.
const embedder = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' })) as unknown as (
  texts: string[],
  o: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist(): number[][] }>

const texts = [...new Set(samplePeople.flatMap((p) => chunksOf(p).map((c) => c.text)))]
const vec = new Map<string, number[]>()
for (let i = 0; i < texts.length; i += 32) {
  const batch = texts.slice(i, i + 32)
  const out = (await embedder(batch, { pooling: 'mean', normalize: true })).tolist()
  batch.forEach((t, j) => vec.set(t, out[j].map((x) => Math.round(x * 1e4) / 1e4)))
  process.stdout.write(`\rembedded ${Math.min(i + 32, texts.length)}/${texts.length}`)
}
console.log()

// One signed byte per number (x * 300, base64): 1.5 MB instead of 7. Cosine error is far below the noise.
const q8 = (v: number[]) => Buffer.from(Int8Array.from(v, (x) => Math.max(-127, Math.min(127, Math.round(x * 300))))).toString('base64')
writeFileSync('public/vectors.json', JSON.stringify(Object.fromEntries([...vec].map(([t, v]) => [t, q8(v)]))))
console.log(`public/vectors.json: ${vec.size} sentences`)

if (!url || !key) {
  console.log('No Supabase settings in .env: skipped the database.')
  process.exit(0)
}

const call = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
}

await call(
  'places?on_conflict=id',
  PLACES.map((p) => ({ id: p.id, name: p.name, kind: p.kind, parent_id: p.parent ?? null, geo: `SRID=4326;POINT(${p.lng} ${p.lat})`, aliases: p.aliases ?? [], metro_id: p.metro ?? null })),
  { Prefer: 'resolution=merge-duplicates' },
)
console.log(`places: ${PLACES.length}`)

// Two passes: the second one makes the links, now that everybody exists.
for (const pass of [1, 2]) {
  for (let i = 0; i < samplePeople.length; i += 10) {
    await Promise.all(
      samplePeople.slice(i, i + 10).map((p) =>
        call('rpc/upsert_person', {
          p: personPayload(p),
          chunk_list: chunksOf(p).map((c) => ({ text: c.text, kind: c.kind, momentId: c.momentId, embedding: vec.get(c.text) })),
        }),
      ),
    )
    process.stdout.write(`\rpass ${pass}: ${Math.min(i + 10, samplePeople.length)}/${samplePeople.length}`)
  }
  console.log()
}
console.log('Supabase loaded.')
