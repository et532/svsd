import { AURA, AURA_BLUR, AURA_H, AURA_W } from '../lib/aura'

// The still background (the list): the Figma "Aura" orbs at their spots, with the light grain on the ground under them.
// The mindmap draws its own copy so the orbs can move to the groups.
export function AuraBackground() {
  return (
    <div className="aura-bg" aria-hidden>
      {AURA.map((o, i) => (
        <span
          key={i}
          className="aura-bg-orb"
          style={{
            left: `${(o.x / AURA_W) * 100}%`,
            top: `${(o.y / AURA_H) * 100}%`,
            width: `${(o.w / AURA_W) * 100}%`,
            aspectRatio: `${o.w} / ${o.h}`,
            background: o.color,
            filter: `blur(${AURA_BLUR}px)`,
          }}
        />
      ))}
    </div>
  )
}
