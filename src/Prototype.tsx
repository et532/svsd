import { useGlassEverywhere } from './lib/glass'
import { preloadModels } from './lib/preload'
import { AuraBackground } from './components/AuraBackground'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AskBar } from './components/AskBar'
import type { Sent } from './components/Composer'
import { Keyboard, useKeyboardTarget } from './components/Keyboard'
import { BackIcon, CheckIcon, CloseIcon } from './components/Icons'
import { HomeIndicator, StatusBar } from './components/StatusBar'
import { TopControls, type GroupBy, type Tab } from './components/TopControls'
import type { Person } from './data/people'
import { draftToMoment, draftToPerson, newTodo, parseMoment, parsePerson, type PersonNote } from './lib/capture'
import { auraDepth, firstName, momentsOf, todosOf } from './lib/people'
import { addPerson, updatePerson, usePeople } from './lib/peopleStore'
import { AskScreen } from './screens/AskScreen'
import { CaptureScreen } from './screens/CaptureScreen'
import { ListScreen } from './screens/ListScreen'
import { MindmapScreen } from './screens/MindmapScreen'
import { ProfileScreen } from './screens/ProfileScreen'

// Full-screen layers above the tabs, newest last. Back / close pops the top one.
// Where a flow was opened from, as % of the phone: Ask / Add grow out of that point in a circle.
type Origin = { x: number; y: number }

type Layer =
  | { kind: 'capture'; mutualOf?: string; origin?: Origin }
  | { kind: 'profile'; id: string; fresh?: string | null }
  | { kind: 'ask'; start: 'type' | 'voice'; origin?: Origin }

function originOf(el: HTMLElement): Origin | undefined {
  const phone = el.closest('.phone')
  if (!phone) return undefined
  const b = el.getBoundingClientRect()
  const p = phone.getBoundingClientRect()
  return { x: ((b.left + b.width / 2 - p.left) / p.width) * 100, y: ((b.top + b.height / 2 - p.top) / p.height) * 100 }
}

// Grow out of `from`; when closing, shrink into `to` (the X button).
const growStyle = (from?: Origin, to?: Origin) =>
  ({
    ...(from && { '--ox': `${from.x}%`, '--oy': `${from.y}%` }),
    ...(to && { '--cx': `${to.x}%`, '--cy': `${to.y}%` }),
  }) as React.CSSProperties

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

  // Start getting the voice and search models ready right away, so they are there when first used
  useEffect(() => preloadModels(), [])

  const say = useCallback((text: string, ok = false) => setToast({ text, ok, key: Date.now() }), [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const [closing, setClosing] = useState(false)
  // Play the top layer's closing animation first, then drop it.
  const closeTop = (ms: number) => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      pop()
      setClosing(false)
    }, ms)
  }
  // A profile slides back out to the right; Ask / Add shrink back into the button they grew from.
  const closeProfile = () => closeTop(320)
  const [shrinkTo, setShrinkTo] = useState<Origin>()
  const closeGrow = () => {
    const layerEls = document.querySelectorAll<HTMLElement>('.layer')
    const x = layerEls[layerEls.length - 1]?.querySelector<HTMLElement>('.flow-close')
    setShrinkTo(x ? originOf(x) : undefined)
    closeTop(500)
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
  // With mutualOf, they and that person are linked both ways.
  function createPerson(sent: Sent, mutualOf?: string): Person {
    const draft = parsePerson(sent.text, allPeople)
    const same = allPeople.find((p) => p.name.toLowerCase() === draft.name?.trim().toLowerCase())
    const person = same ?? draftToPerson({ ...draft, knowsIds: [...(draft.knowsIds ?? []), ...(mutualOf ? [mutualOf] : [])] }, sent, new Set(allPeople.map((p) => p.id)))
    if (!same) addPerson(person)
    const other = mutualOf && mutualOf !== person.id ? byId(mutualOf) : undefined
    if (other) {
      if (same && !same.knows.includes(other.id)) updatePerson(same.id, { knows: [...same.knows, other.id] })
      if (!other.knows.includes(person.id)) updatePerson(other.id, { knows: [...other.knows, person.id] })
    }
    return person
  }

  // A note about several new people: one profile each, and they all know each other (they were met together).
  function createPeople(sent: Sent, notes: PersonNote[]): Person[] {
    const made = notes.map((n) => createPerson({ ...sent, text: n.text, voice: false }))
    const ids = made.map((p) => p.id)
    for (const p of made) updatePerson(p.id, { knows: [...new Set([...p.knows, ...ids.filter((i) => i !== p.id)])] })
    return made
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

  const kbTarget = useKeyboardTarget()
  const backTo = navFocus && layers.length === 0 ? byId(navFocus) : undefined
  // Every white card and button gets the Figma liquid glass (lib/glass.ts)
  const phoneRef = useRef<HTMLDivElement>(null)
  useGlassEverywhere(phoneRef)

  return (
    <div ref={phoneRef} className={`phone${top?.kind === 'profile' ? ' is-dark-top' : ''}${kbTarget ? ' has-kb' : ''}`}>
      {/* The still aura is always mounted as the base, so switching tabs crossfades: the mindmap draws its own opaque
          copy on top (so its orbs can move to groups) and fades in/out over this one instead of hard-cutting. */}
      <AuraBackground />
      <StatusBar />
      {/* With a filter on, the mindmap stays mounted (stable key, no remount) as the list's background so its grouped
          colored auras carry over — dimmed, same positions — behind the Connections rows. Rendered before the list so
          it paints behind it; `asBackground` fades the discs/labels/links out and leaves only the auras. */}
      {/* Without a filter it stays mounted too, just hidden, so switching tabs doesn't redraw the layout. */}
      <MindmapScreen key="map" people={focusId ? allPeople : people} focusId={focusId} onView={openProfile} groupBy={groupBy} asBackground={tab !== 'mindmap'} hidden={tab === 'list' && groupBy === 'none'} />
      {tab === 'list' && <ListScreen key="list" people={people} onOpen={openProfile} />}

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
        onType={(e) => {
          setNavFocus(null)
          push({ kind: 'ask', start: 'type', origin: originOf(e.currentTarget) })
        }}
        onVoice={(e) => {
          setNavFocus(null)
          push({ kind: 'ask', start: 'voice', origin: originOf(e.currentTarget) })
        }}
        onAdd={(e) => push({ kind: 'capture', origin: originOf(e.currentTarget) })}
      />

      {layers.map((layer, i) => {
        const key = `${i}-${layer.kind}`
        const shut = closing && i === layers.length - 1 ? ' is-closing' : ''
        // Only the top two layers render, so a profile stays under the flow opened over it.
        if (i < layers.length - 2) return null
        if (layer.kind === 'ask')
          return (
            <div key={key} className={`layer is-grow-pill${shut}`} style={growStyle(layer.origin, shut ? shrinkTo : undefined)}>
              <AskScreen
                people={allPeople}
                tab={tab}
                start={layer.start}
                onClose={closeGrow}
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
            <div key={key} className={`layer is-grow-add${shut}`} style={growStyle(layer.origin, shut ? shrinkTo : undefined)}>
              <CaptureScreen
                people={allPeople}
                onClose={closeGrow}
                onCreate={(sent) => createPerson(sent, layer.mutualOf)}
                onCreateMany={createPeople}
                mutualWith={layer.mutualOf ? firstName(byId(layer.mutualOf)?.name ?? '') : undefined}
                onMoment={(id, sent) => replaceTop({ kind: 'profile', id, fresh: addMoment(id, sent) })}
                onOpenProfile={(id) => replaceTop({ kind: 'profile', id })}
              />
            </div>
          )
        const person = byId(layer.id)
        if (!person) return null
        return (
          <div key={key + layer.id} className={`layer is-profile${shut}`}>
            <ProfileScreen
              person={person}
              people={allPeople}
              freshMomentId={layer.fresh}
              onBack={closeProfile}
              onOpen={(id) => push({ kind: 'profile', id })}
              onViewConnections={() => goTo('mindmap', person.id)}
              onAddMoment={(sent) => {
                const fresh = addMoment(person.id, sent)
                setLayers((l) => l.map((x, j) => (j === i ? { ...x, fresh } : x)))
              }}
              onAddMutual={(e) => push({ kind: 'capture', mutualOf: person.id, origin: originOf(e.currentTarget) })}
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
      <Keyboard target={kbTarget} />
      <HomeIndicator />
    </div>
  )
}
