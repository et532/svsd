import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { modeInfo, modeOrder, type Mode } from '../modes'
import { HomeIcon, MeetIcon, SproutIcon } from './Icons'

const modeIcons: Record<Mode, typeof HomeIcon> = {
  from: SproutIcon,
  met: MeetIcon,
  livesNow: HomeIcon,
}

type Props = {
  mode: Mode
  onChange: (mode: Mode) => void
}

// Chip in the search bar showing which places the map shows, and the sheet it opens to change that.
export function FilterMenu({ mode, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const chipRef = useRef<HTMLButtonElement>(null)
  // The sheet renders into the phone screen itself: the search bar's frosted-glass blur would
  // otherwise trap the full-screen overlay inside the bar.
  const phone = open ? chipRef.current?.closest('.phone') : null
  const info = modeInfo[mode]
  const Icon = modeIcons[mode]

  return (
    <>
      <button
        ref={chipRef}
        className="filter-chip"
        style={{ background: `linear-gradient(135deg, ${info.color}55, ${info.color}1a)` }}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Map shows ${info.label}. Change`}
      >
        <Icon size={15} />
        <span className="filter-tiny">{info.tiny}</span>
      </button>

      {phone &&
        createPortal(
          <BottomSheet
            mode={mode}
            onApply={(next) => {
              onChange(next)
              setOpen(false)
            }}
            onClose={() => setOpen(false)}
          />,
          phone,
        )}
    </>
  )
}

type SheetProps = {
  mode: Mode
  onApply: (mode: Mode) => void
  onClose: () => void
}

// Slides up from the bottom. Pick one, then Apply. Tap outside, swipe down, or press Escape to close.
function BottomSheet({ mode, onApply, onClose }: SheetProps) {
  const [pending, setPending] = useState(mode)
  const [closing, setClosing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Slide the sheet down first, then tell the parent to unmount it
  const dismiss = useCallback(
    (after: () => void) => {
      if (closing) return
      setClosing(true)
      sheetRef.current?.style.removeProperty('transform')
      setTimeout(after, 280)
    },
    [closing],
  )
  const close = useCallback(() => dismiss(onClose), [dismiss, onClose])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close])

  return (
    <div className={`filter-overlay${closing ? ' is-closing' : ''}`}>
      <div className="overlay-backdrop" onClick={close} />
      <div
        ref={sheetRef}
        className={`sheet${dragging ? ' is-dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-sheet-title"
      >
        {/* Swipe down on the top of the sheet to close it; the sheet follows the finger */}
        <div
          className="sheet-grab"
          onPointerDown={(e) => {
            dragStartY.current = e.clientY
            setDragging(true)
            // Keep receiving the pointer even after it moves off this strip
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (dragStartY.current === null) return
            const dy = Math.max(0, e.clientY - dragStartY.current)
            sheetRef.current!.style.transform = `translateY(${dy}px)`
          }}
          onPointerUp={(e) => {
            const dy = dragStartY.current === null ? 0 : e.clientY - dragStartY.current
            dragStartY.current = null
            setDragging(false)
            if (dy > 50) close()
            else sheetRef.current?.style.removeProperty('transform')
          }}
          onPointerCancel={() => {
            dragStartY.current = null
            setDragging(false)
            sheetRef.current?.style.removeProperty('transform')
          }}
        >
          <div className="sheet-handle" aria-hidden />
          <h3 id="filter-sheet-title">Show on map</h3>
        </div>
        <div role="radiogroup" aria-labelledby="filter-sheet-title">
          {modeOrder.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={id === pending}
              className="sheet-row"
              onClick={() => setPending(id)}
            >
              <span>{modeInfo[id].label}</span>
              <span className={`radio${id === pending ? ' is-on' : ''}`} aria-hidden />
            </button>
          ))}
        </div>
        <button className="primary-button" onClick={() => dismiss(() => onApply(pending))}>
          Apply
        </button>
      </div>
    </div>
  )
}
