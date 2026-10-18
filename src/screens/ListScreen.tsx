import type { Person } from '../data/people'
import { ChevronRightIcon } from '../components/Icons'
import { initials, orbBackground, orbTextColor } from '../lib/people'

type Props = {
  people: Person[]
  query: string
  onOpen: (id: string) => void
}

export function ListScreen({ people, query, onOpen }: Props) {
  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name))

  if (sorted.length === 0) {
    return (
      <div className="screen list-screen">
        <p className="empty">No one matches “{query}”.</p>
      </div>
    )
  }

  return (
    <div className="screen list-screen">
      <ul className="people-list">
        {sorted.map((person) => (
          <li key={person.id}>
            <button className="person-row" onClick={() => onOpen(person.id)}>
              <span className="avatar" style={{ background: orbBackground(person.id), color: orbTextColor(person.id) }} aria-hidden>
                {initials(person.name)}
              </span>
              <span className="person-name">{person.name}</span>
              <span className="person-arrow" aria-hidden>
                <ChevronRightIcon size={19} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
