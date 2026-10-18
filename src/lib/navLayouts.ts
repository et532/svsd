// Layouts for the bottom nav with the Ask (voice AI search) mic in the middle, being compared at #/nav-looks.
// Open one full size with #/?nav=3.
export type NavLayout = '1' | '2' | '3' | '4'

export const navLayouts: { id: NavLayout; name: string; description: string }[] = [
  {
    id: '1',
    name: 'Three pieces',
    description: 'Tabs on the left, a black mic in the middle and the black + on the right, all floating. The mic matches the + exactly.',
  },
  {
    id: '2',
    name: 'Gradient orb',
    description: 'Same three pieces, but the mic is a soft pastel orb, like the avatars and capture screen, so the AI feels like its own thing.',
  },
  {
    id: '3',
    name: 'One bar',
    description: 'Everything in a single glass bar: tabs on the left, + on the right, and the orb mic raised out of the middle.',
  },
  {
    id: '4',
    name: 'Ask pill',
    description: 'Tabs on the left, + on the right, and a wider black “Ask” pill with a mic in the middle, so it says what it does.',
  },
]
