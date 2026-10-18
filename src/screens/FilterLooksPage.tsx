import { filterLayouts } from '../lib/filterLayouts'
import { Prototype } from '../Prototype'

// Temporary page for choosing the mindmap filter layout: each phone is the real app, open on the mindmap.
export function FilterLooksPage() {
  return (
    <div className="looks-page">
      <header className="looks-header">
        <a href="#/" className="looks-back">
          ← Back to app
        </a>
        <h1>Mindmap filter layouts</h1>
        <p>
          Each phone is the real app. Try collapsing and opening the filter at the top left, and switching what the
          colors mean.
        </p>
      </header>
      <div className="looks-grid">
        {filterLayouts.map((layout) => (
          <figure key={layout.id} className="looks-frame">
            <figcaption>
              <div className="looks-name">
                <span className="looks-id">{layout.id.toUpperCase()}</span>
                {layout.name}
              </div>
              <p>{layout.description}</p>
              <a href={`#/?filter=${layout.id}`}>Open full size</a>
            </figcaption>
            <Prototype filterLayout={layout.id} initialTab="mindmap" />
          </figure>
        ))}
      </div>
    </div>
  )
}
