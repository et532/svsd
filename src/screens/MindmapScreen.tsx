import { useEffect, useMemo, useRef, useState } from 'react'
import type { Person } from '../data/people'
import { createGraph, type Graph } from '../lib/forceGraph'
import { auraDepth, initials, linksOf, momentsOf } from '../lib/people'
import type { ColorBy } from '../lib/mindmapColors'
import type { GroupBy } from '../components/TopControls'
import { Avatar } from '../components/Avatar'
import { ChevronRightIcon } from '../components/Icons'


// Grouping (territory clouds by city / met at / job), chosen in the Filters menu at the top right.
const groupValue: Record<GroupBy, (p: Person) => string> = {
  none: () => '',
  city: (p) => p.livesNow.city,
  met: (p) => p.met.city,
  job: (p) => p.profession,
}

// Territory clouds: one soft color per group (yellow, orange, pink, blue like the Figma disc study).
const territoryColors = ['#f5dc6a', '#f2724c', '#e0508f', '#6f7fe6', '#7fd1b0', '#b48ae6']

// The more you've interacted with someone (moments logged + how close you are), the bigger their dot.
const radiusOf = (p: Person) => 8 + Math.min(momentsOf(p).length + auraDepth(p.id), 10) * 2.4
// Zoomed out past this, dragging anywhere pans the map instead of moving a person.
const GRAB_ZOOM = 0.6
// Disc (halo) radius for a person, from their interaction size r: 24px for the least up to ~54px.
const discOf = (r: number) => 14 + r * 1.25
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Ink style: a link is a filled, tapered branch (w0 wide at the parent, w1 thin at the child) along a gentle curve.
// Each link bends its own fixed way (from its ids), so the shape doesn't change between frames.
const bendOf = (key: string) => {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return ((Math.abs(h) % 100) / 100 - 0.5) * 0.4
}
function branch(ax: number, ay: number, bx: number, by: number, w0: number, w1: number, bend: number) {
  const len = Math.hypot(bx - ax, by - ay) || 1
  const cx = (ax + bx) / 2 - ((by - ay) / len) * bend * len
  const cy = (ay + by) / 2 + ((bx - ax) / len) * bend * len
  const left: string[] = []
  const right: string[] = []
  const N = 10
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const m = 1 - t
    const x = m * m * ax + 2 * m * t * cx + t * t * bx
    const y = m * m * ay + 2 * m * t * cy + t * t * by
    let tx = 2 * m * (cx - ax) + 2 * t * (bx - cx)
    let ty = 2 * m * (cy - ay) + 2 * t * (by - cy)
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl
    ty /= tl
    const w = (w0 + (w1 - w0) * t) / 2
    left.push(`${(x - ty * w).toFixed(1)} ${(y + tx * w).toFixed(1)}`)
    right.push(`${(x + ty * w).toFixed(1)} ${(y - tx * w).toFixed(1)}`)
  }
  return `M${left.join('L')}L${right.reverse().join('L')}Z`
}

type Props = {
  people: Person[]
  focusId?: string | null
  onView?: (id: string) => void
  groupBy?: GroupBy
  colorBy?: ColorBy
  ink?: boolean
}

export function MindmapScreen({ people, focusId = null, onView, groupBy = 'none', ink = false }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null) // a group isolated by tapping its name

  const rootRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const nodeEls = useRef(new Map<string, HTMLElement>())
  const lineEls = useRef(new Map<string, SVGLineElement>())
  const turfEls = useRef(new Map<string, HTMLElement>())
  const pathEls = useRef(new Map<string, SVGPathElement>()) // ink style: the branches
  const blobEls = useRef(new Map<string, SVGCircleElement>()) // ink style: the bulbs
  const inkRef = useRef(ink)
  const depthRef = useRef(new Map<string, number>())
  const graphRef = useRef<Graph | null>(null)
  const view = useRef({ x: 0, y: 0, k: 1 })
  const touched = useRef(false) // once the user pans or zooms, stop auto-fitting the view
  const selectedRef = useRef<string | null>(null)
  const wake = useRef<() => void>(() => {})
  const drawRef = useRef<() => void>(() => {})
  const fitRef = useRef<() => { x: number; y: number; k: number }>(() => ({ x: 0, y: 0, k: 1 }))
  const settleTimer = useRef(0)

  const links = useMemo(() => linksOf(people), [people])
  const radii = useMemo(() => new Map(people.map((p) => [p.id, radiusOf(p)])), [people])
  const radiiRef = useRef(radii)
  radiiRef.current = radii
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

  selectedRef.current = selected
  inkRef.current = ink
  depthRef.current = depth

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
        worldRef.current.style.setProperty('--k', String(k)) // initials fade in as you zoom in
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
      if (inkRef.current) {
        const d = depthRef.current
        for (const n of graph.nodes) {
          const el = blobEls.current.get(n.id)
          if (!el) continue
          el.setAttribute('cx', String(n.x))
          el.setAttribute('cy', String(n.y))
          el.setAttribute('r', String(radiiRef.current.get(n.id) ?? 12))
        }
        for (const l of graph.links) {
          const el = pathEls.current.get(`${l.a.id}|${l.b.id}`)
          if (!el) continue
          const r = (id: string) => radiiRef.current.get(id) ?? 12
          // With someone selected they are the root: their branches are thick, growing outward. Otherwise the more
          // interacted-with person is the thicker end.
          const aFirst = d.size ? (d.get(l.a.id) ?? 9) <= (d.get(l.b.id) ?? 9) : r(l.a.id) >= r(l.b.id)
          const [p, c] = aFirst ? [l.a, l.b] : [l.b, l.a]
          const root = d.has(l.a.id) && d.has(l.b.id)
          // thin tips fade away under the gooey filter, so the tips stay at least ~3 wide
          const w0 = root ? 13 : Math.min(10, Math.max(5, r(p.id) * 0.55))
          el.setAttribute('d', branch(p.x, p.y, c.x, c.y, w0, root ? 4.5 : 3, bendOf(`${p.id}${c.id}`)))
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
        const r = discOf(radiiRef.current.get(sel.id) ?? 12) * k
        labelRef.current.style.transform = `translate(${root.clientWidth / 2 + x + sel.x * k}px, ${root.clientHeight / 2 + y + sel.y * k + r + 14}px) translateX(-50%)`
      }
    }
    drawRef.current = draw
    fitRef.current = fit

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

  useEffect(() => drawRef.current(), [selected, ink])

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
    // A press that started on an overlay (name pill, legend) never reached us, so it isn't a tap on the graph.
    if (!pointers.current.delete(e.pointerId)) return
    const d = drag.current
    const node = graphRef.current?.nodes.find((n) => n.id === d.grab)
    if (node) node.pinned = false
    if (pointers.current.size < 2) settle() // let go of a pinch: spring back if it went too far
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
    animateTo({ x: (-(x0 + x1) / 2) * k, y: (-(y0 + y1) / 2) * k + 20, k }) // +20: leave room for the name pill below
  }

  // Glide the view to a target. Each frame closes a fraction of the gap, so it eases out like an iOS spring.
  const animateTo = (target: { x: number; y: number; k: number }, rate = 0.16) => {
    touched.current = true
    cancelAnimationFrame(flight.current)
    const v = view.current
    const step = () => {
      const fast = reduceMotion() ? 1 : rate
      v.x += (target.x - v.x) * fast
      v.y += (target.y - v.y) * fast
      v.k += (target.k - v.k) * fast
      drawRef.current()
      if (Math.abs(target.k - v.k) > 0.002 || Math.abs(target.x - v.x) > 0.5 || Math.abs(target.y - v.y) > 0.5) flight.current = requestAnimationFrame(step)
    }
    step()
  }

  // Zoom limits: a bit past "everyone in frame" going out, and 3x going in. Pushing past them stretches
  // with resistance (zoomAt); letting go springs the view back, like an iOS scroll view's rubber band.
  const MAX_K = 3
  const minK = () => fitRef.current().k * 0.85
  const settle = () => {
    const v = view.current
    if (v.k < minK()) animateTo(fitRef.current(), 0.12)
    else if (v.k > MAX_K) animateTo({ x: (v.x * MAX_K) / v.k, y: (v.y * MAX_K) / v.k, k: MAX_K }, 0.12)
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
    // Past a limit, only a third of the gesture counts, and the stretch is capped
    const lo = minK()
    if ((v.k <= lo && factor < 1) || (v.k >= MAX_K && factor > 1)) factor = Math.pow(factor, 0.3)
    const k = Math.min(MAX_K * 1.25, Math.max(lo * 0.7, v.k * factor))
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
      cancelAnimationFrame(flight.current)
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.002))
      // The wheel has no "let go", so spring back once it pauses
      clearTimeout(settleTimer.current)
      settleTimer.current = window.setTimeout(settle, 140)
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
      className={`screen mindmap-screen${ink ? ' look-ink' : ''}${selected ? ' has-sel' : ''}${focus ? ' has-focus' : ''}`}
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
          {ink ? (
            <>
              <defs>
                {/* Gooey: blur, then harden the edge, so branches and bulbs melt into one ink shape */}
                <filter id="mm-goo" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
                  <feGaussianBlur stdDeviation="2.6" />
                  <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
                </filter>
                {/* Ragged, spray-paint edge for the grey halos */}
                <filter id="mm-rough" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n" scale="7" />
                </filter>
              </defs>
              <g filter="url(#mm-goo)">
                {links.map(([a, b]) => (
                  <path
                    key={`${a}|${b}`}
                    ref={(el) => {
                      if (el) pathEls.current.set(`${a}|${b}`, el)
                      else pathEls.current.delete(`${a}|${b}`)
                    }}
                    className={`mm-branch${lineState(a, b)}`}
                  />
                ))}
                {people.map((p) => (
                  <circle
                    key={p.id}
                    ref={(el) => {
                      if (el) blobEls.current.set(p.id, el)
                      else blobEls.current.delete(p.id)
                    }}
                    className={`mm-blob${state(p.id)}`}
                  />
                ))}
              </g>
            </>
          ) : (
            links.map(([a, b]) => (
              <line
                key={`${a}|${b}`}
                ref={(el) => {
                  if (el) lineEls.current.set(`${a}|${b}`, el)
                  else lineEls.current.delete(`${a}|${b}`)
                }}
                className={`mm-line${groupOf.get(a) && groupOf.get(a) === groupOf.get(b) ? ' in-group' : ''}${lineState(a, b)}`}
              />
            ))
          )}
        </svg>
        {people.map((p) => {
          const r = radii.get(p.id) ?? 12
          return (
            <div
              key={p.id}
              data-id={p.id}
              ref={(el) => {
                if (el) nodeEls.current.set(p.id, el)
                else nodeEls.current.delete(p.id)
              }}
              className={`mm-node${state(p.id)}`}
              style={{
                width: discOf(r) * 2,
                height: discOf(r) * 2,
                margin: -discOf(r),
                fontSize: r * 0.62,
                ['--dot' as string]: `${(3 + r * 0.14) * 2}px`,
              }}
            >
              <b>{initials(p.name)}</b>
            </div>
          )
        })}
      </div>

      {person && (
        <div ref={labelRef} className="mm-label" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="mm-label-open" onClick={() => onView?.(person.id)} aria-label={`View ${person.name}`}>
            <Avatar id={person.id} className="avatar-sm" />
            <span>
              <strong>{person.name}</strong>
              <small>{[person.profession, person.livesNow.city].filter((x) => x && x !== 'Unknown').join(' · ')}</small>
            </span>
            <ChevronRightIcon size={19} />
          </button>
        </div>
      )}

    </div>
  )
}
