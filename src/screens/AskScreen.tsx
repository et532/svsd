import { useEffect, useRef, useState } from 'react'
import { Composer, type Sent } from '../components/Composer'
import { ChevronRightIcon, CloseIcon, GamepadIcon, PartyIcon, PinIcon } from '../components/Icons'
import type { Person } from '../data/people'
import { interpret, storyRequest, type Action, type AskResult, type Match } from '../lib/ask'
import { updatePerson } from '../lib/peopleStore'
import { initials, orbBackground, orbTextColor } from '../lib/people'
import type { Tab } from '../components/TopControls'

type Props = {
  people: Person[]
  tab: Tab
  // Open typing (tap the bar) or recording (tap its mic).
  start: 'type' | 'voice'
  onClose: () => void
  onOpenProfile: (id: string) => void
  onAdd: () => void
  onShow: (ids: string[], label: string) => void
  onToast: (text: string) => void
}

// What you can search by, as examples.
const ways = [
  { Icon: GamepadIcon, label: 'Interest', example: 'Someone to go climbing with' },
  { Icon: PartyIcon, label: 'Occasion', example: 'Someone to invite to a house party' },
  { Icon: PinIcon, label: 'Location', example: 'Someone to hang out in the city' },
]

// "Search for someone by…": type or speak a request; Peepl finds the people, says why, and can draft the message.
export function AskScreen({ people, tab, start, onClose, onOpenProfile, onAdd, onShow, onToast }: Props) {
  const [asked, setAsked] = useState<{ text: string; result: AskResult } | null>(null)
  // A drafted message / intro open over the results
  const [drafting, setDrafting] = useState<Action | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function ask({ text }: Sent) {
    const result = interpret(text, people)
    setAsked({ text, result })
    // Actions hand off to the right screen after a beat, so you see what's happening
    const go = result.kind === 'add' ? onAdd : result.kind === 'none' || result.kind === 'people' ? null : () => onOpenProfile(result.person.id)
    if (go) timer.current = window.setTimeout(go, 900)
  }

  const result = asked?.result
  return (
    <section className="flow" aria-label="Find someone">
      <div className="flow-aura" aria-hidden />
      <button className="round-button glass-button flow-close" onClick={onClose} aria-label="Close">
        <CloseIcon size={20} />
      </button>

      <div className="flow-main is-top">
        {!asked && (
          <>
            <h2 className="flow-title">Search for someone by…</h2>
            <div className="flow-cards">
              {ways.map(({ Icon, label, example }) => (
                <div key={label} className="way">
                  <Icon size={22} />
                  <span>
                    <b>{label}</b>
                    <small>“{example}”</small>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {asked && result && (
          <div className="ask-answer" aria-live="polite">
            <h2 className="flow-title is-ink">{asked.text}</h2>
            <Answer result={result} tab={tab} onOpenProfile={onOpenProfile} onShow={onShow} onAction={setDrafting} />
          </div>
        )}
      </div>

      {drafting && (
        <Draft
          action={drafting}
          onCancel={() => setDrafting(null)}
          onSend={() => {
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
          }}
        />
      )}

      <div className="flow-bottom">
        {/* Remounted per answer so the next question starts empty */}
        <Composer key={asked?.text ?? 'first'} placeholder="Ask me about people" script={storyRequest(people)} start={asked ? undefined : start} onSend={ask} />
      </div>
    </section>
  )
}

type AnswerProps = {
  result: AskResult
  tab: Tab
  onOpenProfile: (id: string) => void
  onShow: (ids: string[], label: string) => void
  onAction: (action: Action) => void
}

function Answer({ result, tab, onOpenProfile, onShow, onAction }: AnswerProps) {
  if (result.kind === 'add') return <p className="flow-note">Okay, let’s add someone new…</p>
  if (result.kind === 'moment' || result.kind === 'profile') return <p className="flow-note">Opening {result.person.name}…</p>
  if (result.kind === 'none')
    return (
      <p className="flow-note">
        {result.title}. Try “who’s into music?”, “people I met at Config” or “who lives in London?”
      </p>
    )

  const { matches, title } = result
  if (matches.length === 0) return <p className="flow-note">{title}</p>
  return (
    <>
      {(result.groups ?? [{ label: '', matches }]).map((g) => (
        <div key={g.label} className="ask-group">
          {g.label && <span className="label ask-group-label">{g.label}</span>}
          <div className="ask-results">
            {g.matches.slice(0, 6).map((m) => (
              <ResultCard key={m.person.id} match={m} onOpenProfile={onOpenProfile} onAction={onAction} />
            ))}
          </div>
        </div>
      ))}
      {matches.length > 6 && <p className="flow-note">and {matches.length - 6} more</p>}
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
  )
}

// Name and "job · city", then why they came up, then the drafted next step.
function ResultCard({ match, onOpenProfile, onAction }: { match: Match; onOpenProfile: (id: string) => void; onAction: (a: Action) => void }) {
  const { person: p, why, via, action } = match
  return (
    <div className="result-card">
      <button className="result-head" onClick={() => onOpenProfile(p.id)}>
        <span className="avatar avatar-lg" style={{ background: orbBackground(p.id), color: orbTextColor(p.id) }}>
          {initials(p.name)}
        </span>
        <span className="result-who">
          <b>{p.name}</b>
          <span>{[p.profession, p.livesNow.city].filter((x) => x && x !== 'Unknown').join(' · ')}</span>
        </span>
        <ChevronRightIcon size={16} />
      </button>
      <div className="result-body">
        {via && <span className="ask-via">{via}</span>}
        <p>{why}</p>
        {action && (
          <button className="result-action" onClick={() => onAction(action)}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}

// Peepl drafts it; you decide whether to send it.
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
