import { useEffect, useState } from 'react'
import { BackIcon, CheckIcon, ChevronRightIcon, MicIcon, PlayIcon, PlusIcon } from '../components/Icons'
import type { Moment, Person } from '../data/people'
import { formatTime } from '../lib/capture'
import { updatePerson } from '../lib/peopleStore'
import { usePfpStyle } from '../lib/pfpStyle'
import { auraDepth, closenessLabel, contextLabel, firstName, initials, momentsOf, orbBackground, todosOf } from '../lib/people'

type Props = {
  person: Person
  people: Person[]
  // A moment that was just logged opens expanded and glows once.
  freshMomentId?: string | null
  onBack: () => void
  onExpand?: (full: boolean) => void
  onOpen: (id: string) => void
  onViewMap: () => void
  onViewConnections: () => void
  onLogMoment: (talk: boolean) => void
  onSoon: (what: string) => void
}

function dateLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ProfileScreen({ person: p, people, freshMomentId = null, onBack, onExpand, onOpen, onViewMap, onViewConnections, onLogMoment, onSoon }: Props) {
  const pfp = usePfpStyle()
  const [open, setOpen] = useState<Set<string>>(() => new Set(freshMomentId ? [freshMomentId] : []))
  // Opens as an 80% sheet; the first scroll grows it to full screen.
  const [full, setFull] = useState(false)
  const grow = () => {
    setFull(true)
    onExpand?.(true)
  }
  const moments = momentsOf(p)
  const todos = todosOf(p)
  const mutuals = p.knows.map((id) => people.find((x) => x.id === id)).filter((x): x is Person => !!x)
  const other = p.context === 'work' ? 'social' : 'work'

  useEffect(() => {
    if (freshMomentId) setOpen((s) => new Set(s).add(freshMomentId))
  }, [freshMomentId])

  const toggleTodo = (id: string) => updatePerson(p.id, { todos: todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })
  const toggleMoment = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section className={`profile${full ? ' is-full' : ''}`} aria-label={p.name}>
      <div className="profile-scroll" onScroll={(e) => !full && e.currentTarget.scrollTop > 4 && grow()} onWheel={(e) => e.deltaY > 0 && !full && grow()}>
        <div className="profile-hero">
          <span className="profile-blob" style={{ width: 300, height: 260, right: -80, top: -90, background: `var(--${p.context}-core)` }} />
          <span className="profile-blob" style={{ width: 240, height: 200, right: -20, bottom: -110, background: `var(--${other}-core)`, opacity: 0.85 }} />
          <span className="profile-blob" style={{ width: 260, height: 240, left: -110, bottom: -80, background: `var(--${p.context}-deep)` }} />
          <div className="profile-top">
            <button className="round-button on-dark" onClick={onBack} aria-label="Back">
              <BackIcon />
            </button>
          </div>
          <div className="profile-who">
            <span className="avatar avatar-xl" style={{ background: orbBackground(p.id, pfp) }}>
              {initials(p.name)}
            </span>
            <div>
              <h2>{p.name}</h2>
              <div className="profile-sub">{[p.profession, p.livesNow.city].filter((x) => x && x !== 'Unknown').join(' · ')}</div>
              <div className="chips">
                <span className="chip on-dark">{closenessLabel[auraDepth(p.id)]}</span>
                <span className="chip on-dark">
                  <i style={{ background: `var(--${p.context}-core)` }} />
                  {contextLabel[p.context]}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-body">
          <div className="profile-card">
            <span className="label">Field notes</span>
            <p>{p.story}</p>
            <div className="chips">
              {p.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
              <button className="chip is-ghost" onClick={() => onSoon('Adding tags')}>
                + tag
              </button>
            </div>
          </div>

          <div className="profile-section">
            <span className="label">Things to talk about</span>
            <div className="profile-list">
              {todos.map((t) => (
                <div key={t.id} className={`profile-item${t.done ? ' is-done' : ''}`}>
                  <button className="profile-cb" onClick={() => toggleTodo(t.id)} aria-pressed={t.done} aria-label={`Mark done: ${t.text}`}>
                    {t.done && <CheckIcon size={12} />}
                  </button>
                  <span>{t.text}</span>
                </div>
              ))}
              <button className="profile-item is-add" onClick={() => onSoon('Adding to-dos')}>
                + Add something to do
              </button>
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-row">
              <span className="label">Location</span>
              <button className="text-link" onClick={onViewMap}>
                View map
              </button>
            </div>
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
              {mutuals.map((m) => (
                <button key={m.id} className="profile-mutual" onClick={() => onOpen(m.id)}>
                  <span className="avatar" style={{ background: orbBackground(m.id, pfp) }}>
                    {initials(m.name)}
                  </span>
                  {firstName(m.name)}
                </button>
              ))}
              <button className="profile-mutual" onClick={() => onSoon('Linking people')}>
                <span className="avatar is-add">
                  <PlusIcon size={20} />
                </span>
                Link
              </button>
            </div>
          </div>

          <div className="profile-section">
            <span className="label">Moments · {moments.length}</span>
            <div className="profile-moments">
              {moments.map((m) => (
                <MomentCard key={m.id} moment={m} person={p} open={open.has(m.id)} fresh={m.id === freshMomentId} onToggle={() => toggleMoment(m.id)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sheet-bar">
        <button className="pill-button ink grow" onClick={() => onLogMoment(false)}>
          Log a moment
        </button>
        <button className="round-button glass-button is-lg" onClick={() => onLogMoment(true)} aria-label="Record a moment">
          <MicIcon size={18} />
        </button>
      </div>
    </section>
  )
}

function MomentCard({ moment: m, person, open, fresh, onToggle }: { moment: Moment; person: Person; open: boolean; fresh: boolean; onToggle: () => void }) {
  const kind = m.firstMeeting ? `first met · ${person.met.context}` : m.seconds ? 'voice note' : 'note'
  return (
    <div className={`moment${open ? ' is-open' : ''}${fresh ? ' is-fresh' : ''}`}>
      <button className="moment-head" onClick={onToggle} aria-expanded={open}>
        <span>
          <span className="moment-meta">
            {dateLabel(m.date)} · {kind}
          </span>
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

const WAVE = Array.from({ length: 34 }, (_, i) => 4 + ((i * 7) % 11) * 1.6)

function VoiceNote({ transcript, seconds }: { transcript: string; seconds?: number }) {
  const [played, setPlayed] = useState(-1)
  useEffect(() => {
    if (played < 0) return
    if (played >= WAVE.length) {
      const t = setTimeout(() => setPlayed(-1), 300)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setPlayed((n) => n + 1), 90)
    return () => clearTimeout(t)
  }, [played])

  if (!seconds)
    return (
      <div className="voice-note">
        <span className="moment-meta">Typed note</span>
        <q>{transcript}</q>
      </div>
    )
  return (
    <div className="voice-note">
      <div className="voice-row">
        <button className="round-button ink is-sm" onClick={() => setPlayed(0)} aria-label="Play voice note">
          <PlayIcon />
        </button>
        <div className="voice-wave" aria-hidden>
          {WAVE.map((h, i) => (
            <i key={i} className={i < played ? 'is-played' : undefined} style={{ height: h }} />
          ))}
        </div>
        <span className="moment-meta">{formatTime(seconds)}</span>
      </div>
      <q>{transcript}</q>
    </div>
  )
}
