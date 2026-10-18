import { useEffect, useMemo, useRef, useState } from 'react'
import type { Context, Person } from '../data/people'
import { createGraph, type Graph } from '../lib/forceGraph'
import { contextColor, initials, linksOf, orbBackground, orbTextColor } from '../lib/people'
import { usePfpStyle } from '../lib/pfpStyle'

type GroupBy = 'none' | 'city' | 'met' | 'job'

const groupOptions: { id: GroupBy; label: string; icon: string }[] = [
  { id: 'none', label: 'None', icon: 'M6 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0' },
  { id: 'city', label: 'City', icon: 'M4 21V9l7-4v16M11 21V12l9 3v6M3 21h18' },
  { id: 'met', label: 'Met at', icon: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0' },
  { id: 'job', label: 'Job', icon: 'M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18' },
]

const groupValue: Record<GroupBy, (p: Person) => string> = {
  none: () => '',
  city: (p) => p.livesNow.city,
  met: (p) => p.met.city,
  job: (p) => p.profession,
}

// What the bubble colors mean (the same colors as the avatars on the list).
const legend: { id: Context; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'social', label: 'Social' },
  { id: 'community', label: 'Community' },
  { id: 'family', label: 'Family' },
]

// What the dot colors mean. 'relationship' uses the avatar colors; the others rank values by how many people share them.
type ColorBy = 'relationship' | 'city' | 'job' | 'recent'
const colorOptions: { id: ColorBy; label: string }[] = [
  { id: 'relationship', label: 'Relationship' },
  { id: 'city', label: 'City' },
  { id: 'job', label: 'Job' },
  { id: 'recent', label: 'Last seen' },
]
const colorKey: Record<ColorBy, (p: Person) => string> = {
  relationship: (p) => p.context,
  city: (p) => p.livesNow.city,
  job: (p) => p.profession,
  recent: (p) => {
    const days = (Date.now() - new Date(p.lastContacted).getTime()) / 86_400_000
    return days <= 30 ? 'This month' : days <= 120 ? 'Past 4 months' : 'Longer ago'
  },
}
const palette = ['#2f4fd0', '#ec5a32', '#e8c22e', '#d6347f', '#2fa38a', '#8a5cd6']
const otherColor = '#b9b2c2'

// Territory clouds: one soft pastel per group.
const territoryColors = ['#ffd6c2', '#d9f2e6', '#e3d9ff', '#ffd9ea', '#fbf0c4', '#d6e6ff']

const radius = (degree: number) => 11 + Math.min(degree, 5) * 1.2
// Zoomed out past this, dragging anywhere pans the map instead of moving a person.
const GRAB_ZOOM = 0.6
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function MindmapScreen({ people, focusId = null }: { people: Person[]; focusId?: string | null }) {
  const pfp = usePfpStyle()
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [colorBy, setColorBy] = useState<ColorBy>('relationship')
  const [selected, setSelected] = useState<string | null>(null)
  const [menu, setMenu] = useState(false) // the key is always shown; tap or hold its pill to swap it for the list of things to color by
  const [hover, setHover] = useState<ColorBy | null>(null)
  const holdTimer = useRef(0)
  const held = useRef(false)
  const [focus, setFocus] = useState<string | null>(null) // a group isolated by tapping its name

  const rootRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const nodeEls = useRef(new Map<string, HTMLElement>())
  const lineEls = useRef(new Map<string, SVGLineElement>())
  const turfEls = useRef(new Map<string, HTMLElement>())
  const graphRef = useRef<Graph | null>(null)
  const view = useRef({ x: 0, y: 0, k: 1 })
  const touched = useRef(false) // once the user pans or zooms, stop auto-fitting the view
  const selectedRef = useRef<string | null>(null)
  const wake = useRef<() => void>(() => {})
  const drawRef = useRef<() => void>(() => {})

  const links = useMemo(() => linksOf(people), [people])
  const degree = useMemo(() => {
    const d = new Map<string, number>()
    for (const [a, b] of links) {
      d.set(a, (d.get(a) ?? 0) + 1)
      d.set(b, (d.get(b) ?? 0) + 1)
    }
    return d
  }, [links])
  // Selected person = 0, their direct connections = 1. Everyone else isn't listed.
  const depth = useMemo(() => {
    const d = new Map<string, number>()
    if (!selected) return d
    const next = new Map<string, string[]>()
    for (const [a, b] of links) {
      next.set(a, [...(next.get(a) ?? []), b])
      next.set(b, [...(next.get(b) ?? []), a])
    }
    d.set(selected, 0)
    let frontier = [selected]
    for (let level = 1; level <= 1; level++) {
      const found: string[] = []
      for (const id of frontier)
        for (const n of next.get(id) ?? [])
          if (!d.has(n)) {
            d.set(n, level)
            found.push(n)
          }
      frontier = found
    }
    return d
  }, [links, selected])

  // Who is in which group. A group of one person has nothing to clump with, so it stays ungrouped.
  const { groupOf, groups } = useMemo(() => {
    const count = new Map<string, number>()
    for (const p of people) count.set(groupValue[groupBy](p), (count.get(groupValue[groupBy](p)) ?? 0) + 1)
    const of = new Map(people.map((p) => [p.id, count.get(groupValue[groupBy](p))! > 1 ? groupValue[groupBy](p) : '']))
    const names = [...count].filter(([g, n]) => g && n > 1).sort((a, b) => b[1] - a[1]).map(([g]) => g)
    return { groupOf: of, groups: names }
  }, [people, groupBy])

  // Color for each value, most common first; anything past the palette is grey "Other".
  const colors = useMemo(() => {
    const count = new Map<string, number>()
    for (const p of people) count.set(colorKey[colorBy](p), (count.get(colorKey[colorBy](p)) ?? 0) + 1)
    const ranked = [...count].sort((a, b) => b[1] - a[1]).map(([k]) => k)
    const of = new Map(ranked.map((k, i) => [k, palette[i] ?? otherColor]))
    const entries = ranked.slice(0, palette.length).map((k) => ({ label: k, color: of.get(k)! }))
    if (ranked.length > palette.length) entries.push({ label: 'Other', color: otherColor })
    return { of, entries }
  }, [people, colorBy])

  selectedRef.current = selected

  // Build the simulation whenever the people or the grouping change; keep existing positions.
  useEffect(() => {
    const prev = new Map(graphRef.current?.nodes.map((n) => [n.id, { x: n.x, y: n.y }]))
    const graph = createGraph(
      people.map((p) => p.id),
      links,
      prev,
    )
    graphRef.current = graph
    graph.setGroups((id) => groupOf.get(id) ?? '')
    touched.current = false

    // Frame everyone inside the phone, clear of the search bar and the nav.
    const fit = () => {
      const root = rootRef.current
      if (!root || !graph.nodes.length) return { ...view.current }
      // Ignore the farthest 4% of people so a few drifting loners don't shrink everyone else.
      const span = (v: number[]) => {
        const sorted = [...v].sort((p, q) => p - q)
        const cut = Math.floor(sorted.length * 0.04)
        return [sorted[cut], sorted[sorted.length - 1 - cut]]
      }
      const [x0, x1] = span(graph.nodes.map((n) => n.x))
      const [y0, y1] = span(graph.nodes.map((n) => n.y))
      const k = Math.min(1.2, Math.max(0.08, Math.min((root.clientWidth - 90) / (x1 - x0 + 90), (root.clientHeight - 330) / (y1 - y0 + 90))))
      return { x: (-(x0 + x1) / 2) * k, y: (-(y0 + y1) / 2) * k + 65, k } // +65: the controls take more room at the top than the nav does at the bottom
    }

    const draw = () => {
      const { x, y, k } = view.current
      if (worldRef.current) {
        worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`
        worldRef.current.style.setProperty('--inv', String(Math.min(3, 1 / k))) // keeps group names readable when zoomed out
      }
      for (const n of graph.nodes) {
        const el = nodeEls.current.get(n.id)
        if (el) el.style.transform = `translate(${n.x}px, ${n.y}px)`
      }
      for (const l of graph.links) {
        const el = lineEls.current.get(`${l.a.id}|${l.b.id}`)
        if (el) {
          el.setAttribute('x1', String(l.a.x))
          el.setAttribute('y1', String(l.a.y))
          el.setAttribute('x2', String(l.b.x))
          el.setAttribute('y2', String(l.b.y))
        }
      }
      // Each group's cloud wraps its members.
      const box = new Map<string, number[]>()
      for (const n of graph.nodes) {
        if (!n.group) continue
        const b = box.get(n.group) ?? [Infinity, Infinity, -Infinity, -Infinity]
        box.set(n.group, [Math.min(b[0], n.x), Math.min(b[1], n.y), Math.max(b[2], n.x), Math.max(b[3], n.y)])
      }
      for (const [g, [x0, y0, x1, y1]] of box) {
        const el = turfEls.current.get(g)
        if (!el) continue
        const r = Math.max(x1 - x0, y1 - y0) / 2 + 70
        el.style.width = el.style.height = `${r * 2}px`
        el.style.transform = `translate(${(x0 + x1) / 2 - r}px, ${(y0 + y1) / 2 - r}px)`
      }
      // The label card follows its node but stays the same size when zoomed.
      const sel = graph.nodes.find((n) => n.id === selectedRef.current)
      const root = rootRef.current
      if (labelRef.current && root && sel) {
        const r = radius(sel.degree) * k
        labelRef.current.style.transform = `translate(${root.clientWidth / 2 + x + sel.x * k}px, ${root.clientHeight / 2 + y + sel.y * k + r + 14}px) translateX(-50%)`
      }
    }
    drawRef.current = draw

    let raf = 0
    const tick = () => {
      graph.step()
      if (!touched.current) {
        const t = fit()
        const v = view.current
        v.x += (t.x - v.x) * 0.1
        v.y += (t.y - v.y) * 0.1
        v.k += (t.k - v.k) * 0.1
      }
      draw()
      raf = graph.alpha > 0.01 ? requestAnimationFrame(tick) : 0
    }
    wake.current = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    if (reduceMotion()) {
      for (let i = 0; i < 400; i++) graph.step()
      view.current = fit()
      draw()
    } else wake.current()
    return () => cancelAnimationFrame(raf)
  }, [people, links, groupOf])

  useEffect(() => drawRef.current(), [selected])

  // Pointer: drag a node, drag the background to pan, wheel or two-finger pinch to zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ id: string | null; grab: string | null; moved: boolean; pinch: number; travel: number }>({ id: null, grab: null, moved: false, pinch: 0, travel: 0 })

  const toWorld = (cx: number, cy: number) => {
    const root = rootRef.current!.getBoundingClientRect()
    const { x, y, k } = view.current
    return { x: (cx - root.left - root.width / 2 - x) / k, y: (cy - root.top - root.height / 2 - y) / k }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    cancelAnimationFrame(flight.current)
    setMenu(false)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const nodeEl = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
    const id = pointers.current.size === 1 ? (nodeEl?.dataset.id ?? null) : null
    drag.current = { id, grab: view.current.k >= GRAB_ZOOM ? id : null, moved: false, pinch: 0, travel: 0 }
    const node = graphRef.current?.nodes.find((n) => n.id === drag.current.grab)
    if (node) node.pinned = true
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const last = pointers.current.get(e.pointerId)
    if (!last) return
    const now = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, now)
    const d = drag.current
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (d.pinch) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / d.pinch)
      d.pinch = dist
      d.moved = true
      return
    }
    d.travel += Math.hypot(now.x - last.x, now.y - last.y)
    if (d.travel > 4) d.moved = true
    const graph = graphRef.current
    const node = graph?.nodes.find((n) => n.id === d.grab)
    if (node && graph) {
      const w = toWorld(now.x, now.y)
      node.x = w.x
      node.y = w.y
      graph.alpha = Math.max(graph.alpha, 0.35)
      wake.current()
    } else {
      touched.current = true
      view.current.x += now.x - last.x
      view.current.y += now.y - last.y
    }
    drawRef.current()
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    const d = drag.current
    const node = graphRef.current?.nodes.find((n) => n.id === d.grab)
    if (node) node.pinned = false
    if (pointers.current.size === 0) {
      if (!d.moved) {
        setSelected(d.id) // tap a node to select it, tap empty space to clear
        if (d.id) flyTo(d.id)
        if (!d.id) setFocus(null)
      }
      d.id = d.grab = null
      d.pinch = 0
    }
  }

  // Zoom to a person and center them with their direct connections in view. The user can still pan afterwards.
  const flight = useRef(0)
  const flyTo = (id: string) => {
    const graph = graphRef.current
    const root = rootRef.current
    if (!graph || !root) return
    const near = new Set([id])
    for (const l of graph.links) {
      if (l.a.id === id) near.add(l.b.id)
      if (l.b.id === id) near.add(l.a.id)
    }
    const ns = graph.nodes.filter((n) => near.has(n.id))
    const [x0, x1] = [Math.min(...ns.map((n) => n.x)), Math.max(...ns.map((n) => n.x))]
    const [y0, y1] = [Math.min(...ns.map((n) => n.y)), Math.max(...ns.map((n) => n.y))]
    const k = Math.min(1.4, Math.max(0.35, Math.min((root.clientWidth - 110) / (x1 - x0 + 90), (root.clientHeight - 360) / (y1 - y0 + 90))))
    const target = { x: (-(x0 + x1) / 2) * k, y: (-(y0 + y1) / 2) * k + 20, k } // +20: leave room for the name pill below
    touched.current = true
    cancelAnimationFrame(flight.current)
    const v = view.current
    const step = () => {
      const fast = reduceMotion() ? 1 : 0.16
      v.x += (target.x - v.x) * fast
      v.y += (target.y - v.y) * fast
      v.k += (target.k - v.k) * fast
      drawRef.current()
      if (Math.abs(target.k - v.k) > 0.002 || Math.abs(target.x - v.x) > 0.5) flight.current = requestAnimationFrame(step)
    }
    step()
  }

  // Searching down to one person selects them like a tap. Wait a beat so the rebuilt graph has spread out first.
  useEffect(() => {
    setSelected(focusId)
    if (!focusId) return
    const t = setTimeout(() => flyTo(focusId), reduceMotion() ? 0 : 500)
    return () => clearTimeout(t)
  }, [focusId, people])

  const zoomAt = (cx: number, cy: number, factor: number) => {
    const root = rootRef.current!.getBoundingClientRect()
    const v = view.current
    const k = Math.min(3, Math.max(0.08, v.k * factor))
    const px = cx - root.left - root.width / 2
    const py = cy - root.top - root.height / 2
    v.x = px - ((px - v.x) / v.k) * k
    v.y = py - ((py - v.y) / v.k) * k
    v.k = k
    touched.current = true
    drawRef.current()
  }

  // React's onWheel is passive, so attach the wheel listener by hand to stop the page scrolling.
  useEffect(() => {
    const el = rootRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.002))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const person = people.find((p) => p.id === selected)
  const dimmed = (id: string) => (focus ? groupOf.get(id) !== focus : false)
  const state = (id: string) =>
    selected ? [' is-lit', ' is-near'][depth.get(id) ?? 9] ?? ' is-far' : dimmed(id) ? ' is-far' : ''
  const lineState = (a: string, b: string) =>
    selected
      ? (depth.has(a) && depth.has(b) ? ' is-near' : ' is-far')
      : dimmed(a) || dimmed(b)
        ? ' is-far'
        : ''

  if (people.length === 0)
    return (
      <div className="screen mindmap-screen">
        <p className="empty">No one to show.</p>
      </div>
    )

  return (
    <div
      ref={rootRef}
      className={`screen mindmap-screen${selected ? ' has-sel' : ''}${focus ? ' has-focus' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={worldRef} className="mm-world">
        {groups.map((g, i) => (
          <div
            key={g}
            ref={(el) => {
              if (el) turfEls.current.set(g, el)
              else turfEls.current.delete(g)
            }}
            className={`mm-turf${focus === g ? ' is-focus' : ''}`}
            style={{ background: `radial-gradient(closest-side, ${territoryColors[i % territoryColors.length]} 55%, transparent)` }}
          >
            <button type="button" className="mm-turf-name" onPointerDown={(e) => e.stopPropagation()} onClick={() => setFocus(focus === g ? null : g)}>
              {g}
            </button>
          </div>
        ))}
        <svg className="mm-lines" width="1" height="1" aria-hidden>
          {links.map(([a, b]) => (
            <line
              key={`${a}|${b}`}
              ref={(el) => {
                if (el) lineEls.current.set(`${a}|${b}`, el)
                else lineEls.current.delete(`${a}|${b}`)
              }}
              className={`mm-line${lineState(a, b)}`}
            />
          ))}
        </svg>
        {people.map((p) => {
          const r = radius(degree.get(p.id) ?? 0)
          return (
            <div
              key={p.id}
              data-id={p.id}
              ref={(el) => {
                if (el) nodeEls.current.set(p.id, el)
                else nodeEls.current.delete(p.id)
              }}
              className={`mm-node${state(p.id)}`}
              style={{ width: r * 2, height: r * 2, margin: -r, fontSize: r * 0.62, color: colorBy === 'relationship' ? orbTextColor(p.id) : '#fff',
                ['--orb' as string]:
                  colorBy === 'relationship'
                    ? orbBackground(p.id, pfp)
                    : `radial-gradient(circle at 32% 28%, #fff 0, ${colors.of.get(colorKey[colorBy](p))} 62%)`,
              }}
            >
              <b>{initials(p.name)}</b>
            </div>
          )
        })}
      </div>

      {person && (
        <div ref={labelRef} className="mm-label" onPointerDown={(e) => e.stopPropagation()}>
          <span>
            <strong>{person.name}</strong>
            <small>{person.profession}</small>
          </span>
          {/* The profile screen isn't built yet. */}
          <button type="button" className="mm-view">
            View
          </button>
        </div>
      )}

      <div className="mm-colors" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="mm-color-pill"
          aria-expanded={menu}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            held.current = false
            window.clearTimeout(holdTimer.current)
            holdTimer.current = window.setTimeout(() => {
              held.current = true
              setMenu(true)
            }, 250)
          }}
          onPointerMove={(e) => {
            if (!held.current) return
            const id = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-color-option]')?.dataset.colorOption
            setHover((id as ColorBy) ?? null)
          }}
          onPointerUp={() => {
            window.clearTimeout(holdTimer.current)
            if (held.current) {
              // Released over an option: pick it. Released elsewhere: leave the list open to tap.
              if (hover) {
                setColorBy(hover)
                setMenu(false)
              }
              setHover(null)
            } else setMenu(!menu)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setMenu(!menu)
            }
          }}
        >
          {colorOptions.find((o) => o.id === colorBy)!.label}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {menu ? (
          <div className="mm-list mm-menu" role="menu">
            {colorOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={colorBy === o.id}
                data-color-option={o.id}
                className={`${colorBy === o.id ? 'is-on' : ''}${hover === o.id ? ' is-hover' : ''}`}
                onClick={() => {
                  setColorBy(o.id)
                  setMenu(false)
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mm-list">
            {(colorBy === 'relationship' ? legend.map((l) => ({ label: l.label, color: contextColor(l.id) })) : colors.entries).map((l) => (
              <span key={l.label}>
                <i style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mm-chips" onPointerDown={(e) => e.stopPropagation()}>
        {groupOptions.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={groupBy === o.id}
            className={groupBy === o.id ? 'is-on' : ''}
            onClick={() => {
              setGroupBy(o.id)
              setFocus(null)
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
              <path d={o.icon} />
            </svg>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
