import { filterLayouts, type FilterLayout } from '../lib/filterLayouts'
import { Prototype } from '../Prototype'
import { LooksPage } from './LooksPage'

export function FilterLooksPage() {
  return (
    <LooksPage
      title="Mindmap filter layouts"
      intro="Each phone is the real app. Try collapsing and opening the filter at the top left, and switching what the colors mean."
      options={filterLayouts}
      param="filter"
      render={(id) => <Prototype filterLayout={id as FilterLayout} initialTab="mindmap" />}
    />
  )
}
