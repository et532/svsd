import type { NavLayout } from '../lib/navLayouts'
import { ListIcon, MicIcon, MindmapIcon } from './Icons'

export type Tab = 'mindmap' | 'list'

type Props = {
  active: Tab
  onChange: (tab: Tab) => void
  // Opens Ask, the voice AI search (which also adds people: "add someone new")
  onAsk: () => void
  layout?: NavLayout
}

// Mindmap and People on either side of the Ask mic.
export function BottomBar({ active, onChange, onAsk, layout = 'floating' }: Props) {
  const tab = (id: Tab, label: string, Icon: typeof ListIcon) => (
    <button
      className={`nav-button${active === id ? ' is-active' : ''}`}
      onClick={() => onChange(id)}
      aria-label={label}
      aria-current={active === id ? 'page' : undefined}
    >
      <Icon size={23} />
      {layout === 'docked' && <span className="nav-label">{label}</span>}
    </button>
  )

  return (
    <nav className={`bottom-bar nav-${layout}`} aria-label="Views">
      {tab('mindmap', 'Mindmap', MindmapIcon)}
      <button className="ask-button" onClick={onAsk} aria-label="Ask Peepl: search or add someone by voice">
        <span className="ask-button-orb" aria-hidden />
        <MicIcon size={24} />
      </button>
      {tab('list', 'People', ListIcon)}
    </nav>
  )
}
