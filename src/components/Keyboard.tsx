import { useEffect, useRef, useState, type ReactNode } from 'react'

// The iOS keyboard (Figma "Keyboard" component, iOS 26 look) for the desktop device frame. It types into whichever
// textarea has focus, so Composer needs no changes. On a real phone (under 600px) the system keyboard is used instead.

const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!

/** The textarea the keyboard is typing into, or null (keyboard hidden). */
export function useKeyboardTarget() {
  const [target, setTarget] = useState<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    if (!window.matchMedia('(min-width: 600px)').matches) return
    const sync = () => {
      const a = document.activeElement
      setTarget(a instanceof HTMLTextAreaElement && !a.readOnly && a.isConnected ? a : null)
    }
    document.addEventListener('focusin', sync)
    document.addEventListener('focusout', () => setTimeout(sync))
    // ponytail: poll because removing a focused element (closing a layer) fires no event; use a MutationObserver if this ever shows up in a profile
    const poll = setInterval(sync, 250)
    return () => {
      document.removeEventListener('focusin', sync)
      clearInterval(poll)
    }
  }, [])
  return target
}

function insert(ta: HTMLTextAreaElement, text: string, back = 0) {
  const start = Math.max(0, ta.selectionStart - back)
  const end = ta.selectionEnd
  setValue.call(ta, ta.value.slice(0, start) + text + ta.value.slice(end))
  ta.setSelectionRange(start + text.length, start + text.length)
  ta.dispatchEvent(new Event('input', { bubbles: true }))
}

function backspace(ta: HTMLTextAreaElement) {
  const { selectionStart: s, selectionEnd: e } = ta
  if (s === e && s === 0) return
  setValue.call(ta, ta.value.slice(0, s === e ? s - 1 : s) + ta.value.slice(e))
  ta.setSelectionRange(s === e ? s - 1 : s, s === e ? s - 1 : s)
  ta.dispatchEvent(new Event('input', { bubbles: true }))
}

const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const NUMBERS = ['1234567890', '-/:;()$&@"', '.,?!\'']
const SYMBOLS = ['[]{}#%^*+=', '_\\|~<>€£¥•', '.,?!\'']
const EMOJI = '😀😂🥹😍😎🤔😅🙌👍👏🙏💪🔥✨🎉❤️☕🍕🍻🧗‍♂️🏔️🚲💼📍📞💬📅🎶🌮🐶🌟👋🤝😴'.match(/\p{Extended_Pictographic}(?:‍\p{Extended_Pictographic}|️)*/gu) ?? []

// Small built-in word list for the suggestion bar (no real autocorrect).
const WORDS = (
  'about after again also and are around back because been before best but call can catch climbing coffee could dinner do down drinks for from get go going great had have he her here hi his how i if in intro into is it just know last later let like looking lunch maybe me met more my need next not now of on one or our out over people plan really see she should so some someone something startup talk tell that the their them then there they this time to up us want was we week weekend well went what when where who will with would you your'
).split(' ')
const STARTERS = ['I', 'The', "I'm"]

const MicSvg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </svg>
)
const EmojiSvg = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M8.2 14.2a4.5 4.5 0 0 0 7.6 0" />
    <circle cx="9" cy="9.6" r=".6" fill="currentColor" />
    <circle cx="15" cy="9.6" r=".6" fill="currentColor" />
  </svg>
)
const AbcSvg = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2.5" y="5.5" width="19" height="13" rx="3" />
    <path d="M6.5 15h11M7 9h.01M10.3 9h.01M13.7 9h.01M17 9h.01" />
  </svg>
)

type Layer = 'letters' | 'numbers' | 'symbols' | 'emoji'

export function Keyboard({ target }: { target: HTMLTextAreaElement | null }) {
  const [layer, setLayer] = useState<Layer>('letters')
  const [shift, setShift] = useState<'off' | 'once' | 'lock'>('off')
  const [, bump] = useState(0) // re-render when the text changes, for the suggestions and auto-capital
  const last = useRef<HTMLTextAreaElement | null>(null)
  const holdRef = useRef(0)
  const lastShiftTap = useRef(0)

  if (target) last.current = target
  const ta = target ?? last.current // keep the last keys on screen while the keyboard slides away
  const open = !!target

  useEffect(() => {
    if (!target) return
    setLayer('letters')
    setShift('off')
    const on = () => bump((n) => n + 1)
    target.addEventListener('input', on)
    target.addEventListener('keyup', on)
    on()
    return () => {
      target.removeEventListener('input', on)
      target.removeEventListener('keyup', on)
    }
  }, [target])

  const before = ta ? ta.value.slice(0, ta.selectionStart) : ''
  const upper = shift !== 'off' || before === '' || /[.!?]\s$/.test(before)
  const word = /[A-Za-z']+$/.exec(before)?.[0] ?? ''

  const suggestions = (() => {
    if (!word) return before.trim() === '' ? STARTERS : []
    const w = word.toLowerCase()
    const found = WORDS.filter((x) => x.startsWith(w) && x !== w).slice(0, 2)
    return [`“${word}”`, ...found.map((x) => (/^[A-Z]/.test(word) ? x[0].toUpperCase() + x.slice(1) : x))].slice(0, 3)
  })()

  const press = (fn: (t: HTMLTextAreaElement) => void) => (e: React.PointerEvent) => {
    e.preventDefault()
    if (target) fn(target)
  }
  const type = (ch: string) =>
    press((t) => {
      insert(t, ch)
      if (shift === 'once') setShift('off')
    })

  const letterKey = (ch: string) => {
    const label = layer === 'letters' && upper ? ch.toUpperCase() : ch
    return (
      <button key={ch} type="button" className="kb-key is-char" data-k={label} onPointerDown={type(label)} onMouseDown={(e) => e.preventDefault()}>
        {label}
      </button>
    )
  }
  const rows = layer === 'letters' ? LETTERS : layer === 'numbers' ? NUMBERS : SYMBOLS
  const special = (cls: string, children: ReactNode, onDown: (e: React.PointerEvent) => void, extra = '') => (
    <button type="button" className={`kb-key ${cls}${extra}`} onPointerDown={onDown} onMouseDown={(e) => e.preventDefault()}>
      {children}
    </button>
  )

  const startDelete = (e: React.PointerEvent) => {
    e.preventDefault()
    if (!target) return
    backspace(target)
    // Hold to keep deleting, like the real key
    holdRef.current = window.setTimeout(() => {
      holdRef.current = window.setInterval(() => backspace(target), 60)
    }, 400)
  }
  const stopDelete = () => {
    clearTimeout(holdRef.current)
    clearInterval(holdRef.current)
  }

  const shiftTap = press(() => {
    const now = Date.now()
    setShift((s) => (now - lastShiftTap.current < 350 ? 'lock' : s === 'off' ? 'once' : 'off'))
    lastShiftTap.current = now
  })

  const returnKey = press((t) => {
    t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  })
  const micKey = press((t) => {
    t.closest('.composer')?.querySelector<HTMLButtonElement>('.composer-mic')?.click()
  })

  return (
    <div className={`kb${open ? ' is-open' : ''}`} aria-hidden={!open} onPointerUp={stopDelete} onPointerLeave={stopDelete} onPointerCancel={stopDelete}>
      <div className="kb-suggest">
        {suggestions.map((s, i) => (
          <button
            key={s + i}
            type="button"
            onPointerDown={press((t) => {
              const quoted = s.startsWith('“')
              if (quoted) insert(t, ' ') // keep what was typed, just finish the word
              else insert(t, s + ' ', word.length)
            })}
            onMouseDown={(e) => e.preventDefault()}
          >
            {s}
          </button>
        ))}
      </div>

      {layer === 'emoji' ? (
        <div className="kb-emoji">
          {EMOJI.map((em) => (
            <button key={em} type="button" onPointerDown={press((t) => insert(t, em))} onMouseDown={(e) => e.preventDefault()}>
              {em}
            </button>
          ))}
        </div>
      ) : (
        <div className="kb-keys">
          <div className="kb-row">{rows[0].split('').map(letterKey)}</div>
          <div className={`kb-row${layer === 'letters' ? ' is-inset' : ''}`}>{rows[1].split('').map(letterKey)}</div>
          <div className="kb-row">
            {layer === 'letters'
              ? special('is-side', <ShiftSvg on={shift !== 'off'} lock={shift === 'lock'} />, shiftTap, shift !== 'off' ? ' is-on' : '')
              : special('is-side is-text', layer === 'numbers' ? '#+=' : '123', press(() => setLayer(layer === 'numbers' ? 'symbols' : 'numbers')))}
            <div className="kb-row-mid">{rows[2].split('').map(letterKey)}</div>
            <button type="button" className="kb-key is-side" onPointerDown={startDelete} onMouseDown={(e) => e.preventDefault()} aria-label="Delete">
              <svg width="26" height="20" viewBox="0 0 26 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
                <path d="M8.5 2h12.2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H8.5L1.8 10z" />
                <path d="m12.5 6.5 7 7m0-7-7 7" />
              </svg>
            </button>
          </div>
          <div className="kb-row">
            {special('is-wide is-text', layer === 'letters' ? '123' : 'ABC', press(() => setLayer(layer === 'letters' ? 'numbers' : 'letters')))}
            <button type="button" className="kb-key is-space" aria-label="Space" onPointerDown={type(' ')} onMouseDown={(e) => e.preventDefault()} />
            {special(
              'is-wide',
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6v6a2 2 0 0 1-2 2H5m0 0 4-4m-4 4 4 4" />
              </svg>,
              returnKey,
            )}
          </div>
        </div>
      )}

      <div className="kb-bottom">
        <button type="button" onPointerDown={press(() => setLayer(layer === 'emoji' ? 'letters' : 'emoji'))} onMouseDown={(e) => e.preventDefault()} aria-label="Emoji">
          {layer === 'emoji' ? <AbcSvg /> : <EmojiSvg />}
        </button>
        <button type="button" onPointerDown={micKey} onMouseDown={(e) => e.preventDefault()} aria-label="Dictate">
          <MicSvg />
        </button>
      </div>
    </div>
  )
}

function ShiftSvg({ on, lock }: { on: boolean; lock: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 3 12.5h5.2V19a1 1 0 0 0 1 1h5.6a1 1 0 0 0 1-1v-6.5H21z" />
      {lock && <path d="M9 22.5h6" strokeLinecap="round" />}
    </svg>
  )
}
