// A tiny force-directed layout (no React, no dependency). Positions are in world units around (0, 0).
// Links pull people together; a link with many mutual neighbors pulls harder and sits shorter,
// so densely linked groups clump tighter than a sparse chain.

export type GNode = {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  group: string // '' = ungrouped
  pinned: boolean
  degree: number
}

type GLink = { a: GNode; b: GNode; strength: number; rest: number }

export type Graph = {
  nodes: GNode[]
  links: GLink[]
  alpha: number
  step: () => void
  setGroups: (groupOf: (id: string) => string, last?: string) => void
}

const REPEL = 60000
const GROUP_PULL = 0.07
const GROUP_SPACING = 330
const COMP_SPACING = 85 // px of map radius per √person: how far apart the separate circles of people sit
const COMP_PULL = 0.012
const LONER_PULL = 0.05
// While grouped, a link between two different groups pulls this much as hard, so groups made by place met or job (whose
// people know people in other groups) stay together instead of being stretched across the map.
const CROSS_GROUP = 0.2

export function createGraph(ids: string[], pairs: [string, string][], prev?: Map<string, { x: number; y: number }>): Graph {
  const nodes: GNode[] = ids.map((id, i) => {
    const old = prev?.get(id)
    const angle = i * 2.4 // spread new nodes on a spiral
    const r = 20 + i * 6
    return { id, x: old?.x ?? Math.cos(angle) * r, y: old?.y ?? Math.sin(angle) * r, vx: 0, vy: 0, group: '', pinned: false, degree: 0 }
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const neighbors = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]))
  for (const [a, b] of pairs) {
    neighbors.get(a)?.add(b)
    neighbors.get(b)?.add(a)
  }
  for (const n of nodes) n.degree = neighbors.get(n.id)!.size

  const links: GLink[] = pairs.map(([ia, ib]) => {
    let shared = 0
    for (const x of neighbors.get(ia)!) if (neighbors.get(ib)!.has(x)) shared++
    return { a: byId.get(ia)!, b: byId.get(ib)!, strength: 0.05 * (1 + shared), rest: 200 / (1 + 0.5 * shared) }
  })

  let anchors = new Map<string, { x: number; y: number }>()

  // Each circle of people who know each other gets its own home on the map (bigger circles nearer the middle), so
  // people from different parts of your life form separate clusters instead of one blob. Used when no Group by is set.
  const parent = new Map(ids.map((id) => [id, id]))
  const root = (id: string): string => (parent.get(id) === id ? id : root(parent.get(id)!))
  for (const [ia, ib] of pairs) parent.set(root(ia), root(ib))
  const compSize = new Map<string, number>()
  for (const id of ids) compSize.set(root(id), (compSize.get(root(id)) ?? 0) + 1)
  const compHome = new Map<string, { x: number; y: number; pull: number }>()
  let placed = 0
  const linked = [...compSize].filter(([, n]) => n > 1).sort((x, y) => y[1] - x[1])
  linked.forEach(([r, n], i) => {
    const d = COMP_SPACING * Math.sqrt(placed + n / 2)
    compHome.set(r, { x: Math.cos(i * 2.4) * d, y: Math.sin(i * 2.4) * d, pull: COMP_PULL })
    placed += n
  })
  // People who know nobody ring the outside of everything, evenly spaced.
  const loners = [...compSize].filter(([, n]) => n === 1)
  const ring = COMP_SPACING * Math.sqrt(placed) + 800
  const inner = ring - 450 // people who know someone stay inside this, so nobody sits outside the loner ring
  loners.forEach(([r], i) => {
    const t = (i / loners.length) * Math.PI * 2
    compHome.set(r, { x: Math.cos(t) * ring, y: Math.sin(t) * ring, pull: LONER_PULL })
  })

  const graph: Graph = {
    nodes,
    links,
    alpha: 1,
    setGroups(groupOf, last) {
      for (const n of nodes) n.group = groupOf(n.id)
      // Biggest groups sit near the middle; the rest spiral outward so territories don't overlap. `last` (the catch-all
      // "Other" group) always goes on the outside.
      const size = new Map<string, number>()
      for (const n of nodes) if (n.group) size.set(n.group, (size.get(n.group) ?? 0) + 1)
      const names = [...size.keys()].sort((a, b) => Number(a === last) - Number(b === last) || size.get(b)! - size.get(a)!)
      anchors = new Map(
        names.map((g, i) => {
          const r = GROUP_SPACING * Math.sqrt(i + 0.5)
          return [g, { x: Math.cos(i * 2.4) * r, y: Math.sin(i * 2.4) * r }]
        }),
      )
      graph.alpha = 1
    },
    step() {
      const a = graph.alpha
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const p = nodes[i]
          const q = nodes[j]
          let dx = q.x - p.x
          let dy = q.y - p.y
          let d2 = dx * dx + dy * dy
          if (d2 < 1) {
            dx = Math.random() - 0.5
            dy = Math.random() - 0.5
            d2 = 1
          }
          if (d2 > 640000) continue // too far apart to matter; keeps 200+ people fast
          const f = (REPEL / d2) * a
          const d = Math.sqrt(d2)
          p.vx -= (dx / d) * f
          p.vy -= (dy / d) * f
          q.vx += (dx / d) * f
          q.vy += (dy / d) * f
        }
      for (const { a: p, b: q, strength, rest } of links) {
        const dx = q.x - p.x
        const dy = q.y - p.y
        const d = Math.hypot(dx, dy) || 1
        const cross = p.group && q.group && p.group !== q.group ? CROSS_GROUP : 1
        const f = ((d - rest) / d) * strength * cross * a
        p.vx += dx * f
        p.vy += dy * f
        q.vx -= dx * f
        q.vy -= dy * f
      }
      for (const n of nodes) {
        const anchor = anchors.get(n.group)
        const home = anchor ?? compHome.get(root(n.id))!
        const pull = anchor ? GROUP_PULL : compHome.get(root(n.id))!.pull
        n.vx += (home.x - n.x) * pull * a
        n.vy += (home.y - n.y) * pull * a
        if (n.pinned) {
          n.vx = n.vy = 0
          continue
        }
        n.vx *= 0.6
        n.vy *= 0.6
        n.x += n.vx
        n.y += n.vy
        if (!anchors.size && compSize.get(root(n.id))! > 1) {
          const r = Math.hypot(n.x, n.y)
          if (r > inner) {
            n.x *= inner / r
            n.y *= inner / r
          }
        }
      }
      graph.alpha = Math.max(graph.alpha * 0.985, 0)
    },
  }
  return graph
}
