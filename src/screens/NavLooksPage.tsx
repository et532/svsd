import { navLayouts } from '../lib/navLayouts'
import { Prototype } from '../Prototype'

// Temporary page for choosing the bottom nav layout with the Ask mic: each phone is the real app.
export function NavLooksPage() {
  return (
    <div className="looks-page">
      <header className="looks-header">
        <a href="#/" className="looks-back">
          ← Back to app
        </a>
        <h1>Nav bar layouts with Ask</h1>
        <p>
          Each phone is the real app. The mic in the middle opens Ask, the voice AI search: tap it to hear an example,
          or type your own request.
        </p>
      </header>
      <div className="looks-grid">
        {navLayouts.map((layout) => (
          <figure key={layout.id} className="looks-frame">
            <figcaption>
              <div className="looks-name">
                <span className="looks-id">{layout.id}</span>
                {layout.name}
              </div>
              <p>{layout.description}</p>
              <a href={`#/?nav=${layout.id}`}>Open full size</a>
            </figcaption>
            <Prototype navLayout={layout.id} />
          </figure>
        ))}
      </div>
    </div>
  )
}
