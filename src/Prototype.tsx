import { useCallback, useEffect, useMemo, useState } from 'react'
import { AskBar } from './components/AskBar'
import type { Sent } from './components/Composer'
import { BackIcon, CheckIcon, CloseIcon } from './components/Icons'
import { HomeIndicator, StatusBar } from './components/StatusBar'
import { TopControls, type GroupBy, type Tab } from './components/TopControls'
import type { Person } from './data/people'
import { draftToMoment, draftToPerson, newTodo, parseMoment, parsePerson } from './lib/capture'
import { auraDepth, firstName, momentsOf, todosOf } from './lib/people'
import { addPerson, updatePerson, usePeople } from './lib/peopleStore'
import { AskScreen } from './screens/AskScreen'
import { CaptureScreen } from './screens/CaptureScreen'
import { ListScreen } from './screens/ListScreen'
import { MindmapScreen } from './screens/MindmapScreen'
import { ProfileScreen } from './screens/ProfileScreen'

// Full-screen layers above the tabs, newest last. Back / close pops the top one.
type Layer =
  | { kind: 'capture' }
  | { kind: 'profile'; id: string; fresh?: string | null }
  | { kind: 'ask'; start: 'type' | 'voice' }

// The app's phone screen.
export function Prototype() {
  const allPeople = usePeople()
  const [tab, setTab] = useState<Tab>('mindmap')
  // Mindmap grouping, from the Filters menu
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [layers, setLayers] = useState<Layer[]>([])
  // Set by "View connections" on a profile: who to focus, and a way back to them.
  const [navFocus, setNavFocus] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; ok: boolean; key: number } | null>(null)

  // People picked out by Ask ("Show all 3 in your list"), shown until cleared with the pill above the bar
  const [askFilter, setAskFilter] = useState<{ ids: string[]; label: string } | null>(null)
  const people = useMemo(() => allPeople.filter((p) => !askFilter || askFilter.ids.includes(p.id)), [allPeople, askFilter])
  const focusId = navFocus
  const top = layers[layers.length - 1]
  const byId = (id: string) => allPeople.find((p) => p.id === id)

  const say = useCallback((text: string, ok = false) => setToast({ text, ok, key: Date.now() }), [])
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

  function goTo(next: Tab, id: string) {
    setLayers([])
    setTab(next)
    setNavFocus(id)
  }

  // A note about someone new. Someone you already have by that name isn't added twice.
  function createPerson(sent: Sent): Person {
    const draft = parsePerson(sent.text, allPeople)
    const same = allPeople.find((p) => p.name.toLowerCase() === draft.name?.trim().toLowerCase())
    if (same) return same
    const person = draftToPerson(draft, sent, new Set(allPeople.map((p) => p.id)))
    addPerson(person)
    return person
  }

  // A note about someone you know: a new moment, their follow-up, and one step closer.
  function addMoment(id: string, sent: Sent) {
    const person = byId(id)
    if (!person) return null
    const draft = parseMoment(sent.text)
    const moment = draftToMoment(draft, sent)
    updatePerson(id, {
      moments: [moment, ...momentsOf(person)],
      todos: draft.follow ? [newTodo(draft.follow), ...todosOf(person)] : todosOf(person),
      lastContacted: new Date().toISOString().slice(0, 10),
      closeness: Math.min(3, auraDepth(id) + 1) as 1 | 2 | 3,
    })
    say('New moment saved', true)
    return moment.id
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
      {tab === 'list' && <ListScreen people={people} onOpen={openProfile} />}
      {tab === 'mindmap' && <MindmapScreen people={focusId ? allPeople : people} focusId={focusId} onView={openProfile} groupBy={groupBy} />}

      <TopControls tab={tab} onTab={changeTab} groupBy={groupBy} onGroupBy={setGroupBy} />

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

      {askFilter && layers.length === 0 && (
        <div className="ask-filter" role="status">
          <span className="ask-filter-dot" aria-hidden />
          <span className="ask-filter-text">
            {askFilter.label} · {people.length}
          </span>
          <button onClick={() => setAskFilter(null)} aria-label="Show everyone again">
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      <AskBar
        onType={() => {
          setNavFocus(null)
          push({ kind: 'ask', start: 'type' })
        }}
        onVoice={() => {
          setNavFocus(null)
          push({ kind: 'ask', start: 'voice' })
        }}
        onAdd={() => push({ kind: 'capture' })}
      />

      {layers.map((layer, i) => {
        const key = `${i}-${layer.kind}`
        // Only the top two layers render, so a profile stays under the flow opened over it.
        if (i < layers.length - 2) return null
        if (layer.kind === 'ask')
          return (
            <div key={key} className="layer is-fade">
              <AskScreen
                people={allPeople}
                tab={tab}
                start={layer.start}
                onClose={pop}
                onOpenProfile={openProfile}
                onAdd={() => replaceTop({ kind: 'capture' })}
                onToast={say}
                onShow={(ids, label) => {
                  setLayers([])
                  setAskFilter({ ids, label })
                }}
              />
            </div>
          )
        if (layer.kind === 'capture')
          return (
            <div key={key} className="layer is-up">
              <CaptureScreen
                people={allPeople}
                onClose={pop}
                onCreate={createPerson}
                onMoment={(id, sent) => replaceTop({ kind: 'profile', id, fresh: addMoment(id, sent) })}
                onOpenProfile={(id) => replaceTop({ kind: 'profile', id })}
              />
            </div>
          )
        const person = byId(layer.id)
        if (!person) return null
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
              onAddMoment={(sent) => {
                const fresh = addMoment(person.id, sent)
                setLayers((l) => l.map((x, j) => (j === i ? { ...x, fresh } : x)))
              }}
              onSoon={(what) => say(`${what} isn't built yet`)}
            />
          </div>
        )
      })}

      {toast && (
        <div key={toast.key} className="toast" role="status">
          {toast.ok && (
            <span className="toast-check">
              <CheckIcon size={14} />
            </span>
          )}
          {toast.text}
        </div>
      )}
      <HomeIndicator />
    </div>
  )
}
