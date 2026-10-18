import { CheckIcon, CloseIcon } from '../components/Icons'
import type { Person } from '../data/people'
import { usePfpStyle } from '../lib/pfpStyle'
import { contextColor, contextLabel, firstName, initials, orbBackground } from '../lib/people'

type Props = {
  person: Person
  people: Person[]
  onClose: () => void
  onAddAnother: () => void
  onViewProfile: () => void
}

const W = 390
const H = 340
const R = 118

// After saving: the new person lands in the middle of their part of the network.
// Solid lines are people they know; dashed lines are suggestions (met at the same place, or same city).
export function SavedScreen({ person, people, onClose, onAddAnother, onViewProfile }: Props) {
  const pfp = usePfpStyle()
  const known = person.knows.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p)
  const suggested = people
    .filter((p) => p.id !== person.id && !person.knows.includes(p.id))
    .filter((p) => same(p.met.context, person.met.context) || same(p.livesNow.city, person.livesNow.city))
    .slice(0, Math.max(0, 5 - known.length))
  const around = [...known.map((p) => ({ p, kind: 'known' as const })), ...suggested.map((p) => ({ p, kind: 'sugg' as const }))]
  const nodes = around.map((n, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(around.length, 1)
    return { ...n, x: W / 2 + Math.cos(angle) * R, y: H / 2 + Math.sin(angle) * R * 0.9 }
  })
  const first = firstName(person.name)
  const firstSugg = suggested[0]

  return (
    <section className="saved" aria-label={`${person.name} saved`}>
      <div className="saved-scroll">
        <button className="round-button glass-button" onClick={onClose} aria-label="Close">
          <CloseIcon size={20} />
        </button>
        <div className="saved-toast" role="status">
          <span className="saved-ok">
            <CheckIcon size={14} />
          </span>
          {person.name} joined your people
        </div>

        <div className="saved-net">
          <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
            <circle className="saved-ring" cx={W / 2} cy={H / 2} r={R} />
            {nodes.map(({ p, kind, x, y }) => (
              <line
                key={p.id}
                className={kind === 'known' ? 'saved-edge' : 'saved-sugg'}
                x1={W / 2}
                y1={H / 2}
                x2={x}
                y2={y}
                style={kind === 'known' ? { stroke: contextColor(person.context) } : undefined}
              />
            ))}
          </svg>
          {nodes.map(({ p, kind, x, y }) => (
            <div key={p.id} className={`saved-node${kind === 'sugg' ? ' is-sugg' : ''}`} style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}>
              <span className="avatar" style={{ background: orbBackground(p.id, pfp) }}>
                {initials(p.name)}
              </span>
              <span className="saved-tag">{firstName(p.name)}</span>
            </div>
          ))}
          <div className="saved-node is-new" style={{ left: '50%', top: '50%' }}>
            <span className="avatar avatar-lg" style={{ background: orbBackground(person.id, pfp) }}>
              {initials(person.name)}
            </span>
            <span className="saved-tag">{first}</span>
          </div>
        </div>

        <div className="saved-copy">
          <span className="label">
            <i style={{ background: contextColor(person.context) }} />
            {contextLabel[person.context]} · just met · {person.met.context}
          </span>
          <h2>{first} is in your people</h2>
          <p>
            {known.length > 0 && `Linked to ${known.map((p) => firstName(p.name)).join(' and ')}. `}
            {firstSugg && `Dashed: ${firstName(firstSugg.name)} ${same(firstSugg.met.context, person.met.context) ? `was at ${person.met.context} too` : `also lives in ${person.livesNow.city}`}. `}
            Their aura deepens as you log more moments.
          </p>
        </div>
      </div>

      <div className="sheet-bar">
        <button className="pill-button ghost" onClick={onAddAnother}>
          Add another
        </button>
        <button className="pill-button ink grow" onClick={onViewProfile}>
          View profile
        </button>
      </div>
    </section>
  )
}

function same(a: string, b: string) {
  const norm = (s: string) => s.toLowerCase().replace(/^climate /, '').split(',')[0].trim()
  return !!a && !!b && norm(a) === norm(b)
}
