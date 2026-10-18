import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FilterLayout } from '../lib/filterLayouts'
import { filterLayouts } from '../lib/filterLayouts'
import { colorOptions, type ColorBy, type KeyEntry } from '../lib/mindmapColors'
import { CheckIcon, ChevronDownIcon, FilterIcon } from './Icons'

type Props = {
  layout: FilterLayout
  value: ColorBy
  onChange: (value: ColorBy) => void
  entries: KeyEntry[]
}

// The mindmap's color filter as a button at the end of the search bar, opening a pop-up or a slide-up sheet.
export function SearchFilter({ layout, value, onChange, entries }: Props) {
  const { trigger, panel, options } = filterLayouts.find((l) => l.id === layout) ?? filterLayouts[0]
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = colorOptions.find((o) => o.id === value)?.label

  // The pop-up closes when tapping anywhere else; Escape closes either
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (panel === 'popover' && !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, panel])

  const body = (
    <>
      <div className="sf-label">Color by</div>
      {options === 'rows' ? (
        <div className="sf-rows" role="radiogroup" aria-label="Color by">
          {colorOptions.map((o) => (
            <button key={o.id} role="radio" aria-checked={o.id === value} className={o.id === value ? 'is-on' : ''} onClick={() => onChange(o.id)}>
              {o.label}
              {o.id === value && <CheckIcon size={15} />}
            </button>
          ))}
        </div>
      ) : (
        <div className="sf-chips" role="radiogroup" aria-label="Color by">
          {colorOptions.map((o) => (
            <button key={o.id} role="radio" aria-checked={o.id === value} className={o.id === value ? 'is-on' : ''} onClick={() => onChange(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      <div className="sf-label">Key</div>
      <div className="sf-key">
        {entries.map((e) => (
          <span key={e.label}>
            <i style={{ background: e.color }} />
            {e.label}
          </span>
        ))}
      </div>
    </>
  )

  // The sheet renders into the phone itself, since the search bar's glass would trap a full-screen overlay
  const phone = open && panel === 'sheet' ? ref.current?.closest('.phone') : null

  return (
    <div className="sf" ref={ref}>
      {trigger === 'icon' ? (
        <button
          className={`sf-icon${open ? ' is-open' : ''}`}
          onClick={() => setOpen(!open)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Filter: colored by ${current}`}
        >
          <FilterIcon size={19} />
          {value !== 'relationship' && <span className="sf-badge" aria-hidden />}
        </button>
      ) : (
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
      )}

      {open && panel === 'popover' && (
        <div className="sf-popover" role="dialog" aria-label="Filter">
          {body}
        </div>
      )}

      {phone &&
        createPortal(
          <div className="sf-overlay">
            <div className="sf-scrim" onClick={() => setOpen(false)} aria-hidden />
            <div className="sf-sheet" role="dialog" aria-modal="true" aria-labelledby="sf-title">
              <div className="sf-handle" aria-hidden />
              <h3 id="sf-title">Filter</h3>
              {body}
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
