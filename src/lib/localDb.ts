// Everything is kept on the user's own device, in the browser's IndexedDB (database "peepl", one store "kv"): no
// server, no account, nothing leaves the device. If IndexedDB is unavailable (some private windows), reads give
// null and writes do nothing, and the app falls back to its localStorage copy.

let db: Promise<IDBDatabase> | undefined
const conn = () =>
  (db ??= new Promise((resolve, reject) => {
    const open = indexedDB.open('peepl', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('kv')
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  }))

const request = <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) =>
  conn().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction('kv', mode)
        const r = run(tx.objectStore('kv'))
        tx.oncomplete = () => resolve(r.result)
        tx.onerror = () => reject(tx.error)
      }),
  )

export async function readDb<T>(name: string): Promise<T | null> {
  try {
    return ((await request('readonly', (s) => s.get(name))) as T | undefined) ?? null
  } catch {
    return null
  }
}

const put = (name: string, value: unknown) => request('readwrite', (s) => s.put(value, name)).catch(() => {})

// Saved a moment after the last change, so a burst of edits is one write. A change still waiting when the tab is
// hidden or closed is written straight away.
const waiting = new Map<string, { value: unknown; timer: number }>()
export function writeDb(name: string, value: unknown) {
  window.clearTimeout(waiting.get(name)?.timer)
  waiting.set(name, {
    value,
    timer: window.setTimeout(() => {
      waiting.delete(name)
      void put(name, value)
    }, 250),
  })
}
if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return
    for (const [name, { value, timer }] of waiting) {
      window.clearTimeout(timer)
      void put(name, value)
    }
    waiting.clear()
  })

// Backup and restore: one JSON file with your people and your name fixes (search vectors are rebuilt on their own).
const BACKUP = ['people', 'namefixes'] as const

export async function exportBackup() {
  const data = Object.fromEntries(await Promise.all(BACKUP.map(async (n) => [n, await readDb(n)])))
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `peepl-backup-${new Date().toISOString().slice(0, 10)}.json` })
  a.click()
  URL.revokeObjectURL(url)
}

// Replaces what is saved with the backup, then reloads. Returns false if the file isn't a Peepl backup.
export async function importBackup(file: File): Promise<boolean> {
  try {
    const data = JSON.parse(await file.text()) as Record<string, unknown>
    if (!data || typeof data !== 'object' || !('people' in data)) return false
    await Promise.all(BACKUP.filter((n) => data[n]).map((n) => put(n, data[n])))
    localStorage.removeItem('peepl.people.v1')
    localStorage.removeItem('peepl.nameFixes.v1')
    location.reload()
    return true
  } catch {
    return false
  }
}
