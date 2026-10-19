import { useEffect, useRef, useState } from 'react'
import { BackIcon, CloseIcon, KeyboardIcon, MicIcon, PlusIcon, SearchIcon } from '../components/Icons'
import type { Person } from '../data/people'
import { interpret, storyRequest, type Action, type AskResult, type Match } from '../lib/ask'
import { updatePerson } from '../lib/peopleStore'
import { contextLabel, firstName, timeSince } from '../lib/people'
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

// One exchange in the chat: what you asked, and Peepl's answer once it's ready.
type Turn = { id: number; text: string; result: AskResult | null }

const WORD_MS = 190
const BARS = 22

// Ask Peepl: the voice AI search behind the mic button. It opens on a short "What can I help with?" sheet; once you
// finish speaking (a scripted demo, like capture) or typing, it becomes a chat: your request as a bubble, and
// Peepl's answer as person cards from your notes. Tap a card to open that person.
export function AskScreen({ people, tab, onClose, onOpenProfile, onAdd, onLogMoment, onShow, onToast }: Props) {
  const [turns, setTurns] = useState<Turn[]>([])
  // What's being "heard" right now (null when not listening)
  const [live, setLive] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [bars, setBars] = useState<number[]>(() => Array(BARS).fill(4))
  // A drafted message / intro open over the chat
  const [drafting, setDrafting] = useState<Action | null>(null)
  const timers = useRef<number[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)
  const listening = live !== null
  const inChat = turns.length > 0

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
    if (!listening) return setBars(Array(BARS).fill(4))
    const id = window.setInterval(() => setBars(Array.from({ length: BARS }, () => 4 + Math.random() * 18)), 110)
    return () => window.clearInterval(id)
  }, [listening])

  // Keep the newest message in view
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [turns, live])

  // Send a request into the chat, then answer it after a beat
  function ask(text: string) {
    clearTimers()
    setLive(null)
    const id = nextId.current++
    setTurns((t) => [...t, { id, text, result: null }])
    const r = interpret(text, people)
    timers.current.push(
      window.setTimeout(() => {
        setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, result: r } : turn)))
        // Actions hand off to the right screen after a beat, so you see what's happening
        if (r.kind === 'add') timers.current.push(window.setTimeout(onAdd, 1000))
        if (r.kind === 'moment') timers.current.push(window.setTimeout(() => onLogMoment(r.person.id), 1000))
        if (r.kind === 'profile') timers.current.push(window.setTimeout(() => onOpenProfile(r.person.id), 1000))
      }, 900),
    )
  }

  // "Speak" a request word by word, then send it
  function speak(text: string) {
    clearTimers()
    setTyping(false)
    setLive('')
    const words = text.split(' ')
    words.forEach((_, i) => timers.current.push(window.setTimeout(() => setLive(words.slice(0, i + 1).join(' ')), 350 + i * WORD_MS)))
    timers.current.push(window.setTimeout(() => ask(text), 350 + words.length * WORD_MS + 450))
  }

  function tapMic() {
    if (listening) return live ? ask(live) : (clearTimers(), setLive(null)) // stop early: go with what was heard
    speak(storyRequest(people))
  }

  function submitTyped(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    ask(draft.trim())
    setDraft('')
  }

  function startTyping() {
    clearTimers()
    setLive(null)
    setTyping(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const sendDraft = (action: Action) => {
    const { closes } = action
    if (closes) {
      const owner = people.find((p) => p.id === closes.personId)
      if (owner) updatePerson(owner.id, { todos: (owner.todos ?? []).map((t) => (t.id === closes.todoId ? { ...t, done: true } : t)) })
    }
    setDrafting(null)
    onToast(
      closes
        ? `Sent · ticked off “${people.find((p) => p.id === closes.personId)?.todos?.find((t) => t.id === closes.todoId)?.text}”`
        : `Sent to ${action.to.split(' ')[0]}`,
    )
  }

  const wave = (
    <span className="ask-wave" aria-hidden>
      {bars.map((h, i) => (
        <i key={i} style={{ height: h }} />
      ))}
    </span>
  )

  // ---- The chat ----
  if (inChat)
    return (
      <div className="ask-chat" role="dialog" aria-modal="true" aria-label="Ask Peepl">
        <header className="ask-chat-head">
          <button className="ask-back" onClick={onClose}>
            <BackIcon size={14} />
            <span className="label">{tab === 'mindmap' ? 'Mindmap' : 'People'}</span>
          </button>
          <h1>Ask</h1>
        </header>

        <div className="ask-thread" ref={threadRef} aria-live="polite">
          {turns.map((turn) => (
            <div key={turn.id} className="ask-turn">
              <p className="ask-bubble">{turn.text}</p>
              {turn.result ? (
                <Answer result={turn.result} tab={tab} onOpenProfile={onOpenProfile} onShow={onShow} onAction={setDrafting} />
              ) : (
                <p className="ask-thinking" aria-label="Looking through your notes">
                  <i />
                  <i />
                  <i />
                </p>
              )}
            </div>
          ))}
          {listening && <p className="ask-bubble is-live">{live || '…'}</p>}
        </div>

        <form className="ask-composer" onSubmit={submitTyped}>
          {listening ? (
            <div className="ask-composer-live">{wave}</div>
          ) : (
            <input
              ref={inputRef}
              className="ask-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about your people…"
              aria-label="Type a request"
            />
          )}
          <button type="button" className={`ask-composer-mic${listening ? ' is-live' : ''}`} onClick={tapMic} aria-label={listening ? 'Stop listening' : 'Tap to talk'}>
            {listening ? <span className="ask-stop" /> : <MicIcon size={20} />}
          </button>
        </form>

        {drafting && <Draft action={drafting} onCancel={() => setDrafting(null)} onSend={() => sendDraft(drafting)} />}
      </div>
    )

  // ---- The opening sheet ----
  return (
    <div className="ask">
      <div className="ask-scrim" onClick={onClose} aria-hidden />
      <div className={`ask-sheet${listening ? ' is-listening' : ''}`} role="dialog" aria-modal="true" aria-label="Ask Peepl">
        <div className="ask-head">
          <span className="label">{listening ? 'Listening…' : 'Ask Peepl'}</span>
          <button className="round-button glass-button is-sm" onClick={onClose} aria-label="Close">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="ask-orb" aria-hidden>
          <span />
        </div>

        <div className="ask-body" aria-live="polite">
          {listening ? (
            <p className="ask-heard">{live || '…'}</p>
          ) : (
            <>
              <h2 className="ask-title">What can I help with?</h2>
              <ul className="ask-can">
                <li>
                  <SearchIcon size={16} />
                  Find people by what they’re into, where they live or how you met
                </li>
                <li>
                  <PlusIcon size={16} />
                  Add someone new, or log a moment with someone
                </li>
              </ul>
            </>
          )}
        </div>

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
            <button className={`ask-mic${listening ? ' is-live' : ''}`} onClick={tapMic} aria-label={listening ? 'Stop listening' : 'Tap to talk'}>
              {listening ? (
                wave
              ) : (
                <>
                  <MicIcon size={20} />
                  Tap to talk
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
  onAction: (action: Action) => void
}

// Peepl's side of an exchange: a short reply for actions and misses, person cards for searches.
function Answer({ result, tab, onOpenProfile, onShow, onAction }: AnswerProps) {
  if (result.kind === 'add') return <p className="ask-reply">Okay, let’s add someone new.</p>
  if (result.kind === 'moment') return <p className="ask-reply">Logging a moment with {firstName(result.person.name)}…</p>
  if (result.kind === 'profile') return <p className="ask-reply">Opening {firstName(result.person.name)}’s profile…</p>
  if (result.kind === 'none')
    return <p className="ask-reply">{result.title}. Try “who’s into music?”, “people I met at Config” or “who lives in London?”</p>

  const { matches, title } = result
  if (matches.length === 0) return <p className="ask-reply">{title}.</p>
  const count = `${matches.length} ${matches.length === 1 ? 'person' : 'people'} · from your notes`
  return (
    <div className="ask-answer">
      {(result.groups ?? [{ label: count, matches }]).map((g) => (
        <div key={g.label} className="ask-group">
          <span className="label">{g.label}</span>
          {g.matches.slice(0, 6).map((m) => (
            <Card key={m.person.id} match={m} onOpenProfile={onOpenProfile} onAction={onAction} />
          ))}
        </div>
      ))}
      {matches.length > 6 && <p className="ask-more">and {matches.length - 6} more</p>}
      <button className="ask-link" onClick={() => onShow(matches.map((m) => m.person.id), title.replace(/^\d+ (people|person) · /, ''))}>
        Show {matches.length === 1 ? 'them' : `all ${matches.length}`} {tab === 'mindmap' ? 'on the mindmap' : 'in your list'}
      </button>
    </div>
  )
}

// A person in an answer: tap anywhere to open their profile; the drafted next step has its own button.
function Card({ match, onOpenProfile, onAction }: { match: Match; onOpenProfile: (id: string) => void; onAction: (a: Action) => void }) {
  const { person, why, say, via, action } = match
  const meta = [contextLabel[person.context], person.livesNow.city.split(',')[0], timeSince(person.lastContacted)].join(' · ')
  const open = () => onOpenProfile(person.id)
  return (
    <div
      className="ask-person"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
      aria-label={`Open ${person.name}`}
    >
      <div className="ask-person-head">
        <span className="ask-person-orb" style={{ background: `var(--${person.context}-core)` }} aria-hidden />
        <span>
          <b>{person.name}</b>
          <span className="ask-person-meta">{meta}</span>
        </span>
      </div>
      <p className="ask-person-why">{why}</p>
      {via && <span className="ask-via">{via}</span>}
      {say && <p className="ask-say">Say: {say}</p>}
      {action && (
        <button
          className="ask-action"
          onClick={(e) => {
            e.stopPropagation()
            onAction(action)
          }}
        >
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
        <button className="round-button glass-button is-sm" onClick={onCancel} aria-label="Back to the chat">
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
