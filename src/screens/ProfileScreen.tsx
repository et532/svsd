import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Composer, type Sent } from '../components/Composer'
import { BackIcon, ChevronRightIcon, MoreIcon, PauseIcon, PlayIcon, PlusIcon } from '../components/Icons'
import type { Moment, Person } from '../data/people'
import { formatTime, momentScript, newTodo } from '../lib/capture'
import { updatePerson } from '../lib/peopleStore'
import { firstName, momentsOf, todosOf } from '../lib/people'

type Props = {
  person: Person
  people: Person[]
  // A moment that was just logged opens expanded and glows once.
  freshMomentId?: string | null
  onBack: () => void
  onExpand?: (full: boolean) => void
  onOpen: (id: string) => void
  onViewConnections: () => void
  onAddMoment: (sent: Sent) => void
  onAddMutual: (e: React.MouseEvent<HTMLElement>) => void
  onSoon: (what: string) => void
}

function dateLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ProfileScreen({ person: p, people, freshMomentId = null, onBack, onExpand, onOpen, onViewConnections, onAddMoment, onAddMutual, onSoon }: Props) {
  const [addingTag, setAddingTag] = useState(false)
  const [addingTodo, setAddingTodo] = useState(false)
  const [open, setOpen] = useState<Set<string>>(() => new Set(freshMomentId ? [freshMomentId] : []))
  // Opens as an 80% sheet; the first scroll grows it to full screen.
  const [full, setFull] = useState(false)
  // Scrolled past the hero: the bar behind the back button fills in with their name.
  const [scrolled, setScrolled] = useState(false)
  // Bumped after each send so the composer starts empty again
  const [sends, setSends] = useState(0)
  const grow = () => {
    setFull(true)
    onExpand?.(true)
  }
  const moments = momentsOf(p)
  const todos = todosOf(p)
  const mutuals = p.knows.map((id) => people.find((x) => x.id === id)).filter((x): x is Person => !!x)
  const other = p.context === 'work' ? 'social' : 'work'
  const first = momentsOf(p).find((m) => m.firstMeeting)?.date ?? p.lastContacted
  const met = new Date(first + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  useEffect(() => {
    if (freshMomentId) setOpen((s) => new Set(s).add(freshMomentId))
  }, [freshMomentId])

  const toggleTodo = (id: string) => updatePerson(p.id, { todos: todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })
  const addTag = (text: string | null) => {
    setAddingTag(false)
    const tag = text?.toLowerCase()
    if (tag && !p.tags.includes(tag)) updatePerson(p.id, { tags: [...p.tags, tag] })
  }
  const addTodo = (text: string | null) => {
    setAddingTodo(false)
    if (text) updatePerson(p.id, { todos: [...todos, newTodo(text)] })
  }
  // Tags other people have that this person doesn't, most common first
  const tagIdeas = (() => {
    const count = new Map<string, number>()
    for (const x of people) for (const t of x.tags) if (!p.tags.includes(t)) count.set(t, (count.get(t) ?? 0) + 1)
    return [...count].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t)
  })()
  const toggleMoment =(id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section
      className={`profile${full ? ' is-full' : ''}${scrolled ? ' is-scrolled' : ''}${addingTag || addingTodo ? ' is-adding' : ''}`}
      style={{ '--ctx': `var(--${p.context}-deep)` } as React.CSSProperties}
      aria-label={p.name}
    >
      {!full && (
        <button
          className="profile-handle"
          aria-label="Drag up to open, down to close"
          onClick={grow}
          onPointerDown={(e) => {
            const y0 = e.clientY
            const move = (m: PointerEvent) => {
              if (Math.abs(m.clientY - y0) < 24) return
              cleanup()
              if (m.clientY < y0) grow()
              else onBack()
            }
            const cleanup = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', cleanup)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', cleanup)
          }}
        />
      )}
      <div className="profile-bar">
        <button className="round-button on-dark" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        <h2>{p.name}</h2>
        <button className="round-button on-dark" onClick={() => onSoon('More options')} aria-label="More">
          <MoreIcon />
        </button>
      </div>
      <div
        className="profile-scroll"
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop
          if (!full && top > 4) grow()
          // once the hero has scrolled up past the buttons (the bar's bottom edge)
          const root = e.currentTarget.closest('.profile')!
          const hero = root.querySelector('.profile-hero') as HTMLElement
          const bar = root.querySelector('.profile-bar') as HTMLElement
          setScrolled(top >= hero.offsetHeight - bar.offsetHeight)
        }}
        onWheel={(e) => e.deltaY > 0 && !full && grow()}
      >
        <div className="profile-hero">
          <span className="profile-blob" style={{ width: 300, height: 260, right: -80, top: -90, background: `var(--${p.context}-core)` }} />
          <span className="profile-blob" style={{ width: 240, height: 200, right: -20, bottom: -110, background: `var(--${other}-core)`, opacity: 0.85 }} />
          <span className="profile-blob" style={{ width: 260, height: 240, left: -110, bottom: -80, background: `var(--${p.context}-deep)` }} />
          <div className="profile-who">
            <Avatar id={p.id} className="avatar-xl" />
            <div>
              <h2>{p.name}</h2>
              <div className="profile-sub">{[p.profession, p.livesNow.city].filter((x) => x && x !== 'Unknown').join(' · ')}</div>
              <div className="profile-met">Met {met}</div>
            </div>
          </div>
        </div>

        <div className="profile-body">
          <div className="profile-card">
            <span className="label">Summary</span>
            <p>{p.story}</p>
            <div className="chips">
              {p.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
              {addingTag ? (
                <span className="chip is-editing">
                  <InlineInput placeholder="New tag" onDone={addTag} />
                </span>
              ) : (
                <button className="chip is-ghost" onClick={() => setAddingTag(true)}>
                  + tag
                </button>
              )}
            </div>
            {addingTag && tagIdeas.length > 0 && (
              <div className="chips tag-ideas">
                {tagIdeas.map((t) => (
                  // pointer down, so the field doesn't save its half-typed text first
                  <button key={t} className="chip is-ghost" onPointerDown={(e) => { e.preventDefault(); addTag(t) }}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="profile-section">
            <span className="label">Things to do with {firstName(p.name)}</span>
            <div className="profile-list">
              {todos.map((t) => (
                <button key={t.id} className={`profile-item${t.done ? ' is-done' : ''}`} onClick={() => toggleTodo(t.id)} aria-pressed={t.done}>
                  {t.text}
                </button>
              ))}
              {addingTodo ? (
                <div className="profile-item is-editing">
                  <InlineInput placeholder={`Something to do with ${firstName(p.name)}`} onDone={addTodo} />
                </div>
              ) : (
                <button className="profile-item is-add" onClick={() => setAddingTodo(true)}>
                  <PlusIcon size={14} /> Add something to do
                </button>
              )}
            </div>
          </div>

          <div className="profile-section">
            <span className="label">Where</span>
            <div className="profile-places">
              {[
                ['From', p.from.city],
                ['Met', p.met.context],
                ['Lives now', p.livesNow.city],
              ].map(([k, v]) => (
                <div key={k} className="profile-place">
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-row">
              <span className="label">Mutuals</span>
              <button className="text-link" onClick={onViewConnections}>
                View connections
              </button>
            </div>
            <div className="profile-mutuals">
              <button className="profile-mutual" onClick={onAddMutual}>
                <span className="avatar is-add">
                  <PlusIcon size={20} />
                </span>
                Add
              </button>
              {mutuals.map((m) => (
                <button key={m.id} className="profile-mutual" onClick={() => onOpen(m.id)}>
                  <Avatar id={m.id} />
                  {firstName(m.name)}
                  {p.mutualNotes?.[m.id] && <small>{p.mutualNotes[m.id]}</small>}
                </button>
              ))}
            </div>
          </div>

          <div className="profile-section">
            <span className="label">Moments</span>
            <div className="profile-moments">
              {moments.map((m) => (
                <MomentCard key={m.id} moment={m} open={open.has(m.id)} fresh={m.id === freshMomentId} onToggle={() => toggleMoment(m.id)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sheet-bar">
        <Composer
          key={sends}
          placeholder="Add a moment"
          script={momentScript(firstName(p.name))}
          onSend={(sent) => {
            onAddMoment(sent)
            setSends((n) => n + 1)
          }}
        />
      </div>
    </section>
  )
}

// One-line text field for adding a tag / to-do in place. It's a textarea so the desktop keyboard types into it.
// Return saves, Esc cancels, leaving it saves if there's text.
function InlineInput({ placeholder, onDone, className }: { placeholder: string; onDone: (text: string | null) => void; className?: string }) {
  const done = useRef(false)
  const finish = (text: string) => {
    if (done.current) return
    done.current = true
    onDone(text.trim() || null)
  }
  return (
    <textarea
      ref={(el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
      className={`inline-input ${className ?? ''}`}
      rows={1}
      autoFocus
      maxLength={80}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          finish(e.currentTarget.value)
        } else if (e.key === 'Escape') {
          e.stopPropagation()
          finish('')
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  )
}

function MomentCard({ moment: m, open, fresh, onToggle }: { moment: Moment; open: boolean; fresh: boolean; onToggle: () => void }) {
  return (
    <div className={`moment${open ? ' is-open' : ''}${fresh ? ' is-fresh' : ''}`}>
      <button className="moment-head" onClick={onToggle} aria-expanded={open}>
        <span>
          <span className="moment-meta">{dateLabel(m.date)}</span>
          <b>{m.title}</b>
        </span>
        <ChevronRightIcon size={16} />
      </button>
      <div className="moment-body">
        <div>
          {m.text && m.text !== m.title && <p>{m.text}</p>}
          {m.transcript && <VoiceNote transcript={m.transcript} seconds={m.seconds} />}
        </div>
      </div>
    </div>
  )
}

const WAVE = Array.from({ length: 40 }, (_, i) => 4 + ((i * 7) % 11) * 1.6)

// Ready to play → playing (the transcript fills in with the audio) → played.
function VoiceNote({ transcript, seconds }: { transcript: string; seconds?: number }) {
  const [at, setAt] = useState(0) // bars played
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    if (at >= WAVE.length) return setPlaying(false)
    const t = setTimeout(() => setAt((n) => n + 1), 140)
    return () => clearTimeout(t)
  }, [playing, at])

  if (!seconds)
    return (
      <div className="voice-note">
        <span className="moment-meta">Typed note</span>
        <q>{transcript}</q>
      </div>
    )
  const words = transcript.split(' ')
  const said = at >= WAVE.length ? words.length : Math.floor((at / WAVE.length) * words.length)
  return (
    <div className="voice-note">
      <q className={at ? 'is-playing' : undefined}>
        {words.map((w, i) => (
          <span key={i} className={i < said ? 'is-said' : undefined}>
            {w}{' '}
          </span>
        ))}
      </q>
      <div className="voice-row">
        <button
          className="round-button ink is-sm"
          onClick={() => {
            if (!playing && at >= WAVE.length) setAt(0)
            setPlaying(!playing)
          }}
          aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        >
          {playing ? <PauseIcon size={14} /> : <PlayIcon />}
        </button>
        <div className="voice-wave" aria-hidden>
          {WAVE.map((h, i) => (
            <i key={i} className={i < at ? 'is-played' : undefined} style={{ height: h }} />
          ))}
        </div>
        <span className="moment-meta">{formatTime(seconds)}</span>
      </div>
    </div>
  )
}
