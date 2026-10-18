import { CheckIcon, ChevronDownIcon, FilterIcon } from './Icons'

// Mindmap filter layouts B and D: a compact "Filter" button that opens a panel with the color options and the key.
// (Layouts A and C keep the original black pill and live in MindmapScreen.)

export type KeyEntry = { label: string; color: string }

type Props<T extends string> = {
  layout: 'b' | 'd'
  options: { id: T; label: string }[]
  value: T
  onChange: (value: T) => void
  entries: KeyEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MindmapFilter<T extends string>({ layout, options, value, onChange, entries, open, onOpenChange }: Props<T>) {
  const current = options.find((o) => o.id === value)?.label

  const header = (
    <button
      type="button"
      className={`mm-filter-btn${open ? ' is-open' : ''}`}
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
    >
      <FilterIcon size={16} />
      <span className="mm-filter-word">Filter</span>
      {layout === 'd' && (
        <>
          <span className="mm-filter-sep" aria-hidden />
          <b>{current}</b>
        </>
      )}
      {layout === 'b' && !open && (
        // A glance at the current colors, so the collapsed button still says what you're looking at
        <span className="mm-dots" aria-hidden>
          {entries.map((e) => (
            <i key={e.label} style={{ background: e.color }} />
          ))}
        </span>
      )}
      <span className={`mm-filter-caret${open ? ' is-up' : ''}`}>
        <ChevronDownIcon size={14} />
      </span>
    </button>
  )

  return (
    <div className={`mm-filter mm-filter-${layout}${open ? ' is-open' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
      {header}
      {open && (
        <div className="mm-filter-body">
          <div className="mm-filter-label">Color by</div>
          {layout === 'b' ? (
            <div className="mm-filter-options" role="radiogroup" aria-label="Color by">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={o.id === value}
                  className={o.id === value ? 'is-on' : ''}
                  onClick={() => onChange(o.id)}
                >
                  {o.label}
                  {o.id === value && <CheckIcon size={14} />}
                </button>
              ))}
            </div>
          ) : (
            <div className="mm-filter-seg" role="radiogroup" aria-label="Color by">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={o.id === value}
                  className={o.id === value ? 'is-on' : ''}
                  onClick={() => onChange(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <div className="mm-filter-label">Key</div>
          <div className="mm-list">
            {entries.map((e) => (
              <span key={e.label}>
                <i style={{ background: e.color }} />
                {e.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
