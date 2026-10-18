import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { CheckIcon, CloseIcon, KeyboardIcon, MicIcon, PauseIcon } from '../components/Icons'
import type { Person } from '../data/people'
import {
  formatTime,
  momentPrompts,
  momentScript,
  parseMoment,
  parsePerson,
  personPrompts,
  personScript,
  typedExample,
  typedMomentExample,
  type Draft,
  type Field,
} from '../lib/capture'
import { auraDepth, auraGradient, firstName } from '../lib/people'

export type CaptureResult = { draft: Draft; voice: boolean; text: string; seconds: number }

type Props = {
  // Adding someone new, or logging a moment with someone you already have.
  person?: Person
  people: Person[]
  // Start recording right away (the mic button on a profile).
  autoTalk?: boolean
  onClose: () => void
  onDone: (result: CaptureResult) => void
}

type Rec = 'idle' | 'rec' | 'paused'

const WORD_MS = 210
const BARS = 30

// "Tell me about them": a prompt checklist that fills in as you talk (scripted) or type.
export function CaptureScreen({ person, people, autoTalk = false, onClose, onDone }: Props) {
  const isMoment = !!person
  const script = useMemo(() => (person ? momentScript(firstName(person.name)) : personScript), [person])
  const prompts: [Field, string][] = isMoment ? momentPrompts : personPrompts
  const scriptWords = useMemo(() => script.flatMap((l) => l.text.split(' ')), [script])

  const [phase, setPhase] = useState<'voice' | 'typed'>('voice')
  const [rec, setRec] = useState<Rec>(autoTalk ? 'rec' : 'idle')
  const [heard, setHeard] = useState(0) // words of the script heard so far
  const [seconds, setSeconds] = useState(0)
  const [typed, setTyped] = useState('')
  const [typedBase, setTypedBase] = useState<Draft>({})
  const [bars, setBars] = useState<number[]>(() => Array(BARS).fill(4))
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Everything understood from the lines heard so far.
  const voiceDraft = useMemo(() => {
    const draft: Draft = {}
    let count = 0
    for (const line of script) {
      count += line.text.split(' ').length
      if (heard >= count) Object.assign(draft, line.set)
    }
    return draft
  }, [heard, script])

  const draft: Draft =
    phase === 'voice' ? voiceDraft : { ...typedBase, ...(isMoment ? parseMoment(typed) : parsePerson(typed, people)) }
  const ready = isMoment ? !!draft.what : !!draft.name
  const talking = rec === 'rec' && heard < scriptWords.length

  // The scripted "recording": words, timer and waveform.
  useEffect(() => {
    if (rec !== 'rec' || phase !== 'voice') return
    const words = setInterval(() => setHeard((n) => Math.min(n + 1, scriptWords.length)), WORD_MS)
    const clock = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => {
      clearInterval(words)
      clearInterval(clock)
    }
  }, [rec, phase, scriptWords.length])

  useEffect(() => {
    if (rec !== 'rec' || phase !== 'voice') {
      setBars(Array(BARS).fill(4))
      return
    }
    const wave = setInterval(() => {
      const t = Date.now() / 300
      setBars(
        Array.from({ length: BARS }, (_, i) =>
          talking ? 4 + Math.random() * 22 * (0.5 + 0.5 * Math.sin(i / 3 + t)) : 3 + Math.random() * 3,
        ),
      )
    }, 110)
    return () => clearInterval(wave)
  }, [rec, phase, talking])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (phase !== 'typed') return
    const ta = textRef.current
    ta?.focus()
    ta?.setSelectionRange(ta.value.length, ta.value.length)
  }, [phase])

  // Voice <-> typed morphs with a view transition where the browser has one.
  function morph(update: () => void) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce) return update()
    document.startViewTransition(() => flushSync(update))
  }

  function toTyped() {
    morph(() => {
      setTypedBase(voiceDraft)
      if (!typed && heard) setTyped(scriptWords.slice(0, heard).join(' '))
      if (rec === 'rec') setRec('paused')
      setPhase('typed')
    })
  }

  function toVoice() {
    morph(() => {
      setRec(heard ? 'paused' : 'idle')
      setPhase('voice')
    })
  }

  function done() {
    if (!ready) return
    const voice = phase === 'voice'
    onDone({
      draft,
      voice,
      text: voice ? scriptWords.slice(0, heard).join(' ') : typed,
      seconds: Math.max(seconds, 9),
    })
  }

  // Transcript: the line being said, with the one before it faded.
  const lines: string[] = []
  let count = 0
  for (const line of script) {
    const ws = line.text.split(' ')
    const n = Math.min(ws.length, Math.max(0, heard - count))
    if (n <= 0) break
    lines.push(ws.slice(0, n).join(' '))
    count += ws.length
  }

  const filled = prompts.filter(([k]) => draft[k]).length
  const context = isMoment ? person.context : (draft.context ?? 'unsorted')
  const depth = isMoment ? (Math.max(auraDepth(person.id), 2) as 2 | 3) : filled >= 3 ? 2 : 1
  const title = phase === 'typed' ? 'Write it down' : isMoment ? `What happened with ${firstName(person.name)}?` : 'Tell me about them'

  return (
    <section className={`capture${phase === 'typed' ? ' is-typed' : ''}`} aria-label={isMoment ? 'Log a moment' : 'Add a person'}>
      <div className="capture-top">
        <span>
          {phase === 'voice' && rec !== 'idle' && (
            <span className="capture-timer">
              <i />
              {formatTime(seconds)}
            </span>
          )}
        </span>
        <button className="round-button glass-button capture-close" onClick={onClose} aria-label="Close">
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="capture-scroll">
        <div className="capture-orb" aria-hidden>
          <span style={{ background: auraGradient(context, depth), transform: `scale(${talking ? 1 + (bars[3] / 26) * 0.12 : 1})` }} />
        </div>
        <h2 className="capture-title">{title}</h2>
        <span className="label">Try to cover</span>
        <ul className="capture-prompts">
          {prompts.map(([k, q]) => (
            <li key={k} className={`capture-prompt${draft[k] ? ' is-done' : ''}`}>
              <span className="capture-check">
                <CheckIcon size={14} />
              </span>
              <span className="capture-prompt-text">
                <span className="capture-q">{q}</span>
                {draft[k] && <span className="capture-a">{draft[k]}</span>}
              </span>
            </li>
          ))}
        </ul>
        {phase === 'voice' && lines.length > 0 && (
          <div className="capture-transcript">
            <span className="label">Live transcript</span>
            <p>
              {lines.length > 1 && <span className="is-old">{lines[lines.length - 2]} </span>}
              {lines[lines.length - 1]}
            </p>
          </div>
        )}
      </div>

      {phase === 'typed' ? (
        <div className="capture-bar capture-composer">
          <div className="capture-box">
            <label htmlFor="capture-note" className="sr-only">
              Your note
            </label>
            <textarea
              id="capture-note"
              ref={textRef}
              rows={4}
              value={typed}
              placeholder={isMoment ? typedMomentExample : typedExample}
              onChange={(e) => setTyped(e.target.value)}
            />
            <div className="capture-actions">
              <button className="round-button soft" onClick={toVoice} aria-label="Switch to voice">
                <MicIcon size={18} />
              </button>
              <button className="round-button ink" onClick={done} disabled={!ready} aria-label={isMoment ? 'Save moment' : 'Save person'}>
                <CheckIcon />
              </button>
            </div>
          </div>
        </div>
      ) : rec === 'idle' ? (
        <div className="capture-bar is-idle">
          <button className="round-button glass-button capture-type" onClick={toTyped} aria-label="Type instead">
            <KeyboardIcon />
          </button>
          <button className="capture-talk" onClick={() => setRec('rec')} aria-label="Tap to talk">
            <MicIcon size={28} />
          </button>
          <span className="capture-hint">Tap to talk</span>
        </div>
      ) : (
        <div className="capture-bar">
          <button className="round-button glass-button" onClick={toTyped} aria-label="Type instead">
            <KeyboardIcon />
          </button>
          <div className="capture-pill">
            <div className="capture-wave" aria-hidden>
              {bars.map((h, i) => (
                <i key={i} style={{ height: h }} />
              ))}
            </div>
            <button
              className="round-button soft"
              onClick={() => setRec(rec === 'rec' ? 'paused' : 'rec')}
              aria-label={rec === 'rec' ? 'Pause' : 'Resume'}
            >
              {rec === 'rec' ? <PauseIcon /> : <MicIcon size={18} />}
            </button>
            <button className="round-button ink" onClick={done} disabled={!ready} aria-label="Done">
              <CheckIcon />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
