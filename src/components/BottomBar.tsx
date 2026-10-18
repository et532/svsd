import type { NavLayout } from '../lib/navLayouts'
import { ListIcon, MicIcon, MindmapIcon, PlusIcon } from './Icons'

export type Tab = 'mindmap' | 'list'

const tabs: { id: Tab; label: string; Icon: typeof ListIcon }[] = [
  { id: 'mindmap', label: 'Mindmap', Icon: MindmapIcon },
  { id: 'list', label: 'People', Icon: ListIcon },
]

type Props = {
  active: Tab
  onChange: (tab: Tab) => void
  onAdd: () => void
  // Opens Ask, the voice AI search
  onAsk: () => void
  layout?: NavLayout
}

export function BottomBar({ active, onChange, onAdd, onAsk, layout = '2' }: Props) {
  const orb = layout === '2' || layout === '3'
  return (
    <div className={`bottom-bar nav-layout-${layout}`}>
      <nav className="nav-pill" aria-label="Views">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-button${active === id ? ' is-active' : ''}`}
            onClick={() => onChange(id)}
            aria-label={label}
            aria-current={active === id ? 'page' : undefined}
          >
            <Icon size={23} />
          </button>
        ))}
      </nav>

      <button className={`ask-button${orb ? ' is-orb' : ''}`} onClick={onAsk} aria-label="Ask Peepl: search or add by voice">
        {orb && <span className="ask-button-orb" aria-hidden />}
        <MicIcon size={layout === '4' ? 19 : 24} />
        {layout === '4' && <span>Ask</span>}
      </button>

      <button className="add-button" onClick={onAdd} aria-label="Add person">
        <PlusIcon size={27} />
      </button>
    </div>
  )
}
