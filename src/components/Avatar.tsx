// A person's avatar: a soft flat-gradient circle with a happy face, picked at random but always the same for the
// same id (after Luma's characters). Pass the size with a class (avatar-lg, avatar-xl) as on any .avatar.
const palettes = [
  ['#ffd3ea', '#c9d3ff'],
  ['#dccbff', '#8fa2ea'],
  ['#c6f2e3', '#6fcfc0'],
  ['#ffeaa6', '#f4c761'],
  ['#ffbba8', '#ff8c7a'],
  ['#c0e7ff', '#70bef2'],
  ['#ffd0a0', '#e89c55'],
  ['#fac5da', '#ef90b6'],
]

function hash(id: string) {
  let h = 2166136261
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

const ink = '#16121c'

// Eyes (centered at x 36 and 64, y 42), then mouths (centered at x 50, y ~60).
const eyes = [
  <g key="dots" fill={ink}>
    <circle cx="36" cy="42" r="3.6" />
    <circle cx="64" cy="42" r="3.6" />
  </g>,
  <g key="ovals" fill={ink}>
    <ellipse cx="36" cy="42" rx="3.2" ry="5" />
    <ellipse cx="64" cy="42" rx="3.2" ry="5" />
  </g>,
  <g key="happy" fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round">
    <path d="M30 45q6-8 12 0M58 45q6-8 12 0" />
  </g>,
  <g key="wink" fill={ink} stroke={ink} strokeWidth="3.4" strokeLinecap="round">
    <circle cx="36" cy="42" r="3.6" stroke="none" />
    <path d="M58 44q6-7 12 0" fill="none" />
  </g>,
]

const mouths = [
  <path key="open" d="M38 56q12 0 24 0-1 14-12 14T38 56z" fill={ink} />,
  <path key="smile" d="M36 58q14 14 28 0" fill="none" stroke={ink} strokeWidth="3.6" strokeLinecap="round" />,
  <ellipse key="small" cx="50" cy="63" rx="6" ry="7" fill={ink} />,
  <path key="grin" d="M34 56h32q-2 15-16 15T34 56z" fill={ink} />,
]

export function Avatar({ id, className = '' }: { id: string; className?: string }) {
  const h = hash(id)
  const [a, b] = palettes[h % palettes.length]
  return (
    <span className={`avatar ${className}`} style={{ background: `radial-gradient(circle at 30% 25%, ${a}, ${b})` }} aria-hidden>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {eyes[(h >>> 3) % eyes.length]}
        {mouths[(h >>> 6) % mouths.length]}
      </svg>
    </span>
  )
}
