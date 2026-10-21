import { useEffect, useRef, useState } from 'react'
import { Composer, type Sent } from '../components/Composer'
import { ChevronRightIcon, CloseIcon, GamepadIcon, PartyIcon, PinIcon } from '../components/Icons'
import type { Person } from '../data/people'
import { interpret, storyRequest, type Action, type AskResult, type Match } from '../lib/ask'
import { updatePerson } from '../lib/peopleStore'
import { findPeople, warmUp } from '../lib/semantic'
import { Avatar } from '../components/Avatar'
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
const THINK_MS = 1600 // the pace of the status lines while searching
const MIN_THINK_MS = 450

const ways = [
  { Icon: GamepadIcon, label: 'Interest', example: 'Someone to go climbing with', query: 'Someone to go climbing with' },
  { Icon: PartyIcon, label: 'Occasion', example: 'Someone to invite to a house party', query: 'friends' },
  { Icon: PinIcon, label: 'Location', example: 'Someone to hang out in the city', query: 'friends in New York' },
]

// "Search for someone by…": type or speak a request; Peepl finds the people, says why, and can draft the message.
export function AskScreen({ people, tab, start, onClose, onOpenProfile, onAdd, onShow, onToast }: Props) {
  const [asked, setAsked] = useState<{ text: string; result: AskResult } | null>(null)
  // The request being "made": shown for a beat so it reads as a real search, not an instant answer
  const [pending, setPending] = useState<string | null>(null)
  const timer = useRef(0)
  // Only the latest question may show its answer (the meaning search is async)
  const seq = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => void warmUp(people), [people])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // `query` is what gets searched when the shown text is a loose example (the cards)
  function ask({ text, query }: Sent & { query?: string }) {
    window.clearTimeout(timer.current)
    setAsked(null)
    setPending(text)
    const mine = ++seq.current
    const asking = query ?? text
    const search = async () => {
      let result = interpret(asking, people)
      // A plain "find people like this" (or nothing found): add the closest people by meaning to what the rules found
      if (result.kind === 'none' || (result.kind === 'people' && (result.generic || result.matches.length === 0)))
        result = await findPeople(asking, people, result).catch(() => result)
      return result
    }
    // The answer shows as soon as the search is done; only a very quick one is held for a beat so it doesn't flash
    Promise.all([search(), new Promise((r) => (timer.current = window.setTimeout(r, MIN_THINK_MS)))]).then(([result]) => {
      if (mine !== seq.current) return
      setPending(null)
      setAsked({ text, result })
      // Actions hand off to the right screen after a beat, so you see what's happening
      const go = result.kind === 'add' ? onAdd : result.kind === 'none' || result.kind === 'people' ? null : () => onOpenProfile(result.person.id)
      if (go) timer.current = window.setTimeout(go, 900)
    })
  }

  // Copying or sharing a draft counts as sending it: tick off the follow-up it answers
  function sent(action: Action) {
    const { closes } = action
    const owner = closes && people.find((p) => p.id === closes.personId)
    if (closes && owner) updatePerson(owner.id, { todos: (owner.todos ?? []).map((t) => (t.id === closes.todoId ? { ...t, done: true } : t)) })
    onToast(`Draft for ${action.to.split(' ')[0]} ready`)
  }

  const result = asked?.result
  return (
    <section className="flow" aria-label="Find someone">
      <div className="flow-aura" aria-hidden />
      <button className="round-button glass-button flow-close" onClick={onClose} aria-label="Close">
        <CloseIcon size={20} />
      </button>

      <div className="flow-main is-top">
        {!asked && !pending && (
          <>
            <h2 className="flow-title">Search for someone by…</h2>
            <div className="flow-cards">
              {ways.map(({ Icon, label, example, query }) => (
                <button key={label} className="way" onClick={() => ask({ text: example, query, voice: false, seconds: 0 })}>
                  <Icon size={22} />
                  <span>
                    <b>{label}</b>
                    <small>“{example}”</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {pending && (
          <div className="ask-answer" aria-live="polite">
            <h2 className="flow-title is-ink">{pending}</h2>
            <Thinking />
          </div>
        )}

        {asked && result && (
          <div className="ask-answer" aria-live="polite">
            <h2 className="flow-title is-ink">{asked.text}</h2>
            <Answer result={result} tab={tab} count={people.length} onOpenProfile={onOpenProfile} onShow={onShow} onAdd={onAdd} onSent={sent} />
          </div>
        )}
      </div>

      <div className="flow-bottom">
        {/* Remounted per answer so the next question starts empty */}
        <Composer key={pending ?? asked?.text ?? 'first'} placeholder="Ask me about people" script={storyRequest(people)} start={asked || pending ? undefined : start} onSend={ask} />
      </div>
    </section>
  )
}

type AnswerProps = {
  result: AskResult
  tab: Tab
  // How many people are searched, for "none of your N people"
  count: number
  onOpenProfile: (id: string) => void
  onShow: (ids: string[], label: string) => void
  onAdd: () => void
  onSent: (action: Action) => void
}

function Answer({ result, tab, count, onOpenProfile, onShow, onAdd, onSent }: AnswerProps) {
  if (result.kind === 'add') return <p className="flow-note">Okay, let’s add someone new…</p>
  if (result.kind === 'moment' || result.kind === 'profile') return <p className="flow-note">Opening {result.person.name}…</p>
  if (result.kind === 'none')
    return (
      <p className="flow-note">
        {result.title}. Try “who’s into music?”, “people I met at Config” or “who lives in London?”
      </p>
    )

  const { matches, title } = result
  if (matches.length === 0)
    return (
      <>
        <p className="flow-note">
          {title}. None of the {count} {count === 1 ? 'person' : 'people'} in your list fit, so I won’t guess.
        </p>
        {result.near && result.near.length > 0 && (
          <div className="ask-group">
            <span className="label ask-group-label">Closest, but not quite</span>
            <div className="ask-results">
              {result.near.map((m) => (
                <ResultCard key={m.person.id} match={m} onOpenProfile={onOpenProfile} onSent={onSent} />
              ))}
            </div>
          </div>
        )}
        <button className="ask-show" onClick={onAdd}>
          Add someone new
        </button>
      </>
    )
  return (
    <>
      {(result.groups ?? [{ label: '', matches }]).map((g) => (
        <div key={g.label} className="ask-group">
          {g.label && <span className="label ask-group-label">{g.label}</span>}
          <div className="ask-results">
            {g.matches.slice(0, 6).map((m) => (
              <ResultCard key={m.person.id} match={m} onOpenProfile={onOpenProfile} onSent={onSent} />
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
function ResultCard({ match, onOpenProfile, onSent }: { match: Match; onOpenProfile: (id: string) => void; onSent: (a: Action) => void }) {
  const { person: p, why, via, action } = match
  const [text, setText] = useState<string | null>(null) // the draft, once opened inline
  return (
    <div className="result-card">
      <button className="result-head" onClick={() => onOpenProfile(p.id)}>
        <Avatar id={p.id} />
        <span className="result-who">
          <b>{p.name}</b>
          <span>{[p.profession, p.livesNow.city].filter((x) => x && x !== 'Unknown').join(' · ')}</span>
        </span>
        <ChevronRightIcon size={19} />
      </button>
      <div className="result-body">
        {via && <span className="ask-via">{via}</span>}
        <p>{why}</p>
        {action && text === null && (
          <button className="result-action" onClick={() => setText(action.draft)}>
            {action.label}
          </button>
        )}
        {action && text !== null && (
          <div className="result-draft">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label="Message" />
            <div className="result-draft-actions">
              <button
                className="pill-button ghost"
                onClick={() => {
                  void navigator.clipboard?.writeText(text)
                  onSent(action)
                }}
              >
                Copy Text
              </button>
              <button
                className="pill-button soft"
                onClick={() => {
                  void navigator.share?.({ text }).catch(() => {})
                  onSent(action)
                }}
              >
                Share
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Shimmering status line (it changes as the "search" moves along) over placeholder cards
function Thinking() {
  const steps = ['Reading your notes…', 'Looking through your people…', 'Picking the best matches…']
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setStep((n) => Math.min(n + 1, steps.length - 1)), THINK_MS / steps.length)
    return () => window.clearInterval(t)
  }, [steps.length])
  return (
    <>
      <p className="ask-thinking" key={step}>
        <span className="ask-thinking-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        {steps[step]}
      </p>
      <div className="ask-results" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="result-card is-skeleton" style={{ animationDelay: `${i * 0.15}s` }}>
            <div className="skel-row">
              <span className="skel skel-avatar" />
              <span className="skel-lines">
                <span className="skel" />
                <span className="skel is-short" />
              </span>
            </div>
            <span className="skel" />
            <span className="skel is-short" />
          </div>
        ))}
      </div>
    </>
  )
}
