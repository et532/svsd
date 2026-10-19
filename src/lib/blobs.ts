// Everyone's "Blob club" character (the 18 Originals in the Figma frame "Blob club — 54 sticker collection",
// node 196:5644). The photos are in src/assets/blobs; each blob also carries the colors used around that person.

type Blob = {
  // light, then deeper: the avatar's backdrop and the profile's soft aura
  soft: [string, string]
  // the dark card behind the profile hero and the new-person card: a base, plus three blurred shapes on it
  // (mid: top left, accent: right, deep: bottom left), as in the Figma "Profile" component (create / hero)
  base: string
  mid: string
  accent: string
  deep: string
}

const blobs: Record<string, Blob> = {
  // Mint matches the Figma component exactly
  mint: { soft: ['#c6f2e3', '#6fcfc0'], base: '#113d48', mid: '#278c79', accent: '#d49b45', deep: '#154c5b' },
  lilac: { soft: ['#e4d9ff', '#a99cf0'], base: '#272152', mid: '#7562c4', accent: '#e39fb8', deep: '#382d70' },
  coral: { soft: ['#ffcdbf', '#ff8c7a'], base: '#45201d', mid: '#d9604c', accent: '#efb15a', deep: '#74282a' },
  sky: { soft: ['#cfe6ff', '#7fb6f2'], base: '#132f4d', mid: '#3c82d2', accent: '#9bd0c4', deep: '#1c4877' },
  pistachio: { soft: ['#e6f5c0', '#a9d46a'], base: '#22351b', mid: '#78a83c', accent: '#e3bf48', deep: '#33501f' },
  apricot: { soft: ['#ffe0b8', '#f0a95a'], base: '#44291a', mid: '#d9853a', accent: '#f0c46a', deep: '#743c1d' },
  aqua: { soft: ['#c4f1f5', '#5fc9d6'], base: '#0f3943', mid: '#28a3b2', accent: '#97d49c', deep: '#145764' },
  rose: { soft: ['#ffd6df', '#f291a8'], base: '#481d2c', mid: '#d25f7b', accent: '#f0ad8c', deep: '#742a42' },
  mango: { soft: ['#ffe7a6', '#f5b73d'], base: '#45300f', mid: '#dd9c28', accent: '#ec7849', deep: '#745012' },
  sage: { soft: ['#dfe8d6', '#93a98a'], base: '#232f29', mid: '#6c8b6c', accent: '#c6ad78', deep: '#394b3b' },
  jelly: { soft: ['#e8dcff', '#b39cf0'], base: '#2b2250', mid: '#8a6fd1', accent: '#ec9fc4', deep: '#412f77' },
  indigo: { soft: ['#d5dcff', '#7d8ef0'], base: '#1a2054', mid: '#4c60d4', accent: '#8bcdec', deep: '#29348c' },
  lemon: { soft: ['#fff1b8', '#f2cf5c'], base: '#3c3512', mid: '#d2b32d', accent: '#8bc268', deep: '#685812' },
  peach: { soft: ['#ffe0d2', '#f7a68c'], base: '#47261f', mid: '#e17f67', accent: '#f2c078', deep: '#74392e' },
  tangerine: { soft: ['#ffd2ae', '#f58a3c'], base: '#462310', mid: '#e8772a', accent: '#f1bd49', deep: '#743512' },
  jade: { soft: ['#c8f0d6', '#3fae78'], base: '#0f3829', mid: '#2e9967', accent: '#d1b159', deep: '#14573d' },
  opal: { soft: ['#d9dcff', '#8f9ef5'], base: '#1f2551', mid: '#6b7bdb', accent: '#e0a3d3', deep: '#2e3987' },
  orchid: { soft: ['#ffd8f0', '#ee8fcf'], base: '#471d42', mid: '#cf62b0', accent: '#f0ad9e', deep: '#742a68' },
}
const names = Object.keys(blobs)

// The sample people, one blob each, roughly by how you know them (work: cool blues and greens, social: warm
// oranges, community: yellows and pinks). Anyone added later gets one from their id, always the same.
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

export const blobName = (id: string) => assigned[id] ?? names[hash(id) % names.length]
export const blobOf = (id: string) => blobs[blobName(id)]

// The two soft colors of someone's avatar (light, then deeper); the profile's aura is tinted with them.
export const avatarColors = (id: string) => blobOf(id).soft
