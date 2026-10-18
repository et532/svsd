import { useEffect, useState } from 'react'
import { filterLayouts, type FilterLayout } from './lib/filterLayouts'
import { Prototype } from './Prototype'
import { FilterLooksPage } from './screens/FilterLooksPage'

// Full size of the device frame on a computer (see .device in index.css), plus some breathing room.
const DEVICE_HEIGHT = 874 + 48
const DEVICE_WIDTH = 415 + 48

// Shrink the device frame to fit windows shorter (or narrower) than an iPhone.
function deviceScale() {
  return Math.min(1, window.innerHeight / DEVICE_HEIGHT, window.innerWidth / DEVICE_WIDTH)
}

// Routes: #/filter-looks compares the mindmap filter layouts; #/?filter=b opens the app with that layout.
function readRoute() {
  const [path, search = ''] = window.location.hash.replace(/^#/, '').split('?')
  const filter = new URLSearchParams(search).get('filter') as FilterLayout | null
  return {
    page: path === '/filter-looks' ? 'filter-looks' : 'app',
    filter: filterLayouts.some((l) => l.id === filter) ? filter! : undefined,
  }
}

export default function App() {
  const [scale, setScale] = useState(deviceScale)
  const [route, setRoute] = useState(readRoute)

  useEffect(() => {
    const onResize = () => setScale(deviceScale())
    const onHashChange = () => setRoute(readRoute())
    window.addEventListener('resize', onResize)
    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  if (route.page === 'filter-looks') return <FilterLooksPage />

  return (
    <div className="app">
      <div className="device" style={{ '--device-scale': scale } as React.CSSProperties}>
        <Prototype key={route.filter} filterLayout={route.filter} initialTab={route.filter ? 'mindmap' : 'list'} />
      </div>
    </div>
  )
}
