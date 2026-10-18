import { useEffect, useState } from 'react'

// Desktop-only panel beside the phone for trying out fonts. Not part of the app itself.

type FontOption = { name: string; stack: string; note: string }

const sans = (name: string) => `'${name}', system-ui, -apple-system, sans-serif`
const serif = (name: string) => `'${name}', Georgia, serif`

const bodyFonts: FontOption[] = [
  { name: 'Inter', stack: sans('Inter'), note: 'Neutral, very readable (current)' },
  { name: 'Geist', stack: sans('Geist'), note: 'Crisp and techy' },
  { name: 'Manrope', stack: sans('Manrope'), note: 'Rounded, friendly' },
  { name: 'DM Sans', stack: sans('DM Sans'), note: 'Soft geometric' },
  { name: 'Plus Jakarta Sans', stack: sans('Plus Jakarta Sans'), note: 'Modern, a little playful' },
  { name: 'Figtree', stack: sans('Figtree'), note: 'Warm and clean' },
  { name: 'Outfit', stack: sans('Outfit'), note: 'Round geometric, airy' },
  { name: 'Instrument Sans', stack: sans('Instrument Sans'), note: 'Slightly condensed, editorial' },
]

const SAME_AS_TEXT = 'Same as text'

const headingFonts: FontOption[] = [
  { name: SAME_AS_TEXT, stack: 'var(--font-body)', note: 'One font everywhere' },
  { name: 'Instrument Serif', stack: serif('Instrument Serif'), note: 'Elegant, high contrast' },
  { name: 'Newsreader', stack: serif('Newsreader'), note: 'Soft editorial serif' },
  { name: 'Fraunces', stack: serif('Fraunces'), note: 'Warm, characterful serif' },
  { name: 'Outfit', stack: sans('Outfit'), note: 'Round geometric' },
  { name: 'Manrope', stack: sans('Manrope'), note: 'Rounded sans' },
]

const STORAGE_KEY = 'peepl-fonts'

type Choice = { body: string; heading: string }
const DEFAULT_CHOICE: Choice = { body: 'Inter', heading: SAME_AS_TEXT }

// Remember the choice in this browser only, as a convenience. Fine to lose.
function loadChoice(): Choice {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && typeof saved.body === 'string' && typeof saved.heading === 'string') return saved
  } catch {
    // Storage unavailable: use the default
  }
  return DEFAULT_CHOICE
}

export function FontPanel() {
  const [choice, setChoice] = useState<Choice>(loadChoice)

  useEffect(() => {
    const body = bodyFonts.find((f) => f.name === choice.body) ?? bodyFonts[0]
    const heading = headingFonts.find((f) => f.name === choice.heading) ?? headingFonts[0]
    const root = document.documentElement.style
    root.setProperty('--font-body', body.stack)
    root.setProperty('--font-heading', heading.stack)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice))
    } catch {
      // Storage unavailable: the choice just won't be remembered
    }
  }, [choice])

  return (
    <aside className="font-panel" aria-label="Font options">
      <div className="font-panel-header">
        <h2>Fonts</h2>
        <button className="font-reset" onClick={() => setChoice(DEFAULT_CHOICE)}>
          Reset
        </button>
      </div>

      <FontGroup
        title="Text"
        hint="Names, search, buttons, everything else"
        options={bodyFonts}
        selected={choice.body}
        onSelect={(body) => setChoice({ ...choice, body })}
      />
      <FontGroup
        title="Headings"
        hint="“Show on map”, “People / Places”, “Mindmap is coming soon”"
        options={headingFonts}
        selected={choice.heading}
        onSelect={(heading) => setChoice({ ...choice, heading })}
      />
      <p className="font-panel-note">Map place names use the map’s own font and don’t change.</p>
    </aside>
  )
}

type GroupProps = {
  title: string
  hint: string
  options: FontOption[]
  selected: string
  onSelect: (name: string) => void
}

function FontGroup({ title, hint, options, selected, onSelect }: GroupProps) {
  return (
    <section className="font-group">
      <h3>{title}</h3>
      <p className="font-hint">{hint}</p>
      <div role="radiogroup" aria-label={title}>
        {options.map((font) => (
          <button
            key={font.name}
            role="radio"
            aria-checked={font.name === selected}
            className={`font-option${font.name === selected ? ' is-selected' : ''}`}
            onClick={() => onSelect(font.name)}
          >
            <span className="font-sample" style={{ fontFamily: font.stack }}>
              {font.name}
            </span>
            <span className="font-note">{font.note}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
