import { useSyncExternalStore } from 'react'
import { samplePeople, type Person } from '../data/people'
import { readDb, writeDb } from './localDb'

// Everyone in the app: the sample people plus anyone added with the + button, with changes from
// logging moments and ticking things off. Additions and changes are saved to local-data/people.json by the
// local backend (and mirrored in localStorage), so they survive a reload. Mock mode (?mock=200) never saves.

const KEY = 'peepl.people.v1'
const mock = new URLSearchParams(window.location.search).has('mock')

type Saved = { added: Person[]; changed: Record<string, Partial<Person>> }

function load(): Saved {
  if (mock) return { added: [], changed: {} }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Saved
  } catch {
    // Storage blocked or corrupt: start from the sample data.
  }
  return { added: [], changed: {} }
}

let saved = load()
let people = build()
const listeners = new Set<() => void>()

function build(): Person[] {
  // Skip saved additions that are now sample people too (Jordan Lee, added in the demo, is now built in)
  const sampleIds = new Set(samplePeople.map((p) => p.id))
  const all = [...samplePeople, ...saved.added.filter((p) => !sampleIds.has(p.id))]
  return all.map((p) => (saved.changed[p.id] ? { ...p, ...saved.changed[p.id] } : p))
}

function commit() {
  people = build()
  if (!mock) {
    writeDb('people', saved)
    try {
      localStorage.setItem(KEY, JSON.stringify(saved))
    } catch {
      // Not saved; the change still applies for this session.
    }
  }
  for (const listener of listeners) listener()
}

// The file on this machine is the source of truth; localStorage is just the instant first paint. With no file
// yet (first run with the backend), whatever this browser already had is moved into it.
if (!mock)
  readDb<Saved>('people').then((remote) => {
    if (remote) {
      saved = remote
      people = build()
      for (const listener of listeners) listener()
    } else if (saved.added.length || Object.keys(saved.changed).length) writeDb('people', saved)
  })

export function getPeople(): Person[] {
  return people
}

export function addPerson(person: Person) {
  saved = { ...saved, added: [...saved.added, person] }
  // Links are symmetric: whoever they know now knows them too.
  for (const id of person.knows) {
    const other = people.find((p) => p.id === id)
    if (other && !other.knows.includes(person.id)) patch(id, { knows: [...other.knows, person.id] }, false)
  }
  commit()
}

export function updatePerson(id: string, change: Partial<Person>) {
  patch(id, change, true)
}

function patch(id: string, change: Partial<Person>, notify: boolean) {
  const isAdded = saved.added.some((p) => p.id === id)
  if (isAdded) saved = { ...saved, added: saved.added.map((p) => (p.id === id ? { ...p, ...change } : p)) }
  else saved = { ...saved, changed: { ...saved.changed, [id]: { ...saved.changed[id], ...change } } }
  if (notify) commit()
  else people = build()
}

// Back to the sample data only.
export function resetPeople() {
  saved = { added: [], changed: {} }
  commit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePeople(): Person[] {
  return useSyncExternalStore(subscribe, getPeople, getPeople)
}
