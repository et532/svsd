import { useEffect, useMemo, useRef, useState } from 'react'
import type { Person } from '../data/people'
import { createGraph, type Graph } from '../lib/forceGraph'
import { auraDepth, initials, linksOf, momentsOf } from '../lib/people'
import type { ColorBy } from '../lib/mindmapColors'
import type { GroupBy } from '../components/TopControls'
import { Avatar } from '../components/Avatar'
import { ChevronRightIcon } from '../components/Icons'
import { AURA, AURA_BLUR, AURA_H, AURA_W } from '../lib/aura'
import { getInitialsAt, initialsOpacity, onInitialsAt, setFitZoom } from '../lib/initialsAt'


// Grouping (by city / met at / job), chosen in the Filters menu at the top right. The background orbs wrap the groups.
const groupValue: Record<GroupBy, (p: Person) => string> = {
  none: () => '',
  city: (p) => p.livesNow.city,
  met: (p) => p.met.city,
  job: (p) => p.profession,
}

// The background orbs (lib/aura.ts) are drawn as a 400px circle placed and scaled with transform. Their blur is set at
// that base size, so on screen it scales with the orb: at home it's the Figma 150px. Around a group it follows the Figma
// "Disc study · Grouped by context" (node 317:13760): an oval about the size of the group, blurred by about a third of
// its size (Figma blur 50 on a ~160px shape), so it's soft and fades smoothly into the ground.
const ORB = 400
const GROUP_BLUR = 130 // at the base size, about a third of the orb
// The oval's sides: GROUP_SPREAD × the group's spread (standard deviation of its people), plus GROUP_PAD so the color
// reaches past their discs, at least GROUP_MIN (so small, tight groups still get a generous aura). World px.
const GROUP_SPREAD = 3
const GROUP_PAD = 170
const GROUP_MIN = 280
// Every member's disc must sit inside this share of the oval, where the blurred color is still clearly there
const GROUP_COVER = 0.85
// People who'd be alone in their group share this one (placed last, on the outside)
const OTHER = 'Other'
const BLEND_MS = 1100 // orbs easing between the background and the groups
type OrbState = { x: number; y: number; w: number; h: number; blur: number; op: number }
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const mix = (a: OrbState, b: OrbState, t: number): OrbState => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
  blur: a.blur + (b.blur - a.blur) * t,
  op: a.op + (b.op - a.op) * t,
})
// An orb's own spot in the background, for a screen this size (orbs past the four are spares for extra groups)
const homeOf = (i: number, w: number, h: number): OrbState => {
  const o = AURA[i % AURA.length]
  const s = w / AURA_W
  return { x: o.x * s, y: (o.y * h) / AURA_H, w: o.w * s, h: o.h * s, blur: (AURA_BLUR * ORB) / (Math.sqrt(o.w * o.h) * s), op: i < AURA.length ? 1 : 0 }
}

// The more you've interacted with someone (moments logged + how close you are), the bigger their dot.
// Three sizes, as the Figma "Disc study" (node 317:13363): ranked by interaction, the top ~22% are large, the next ~45%
// medium, the rest small, so the sizes stay varied however the scores bunch up. r 8 / 19.2 / 32 gives discs 48 / 76 /
// 108 across with dots 9 / 12 / 16 (discOf, dotOf).
const interactionOf = (p: Person) => momentsOf(p).length + auraDepth(p.id)
const TIER_R = [8, 19.2, 32]
const radiiOf = (people: Person[]) => {
  const ranked = [...people].sort((a, b) => interactionOf(b) - interactionOf(a) || a.id.localeCompare(b.id))
  const n = ranked.length
  return new Map(ranked.map((p, i) => [p.id, TIER_R[i < n * 0.22 ? 2 : i < n * 0.67 ? 1 : 0]]))
}
// Zoomed out past this, dragging anywhere pans the map instead of moving a person.
const GRAB_ZOOM = 0.6
// Disc (halo) radius for a person, from their interaction size r: 24px for the least up to ~54px.
const discOf = (r: number) => 14 + r * 1.25
// The white dot's radius inside the disc: 4.4 / 6 / 8 for the three sizes.
const dotOf = (r: number) => 3.2 + r * 0.15
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
  // Set by Prototype when the mindmap is serving as the Connections list's background: keep the grouped auras in place
  // but dim them 30% and fade the discs / labels / links away.
  asBackground?: boolean
}

export function MindmapScreen({ people, focusId = null, onView, groupBy = 'none', ink = false, asBackground = false }: Props) {
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
  // Smooth wheel zoom: ticks accumulate a target scale (`k`) that the view eases toward each frame, around the world
  // point under the cursor (`wx`/`wy`) kept pinned at the cursor's screen point (`px`/`py`). `raf` = active glide.
  const wheelZoom = useRef({ k: 0, px: 0, py: 0, wx: 0, wy: 0, raf: 0 })
  // Background orbs: their elements, where each was last drawn, where the current blend started, and which group each
  // one wraps (null = none: it fades out so the grey ground shows)
  const orbEls = useRef<(HTMLElement | null)[]>([])
  const orbs = useRef({ cur: [] as OrbState[], from: [] as OrbState[], t0: 0, dur: 0, groupFor: [] as (string | null)[], raf: 0 })
  const focusRef = useRef<string | null>(null)
  const groupByRef = useRef(groupBy)
  const asBgRef = useRef(asBackground)
  // Once the screen has faded in (or was already showing as the list's background), it must not fade in again: coming
  // back from the Connections list would replay the fade from transparent and flash the still aura underneath.
  const [settled, setSettled] = useState(asBackground)
  if (asBackground && !settled) setSettled(true) // left for the list before the first fade-in finished
  asBgRef.current = asBackground

  const links = useMemo(() => linksOf(people), [people])
  const radii = useMemo(() => radiiOf(people), [people])
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

  // Who is in which group. Everyone who'd be alone in theirs goes into one "Other" group, so every dot sits on an aura
  // (a lone dot on the bare grey ground was hard to see).
  const { groupOf, groups } = useMemo(() => {
    if (groupBy === 'none') return { groupOf: new Map<string, string>(), groups: [] as string[] }
    const count = new Map<string, number>()
    for (const p of people) count.set(groupValue[groupBy](p), (count.get(groupValue[groupBy](p)) ?? 0) + 1)
    const of = new Map(people.map((p) => [p.id, count.get(groupValue[groupBy](p))! > 1 ? groupValue[groupBy](p) : OTHER]))
    const names = [...count].filter(([g, n]) => g && n > 1).sort((a, b) => b[1] - a[1]).map(([g]) => g)
    if ([...of.values()].includes(OTHER)) names.push(OTHER)
    return { groupOf: of, groups: names }
  }, [people, groupBy])

  selectedRef.current = selected
  inkRef.current = ink
  depthRef.current = depth
  focusRef.current = focus
  groupByRef.current = groupBy
  const orbCount = Math.max(AURA.length, groups.length)

  // Entering / leaving background mode: redraw so the orbs pick up (or drop) the 30% dim.
  useEffect(() => {
    drawRef.current()
  }, [asBackground])

  // Build the simulation whenever the people or the grouping change; keep existing positions.
  useEffect(() => {
    const prev = new Map(graphRef.current?.nodes.map((n) => [n.id, { x: n.x, y: n.y }]))
    const graph = createGraph(
      people.map((p) => p.id),
      links,
      prev,
    )
    graphRef.current = graph
    graph.setGroups((id) => groupOf.get(id) ?? '', OTHER)
    touched.current = false

    // Hand each group the nearest free orb (from where its people are now), then blend the orbs from where they are
    // to their new places.
    {
      const root = rootRef.current
      const w = root?.clientWidth ?? AURA_W
      const h = root?.clientHeight ?? AURA_H
      const { x: vx, y: vy, k: vk } = view.current
      const sum = new Map<string, number[]>()
      for (const n of graph.nodes) {
        if (!n.group) continue
        const c = sum.get(n.group) ?? [0, 0, 0]
        sum.set(n.group, [c[0] + n.x, c[1] + n.y, c[2] + 1])
      }
      const count = Math.max(AURA.length, sum.size)
      const free = new Set(Array.from({ length: count }, (_, i) => i))
      const groupFor: (string | null)[] = Array(count).fill(null)
      for (const [g, [sx, sy, c]] of [...sum].sort((a, b) => b[1][2] - a[1][2])) {
        const gx = w / 2 + vx + (sx / c) * vk
        const gy = h / 2 + vy + (sy / c) * vk
        let best = -1
        let bestD = Infinity
        for (const i of free) {
          const o = homeOf(i, w, h)
          const dist = Math.hypot(o.x - gx, o.y - gy)
          if (dist < bestD) [best, bestD] = [i, dist]
        }
        free.delete(best)
        groupFor[best] = g
      }
      const o = orbs.current
      o.groupFor = groupFor
      o.from = o.cur.slice()
      o.t0 = performance.now()
      o.dur = o.cur.length && !reduceMotion() ? BLEND_MS : 0
    }

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
        worldRef.current.style.setProperty('--k', String(k))
        // Initials fade in (and the dots out) as you zoom in, from where the side panel says (lib/initialsAt)
        const fitK = fit().k
        setFitZoom(fitK)
        worldRef.current.style.setProperty('--ini', initialsOpacity(k, getInitialsAt().t, fitK).toFixed(3))
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
      // Each group's middle (mean of its members) and oval. The spread (standard deviation along x and y) sets the oval's
      // usual size and shape; then it grows, keeping its shape, until every member's whole disc sits inside GROUP_COVER of
      // it, so every dot is on its aura.
      const sums = new Map<string, number[]>()
      for (const n of graph.nodes) {
        if (!n.group) continue
        const c = sums.get(n.group) ?? [0, 0, 0, 0, 0]
        sums.set(n.group, [c[0] + n.x, c[1] + n.y, c[2] + n.x * n.x, c[3] + n.y * n.y, c[4] + 1])
      }
      const spread = new Map<string, { cx: number; cy: number; w: number; h: number }>()
      for (const [g, [sx, sy, sxx, syy, c]] of sums) {
        const cx = sx / c
        const cy = sy / c
        const w = Math.max(GROUP_MIN, Math.sqrt(Math.max(0, sxx / c - cx * cx)) * GROUP_SPREAD + GROUP_PAD)
        const h = Math.max(GROUP_MIN, Math.sqrt(Math.max(0, syy / c - cy * cy)) * GROUP_SPREAD + GROUP_PAD)
        spread.set(g, { cx, cy, w, h })
      }
      const grow = new Map<string, number>()
      for (const n of graph.nodes) {
        const b = spread.get(n.group)
        if (!b) continue
        const disc = discOf(radiiRef.current.get(n.id) ?? 12)
        const out = Math.hypot((Math.abs(n.x - b.cx) + disc) / (b.w / 2), (Math.abs(n.y - b.cy) + disc) / (b.h / 2)) / GROUP_COVER
        grow.set(n.group, Math.max(grow.get(n.group) ?? 1, out))
      }
      for (const [g, f] of grow) {
        const b = spread.get(g)!
        b.w *= f
        b.h *= f
      }
      // Each group's name sits in its middle.
      for (const [g, { cx, cy }] of spread) {
        const el = turfEls.current.get(g)
        if (!el) continue
        el.style.width = el.style.height = '400px' // just a box to center the name in
        el.style.transform = `translate(${cx - 200}px, ${cy - 200}px)`
      }
      // The background orbs: at home when nothing's grouped; around their group (in the world, so they zoom with it)
      // when something is, a soft oval hugging the group; spare ones fade out. Eases between the two after the grouping changes.
      const rootEl = rootRef.current
      if (rootEl) {
        const w = rootEl.clientWidth
        const h = rootEl.clientHeight
        const o = orbs.current
        const t = o.dur ? Math.min(1, (performance.now() - o.t0) / o.dur) : 1
        orbEls.current.forEach((el, i) => {
          if (!el) return
          const home = homeOf(i, w, h)
          const g = o.groupFor[i]
          const b = g ? spread.get(g) : undefined
          let target: OrbState = groupByRef.current === 'none' ? home : { ...home, w: home.w * 0.6, h: home.h * 0.6, op: 0 }
          if (b) {
            const ow = b.w * k
            const oh = b.h * k
            const f = focusRef.current
            target = { x: w / 2 + x + b.cx * k, y: h / 2 + y + b.cy * k, w: ow, h: oh, blur: GROUP_BLUR, op: f && f !== g ? 0.3 : 1 }
          }
          const s = o.from[i] && t < 1 ? mix(o.from[i], target, ease(t)) : target
          o.cur[i] = s
          el.style.transform = `translate(${s.x - ORB / 2}px, ${s.y - ORB / 2}px) scale(${s.w / ORB}, ${s.h / ORB})`
          el.style.filter = `blur(${s.blur.toFixed(1)}px)`
          // As the list's background the colored auras carry over 30% dimmer than on the mindmap.
          el.style.opacity = (s.op * (asBgRef.current ? 0.7 : 1)).toFixed(3)
        })
        if (t < 1 && !o.raf)
          o.raf = requestAnimationFrame(() => {
            o.raf = 0
            drawRef.current()
          })
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

  useEffect(() => drawRef.current(), [selected, ink, focus])
  // Redraw when the side panel's "initials appear" slider moves
  useEffect(() => {
    let t = getInitialsAt().t
    return onInitialsAt(() => {
      if (getInitialsAt().t === t) return
      t = getInitialsAt().t
      drawRef.current()
    })
  }, [])

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
    cancelAnimationFrame(wheelZoom.current.raf)
    wheelZoom.current.raf = 0
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
    cancelAnimationFrame(wheelZoom.current.raf)
    wheelZoom.current.raf = 0
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

  // React's onWheel is passive, so attach the wheel listener by hand to stop the page scrolling. Each notch feeds a
  // target scale that the view glides toward every frame (eased), so zooming reads as one smooth motion instead of a
  // stair-step per notch; the world point under the cursor stays pinned while it changes.
  useEffect(() => {
    const el = rootRef.current!
    const z = wheelZoom.current
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const root = el.getBoundingClientRect()
      const v = view.current
      const lo = minK()
      z.px = e.clientX - root.left - root.width / 2
      z.py = e.clientY - root.top - root.height / 2
      if (!z.raf) z.k = v.k // not already gliding: start accumulating from where the view is now
      z.wx = (z.px - v.x) / v.k // the world point under the cursor, kept fixed as k changes
      z.wy = (z.py - v.y) / v.k
      // Faster per notch; past a limit only a fraction of the scroll counts and the stretch is capped
      let factor = Math.exp(-e.deltaY * 0.0075)
      if ((z.k <= lo && factor < 1) || (z.k >= MAX_K && factor > 1)) factor = Math.pow(factor, 0.3)
      z.k = Math.min(MAX_K * 1.25, Math.max(lo * 0.7, z.k * factor))
      // The wheel has no "let go", so spring back once it pauses
      clearTimeout(settleTimer.current)
      settleTimer.current = window.setTimeout(settle, 140)
      if (reduceMotion()) {
        cancelAnimationFrame(flight.current)
        v.k = z.k
        v.x = z.px - z.wx * z.k
        v.y = z.py - z.wy * z.k
        touched.current = true
        drawRef.current()
        return
      }
      if (!z.raf) {
        cancelAnimationFrame(flight.current) // take over from any fly / settle glide
        const glide = () => {
          const vv = view.current
          vv.k += (z.k - vv.k) * 0.3
          vv.x = z.px - z.wx * vv.k
          vv.y = z.py - z.wy * vv.k
          touched.current = true
          drawRef.current()
          if (Math.abs(z.k - vv.k) > 0.001) z.raf = requestAnimationFrame(glide)
          else z.raf = 0
        }
        z.raf = requestAnimationFrame(glide)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(z.raf)
      z.raf = 0
    }
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
      className={`screen mindmap-screen${ink ? ' look-ink' : ''}${selected ? ' has-sel' : ''}${focus ? ' has-focus' : ''}${asBackground ? ' as-bg' : ''}${settled ? ' is-settled' : ''}`}
      onAnimationEnd={(e) => e.target === e.currentTarget && setSettled(true)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="aura-bg mm-aura" aria-hidden>
        {Array.from({ length: orbCount }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              orbEls.current[i] = el
            }}
            className="mm-aura-orb"
            style={{ background: AURA[i % AURA.length].color, opacity: 0 }}
          />
        ))}
      </div>
      <div ref={worldRef} className="mm-world">
        {groups.map((g) => (
          <div
            key={g}
            ref={(el) => {
              if (el) turfEls.current.set(g, el)
              else turfEls.current.delete(g)
            }}
            className={`mm-turf${focus === g ? ' is-focus' : ''}`}
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
                className={`mm-line${groupOf.get(a) && groupOf.get(a) !== OTHER && groupOf.get(a) === groupOf.get(b) ? ' in-group' : ''}${lineState(a, b)}`}
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
                fontSize: r * 0.75, // Geist SemiBold ~24px on a large disc, as the Figma "Disc study" initials
                ['--dot' as string]: `${dotOf(r) * 2}px`,
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
