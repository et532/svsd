import { Prototype } from '../Prototype'
import { mapLooks } from './mapLooks'

// Temporary page for choosing a map look: each phone is the real app, open on the map.
export function MapLooksPage() {
  return (
    <div className="designs-page">
      <header className="designs-header">
        <a href="#/" className="designs-back">
          ← Back to app
        </a>
        <h1>Map looks</h1>
        <p>
          Each phone is the real app. Spin and zoom the globe to compare. The glowing pastel dots are the same in all
          four; only the map underneath changes.
        </p>
      </header>
      <div className="designs-grid">
        {mapLooks.map((look) => (
          <figure key={look.id} className="design-frame">
            <figcaption>
              <div className="design-name">
                <span className="design-id">{look.id.toUpperCase()}</span>
                {look.name}
              </div>
              <p>{look.description}</p>
              <a href={`#/?look=${look.id}`}>Open full size</a>
            </figcaption>
            <Prototype mapLook={look.id} initialTab="map" />
          </figure>
        ))}
      </div>
    </div>
  )
}
