import type { Person } from '../data/people'
import { ChevronRightIcon } from '../components/Icons'
import { initials, orbBackground } from '../lib/people'

type Props = {
  people: Person[]
  query: string
}

export function ListScreen({ people, query }: Props) {
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
          <li key={person.id} className="person-row">
            <div className="avatar" style={{ background: orbBackground(person.id) }} aria-hidden>
              {initials(person.name)}
            </div>
            <div className="person-name">{person.name}</div>
            <span className="person-arrow" aria-hidden>
              <ChevronRightIcon size={19} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
