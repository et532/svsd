import { useMemo, useState } from 'react'
import { BottomBar, type Tab } from './components/BottomBar'
import { FilterMenu } from './components/FilterMenu'
import { SearchBar } from './components/SearchBar'
import { HomeIndicator, StatusBar } from './components/StatusBar'
import { samplePeople } from './data/people'
import type { Mode } from './modes'
import { matchesQuery } from './lib/people'
import { ListScreen } from './screens/ListScreen'
import { MapScreen } from './screens/MapScreen'
import { MindmapScreen } from './screens/MindmapScreen'

// The app's single phone screen.
export function Prototype() {
  const [tab, setTab] = useState<Tab>('list')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('from')
  const [searchOpen, setSearchOpen] = useState(false)

  const people = useMemo(() => samplePeople.filter((p) => matchesQuery(p, query)), [query])

  return (
    <div className="phone">
      <StatusBar />
      {tab === 'list' && <ListScreen people={people} query={query} />}
      {tab === 'map' && <MapScreen people={people} mode={mode} />}
      {tab === 'mindmap' && <MindmapScreen />}

      {searchOpen && <div className="search-scrim" aria-hidden />}

      <header className="top-bar">
        <SearchBar
          value={query}
          onChange={setQuery}
          people={samplePeople}
          onOpenChange={setSearchOpen}
          // The from / met / lives now filter only changes the map, so it only shows there.
          accessory={tab === 'map' && <FilterMenu mode={mode} onChange={setMode} />}
          // Shorter text so it isn't cut off next to the filter chip
          placeholder={tab === 'map' ? 'Search people & places' : undefined}
        />
      </header>

      {/* The add form isn't built yet. */}
      <BottomBar active={tab} onChange={setTab} onAdd={() => {}} />
      <HomeIndicator />
    </div>
  )
}
