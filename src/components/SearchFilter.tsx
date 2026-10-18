import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { colorOptions, type ColorBy, type KeyEntry } from '../lib/mindmapColors'
import { ChevronDownIcon, FilterIcon } from './Icons'

type Props = {
  value: ColorBy
  onChange: (value: ColorBy) => void
  entries: KeyEntry[]
}

// The mindmap's color filter at the end of the search bar. It's a plain filter icon while the colors show the
// default (Relationship); once something else is picked it becomes a chip naming that filter. Either opens a sheet
// that slides up with the options as chips and the key.
export function SearchFilter({ value, onChange, entries }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = colorOptions.find((o) => o.id === value)?.label
  const filtered = value !== 'relationship'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // The sheet renders into the phone itself, since the search bar's glass would trap a full-screen overlay
  const phone = open ? ref.current?.closest('.phone') : null

  return (
    <div className="sf" ref={ref}>
      {filtered ? (
        <button
          className={`sf-chip${open ? ' is-open' : ''}`}
          onClick={() => setOpen(!open)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Filter: colored by ${current}`}
        >
          <FilterIcon size={15} />
          {current}
          <ChevronDownIcon size={13} />
        </button>
      ) : (
        <button
          className={`sf-icon${open ? ' is-open' : ''}`}
          onClick={() => setOpen(!open)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Filter"
        >
          <FilterIcon size={19} />
        </button>
      )}

      {phone &&
        createPortal(
          <div className="sf-overlay">
            <div className="sf-scrim" onClick={() => setOpen(false)} aria-hidden />
            <div className="sf-sheet" role="dialog" aria-modal="true" aria-labelledby="sf-title">
              <div className="sf-handle" aria-hidden />
              <h3 id="sf-title">Filter</h3>
              <div className="sf-label">Color by</div>
              <div className="sf-chips" role="radiogroup" aria-label="Color by">
                {colorOptions.map((o) => (
                  <button
                    key={o.id}
                    role="radio"
                    aria-checked={o.id === value}
                    className={o.id === value ? 'is-on' : ''}
                    onClick={() => onChange(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="sf-label">Key</div>
              <div className="sf-key">
                {entries.map((e) => (
                  <span key={e.label}>
                    <i style={{ background: e.color }} />
                    {e.label}
                  </span>
                ))}
              </div>
              <button className="sf-done" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>,
          phone,
        )}
    </div>
  )
}
