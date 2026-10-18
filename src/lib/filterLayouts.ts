// Layouts for the mindmap's color filter (top left), being compared at #/filter-looks.
// Open one full size with #/?filter=b.
export type FilterLayout = 'a' | 'b' | 'c' | 'd'
export const filterLayouts: { id: FilterLayout; name: string; description: string }[] = [
  {
    id: 'a',
    name: 'Collapse arrow',
    description: 'Today’s black pill, plus a small arrow beside it that hides or shows the key. Collapsed, only the pill naming the current filter is left.',
  },
  {
    id: 'b',
    name: 'Filter button',
    description: 'Collapsed to a “Filter” button with a row of the current colors. Tap to open a panel: what to color by, with a check on the current one, and the key below.',
  },
  {
    id: 'c',
    name: 'Dots preview',
    description: 'Today’s black pill. Collapsed, the key shrinks to a row of colored dots beside it; tap the dots to see the labels again, or “Hide” to fold them back.',
  },
  {
    id: 'd',
    name: 'Filter + current',
    description: 'One button that reads “Filter | Relationship”, always showing the current filter. Tap to open the options as chips, with the key below.',
  },
]
