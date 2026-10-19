import { useEffect, useState } from 'react'

const BARS = 36

// A live-looking recording waveform: thin blue bars that jump while `live`.
export function Wave({ live }: { live: boolean }) {
  const [bars, setBars] = useState<number[]>(() => Array(BARS).fill(3))
  useEffect(() => {
    if (!live) return setBars(Array(BARS).fill(3))
    const id = window.setInterval(() => {
      const t = Date.now() / 260
      setBars(Array.from({ length: BARS }, (_, i) => 3 + Math.random() * 18 * (0.45 + 0.55 * Math.abs(Math.sin(i / 3 + t)))))
    }, 100)
    return () => window.clearInterval(id)
  }, [live])
  return (
    <span className="wave" aria-hidden>
      {bars.map((h, i) => (
        <i key={i} style={{ height: h }} />
      ))}
    </span>
  )
}
