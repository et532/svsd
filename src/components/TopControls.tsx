import { useEffect, useRef, useState } from 'react'
import {
  BriefcaseIcon,
  BuildingIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FilterIcon,
  ListIcon,
  MindmapIcon,
  PinIcon,
} from './Icons'

export type Tab = 'mindmap' | 'list'
export type GroupBy = 'none' | 'city' | 'met' | 'job'

const options: { id: GroupBy; label: string; hint: string; Icon: typeof PinIcon }[] = [
  { id: 'none', label: 'None', hint: 'A free-form web', Icon: MindmapIcon },
  { id: 'city', label: 'City', hint: 'Where they currently live', Icon: BuildingIcon },
  { id: 'met', label: 'Met at', hint: 'Where you met', Icon: PinIcon },
  { id: 'job', label: 'Job', hint: 'What they do', Icon: BriefcaseIcon },
]

type Props = {
  tab: Tab
  onTab: (tab: Tab) => void
  groupBy: GroupBy
  onGroupBy: (g: GroupBy) => void
}

// Top left: switch between the mindmap and the list. Top right (mindmap only): Filters, which groups the graph.
export function TopControls({ tab, onTab, groupBy, onGroupBy }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  // Blob position in px (0 = mindmap, STEP = list); `drag` overrides it while holding and dragging.
  const [drag, setDrag] = useState<number | null>(null)
  const grab = useRef({ x: 0, from: 0, moved: false })
  const STEP = 44 // a 42px view button + the 2px gap
  const base = tab === 'list' ? STEP : 0

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault() // no focus ring on the pressed button; the blob is the only indicator
    grab.current = { x: e.clientX, from: base, moved: false }
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return
    const g = grab.current
    if (!g.moved && Math.abs(e.clientX - g.x) < 4) return
    if (!g.moved) e.currentTarget.setPointerCapture(e.pointerId)
    g.moved = true
    setDrag(Math.max(0, Math.min(STEP, g.from + e.clientX - g.x)))
  }
  const onUp = () => {
    if (drag === null) return
    const next: Tab = drag > STEP / 2 ? 'list' : 'mindmap'
    setDrag(null)
    if (next !== tab) onTab(next)
  }

  const view = (id: Tab, label: string, Icon: typeof ListIcon) => (
    <button
      className={`view-button${tab === id ? ' is-active' : ''}`}
      onClick={() => !grab.current.moved && onTab(id)}
      aria-label={label}
      aria-pressed={tab === id}
    >
      <Icon size={20} />
    </button>
  )

  return (
    <header className="top-controls">
      <div className="view-toggle" role="group" aria-label="View" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className={`view-blob${drag !== null ? ' is-dragging' : ''}`} style={{ transform: `translateX(${drag ?? base}px)` }} />
        {view('mindmap', 'Mindmap', MindmapIcon)}
        {view('list', 'Connections list', ListIcon)}
      </div>
      {tab === 'mindmap' && (
        <div ref={ref} className="filters">
          <button className="filters-button" onClick={() => setOpen(!open)} aria-expanded={open}>
            <FilterIcon size={18} />
            Filters
            {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
          {open && (
            <div className="filters-menu" role="menu">
              <span className="filters-title">Group by</span>
              {options.map(({ id, label, hint, Icon }) => (
                <button
                  key={id}
                  role="menuitemradio"
                  aria-checked={groupBy === id}
                  className={`filters-item${groupBy === id ? ' is-on' : ''}`}
                  onClick={() => {
                    onGroupBy(id)
                    setOpen(false)
                  }}
                >
                  <Icon size={18} />
                  <span>
                    <b>{label}</b>
                    <small>{hint}</small>
                  </span>
                  {groupBy === id && <CheckIcon size={18} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  )
}
