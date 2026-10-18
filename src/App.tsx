import { useEffect, useState } from 'react'
import { Prototype } from './Prototype'
import { MapLooksPage } from './screens/MapLooksPage'
import { mapLooks, type MapLook } from './screens/mapLooks'

// Full size of the device frame on a computer (see .device in index.css), plus some breathing room.
const DEVICE_HEIGHT = 874 + 48
const DEVICE_WIDTH = 415 + 48

// Shrink the device frame to fit windows shorter (or narrower) than an iPhone.
function deviceScale() {
  return Math.min(1, window.innerHeight / DEVICE_HEIGHT, window.innerWidth / DEVICE_WIDTH)
}

// Routes: #/map-looks compares map looks side by side; #/?look=b opens the app with that look.
function readRoute() {
  const [path, search = ''] = window.location.hash.replace(/^#/, '').split('?')
  const look = new URLSearchParams(search).get('look') as MapLook | null
  return {
    page: path === '/map-looks' ? 'map-looks' : 'app',
    look: mapLooks.some((l) => l.id === look) ? look! : undefined,
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

  if (route.page === 'map-looks') return <MapLooksPage />

  return (
    <div className="app">
      <div className="device" style={{ '--device-scale': scale } as React.CSSProperties}>
        <Prototype key={route.look} mapLook={route.look} initialTab={route.look ? 'map' : 'list'} />
      </div>
    </div>
  )
}
