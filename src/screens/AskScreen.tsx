import { useEffect, useRef, useState } from 'react'
import { ChevronRightIcon, CloseIcon, KeyboardIcon, MicIcon } from '../components/Icons'
import type { Person } from '../data/people'
import { interpret, storyRequest, type Action, type AskResult, type Match } from '../lib/ask'
import { updatePerson } from '../lib/peopleStore'
import { firstName, initials, orbBackground, orbTextColor } from '../lib/people'
import type { Tab } from '../components/BottomBar'

type Props = {
  people: Person[]
  tab: Tab
  onClose: () => void
  onOpenProfile: (id: string) => void
  onAdd: () => void
  onLogMoment: (id: string) => void
  onShow: (ids: string[], label: string) => void
  onToast: (text: string) => void
}

type Phase = 'idle' | 'listening' | 'thinking' | 'answer'

const WORD_MS = 190
const BARS = 26

// Ask Peepl: the voice AI search behind the mic button. Speak (a scripted demo, like capture) or type a request;
// it finds people or jumps to the right action.
export function AskScreen({ people, tab, onClose, onOpenProfile, onAdd, onLogMoment, onShow, onToast }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [heard, setHeard] = useState('')
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [result, setResult] = useState<AskResult | null>(null)
  const [bars, setBars] = useState<number[]>(() => Array(BARS).fill(4))
  // A drafted message / intro open over the results
  const [drafting, setDrafting] = useState<Action | null>(null)
  const timers = useRef<number[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // A live-looking waveform while listening
  useEffect(() => {
    if (phase !== 'listening') return setBars(Array(BARS).fill(4))
    const id = window.setInterval(() => setBars(Array.from({ length: BARS }, () => 4 + Math.random() * 22)), 110)
    return () => window.clearInterval(id)
  }, [phase])

  // Work out what they meant, then act on it
  function answer(text: string) {
    clearTimers()
    setHeard(text)
    setPhase('thinking')
    const r = interpret(text, people)
    timers.current.push(
      window.setTimeout(() => {
        setResult(r)
        setPhase('answer')
        // Actions hand off to the right screen after a beat, so you see what's happening
        if (r.kind === 'add') timers.current.push(window.setTimeout(onAdd, 900))
        if (r.kind === 'moment') timers.current.push(window.setTimeout(() => onLogMoment(r.person.id), 900))
        if (r.kind === 'profile') timers.current.push(window.setTimeout(() => onOpenProfile(r.person.id), 900))
      }, 650),
    )
  }

  // "Speak" a request word by word, then answer it
  function say(text: string) {
    clearTimers()
    setTyping(false)
    setResult(null)
    setHeard('')
    setPhase('listening')
    const words = text.split(' ')
    words.forEach((_, i) =>
      timers.current.push(window.setTimeout(() => setHeard(words.slice(0, i + 1).join(' ')), 350 + i * WORD_MS)),
    )
    timers.current.push(window.setTimeout(() => answer(text), 350 + words.length * WORD_MS + 450))
  }

  function tapMic() {
    if (phase === 'listening') return answer(heard) // stop early: go with what was heard
    say(storyRequest(people))
  }

  function startTyping() {
    clearTimers()
    setPhase(result ? 'answer' : 'idle')
    setTyping(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function submitTyped(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    setTyping(false)
    answer(draft.trim())
    setDraft('')
  }

  const reset = () => {
    clearTimers()
    setResult(null)
    setHeard('')
    setPhase('idle')
  }

  const status =
    phase === 'listening' ? 'Listening…' : phase === 'thinking' ? 'Looking through your people…' : phase === 'answer' ? 'Ask Peepl' : 'Ask Peepl'

  return (
    <div className="ask">
      <div className="ask-scrim" onClick={onClose} aria-hidden />
      <div className={`ask-sheet is-${phase}`} role="dialog" aria-modal="true" aria-label="Ask Peepl">
        <div className="ask-head">
          {phase !== 'idle' && <span className="label">{status}</span>}
          <button className="round-button glass-button is-sm" onClick={onClose} aria-label="Close">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="ask-orb" aria-hidden>
          <span />
        </div>

        <div className="ask-body" aria-live="polite">
          {phase === 'idle' && (
            <>
              <h2 className="ask-title is-welcome">Welcome, Emily</h2>
              <p className="ask-hint">Add a new person, or ask me to find specific people by their interests, work, or how you know them.</p>
            </>
          )}

          {(phase === 'listening' || phase === 'thinking') && <p className="ask-heard">{heard || '…'}</p>}

          {phase === 'answer' && result && (
            <>
              <p className="ask-you">“{heard}”</p>
              <Answer
                result={result}
                tab={tab}
                onOpenProfile={onOpenProfile}
                onShow={onShow}
                onAgain={reset}
                onAction={setDrafting}
              />
            </>
          )}
        </div>

        {drafting && (
          <Draft
            action={drafting}
            onCancel={() => setDrafting(null)}
            onSend={(text) => {
              const { closes } = drafting
              if (closes) {
                const owner = people.find((p) => p.id === closes.personId)
                if (owner) updatePerson(owner.id, { todos: (owner.todos ?? []).map((t) => (t.id === closes.todoId ? { ...t, done: true } : t)) })
              }
              setDrafting(null)
              onToast(
                closes
                  ? `Sent · ticked off “${people.find((p) => p.id === closes.personId)?.todos?.find((t) => t.id === closes.todoId)?.text}”`
                  : `Sent to ${drafting.to.split(' ')[0]}`,
              )
              void text
            }}
          />
        )}

        {typing ? (
          <form className="ask-bar is-typing" onSubmit={submitTyped}>
            <input
              ref={inputRef}
              className="ask-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. who’s into baseball?"
              aria-label="Type a request"
            />
            <button type="button" className="round-button soft" onClick={() => setTyping(false)} aria-label="Speak instead">
              <MicIcon size={18} />
            </button>
          </form>
        ) : (
          <div className="ask-bar">
            <button
              className={`ask-mic${phase === 'listening' ? ' is-live' : ''}`}
              onClick={tapMic}
              aria-label={phase === 'listening' ? 'Stop listening' : 'Tap to talk'}
            >
              {phase === 'listening' ? (
                <span className="ask-wave" aria-hidden>
                  {bars.map((h, i) => (
                    <i key={i} style={{ height: h }} />
                  ))}
                </span>
              ) : (
                <>
                  <MicIcon size={20} />
                  {phase === 'answer' ? 'Ask again' : 'Tap to talk'}
                </>
              )}
            </button>
            <button className="round-button soft" onClick={startTyping} aria-label="Type instead">
              <KeyboardIcon size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

type AnswerProps = {
  result: AskResult
  tab: Tab
  onOpenProfile: (id: string) => void
  onShow: (ids: string[], label: string) => void
  onAgain: () => void
  onAction: (action: Action) => void
}

function Answer({ result, tab, onOpenProfile, onShow, onAgain, onAction }: AnswerProps) {
  if (result.kind === 'add') return <h2 className="ask-title">Okay, let’s add someone new.</h2>
  if (result.kind === 'moment') return <h2 className="ask-title">Logging a moment with {firstName(result.person.name)}…</h2>
  if (result.kind === 'profile') return <h2 className="ask-title">Opening {firstName(result.person.name)}’s profile…</h2>
  if (result.kind === 'none')
    return (
      <>
        <h2 className="ask-title">{result.title}</h2>
        <p className="ask-hint">Try “who’s into music?”, “people I met at Config” or “who lives in London?”</p>
        <button className="ask-link" onClick={onAgain}>
          See examples
        </button>
      </>
    )

  const { matches, title } = result
  return (
    <>
      <h2 className="ask-title is-small">{title}</h2>
      {matches.length > 0 && (
        <>
          {(result.groups ?? [{ label: '', matches }]).map((g) => (
            <div key={g.label} className="ask-group">
              {g.label && <span className="label ask-group-label">{g.label}</span>}
              <div className="ask-results">
                {g.matches.slice(0, 6).map((m) => (
                  <Row key={m.person.id} match={m} onOpenProfile={onOpenProfile} onAction={onAction} />
                ))}
              </div>
            </div>
          ))}
          {matches.length > 6 && <p className="ask-hint">and {matches.length - 6} more</p>}
          <button
            className="ask-show"
            onClick={() =>
              onShow(
                matches.map((m) => m.person.id),
                title.replace(/^\d+ (people|person) · /, ''),
              )
            }
          >
            Show {matches.length === 1 ? 'them' : `all ${matches.length}`} {tab === 'mindmap' ? 'on the mindmap' : 'in your list'}
          </button>
        </>
      )}
    </>
  )
}

function Row({ match, onOpenProfile, onAction }: { match: Match; onOpenProfile: (id: string) => void; onAction: (a: Action) => void }) {
  const { person, why, say, via, action } = match
  if (!say && !action)
    return (
      <button className="ask-row" onClick={() => onOpenProfile(person.id)}>
        <span className="avatar avatar-sm" style={{ background: orbBackground(person.id), color: orbTextColor(person.id) }}>
          {initials(person.name)}
        </span>
        <span className="ask-row-text">
          <b>{person.name}</b>
          <span>{why}</span>
        </span>
        <ChevronRightIcon size={16} />
      </button>
    )
  return (
    <div className="ask-card">
      <button className="ask-row" onClick={() => onOpenProfile(person.id)}>
        <span className="avatar avatar-sm" style={{ background: orbBackground(person.id), color: orbTextColor(person.id) }}>
          {initials(person.name)}
        </span>
        <span className="ask-row-text">
          <b>{person.name}</b>
          <span>{why}</span>
        </span>
        <ChevronRightIcon size={16} />
      </button>
      {via && <span className="ask-via">{via}</span>}
      {say && <p className="ask-say">{say}</p>}
      {action && (
        <button className="ask-action" onClick={() => onAction(action)}>
          {action.label}
        </button>
      )}
    </div>
  )
}

// Peepl drafts it; you decide whether to send.
function Draft({ action, onCancel, onSend }: { action: Action; onCancel: () => void; onSend: (text: string) => void }) {
  const [text, setText] = useState(action.draft)
  const title = action.kind === 'intro' ? 'Draft intro' : action.kind === 'coffee' ? 'Plan coffee' : 'Message'
  return (
    <div className="ask-draft" role="dialog" aria-label={title}>
      <div className="ask-draft-head">
        <span className="label">{title}</span>
        <button className="round-button glass-button is-sm" onClick={onCancel} aria-label="Back to results">
          <CloseIcon size={14} />
        </button>
      </div>
      <p className="ask-draft-to">To: {action.to}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} aria-label="Message" />
      {action.closes && <p className="ask-draft-note">Sending this ticks off the follow-up on their profile.</p>}
      <div className="ask-draft-actions">
        <button className="pill-button ghost" onClick={onCancel}>
          Not now
        </button>
        <button className="pill-button ink grow" onClick={() => onSend(text)}>
          Send
        </button>
      </div>
    </div>
  )
}
