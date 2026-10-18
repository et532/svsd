import { useEffect, useState, type ReactNode } from 'react'

// Temporary page for comparing layout options: every option is the real app, shrunk so they all fit in one row.

type Option = { id: string; name: string; description: string }

type Props = {
  title: string
  intro: string
  options: Option[]
  // Query string that opens one option full size, e.g. "nav" → #/?nav=3
  param: string
  render: (id: string) => ReactNode
}

const PHONE_WIDTH = 375
const PHONE_HEIGHT = 812
// Title, intro and captions above the phones
const HEADER_HEIGHT = 380
const GAP = 20
const PAGE_PADDING = 48

export function LooksPage({ title, intro, options, param, render }: Props) {
  const fit = () => {
    // As big as possible while all phones fit across, and (on a tall enough window) fully on screen
    const width = document.documentElement.clientWidth
    const perPhone = (width - PAGE_PADDING - GAP * (options.length - 1)) / options.length
    const byHeight = (window.innerHeight - HEADER_HEIGHT) / PHONE_HEIGHT
    return Math.min(1, Math.max(0.2, Math.min(perPhone / PHONE_WIDTH, Math.max(byHeight, 0.45))))
  }
  const [scale, setScale] = useState(fit)

  useEffect(() => {
    const onResize = () => setScale(fit())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="looks-page" style={{ '--looks-scale': scale } as React.CSSProperties}>
      <header className="looks-header">
        <a href="#/" className="looks-back">
          ← Back to app
        </a>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      <div className="looks-grid">
        {options.map((option, i) => (
          <figure key={option.id} className="looks-frame">
            <figcaption>
              <div className="looks-name">
                <span className="looks-id">{option.id.length === 1 ? option.id.toUpperCase() : i + 1}</span>
                {option.name}
              </div>
              <p>{option.description}</p>
              <a href={`#/?${param}=${option.id}`}>Open full size</a>
            </figcaption>
            <div className="looks-phone">{render(option.id)}</div>
          </figure>
        ))}
      </div>
    </div>
  )
}
