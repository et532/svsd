import { useEffect, useState } from 'react'
import { modeInfo } from '../modes'
import { SproutIcon } from './Icons'

// Desktop-only panel beside the phone for trying out design options (map filter chip, fonts).
// Not part of the app itself.

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

// Layouts for the From / Met / Now chip in the map's search bar. Each sets the --chip-* variables in index.css.
type ChipOption = { name: string; note: string; vars: Record<string, string> }

const chipOptions: ChipOption[] = [
  {
    name: 'Current',
    note: 'Stacked, semibold',
    vars: { w: '51px', h: '38px', pad: '0px', dir: 'column', gap: '1px', icon: '15px', stroke: '2', text: '10.5px', weight: '600' },
  },
  {
    name: 'Roomier',
    note: 'Bigger chip, same content, more padding',
    vars: { w: '58px', h: '40px', pad: '0px', dir: 'column', gap: '3px', icon: '14px', stroke: '1.8', text: '10px', weight: '500' },
  },
  {
    name: 'Smaller contents',
    note: 'Same chip, smaller icon and text',
    vars: { w: '51px', h: '38px', pad: '0px', dir: 'column', gap: '2px', icon: '12px', stroke: '1.8', text: '9.5px', weight: '500' },
  },
  {
    name: 'Airy and light',
    note: 'Bigger chip, thin icon, regular weight',
    vars: { w: '56px', h: '40px', pad: '0px', dir: 'column', gap: '3px', icon: '13px', stroke: '1.5', text: '10px', weight: '400' },
  },
  {
    name: 'Side by side',
    note: 'Icon next to the word, medium weight',
    vars: { w: 'auto', h: '32px', pad: '12px', dir: 'row', gap: '5px', icon: '13px', stroke: '1.8', text: '12px', weight: '500' },
  },
  {
    name: 'Side by side, light',
    note: 'Icon next to the word, thin and regular',
    vars: { w: 'auto', h: '34px', pad: '13px', dir: 'row', gap: '5px', icon: '12px', stroke: '1.5', text: '11.5px', weight: '400' },
  },
]

// The --chip-* variables as a style object, for previews and for the page itself.
const chipStyle = (option: ChipOption) =>
  Object.fromEntries(Object.entries(option.vars).map(([key, value]) => [`--chip-${key}`, value]))

const STORAGE_KEY = 'peepl-design'

type Choice = { body: string; heading: string; chip: string }
const DEFAULT_CHOICE: Choice = { body: 'Inter', heading: SAME_AS_TEXT, chip: 'Current' }

// Remember the choice in this browser only, as a convenience. Fine to lose.
function loadChoice(): Choice {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && typeof saved === 'object') return { ...DEFAULT_CHOICE, ...saved }
  } catch {
    // Storage unavailable: use the default
  }
  return DEFAULT_CHOICE
}

export function DesignPanel() {
  const [choice, setChoice] = useState<Choice>(loadChoice)

  useEffect(() => {
    const body = bodyFonts.find((f) => f.name === choice.body) ?? bodyFonts[0]
    const heading = headingFonts.find((f) => f.name === choice.heading) ?? headingFonts[0]
    const root = document.documentElement.style
    root.setProperty('--font-body', body.stack)
    root.setProperty('--font-heading', heading.stack)
    const chip = chipOptions.find((c) => c.name === choice.chip) ?? chipOptions[0]
    for (const [name, value] of Object.entries(chipStyle(chip))) root.setProperty(name, value)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice))
    } catch {
      // Storage unavailable: the choice just won't be remembered
    }
  }, [choice])

  return (
    <aside className="font-panel" aria-label="Design options">
      <div className="font-panel-header">
        <h2>Design options</h2>
        <button className="font-reset" onClick={() => setChoice(DEFAULT_CHOICE)}>
          Reset
        </button>
      </div>

      <section className="font-group">
        <h3>Map filter chip</h3>
        <p className="font-hint">The From / Met / Now chip in the search bar on the map tab</p>
        <div role="radiogroup" aria-label="Map filter chip" className="chip-options">
          {chipOptions.map((option) => (
            <button
              key={option.name}
              role="radio"
              aria-checked={option.name === choice.chip}
              className={`font-option chip-option${option.name === choice.chip ? ' is-selected' : ''}`}
              onClick={() => setChoice({ ...choice, chip: option.name })}
            >
              <span className="chip-preview">
                <span
                  className="filter-chip"
                  style={{
                    ...chipStyle(option),
                    background: `linear-gradient(135deg, ${modeInfo.from.color}55, ${modeInfo.from.color}1a)`,
                  }}
                >
                  <SproutIcon />
                  <span className="filter-tiny">{modeInfo.from.tiny}</span>
                </span>
              </span>
              <span className="chip-option-text">
                <span className="chip-option-name">{option.name}</span>
                <span className="font-note">{option.note}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <FontGroup
        title="Font: text"
        hint="Names, search, buttons, everything else"
        options={bodyFonts}
        selected={choice.body}
        onSelect={(body) => setChoice({ ...choice, body })}
      />
      <FontGroup
        title="Font: headings"
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
