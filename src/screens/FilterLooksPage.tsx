import { filterLayouts, type FilterLayout } from '../lib/filterLayouts'
import { Prototype } from '../Prototype'
import { LooksPage } from './LooksPage'

export function FilterLooksPage() {
  return (
    <LooksPage
      title="Mindmap filter layouts"
      intro="Each phone is the real app, open on the mindmap. Tap the filter button at the end of the search bar to open it, and switch what the dot colors mean."
      options={filterLayouts}
      param="filter"
      render={(id) => <Prototype filterLayout={id as FilterLayout} initialTab="mindmap" />}
    />
  )
}
