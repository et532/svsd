import { useEffect, useMemo, useRef, useState } from 'react'
import type { Person } from '../data/people'
import { parseCompany } from '../lib/capture'
import { applyFixes, detectNames, replaceName, resolveName, saveFix, splitNames } from '../lib/nameFixes'
import { MicIcon, SendIcon, StopIcon } from './Icons'
import { listen } from '../lib/speech'
import { Wave } from './Wave'

export type Sent = { text: string; voice: boolean; seconds: number }

type Props = {
  placeholder: string
  // What the mic "hears" (the voice is a scripted demo, like the rest of capture).
  script: string
  // Open straight into typing or recording.
  start?: 'type' | 'voice'
  // Hold focus (and so the keyboard) until the screen has nearly finished growing open.
  waitForOpen?: boolean
  // When given, names in a finished voice note are outlined in the text so a misheard one can be fixed (and remembered).
  people?: Person[]
  onSend: (sent: Sent) => void
  className?: string
}

const WORD_MS = 150

// The input shared by Find, Add and a profile's "Add a moment": a pill you type into, or a mic that "records"
// the script word by word. Stop turns the recording into editable text; the arrow sends.
export function Composer({ placeholder, script, start, waitForOpen = false, people, onSend, className = '' }: Props) {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState(start === 'voice')
  const [typing, setTyping] = useState(start === 'type')
  const [seconds, setSeconds] = useState(0)
  // After a voice note stops, the text is shown with its names outlined until the user taps the text to edit it
  const [review, setReview] = useState(false)
  const [fixed, setFixed] = useState<[string, string][]>([])
  // The name word being retyped: which name, and which of its words
  const [editing, setEditing] = useState<{ name: string; word: number } | null>(null)
  // Why the mic couldn't listen, shown in place of the placeholder
  const [voiceError, setVoiceError] = useState('')
  // A local recording is being turned into text (the first time this downloads the speech model)
  const [transcribing, setTranscribing] = useState(false)
  // The local voice model is still getting ready (first use downloads it): nothing can show until it is
  const [loadingVoice, setLoadingVoice] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  // Remembered name fixes are applied to the words as they appear
  const fixNames = !!people
  // Names and the company in the note, outlined for fixing
  const company = useMemo(() => (people && review ? parseCompany(text) : undefined), [people, review, text])
  const names = useMemo(() => {
    const n = people && review ? detectNames(text, people) : []
    return company && !n.includes(company) ? [...n, company] : n
  }, [people, review, text, company])
  const showNames = review && !voice && names.length > 0

  useEffect(() => {
    if (!voice) return
    const s = setInterval(() => setSeconds((x) => x + 1), 1000)
    // The real mic where the browser has one; otherwise the scripted demo types the script word by word.
    setVoiceError('')
    const stopListening = listen(
      (t) => setText(fixNames ? applyFixes(t).text : t),
      (reason) => {
        setVoiceError(reason)
        setVoice(false)
        setTyping(true)
      },
      setTranscribing,
      setLoadingVoice,
    )
    if (stopListening)
      return () => {
        clearInterval(s)
        stopListening()
      }
    const words = script.split(' ')
    let n = 0
    const w = setInterval(() => {
      n = Math.min(n + 1, words.length)
      setText(words.slice(0, n).join(' '))
    }, WORD_MS)
    return () => {
      clearInterval(w)
      clearInterval(s)
    }
  }, [voice, script, fixNames])

  // Grow with the text, and take focus when typing starts.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [text, voice, typing, showNames])
  useEffect(() => {
    if (!typing || voice || showNames) return
    const ta = taRef.current
    const opening = waitForOpen
      ? ta
          ?.closest('.layer')
          ?.getAnimations()
          .find((a) => a instanceof CSSAnimation && a.animationName === 'grow-circle')
      : undefined
    if (!opening) {
      ta?.focus()
      return
    }
    // Bring the keyboard up just before the reveal ends, while it is easing out. If the screen is
    // closed mid-open the grow animation is cancelled (idle), and it never takes focus.
    const LEAD_MS = 150
    const ms = Number(opening.effect?.getComputedTiming().duration) || 0
    const t = setTimeout(
      () => opening.playState !== 'idle' && ta?.focus(),
      Math.max(0, ms - LEAD_MS - (Number(opening.currentTime) || 0)),
    )
    return () => clearTimeout(t)
  }, [typing, voice, waitForOpen, showNames])

  // What the mic heard, with the remembered name fixes applied
  const heard = () => (people && voice ? applyFixes(text) : { text, fixed: [] })
  const send = () => {
    if (!text.trim()) return
    onSend({ text: heard().text.trim(), voice: voice || seconds > 0, seconds: Math.max(seconds, 6) })
  }
  const stop = () => {
    const h = heard()
    setText(h.text)
    setFixed(h.fixed)
    setVoice(false)
    setTyping(true)
    setReview(true)
  }
  // Retype one word of a name. The fix is remembered, and linked to the person if you know them.
  const rename = (name: string, word: number, typed: string | null) => {
    setEditing(null)
    if (!typed || !people) return
    const words = name.split(' ')
    words[word] = typed
    const full = typed.includes(' ') ? typed : words.join(' ')
    // A company is never linked to a person
    const meant = name === company ? full : resolveName(full, people)
    if (meant === name) return
    const was = fixed.find(([, m]) => m === name)?.[0] ?? name
    saveFix(was, meant)
    setText(replaceName(text, name, meant))
    setFixed([...fixed.filter(([, m]) => m !== name), [was, meant]])
  }

  const open = voice || typing
  return (
    <div
      className={`composer${open ? ' is-open' : ''}${voice ? ' is-voice' : ''} ${className}`}
      // Keep focus on the text while its buttons are pressed: otherwise the keyboard drops on mouse-down, the bar
      // slides away from under the cursor and the click never lands (it took a second tap to start recording)
      onMouseDown={(e) => (e.target as HTMLElement).closest('button') && e.preventDefault()}
    >
      {showNames ? (
        // The note with each name word outlined; tap one to retype it, tap anywhere else to edit the text
        <div className="composer-note" onClick={() => setReview(false)}>
          {splitNames(text, names).map((part, i) =>
            i % 2 === 0 ? (
              part
            ) : (
              <span key={i} onClick={(e) => e.stopPropagation()}>
                {part.split(' ').map((w, j) => (
                  <span key={j}>
                    {j > 0 && ' '}
                    {editing?.name === part && editing.word === j ? (
                      <NameField value={w} onDone={(t) => rename(part, j, t)} />
                    ) : (
                      <button
                        className="name-token"
                        onClick={() => setEditing({ name: part, word: j })}
                        aria-label={`Fix the name ${w}`}
                      >
                        {w}
                      </button>
                    )}
                  </span>
                ))}
              </span>
            ),
          )}
        </div>
      ) : (
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          readOnly={voice}
          placeholder={transcribing ? 'Turning your voice into text…' : voiceError ? voiceMessage(voiceError) : placeholder}
          aria-label={placeholder}
          onFocus={() => {
            setTyping(true)
            setReview(false)
          }}
          // Names go back to being outlined once you leave the text, so more can be fixed
          onBlur={() => people && !voice && text.trim() && setReview(true)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
      )}
      {voice && loadingVoice && !text && (
        <p className="composer-hint">Getting the voice model ready. This takes a minute the first time, then it is instant.</p>
      )}
      {voice ? (
        <div className="composer-row">
          <Wave live />
          <button className="round-button soft" onClick={stop} aria-label="Stop recording">
            <StopIcon />
          </button>
          <button className="round-button ink" onClick={send} aria-label="Send">
            <SendIcon />
          </button>
        </div>
      ) : text.trim() ? (
        <button className="round-button ink composer-send" onClick={send} aria-label="Send">
          <SendIcon />
        </button>
      ) : (
        <button className="round-button soft composer-mic" onClick={() => setVoice(true)} aria-label="Record by voice">
          <MicIcon size={18} />
        </button>
      )}
    </div>
  )
}

function voiceMessage(reason: string) {
  if (reason === 'not-allowed' || reason === 'service-not-allowed') return 'The mic is blocked. Allow it in the address bar, or type.'
  if (reason === 'network') return 'This browser cannot reach its speech service. Try Chrome or Edge, or type.'
  return 'Voice is not working in this browser. Type instead.'
}

// One name word, retyped in place. The old name stays visible, faded, and what you type overwrites it from the left
// (typed "Jor" over "Jorden" reads "Jor" + faded "den"). The real textarea sits on top with invisible text, so the
// desktop keyboard types into it and the caret lands after the last typed letter. Return saves, Esc cancels.
function NameField({ value, onDone }: { value: string; onDone: (text: string | null) => void }) {
  const done = useRef(false)
  const [val, setVal] = useState('')
  const finish = (t: string) => {
    if (done.current) return
    done.current = true
    onDone(t.trim() || null)
  }
  return (
    <span className="name-edit">
      <span className="name-edit-old" aria-hidden>
        <b>{val}</b>
        {value.slice(val.length)}
      </span>
      <textarea
        rows={1}
        autoFocus
        maxLength={60}
        value={val}
        aria-label={`New spelling of ${value}`}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            finish(val)
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            finish('')
          }
        }}
        onBlur={() => finish(val)}
      />
    </span>
  )
}
