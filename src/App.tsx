import { useEffect, useState } from 'react'
import { Prototype } from './Prototype'

// Full size of the device frame on a computer (see .device in index.css), plus some breathing room.
const DEVICE_HEIGHT = 874 + 48
const DEVICE_WIDTH = 415 + 48

// Shrink the device frame to fit windows shorter (or narrower) than an iPhone.
function deviceScale() {
  return Math.min(1, window.innerHeight / DEVICE_HEIGHT, window.innerWidth / DEVICE_WIDTH)
}

export default function App() {
  const [scale, setScale] = useState(deviceScale)

  useEffect(() => {
    const onResize = () => setScale(deviceScale())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="app">
      <div className="device" style={{ '--device-scale': scale } as React.CSSProperties}>
        <Prototype />
      </div>
    </div>
  )
}
