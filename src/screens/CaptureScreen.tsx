import { useEffect, useState } from 'react'
import { Composer, type Sent } from '../components/Composer'
import { ChevronRightIcon, CloseIcon } from '../components/Icons'
import type { Person } from '../data/people'
import { momentCandidates, parsePerson, splitPeople, voiceScript, type PersonNote } from '../lib/capture'
import { Avatar } from '../components/Avatar'
import { cardBackground } from '../lib/people'

type Props = {
  people: Person[]
  onClose: () => void
  // Makes the person from a note about someone new (or finds them if you already have them).
  onCreate: (sent: Sent) => Person
  // Makes one person per note when you talk about several people at once, and links them to each other.
  onCreateMany: (sent: Sent, notes: PersonNote[]) => Person[]
  // Saves a note as a moment with someone you already know, then opens their profile.
  onMoment: (personId: string, sent: Sent) => void
  onOpenProfile: (id: string) => void
  // Opened from a profile's "Add" mutual: first name of that person. The note is always about someone new.
  mutualWith?: string
}

type Stage =
  | { kind: 'input' }
  | { kind: 'processing'; sent: Sent; name: string; group: PersonNote[] }
  | { kind: 'preview'; sent: Sent; people: Person[] }
  | { kind: 'select'; sent: Sent; options: Person[] }

const monthYear = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

// One input for both: "Tell me about a new person or moment". A note about someone new becomes a profile;
// a note about someone you know becomes a moment (asking which one when two share a name).
export function CaptureScreen({ people, onClose, onCreate, onCreateMany, onMoment, onOpenProfile, mutualWith }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'input' })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // "Creating a new profile…" for a moment, then the profile card appears.
  useEffect(() => {
    if (stage.kind !== 'processing') return
    const t = setTimeout(
      () => setStage({ kind: 'preview', sent: stage.sent, people: stage.group.length > 1 ? onCreateMany(stage.sent, stage.group) : [onCreate(stage.sent)] }),
      1700,
    )
    return () => clearTimeout(t)
    // onCreate is stable enough for one timer per stage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  function submit(sent: Sent) {
    const options = mutualWith ? [] : momentCandidates(sent.text, people)
    if (options.length === 1) return onMoment(options[0].id, sent)
    if (options.length > 1) return setStage({ kind: 'select', sent, options })
    const group = mutualWith ? [] : splitPeople(sent.text)
    setStage({ kind: 'processing', sent, name: parsePerson(sent.text, people).name ?? 'them', group })
  }

  const note = stage.kind === 'input' ? null : stage.sent.text

  return (
    <section className="flow" aria-label="Add a person or moment">
      <div className="flow-aura" aria-hidden />
      <button className="round-button glass-button flow-close" onClick={onClose} aria-label="Close">
        <CloseIcon size={20} />
      </button>

      <div className="flow-main is-top">
        {note && <p className="flow-note">{note}</p>}
        {stage.kind === 'input' && <h2 className="flow-title">{mutualWith ? `Who does ${mutualWith} know?` : 'Tell me about a new person or moment'}</h2>}
        {stage.kind === 'processing' && (
          <>
            <h2 className="flow-title is-ink">{creating(stage.group.map((g) => g.name), stage.name)}</h2>
            <div className="flow-cards">
              {(stage.group.length > 1 ? stage.group : [null]).map((_, i) => (
                <div key={i} className="person-card is-skeleton" aria-hidden>
                  <span className="skel skel-avatar" />
                  <span className="person-card-text">
                    <span className="skel" style={{ width: '70%', height: 18 }} />
                    <span className="skel is-short" />
                    <span className="skel is-short" style={{ width: '35%' }} />
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {stage.kind === 'preview' && (
          <>
            <h2 className="flow-title is-ink">{creating(stage.people.map((p) => p.name), stage.people[0].name)}</h2>
            <div className="flow-cards">
              {stage.people.map((p) => (
                <PersonCard key={p.id} person={p} line={`Met ${monthYear(new Date())}`} typed onClick={() => onOpenProfile(p.id)} />
              ))}
            </div>
            {stage.people.length > 1 && (
              <p className="flow-link-note">{`${list(stage.people.map((p) => p.name.split(' ')[0]))} were met together, so they're linked as mutuals.`}</p>
            )}
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
              onClick={() => setStage({ kind: 'processing', sent: stage.sent, name: parsePerson(stage.sent.text, people).name ?? 'them', group: [] })}
            >
              Neither, add a new profile
            </button>
          </>
        )}
      </div>

      {stage.kind === 'input' && (
        <div className="flow-bottom">
          <Composer placeholder="Who did you meet?" script={voiceScript} start="type" waitForOpen people={people} onSend={submit} />
        </div>
      )}
    </section>
  )
}

// "A, B and C"
const list = (names: string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

// The heading while profiles are made: one name, or "2 new profiles for A and B"
const creating = (names: string[], single: string) =>
  names.length > 1 ? `Creating ${names.length} new profiles for ${list(names)}…` : `Creating a new profile for ${names[0] ?? single}…`

// Reveals the parts one after another, a letter at a time, like the profile being filled in.
function useTyped(parts: string[], on: boolean) {
  const [n, setN] = useState(0)
  const total = parts.reduce((t, x) => t + x.length, 0)
  useEffect(() => {
    if (!on) return
    // Wait for the color to paint in and the avatar to pop before the text starts
    let t = 0
    const start = setTimeout(() => {
      t = window.setInterval(() => setN((x) => Math.min(x + 1, total)), 38)
    }, 1000)
    return () => {
      clearTimeout(start)
      clearInterval(t)
    }
  }, [on, total])
  if (!on) return { shown: parts, done: true }
  let left = n
  const shown = parts.map((x) => {
    const take = Math.max(0, Math.min(left, x.length))
    left -= take
    return x.slice(0, take)
  })
  return { shown, done: n >= total }
}

// The dark gradient card for a person: avatar, name, "job · city", and a line of small print.
// `typed` fills the text in letter by letter; the arrow says the card opens their profile.
function PersonCard({ person: p, line, onClick, typed = false }: { person: Person; line: string; onClick: () => void; typed?: boolean }) {
  const sub = [p.profession, p.livesNow.city].filter((x) => x && x !== 'Unknown').join(' · ')
  const { shown, done } = useTyped([p.name, sub, line], typed)
  return (
    <button className={`person-card${typed ? ' is-filling' : ''}`} style={typed ? ({ '--card-bg': cardBackground(p) } as React.CSSProperties) : { background: cardBackground(p) }} onClick={onClick}>
      <Avatar id={p.id} className="avatar-lg" />
      <span className="person-card-text">
        {[p.name, sub, line].map((full, i) => {
          const Tag = (['b', 'span', 'small'] as const)[i]
          // The full text is laid out invisibly first, so the card keeps its final height while the text types in
          return typed ? (
            <Tag key={i} className="tt">
              <i className="tt-full">{full}</i>
              <i className="tt-shown">{shown[i]}</i>
            </Tag>
          ) : (
            <Tag key={i}>{full}</Tag>
          )
        })}
      </span>
      <span className={`person-card-go${done ? ' is-on' : ''}`} aria-hidden>
        <ChevronRightIcon size={19} />
      </span>
    </button>
  )
}
