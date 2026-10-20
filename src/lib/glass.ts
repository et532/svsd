import { useEffect, type RefObject } from 'react'

// Figma's "Glass" effect, as on the Nav pill (node 248:2181): refraction 0.8, depth 20, dispersion 0.5, frost 0
// (light -45° / 0.8 is the rim highlight in CSS, `.glass` in index.css). The browser has no such effect, so it's an
// SVG filter used as a `backdrop-filter`: a displacement map shaped like the element bends what's behind it within
// `DEPTH` px of the edge (stronger toward the edge, like the rim of a lens), and the red / green / blue channels are
// bent by slightly different amounts for the dispersion. One filter per size + corner radius, shared.
// Every white card and button gets it: whatever matches GLASS_SELECTOR inside the phone (keep it in step with the
// matching rule at the end of index.css).
// SVG backdrop filters only work in Chromium browsers (Chrome, Edge); elsewhere the element just shows its fill.

const REFRACTION = 0.8
const DEPTH = 20
const DISPERSION = 0.5

const supported = typeof navigator !== 'undefined' && /Chrome\/|Edg\//.test(navigator.userAgent)
const made = new Set<string>()
let defs: SVGDefsElement | null = null
const SVG = 'http://www.w3.org/2000/svg'

// R / G hold the sideways / up-down shift (0.5 = none), pointing inward, eased in over DEPTH px from the edge.
function displacementMap(w: number, h: number, r: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const hx = w / 2
  const hy = h / 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hx
      const py = y + 0.5 - hy
      const qx = Math.abs(px) - (hx - r)
      const qy = Math.abs(py) - (hy - r)
      let nx = 0
      let ny = 0
      let inside: number // distance in from the edge
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy)
        inside = r - len
        nx = (qx / (len || 1)) * Math.sign(px)
        ny = (qy / (len || 1)) * Math.sign(py)
      } else if (qx > qy) {
        inside = r - qx
        nx = Math.sign(px)
      } else {
        inside = r - qy
        ny = Math.sign(py)
      }
      const t = inside >= 0 && inside < DEPTH ? 1 - inside / DEPTH : 0
      const m = t * t
      const i = (y * w + x) * 4
      img.data[i] = 128 - nx * m * 127
      img.data[i + 1] = 128 - ny * m * 127
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

// `frost` is Figma's Glass frost (a blur of what's behind, before it's bent); 0 = none.
function filterFor(w: number, h: number, r: number, frost = 0) {
  const id = `glass-${w}x${h}r${r}${frost ? `f${frost}` : ''}`
  if (made.has(id)) return id
  if (!defs) {
    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden')
    defs = document.createElementNS(SVG, 'defs')
    svg.appendChild(defs)
    document.body.appendChild(svg)
  }
  // Largest shift in px: refraction × depth, halved (feDisplacementMap moves by scale × (channel − 0.5))
  const scale = REFRACTION * DEPTH
  const spread = DISPERSION * 0.25
  const channel = (scaleBy: number, keep: string, name: string) => `
    <feDisplacementMap in="source" in2="map" scale="${scale * scaleBy}" xChannelSelector="R" yChannelSelector="G" result="${name}d" />
    <feColorMatrix in="${name}d" type="matrix" values="${keep} 0 0 0 1 0" result="${name}" />`
  const filter = document.createElementNS(SVG, 'filter')
  filter.setAttribute('id', id)
  filter.setAttribute('x', '0')
  filter.setAttribute('y', '0')
  filter.setAttribute('width', String(w))
  filter.setAttribute('height', String(h))
  filter.setAttribute('filterUnits', 'userSpaceOnUse')
  filter.setAttribute('color-interpolation-filters', 'sRGB')
  filter.innerHTML = `
    ${frost ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${frost / 2}" edgeMode="duplicate" result="source" />` : '<feOffset in="SourceGraphic" result="source" />'}
    <feImage href="${displacementMap(w, h, r)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map" />
    ${channel(1 + spread, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0 ', 'r')}
    ${channel(1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0 ', 'g')}
    ${channel(1 - spread, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0 ', 'b')}
    <feBlend in="r" in2="g" mode="screen" result="rg" />
    <feBlend in="rg" in2="b" mode="screen" />`
  defs.appendChild(filter)
  made.add(id)
  return id
}

// The white cards and buttons that are glass (same list as the `.glass` rule at the end of index.css)
export const GLASS_SELECTOR = [
  '.view-toggle',
  '.filters-button',
  '.filters-menu',
  '.person-row',
  '.mm-label',
  '.ask-pill',
  '.add-button',
  '.ask-filter',
  '.composer',
  '.way',
  '.result-card',
  '.result-action',
  '.profile-card',
  '.profile-list',
  '.profile-place',
  '.moment',
  '.chip:not(.on-dark):not(.is-ghost):not(.is-editing)',
  '.round-button.glass-button',
  '.pill-button.ghost',
  '.profile-bar .round-button',
].join(', ')

function radiusOf(el: HTMLElement, w: number, h: number) {
  const value = getComputedStyle(el).borderTopLeftRadius
  const r = value.endsWith('%') ? (parseFloat(value) / 100) * Math.min(w, h) : parseFloat(value) || 0
  return Math.min(r, w / 2, h / 2)
}

function glassify(el: HTMLElement) {
  // Nothing inside another glass card is glass (tags on the summary card, a result's Draft a message button): those
  // keep their own style (the CSS rule leaves them out too).
  if (el.parentElement?.closest(GLASS_SELECTOR)) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  if (!w || !h) return
  // An element can ask for Figma's frost with --glass-frost (e.g. the Filters menu: 12)
  const frost = parseFloat(getComputedStyle(el).getPropertyValue('--glass-frost')) || 0
  const id = filterFor(w, h, Math.round(radiusOf(el, w, h)), frost)
  el.style.setProperty('backdrop-filter', `url(#${id})`)
  el.style.setProperty('-webkit-backdrop-filter', `url(#${id})`)
}

// Keeps every GLASS_SELECTOR element inside `root` glassy: the ones there now, ones added later, and on resize.
export function useGlassEverywhere(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el || !supported) return
    const sizes = new ResizeObserver((entries) => entries.forEach((e) => glassify(e.target as HTMLElement)))
    const seen = new WeakSet<Element>()
    const scan = (node: ParentNode) => {
      const found = [...(node instanceof Element && node.matches(GLASS_SELECTOR) ? [node] : []), ...node.querySelectorAll(GLASS_SELECTOR)]
      for (const f of found) {
        if (seen.has(f)) continue
        seen.add(f)
        sizes.observe(f)
        glassify(f as HTMLElement)
      }
    }
    scan(el)
    const added = new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) scan(n)
    })
    added.observe(el, { childList: true, subtree: true })
    return () => {
      added.disconnect()
      sizes.disconnect()
    }
  }, [root])
}
