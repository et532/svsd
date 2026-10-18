import { GlobeIcon, ListIcon, MindmapIcon, PlusIcon } from './Icons'

export type Tab = 'mindmap' | 'list' | 'map'

const tabs: { id: Tab; label: string; Icon: typeof ListIcon }[] = [
  { id: 'mindmap', label: 'Mindmap', Icon: MindmapIcon },
  { id: 'list', label: 'People', Icon: ListIcon },
  { id: 'map', label: 'Map', Icon: GlobeIcon },
]

type Props = {
  active: Tab
  onChange: (tab: Tab) => void
  onAdd: () => void
}

export function BottomBar({ active, onChange, onAdd }: Props) {
  return (
    <div className="bottom-bar">
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
      <button className="add-button" onClick={onAdd} aria-label="Add person">
        <PlusIcon size={27} />
      </button>
    </div>
  )
}
