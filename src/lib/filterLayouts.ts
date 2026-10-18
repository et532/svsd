// Layouts for the mindmap's color filter, now a button in the search bar, being compared at #/filter-looks.
// Open one full size with #/?filter=b.
export type FilterLayout = 'a' | 'b' | 'c' | 'd'

export const filterLayouts: {
  id: FilterLayout
  name: string
  description: string
  // The button in the search bar: a filter icon, or a chip naming the current filter
  trigger: 'icon' | 'chip'
  // What it opens: a pop-up under the search bar, or a sheet that slides up from the bottom
  panel: 'popover' | 'sheet'
  // How the options are laid out (from the earlier B and D panels): rows with a check, or chips
  options: 'rows' | 'chips'
}[] = [
  {
    id: 'a',
    name: 'Icon + pop-up',
    description: 'A filter icon at the end of the search bar opens a floating pop-up under it: options as rows with a check, and the key.',
    trigger: 'icon',
    panel: 'popover',
    options: 'rows',
  },
  {
    id: 'b',
    name: 'Icon + slide-up',
    description: 'The same filter icon opens a sheet that slides up from the bottom: options as rows with a check, and the key.',
    trigger: 'icon',
    panel: 'sheet',
    options: 'rows',
  },
  {
    id: 'c',
    name: 'Current filter + pop-up',
    description: 'The search bar ends in a chip naming the current filter (“Relationship”). It opens a floating pop-up with the options as chips, and the key.',
    trigger: 'chip',
    panel: 'popover',
    options: 'chips',
  },
  {
    id: 'd',
    name: 'Current filter + slide-up',
    description: 'The same chip naming the current filter opens a sheet from the bottom with the options as chips, and the key.',
    trigger: 'chip',
    panel: 'sheet',
    options: 'chips',
  },
]
