import { useId, useMemo, useRef, useState } from 'react'
import type { Person } from '../data/people'
import { initials, matchesQuery, orbBackground } from '../lib/people'
import { usePfpStyle } from '../lib/pfpStyle'
import { CloseIcon, PinIcon, SearchIcon, TagIcon } from './Icons'

type Props = {
  value: string
  onChange: (value: string) => void
  people: Person[]
  onOpenChange?: (open: boolean) => void
  // Extra control at the right end of the bar (the map filter button).
  accessory?: React.ReactNode
  placeholder?: string
}

type Option =
  | { kind: 'person'; person: Person }
  | { kind: 'place'; label: string }
  | { kind: 'tag'; label: string }

export function SearchBar({ value, onChange, people, onOpenChange, accessory, placeholder = 'Search people, places, interests' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [open, setOpenState] = useState(false)
  const [active, setActive] = useState(-1)

  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }

  const { places, tags } = useMemo(() => collectFacets(people), [people])
  const query = value.trim().toLowerCase()

  const sections = useMemo(() => {
    // Before typing: suggest the people you talked to most recently and your most common places.
    if (!query) {
      return [
        {
          title: 'People',
          options: [...people]
            .sort((a, b) => b.lastContacted.localeCompare(a.lastContacted))
            .slice(0, 4)
            .map((person): Option => ({ kind: 'person', person })),
        },
        {
          title: 'Places',
          options: places.slice(0, 3).map((label): Option => ({ kind: 'place', label })),
        },
      ]
    }
    return [
      {
        title: 'People',
        options: people
          .filter((p) => matchesQuery(p, value))
          .slice(0, 4)
          .map((person): Option => ({ kind: 'person', person })),
      },
      {
        title: 'Places',
        options: places
          .filter((p) => p.toLowerCase().includes(query))
          .slice(0, 3)
          .map((label): Option => ({ kind: 'place', label })),
      },
      {
        title: 'Interests',
        options: tags
          .filter((t) => t.toLowerCase().includes(query))
          .slice(0, 3)
          .map((label): Option => ({ kind: 'tag', label })),
      },
    ].filter((s) => s.options.length > 0)
  }, [query, value, people, places, tags])

  const flat = sections.flatMap((s) => s.options)

  const choose = (text: string) => {
    onChange(text)
    setOpen(false)
    inputRef.current?.blur()
  }

  const chooseOption = (option: Option) =>
    choose(option.kind === 'person' ? option.person.name : option.label)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Stop the browser's own "Escape clears a search field", which would reopen the dropdown
      e.preventDefault()
      setOpen(false)
      inputRef.current?.blur()
    } else if (e.key === 'ArrowDown' && flat.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % flat.length)
    } else if (e.key === 'ArrowUp' && flat.length) {
      e.preventDefault()
      setActive((i) => (i <= 0 ? flat.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (active >= 0 && flat[active]) chooseOption(flat[active])
      else choose(value)
    }
  }

  let index = -1

  return (
    <div className={`search${open ? ' is-open' : ''}`}>
      <div className="search-bar">
        <SearchIcon size={19} />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setActive(-1)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search people"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {value && (
          <button
            className="search-clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('')
              setActive(-1)
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
          >
            <CloseIcon size={17} />
          </button>
        )}
        {accessory && (
          <>
            <span className="search-divider" aria-hidden />
            {accessory}
          </>
        )}
      </div>

      {open && (
        // preventDefault keeps the input focused while tapping inside the dropdown.
        <div className="search-dropdown" id={listId} role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {query && flat.length === 0 && <div className="dropdown-empty">No matches for “{value.trim()}”</div>}

          {sections.map((section) => (
            <div key={section.title} className="dropdown-section">
              <div className="dropdown-title">{section.title}</div>
              {section.options.map((option) => {
                index += 1
                const i = index
                return (
                  <div
                    key={option.kind === 'person' ? option.person.id : `${option.kind}-${option.label}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={`dropdown-option${i === active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => chooseOption(option)}
                  >
                    <OptionContent option={option} query={value.trim()} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OptionContent({ option, query }: { option: Option; query: string }) {
  const pfp = usePfpStyle()
  if (option.kind === 'person') {
    const { person } = option
    return (
      <>
        <span className="avatar avatar-sm" style={{ background: orbBackground(person.id, pfp) }} aria-hidden>
          {initials(person.name)}
        </span>
        <span className="option-text">
          <span className="option-label">
            <Highlight text={person.name} query={query} />
          </span>
        </span>
      </>
    )
  }
  return (
    <>
      <span className="option-icon" aria-hidden>
        {option.kind === 'place' ? <PinIcon size={15} /> : <TagIcon size={15} />}
      </span>
      <span className="option-text">
        <span className="option-label">
          <Highlight text={option.label} query={query} />
        </span>
      </span>
    </>
  )
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  )
}

// Places and interests, most common first.
function collectFacets(people: Person[]) {
  const placeCounts = new Map<string, number>()
  const tagCounts = new Map<string, number>()
  for (const p of people) {
    for (const city of new Set([p.from.city, p.met.city, p.livesNow.city])) {
      placeCounts.set(city, (placeCounts.get(city) ?? 0) + 1)
    }
    for (const tag of p.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  }
  const byCount = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k)
  return { places: byCount(placeCounts), tags: byCount(tagCounts) }
}
