import { DEFAULT_T, fullAt, setInitialsAt, useInitialsAt } from '../lib/initialsAt'

// Desktop-only side panel (beside the phone frame): one slider for when the mindmap's initials appear.
export function InitialsPanel() {
  const { t, fitK } = useInitialsAt()
  const full = fullAt(t, fitK)
  return (
    <aside className="side-panel" aria-label="Prototype settings">
      <label className="side-panel-title" htmlFor="initials-at">
        Initials appear
      </label>
      <input
        id="initials-at"
        className="side-panel-slider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={t}
        onChange={(e) => setInitialsAt(Number(e.target.value))}
      />
      <div className="side-panel-ends">
        <span>Full view</span>
        <span>Zoomed in close</span>
      </div>
      <p className="side-panel-note">
        Fully shown at {full.toFixed(2)}× zoom (everyone in frame is {fitK.toFixed(2)}×)
      </p>
      {Math.abs(t - DEFAULT_T) > 0.005 && (
        <button type="button" className="side-panel-reset" onClick={() => setInitialsAt(DEFAULT_T)}>
          Reset
        </button>
      )}
    </aside>
  )
}
