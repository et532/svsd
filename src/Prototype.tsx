import { useCallback, useEffect, useMemo, useState } from 'react'
import { BottomBar, type Tab } from './components/BottomBar'
import { BackIcon } from './components/Icons'
import { SearchBar } from './components/SearchBar'
import { HomeIndicator, StatusBar } from './components/StatusBar'
import { draftToMoment, draftToPerson, newTodo } from './lib/capture'
import { auraDepth, closenessLabel, firstName, matchesQuery, momentsOf, todosOf } from './lib/people'
import { addPerson, updatePerson, usePeople } from './lib/peopleStore'
import { CaptureScreen, type CaptureResult } from './screens/CaptureScreen'
import { ListScreen } from './screens/ListScreen'
import { MindmapScreen } from './screens/MindmapScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { SavedScreen } from './screens/SavedScreen'
import type { FilterLayout } from './lib/filterLayouts'

// Full-screen layers above the tabs, newest last. Back / close pops the top one.
type Layer =
  | { kind: 'capture'; personId?: string; talk?: boolean }
  | { kind: 'saved'; id: string }
  | { kind: 'profile'; id: string; fresh?: string | null }

type Props = {
  filterLayout?: FilterLayout
  initialTab?: Tab
}

// The app's phone screen. Rendered once, or several times on the filter looks page.
export function Prototype({ filterLayout, initialTab = 'list' }: Props) {
  const allPeople = usePeople()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [layers, setLayers] = useState<Layer[]>([])
  // Set by "View connections" on a profile: who to focus, and a way back to them.
  const [navFocus, setNavFocus] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)

  const people = useMemo(() => allPeople.filter((p) => matchesQuery(p, query)), [allPeople, query])
  // One match on the mindmap: keep the whole graph and select that person instead of showing a lone dot.
  const searchFocus = query.trim() && people.length === 1 ? people[0].id : null
  const focusId = navFocus ?? searchFocus
  const top = layers[layers.length - 1]
  const byId = (id: string) => allPeople.find((p) => p.id === id)

  const say = useCallback((text: string) => setToast({ text, key: Date.now() }), [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const [profileFull, setProfileFull] = useState(false)
  useEffect(() => setProfileFull(false), [top])

  const [closing, setClosing] = useState(false)
  // Slide the sheet down first, then drop the layer.
  const closeSheet = () => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      pop()
      setClosing(false)
    }, 320)
  }

  const push = (layer: Layer) => setLayers((l) => [...l, layer])
  const pop = () => setLayers((l) => l.slice(0, -1))
  const replaceTop = (layer: Layer) => setLayers((l) => [...l.slice(0, -1), layer])
  const openProfile = useCallback((id: string) => setLayers((l) => [...l, { kind: 'profile', id }]), [])

  function changeTab(next: Tab) {
    setNavFocus(null)
    setTab(next)
  }

  function changeQuery(q: string) {
    setNavFocus(null)
    setQuery(q)
  }

  function goTo(next: Tab, id: string) {
    setLayers([])
    setQuery('')
    setTab(next)
    setNavFocus(id)
  }

  function savePerson(result: CaptureResult) {
    const person = draftToPerson(result.draft, result, new Set(allPeople.map((p) => p.id)))
    addPerson(person)
    replaceTop({ kind: 'saved', id: person.id })
  }

  function saveMoment(id: string, result: CaptureResult) {
    const person = byId(id)
    if (!person) return pop()
    const moment = draftToMoment(result.draft, result)
    const before = auraDepth(id)
    const closeness = Math.min(3, before + 1) as 1 | 2 | 3
    updatePerson(id, {
      moments: [moment, ...momentsOf(person)],
      todos: result.draft.follow ? [newTodo(result.draft.follow), ...todosOf(person)] : todosOf(person),
      lastContacted: new Date().toISOString().slice(0, 10),
      closeness,
    })
    setLayers((l) => [...l.slice(0, -2), { kind: 'profile', id, fresh: moment.id }])
    say(closeness > before ? `Moment saved · ${firstName(person.name)} is now “${closenessLabel[closeness]}”` : 'Moment saved')
  }

  const backTo = navFocus && layers.length === 0 ? byId(navFocus) : undefined

  return (
    <div className={`phone${top?.kind === 'profile' && profileFull ? ' is-dark-top' : ''}`}>
      <div className="aura" aria-hidden>
        <span className="aura-orb" />
        <span className="aura-orb" />
        <span className="aura-orb" />
        <span className="aura-orb" />
      </div>
      <StatusBar />
      {tab === 'list' && <ListScreen people={people} query={query} onOpen={openProfile} />}
      {tab === 'mindmap' && <MindmapScreen people={focusId ? allPeople : people} focusId={focusId} onView={openProfile} filterLayout={filterLayout} />}

      {searchOpen && <div className="search-scrim" aria-hidden />}

      <header className="top-bar">
        <SearchBar
          value={query}
          onChange={changeQuery}
          people={allPeople}
          onOpenChange={setSearchOpen}
        />
      </header>

      {backTo && (
        <button
          className="back-to"
          onClick={() => {
            setNavFocus(null)
            openProfile(backTo.id)
          }}
        >
          <BackIcon size={16} />
          {firstName(backTo.name)}
        </button>
      )}

      <BottomBar active={tab} onChange={changeTab} onAdd={() => {
          setNavFocus(null)
          push({ kind: 'capture' })
        }} />

      {layers.map((layer, i) => {
        const key = `${i}-${layer.kind}`
        // Only the top two layers render, so a profile stays under the moment being logged.
        if (i < layers.length - 2) return null
        if (layer.kind === 'capture') {
          const person = layer.personId ? byId(layer.personId) : undefined
          return (
            <div key={key + (layer.personId ?? '')} className="layer is-up">
              <CaptureScreen
                person={person}
                people={allPeople}
                autoTalk={layer.talk}
                onClose={pop}
                onDone={(r) => (person ? saveMoment(person.id, r) : savePerson(r))}
              />
            </div>
          )
        }
        const person = byId(layer.id)
        if (!person) return null
        if (layer.kind === 'saved')
          return (
            <div key={key} className="layer is-fade">
              <SavedScreen
                person={person}
                people={allPeople}
                onClose={() => setLayers([])}
                onAddAnother={() => replaceTop({ kind: 'capture' })}
                onViewProfile={() => replaceTop({ kind: 'profile', id: person.id })}
              />
            </div>
          )
        return (
          <div key={key + layer.id} className={`layer is-sheet${closing && i === layers.length - 1 ? ' is-closing' : ''}`}>
            <div className="sheet-scrim" onClick={closeSheet} aria-hidden />
            <ProfileScreen
              onExpand={setProfileFull}
              person={person}
              people={allPeople}
              freshMomentId={layer.fresh}
              onBack={closeSheet}
              onOpen={openProfile}
              onViewConnections={() => goTo('mindmap', person.id)}
              onLogMoment={(talk) => push({ kind: 'capture', personId: person.id, talk })}
              onSoon={(what) => say(`${what} isn’t built yet`)}
            />
          </div>
        )
      })}

      {toast && (
        <div key={toast.key} className="toast" role="status">
          {toast.text}
        </div>
      )}
      <HomeIndicator />
    </div>
  )
}
