import { useEffect, useRef, useState } from 'react'
import { MicIcon, SendIcon, StopIcon } from './Icons'
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
  onSend: (sent: Sent) => void
  className?: string
}

const WORD_MS = 150

// The input shared by Find, Add and a profile's "Add a moment": a pill you type into, or a mic that "records"
// the script word by word. Stop turns the recording into editable text; the arrow sends.
export function Composer({ placeholder, script, start, waitForOpen = false, onSend, className = '' }: Props) {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState(start === 'voice')
  const [typing, setTyping] = useState(start === 'type')
  const [seconds, setSeconds] = useState(0)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!voice) return
    const words = script.split(' ')
    let n = 0
    const w = setInterval(() => {
      n = Math.min(n + 1, words.length)
      setText(words.slice(0, n).join(' '))
    }, WORD_MS)
    const s = setInterval(() => setSeconds((x) => x + 1), 1000)
    return () => {
      clearInterval(w)
      clearInterval(s)
    }
  }, [voice, script])

  // Grow with the text, and take focus when typing starts.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [text, voice, typing])
  useEffect(() => {
    if (!typing || voice) return
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
  }, [typing, voice, waitForOpen])

  const send = () => {
    if (!text.trim()) return
    onSend({ text: text.trim(), voice: voice || seconds > 0, seconds: Math.max(seconds, 6) })
  }
  const stop = () => {
    setVoice(false)
    setTyping(true)
  }

  const open = voice || typing
  return (
    <div
      className={`composer${open ? ' is-open' : ''}${voice ? ' is-voice' : ''} ${className}`}
      // Keep focus on the text while its buttons are pressed: otherwise the keyboard drops on mouse-down, the bar
      // slides away from under the cursor and the click never lands (it took a second tap to start recording)
      onMouseDown={(e) => (e.target as HTMLElement).closest('button') && e.preventDefault()}
    >
      <textarea
        ref={taRef}
        rows={1}
        value={text}
        readOnly={voice}
        placeholder={placeholder}
        aria-label={placeholder}
        onFocus={() => setTyping(true)}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
      />
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
