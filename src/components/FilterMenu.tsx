import { useEffect, useRef, useState } from 'react'
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
  const info = modeInfo[mode]
  const Icon = modeIcons[mode]

  return (
    <>
      <button
        className="filter-chip"
        style={{ background: `${info.color}1f`, color: info.color }}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Map shows ${info.label}. Change`}
      >
        <Icon size={15} />
        <span className="filter-tiny">{info.tiny}</span>
      </button>

      {open && (
        <BottomSheet
          mode={mode}
          onApply={(next) => {
            onChange(next)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
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
  const dragStartY = useRef<number | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="filter-overlay">
      <div className="overlay-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title">
        {/* Swipe down on the top of the sheet to close it */}
        <div
          className="sheet-grab"
          onPointerDown={(e) => {
            dragStartY.current = e.clientY
            // Keep receiving the pointer even after it moves off this strip
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerUp={(e) => {
            if (dragStartY.current !== null && e.clientY - dragStartY.current > 50) onClose()
            dragStartY.current = null
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
        <button className="primary-button" onClick={() => onApply(pending)}>
          Apply
        </button>
      </div>
    </div>
  )
}
