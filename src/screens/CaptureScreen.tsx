import { useEffect, useState } from 'react'
import { Composer, type Sent } from '../components/Composer'
import { CloseIcon } from '../components/Icons'
import type { Person } from '../data/people'
import { momentCandidates, parsePerson, voiceScript } from '../lib/capture'
import { cardBackground, initials, orbBackground, orbTextColor } from '../lib/people'

type Props = {
  people: Person[]
  onClose: () => void
  // Makes the person from a note about someone new (or finds them if you already have them).
  onCreate: (sent: Sent) => Person
  // Saves a note as a moment with someone you already know, then opens their profile.
  onMoment: (personId: string, sent: Sent) => void
  onOpenProfile: (id: string) => void
}

type Stage =
  | { kind: 'input' }
  | { kind: 'processing'; sent: Sent; name: string }
  | { kind: 'preview'; sent: Sent; person: Person }
  | { kind: 'select'; sent: Sent; options: Person[] }

const monthYear = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

// One input for both: "Tell me about a new person or moment". A note about someone new becomes a profile;
// a note about someone you know becomes a moment (asking which one when two share a name).
export function CaptureScreen({ people, onClose, onCreate, onMoment, onOpenProfile }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'input' })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // "Creating a new profile…" for a moment, then the profile card appears.
  useEffect(() => {
    if (stage.kind !== 'processing') return
    const t = setTimeout(() => setStage({ kind: 'preview', sent: stage.sent, person: onCreate(stage.sent) }), 1700)
    return () => clearTimeout(t)
    // onCreate is stable enough for one timer per stage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  function submit(sent: Sent) {
    const options = momentCandidates(sent.text, people)
    if (options.length === 1) return onMoment(options[0].id, sent)
    if (options.length > 1) return setStage({ kind: 'select', sent, options })
    setStage({ kind: 'processing', sent, name: parsePerson(sent.text, people).name ?? 'them' })
  }

  const note = stage.kind === 'input' ? null : stage.sent.text

  return (
    <section className="flow" aria-label="Add a person or moment">
      <div className="flow-aura" aria-hidden />
      <button className="round-button glass-button flow-close" onClick={onClose} aria-label="Close">
        <CloseIcon size={20} />
      </button>

      <div className={`flow-main${stage.kind === 'input' ? '' : ' is-top'}`}>
        {note && <p className="flow-note">{note}</p>}
        {stage.kind === 'input' && <h2 className="flow-title">Tell me about a new person or moment</h2>}
        {stage.kind === 'processing' && <h2 className="flow-title is-ink">Creating a new profile for {stage.name}…</h2>}
        {stage.kind === 'preview' && (
          <>
            <h2 className="flow-title is-ink">Creating a new profile for {stage.person.name}…</h2>
            <PersonCard person={stage.person} line={`Met ${monthYear(new Date())}`} onClick={() => onOpenProfile(stage.person.id)} />
          </>
        )}
        {stage.kind === 'select' && (
          <>
            <h2 className="flow-title is-ink">Which {stage.options[0].name.split(' ')[0]} did you catch up with?</h2>
            <div className="flow-cards">
              {stage.options.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  line={`Last updated ${monthYear(new Date(p.lastContacted + 'T12:00:00'))}`}
                  onClick={() => onMoment(p.id, stage.sent)}
                />
              ))}
            </div>
            <button
              className="flow-neither"
              onClick={() => setStage({ kind: 'processing', sent: stage.sent, name: parsePerson(stage.sent.text, people).name ?? 'them' })}
            >
              Neither, add a new profile
            </button>
          </>
        )}
      </div>

      {stage.kind === 'input' && (
        <div className="flow-bottom">
          <Composer placeholder="Who did you meet?" script={voiceScript} start="type" onSend={submit} />
        </div>
      )}
    </section>
  )
}

// The dark gradient card for a person: avatar, name, "job · city", and a line of small print.
function PersonCard({ person: p, line, onClick }: { person: Person; line: string; onClick: () => void }) {
  const sub = [p.profession, p.livesNow.city].filter((x) => x && x !== 'Unknown').join(' · ')
  return (
    <button className="person-card" style={{ background: cardBackground(p) }} onClick={onClick}>
      <span className="avatar avatar-lg" style={{ background: orbBackground(p.id), color: orbTextColor(p.id) }} aria-hidden>
        {initials(p.name)}
      </span>
      <span className="person-card-text">
        <b>{p.name}</b>
        <span>{sub}</span>
        <small>{line}</small>
      </span>
    </button>
  )
}
