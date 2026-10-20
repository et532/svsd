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
  setGroups: (groupOf: (id: string) => string) => void
}

const REPEL = 16000
const GRAVITY = 0.006
const GROUP_PULL = 0.07
const GROUP_SPACING = 330
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
    return { a: byId.get(ia)!, b: byId.get(ib)!, strength: 0.05 * (1 + shared), rest: 150 / (1 + 0.5 * shared) }
  })

  let anchors = new Map<string, { x: number; y: number }>()

  const graph: Graph = {
    nodes,
    links,
    alpha: 1,
    setGroups(groupOf) {
      for (const n of nodes) n.group = groupOf(n.id)
      // Biggest groups sit near the middle; the rest spiral outward so territories don't overlap.
      const size = new Map<string, number>()
      for (const n of nodes) if (n.group) size.set(n.group, (size.get(n.group) ?? 0) + 1)
      const names = [...size.keys()].sort((a, b) => size.get(b)! - size.get(a)!)
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
        const pull = anchor ? GROUP_PULL : GRAVITY
        n.vx += ((anchor?.x ?? 0) - n.x) * pull * a
        n.vy += ((anchor?.y ?? 0) - n.y) * pull * a
        if (n.pinned) {
          n.vx = n.vy = 0
          continue
        }
        n.vx *= 0.6
        n.vy *= 0.6
        n.x += n.vx
        n.y += n.vy
      }
      graph.alpha = Math.max(graph.alpha * 0.985, 0)
    },
  }
  return graph
}
