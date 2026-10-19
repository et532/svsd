// A person's avatar: one of the 18 "Blob club" stickers from the Figma (the Originals in "Blob club — 54 sticker
// collection", node 196:5644), exported as transparent PNGs in src/assets/blobs. Each sample person has their own
// blob; anyone added later gets one picked from their id, always the same for the same id.
// Pass the size with a class (avatar-lg, avatar-xl) as on any .avatar.
const images = import.meta.glob<string>('../assets/blobs/*.png', { eager: true, import: 'default' })
const src = (blob: string) => images[`../assets/blobs/${blob}.png`]

// Each blob's two colors (light, then deeper); the profile's aura is tinted with them.
const blobs: Record<string, [string, string]> = {
  mint: ['#c6f2e3', '#6fcfc0'],
  lilac: ['#e4d9ff', '#a99cf0'],
  coral: ['#ffcdbf', '#ff8c7a'],
  sky: ['#cfe6ff', '#7fb6f2'],
  pistachio: ['#e6f5c0', '#a9d46a'],
  apricot: ['#ffe0b8', '#f0a95a'],
  aqua: ['#c4f1f5', '#5fc9d6'],
  rose: ['#ffd6df', '#f291a8'],
  mango: ['#ffe7a6', '#f5b73d'],
  sage: ['#dfe8d6', '#93a98a'],
  jelly: ['#e8dcff', '#b39cf0'],
  indigo: ['#d5dcff', '#7d8ef0'],
  lemon: ['#fff1b8', '#f2cf5c'],
  peach: ['#ffe0d2', '#f7a68c'],
  tangerine: ['#ffd2ae', '#f58a3c'],
  jade: ['#c8f0d6', '#3fae78'],
  opal: ['#d9dcff', '#8f9ef5'],
  orchid: ['#ffd8f0', '#ee8fcf'],
}
const names = Object.keys(blobs)

// The sample people, one blob each, roughly by how you know them (work: cool blues and greens, social: warm
// oranges, community: yellows and pinks).
const assigned: Record<string, string> = {
  'jordan-lee': 'mint',
  'daniel-okafor': 'sky',
  'sofia-ramirez': 'opal',
  'aisha-khan': 'indigo',
  'priya-nair': 'lilac',
  'tom-becker': 'sage',
  'hannah-cohen': 'jelly',
  'noah-patel': 'aqua',
  'ana-ruiz': 'jade',
  'maya-chen': 'coral',
  'kenji-watanabe': 'tangerine',
  'omar-haddad': 'apricot',
  'jordan-smith': 'peach',
  'zara-ahmed': 'rose',
  'grace-kim': 'pistachio',
  'lucas-silva': 'lemon',
  'emma-wright': 'orchid',
  'liam-oconnor': 'mango',
}

function hash(id: string) {
  let h = 2166136261
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

const blobOf = (id: string) => assigned[id] ?? names[hash(id) % names.length]

// The two colors of someone's avatar (light, then deeper); the profile's aura is tinted with them too.
export function avatarColors(id: string) {
  return blobs[blobOf(id)]
}

export function Avatar({ id, className = '' }: { id: string; className?: string }) {
  return (
    <span className={`avatar is-blob ${className}`} aria-hidden>
      <img src={src(blobOf(id))} alt="" draggable={false} />
    </span>
  )
}
