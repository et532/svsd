// Layouts for the bottom nav: Mindmap and People tabs on either side of the Ask mic, being compared at
// #/nav-looks. Open one full size with #/?nav=docked.
export type NavLayout = 'docked' | 'floating'

export const navLayouts: { id: NavLayout; name: string; description: string }[] = [
  {
    id: 'docked',
    name: 'Docked bar',
    description:
      'A full-width bar along the bottom edge, like most phone apps: labeled tabs either side, a line over the current one, and the mic raised out of the middle.',
  },
  {
    id: 'floating',
    name: 'Floating pill',
    description: 'A rounded glass pill floating above the bottom, in the style used so far: the two tab icons either side of the mic.',
  },
]
