import { useEffect, useState } from 'react'
import { orbBackground, pfpStyles, type PfpStyle } from '../lib/people'
import { setPfpStyle } from '../lib/pfpStyle'

// Desktop-only panel beside the phone for exploring the glassmorphism look, the phone's
// background, and the avatar gradient style. Not part of the app itself.

type Glass = { blur: number; sat: number; fill: number; edge: number }

const glassPresets: { name: string; note: string; glass: Glass }[] = [
  { name: 'Current', note: 'The look today', glass: { blur: 22, sat: 170, fill: 0.58, edge: 0.85 } },
  { name: 'Crystal', note: 'Barely there, clear', glass: { blur: 30, sat: 185, fill: 0.3, edge: 0.6 } },
  { name: 'Frost', note: 'Heavy milky frost', glass: { blur: 34, sat: 150, fill: 0.78, edge: 0.92 } },
  { name: 'Subtle', note: 'Light blur, soft', glass: { blur: 10, sat: 130, fill: 0.62, edge: 0.8 } },
  { name: 'Vivid', note: 'Punchy, saturated', glass: { blur: 24, sat: 230, fill: 0.5, edge: 0.85 } },
  { name: 'Liquid', note: 'Deep, watery blur', glass: { blur: 44, sat: 210, fill: 0.4, edge: 0.7 } },
  { name: 'Flat', note: 'No blur, near solid', glass: { blur: 0, sat: 100, fill: 0.92, edge: 1 } },
]

type Gradient = { name: string; css: string }

// Each option sets the phone's --bg (the screen behind the app's content). White is the
// default; the rest vary both color AND orientation — the mesh points and linear/conic
// angles differ from one to the next, so the options don't all flow the same direction.
const gradients: Gradient[] = [
  { name: 'White', css: '#ffffff' },
  {
    // diagonal mesh, top-left → bottom-right
    name: 'Pastel dawn',
    css: 'radial-gradient(circle at 15% 15%, #fbe8f1 0, rgba(251,232,241,0) 45%), radial-gradient(circle at 85% 85%, #e8edff 0, rgba(232,237,255,0) 48%), #f7f6fb',
  },
  {
    // horizontal, left → right
    name: 'Peach blush',
    css: 'linear-gradient(90deg, #ffe0cf 0%, #ffe8ea 50%, #ffd6e6 100%)',
  },
  {
    // vertical, bottom → top
    name: 'Mint sky',
    css: 'linear-gradient(to top, #d6f3e4 0%, #e3eef3 55%, #d8e9ff 100%)',
  },
  {
    // mesh angled the other way, top-right → bottom-left
    name: 'Lavender haze',
    css: 'radial-gradient(circle at 72% 18%, #e7ddff 0, rgba(231,221,255,0) 52%), radial-gradient(circle at 20% 78%, #ffd9f0 0, rgba(255,217,240,0) 54%), #f6f3fb',
  },
  {
    // steep diagonal, ↗ 45°
    name: 'Sunset',
    css: 'linear-gradient(45deg, #ffe7cf 0%, #ffd3e2 50%, #e2d6ff 100%)',
  },
  {
    // reverse diagonal, ↖ 300°
    name: 'Ocean',
    css: 'linear-gradient(300deg, #d4f0ff 0%, #cfe6ff 45%, #d8f3ec 100%)',
  },
  {
    // rotational, conic sweep off-center
    name: 'Cotton candy',
    css: 'conic-gradient(from 120deg at 62% 38%, #ffd9ec, #e3e0ff, #d6f0ff, #ffe4f1, #ffd9ec)',
  },
  {
    // shallow diagonal, 110°
    name: 'Golden hour',
    css: 'linear-gradient(110deg, #fff2cf 0%, #ffe0cf 50%, #ffd6e2 100%)',
  },
  {
    // three-point mesh, scattered corners
    name: 'Aurora',
    css: 'radial-gradient(circle at 8% 22%, #c9f5e5 0, rgba(201,245,229,0) 42%), radial-gradient(circle at 58% 8%, #d7dcff 0, rgba(215,220,255,0) 44%), radial-gradient(circle at 90% 74%, #ffd6ef 0, rgba(255,214,239,0) 46%), #f4f5fb',
  },
  {
    // flat vertical, top → bottom
    name: 'Neutral',
    css: 'linear-gradient(180deg, #fafafc 0%, #f1f1f4 100%)',
  },
]

const STORAGE_KEY = 'peepl-style'
const DEFAULT_PRESET = glassPresets[0]
const DEFAULT_GRADIENT = gradients[0].name
const DEFAULT_PFP: PfpStyle = 'sphere'

// A fixed sample avatar id so every pfp preview shows the same colors, letting the
// styles be compared shape-to-shape.
const SAMPLE_ID = 'sample'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export function StylePanel() {
  const [glass, setGlass] = useState<Glass>(DEFAULT_PRESET.glass)
  const [preset, setPreset] = useState<string>(DEFAULT_PRESET.name)
  const [gradient, setGradient] = useState<string>(DEFAULT_GRADIENT)
  const [pfp, setPfp] = useState<PfpStyle>(DEFAULT_PFP)

  // Restore the last choice in this browser (a convenience; fine to lose).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      if (saved && typeof saved === 'object') {
        if (saved.glass) setGlass({ ...DEFAULT_PRESET.glass, ...saved.glass })
        if (typeof saved.preset === 'string') setPreset(saved.preset)
        if (typeof saved.gradient === 'string') setGradient(saved.gradient)
        if (typeof saved.pfp === 'string') setPfp(saved.pfp as PfpStyle)
      }
    } catch {
      // Storage unavailable: use the defaults
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--glass-blur', `blur(${glass.blur}px) saturate(${glass.sat}%)`)
    root.setProperty('--glass', `rgba(255, 255, 255, ${glass.fill})`)
    root.setProperty('--glass-strong', `rgba(255, 255, 255, ${clamp01(glass.fill + 0.24)})`)
    root.setProperty('--glass-edge', `rgba(255, 255, 255, ${glass.edge})`)
    const g = gradients.find((x) => x.name === gradient) ?? gradients[0]
    root.setProperty('--bg', g.css)
    setPfpStyle(pfp)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ glass, preset, gradient, pfp }))
    } catch {
      // Storage unavailable: the choice just won't be remembered
    }
  }, [glass, preset, gradient, pfp])

  const applyPreset = (p: (typeof glassPresets)[number]) => {
    setGlass(p.glass)
    setPreset(p.name)
  }

  // Any manual slider move takes us off a named preset.
  const updateGlass = (patch: Partial<Glass>) => {
    setGlass((g) => ({ ...g, ...patch }))
    setPreset('Custom')
  }

  const reset = () => {
    applyPreset(DEFAULT_PRESET)
    setGradient(DEFAULT_GRADIENT)
    setPfp(DEFAULT_PFP)
  }

  return (
    <aside className="style-panel" aria-label="Style options">
      <div className="style-panel-header">
        <h2>Style playground</h2>
        <button className="style-reset" onClick={reset}>
          Reset
        </button>
      </div>

      <section className="style-group">
        <h3>Glass style</h3>
        <p className="style-hint">The search bar and nav pill (cards, dropdown, popups and sheet use a fixed vivid look)</p>
        <div role="radiogroup" aria-label="Glass preset" className="glass-presets">
          {glassPresets.map((p) => (
            <button
              key={p.name}
              role="radio"
              aria-checked={p.name === preset}
              className={`glass-preset${p.name === preset ? ' is-selected' : ''}`}
              onClick={() => applyPreset(p)}
            >
              <span className="glass-preset-name">{p.name}</span>
              <span className="style-note">{p.note}</span>
            </button>
          ))}
        </div>

        <div className="sliders">
          <Slider
            label="Blur"
            value={glass.blur}
            min={0}
            max={50}
            step={1}
            display={`${glass.blur}px`}
            onChange={(blur) => updateGlass({ blur })}
          />
          <Slider
            label="Saturation"
            value={glass.sat}
            min={100}
            max={250}
            step={5}
            display={`${glass.sat}%`}
            onChange={(sat) => updateGlass({ sat })}
          />
          <Slider
            label="Fill"
            value={glass.fill}
            min={0.1}
            max={1}
            step={0.02}
            display={`${Math.round(glass.fill * 100)}%`}
            onChange={(fill) => updateGlass({ fill })}
          />
          <Slider
            label="Edge"
            value={glass.edge}
            min={0}
            max={1}
            step={0.02}
            display={`${Math.round(glass.edge * 100)}%`}
            onChange={(edge) => updateGlass({ edge })}
          />
        </div>
      </section>

      <section className="style-group">
        <h3>Phone background</h3>
        <p className="style-hint">The screen behind the app's content (White is the default)</p>
        <div role="radiogroup" aria-label="Phone background" className="gradient-grid">
          {gradients.map((g) => (
            <button
              key={g.name}
              role="radio"
              aria-checked={g.name === gradient}
              title={g.name}
              className={`gradient-swatch${g.name === gradient ? ' is-selected' : ''}`}
              onClick={() => setGradient(g.name)}
            >
              <span className="gradient-chip" style={{ background: g.css }} />
              <span className="gradient-name">{g.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="style-group">
        <h3>Profile pictures</h3>
        <p className="style-hint">How the gradient avatars are drawn (same colors, different look)</p>
        <div role="radiogroup" aria-label="Profile picture style" className="pfp-grid">
          {pfpStyles.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={s.id === pfp}
              title={s.name}
              className={`pfp-swatch${s.id === pfp ? ' is-selected' : ''}`}
              onClick={() => setPfp(s.id)}
            >
              <span className="pfp-orb" style={{ background: orbBackground(SAMPLE_ID, s.id) }} />
              <span className="pfp-name">{s.name}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}

function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="slider-row">
      <span className="slider-head">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
