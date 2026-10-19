import type { Person } from '../data/people'
import { ChevronRightIcon } from '../components/Icons'
import { Avatar } from '../components/Avatar'

type Props = {
  people: Person[]
  onOpen: (id: string) => void
}

export function ListScreen({ people, onOpen }: Props) {
  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name))

  if (sorted.length === 0) {
    return (
      <div className="screen list-screen">
        <p className="empty">No one to show.</p>
      </div>
    )
  }

  return (
    <div className="screen list-screen">
      <h1 className="list-title">Connections</h1>
      <ul className="people-list">
        {sorted.map((person) => (
          <li key={person.id}>
            <button className="person-row" onClick={() => onOpen(person.id)}>
              <Avatar id={person.id} />
              <span className="person-text">
                <span className="person-name">{person.name}</span>
                <span className="person-sub">{[person.profession, person.livesNow.city].filter((x) => x && x !== 'Unknown').join(' · ')}</span>
              </span>
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
