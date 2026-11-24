// node build-peep.mjs -> peep-1..4.svg + sheet-peep.html (Peep refinements)
import { writeFileSync } from 'node:fs'
const INK = '#1c1522'
const aura = (id) => `<defs>${[['p', 260, 234, 520, '#d6347f'], ['y', 800, 424, 480, '#e8c22e'], ['b', 220, 774, 500, '#2f4fd0'], ['o', 780, 824, 500, '#ec5a32']]
  .map(([k, x, y, r, c]) => `<radialGradient id="${id}${k}" gradientUnits="userSpaceOnUse" cx="${x}" cy="${y}" r="${r}"><stop offset="0" stop-color="${c}" stop-opacity=".85"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('')}
<filter id="${id}s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#2a1a40" flood-opacity=".22"/></filter></defs>
<rect width="1024" height="1024" fill="#f4f4f4"/>${['p', 'y', 'b', 'o'].map((k) => `<rect width="1024" height="1024" fill="url(#${id}${k})"/>`).join('')}`
const dome = (id, d) => `<path d="${d}" fill="#fff" fill-opacity=".92" filter="url(#${id}s)"/>`
const eye = (x, y, r, dx = 0, dy = 0, shine = false) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>${shine ? `<circle cx="${x + r * 0.3 + dx}" cy="${y - r * 0.32 + dy}" r="${r * 0.3}" fill="#fff"/>` : ''}`
const svg = (b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${b}</svg>\n`
const BLOB = 'M130 1040 C130 770 250 545 520 535 C780 528 894 760 894 1040 Z'
const v = {
  'peep-1': ['1 · Circle (as shown)', svg(aura('a') + `<circle cx="512" cy="830" r="330" fill="#fff" fill-opacity=".92" filter="url(#as)"/>` + eye(395, 640, 34) + eye(629, 640, 34))],
  'peep-2': ['2 · Blob dome, bigger eyes', svg(aura('b') + dome('b', BLOB) + eye(400, 690, 46) + eye(636, 690, 46))],
  'peep-3': ['3 · Looking up and right, with a shine', svg(aura('c') + dome('c', BLOB) + eye(410, 685, 50, 0, 0, true) + eye(646, 685, 50, 0, 0, true).replace(/cx="(\d+)"/g, (m) => m))],
  'peep-4': ['4 · Wide-set eyes, tilted head', svg(aura('d') + `<g transform="rotate(-6 512 900)">` + dome('d', BLOB) + eye(380, 700, 44) + eye(656, 700, 44) + `</g>`)],
}
for (const [k, [, s]] of Object.entries(v)) writeFileSync(`${k}.svg`, s)
const sizes = [200, 120, 60, 29]
const big = (s, z) => `<div class="ic" style="width:${z}px;height:${z}px;border-radius:${z * 0.2237}px">${s.replace('width="1024" height="1024"', 'width="100%" height="100%"')}</div>`
writeFileSync('sheet-peep.html', `<!doctype html><meta charset="utf-8"><title>Peep refinements</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600&display=swap" rel="stylesheet">
<style>body{margin:0;padding:36px;background:#f4f4f4;font:15px/1.4 Geist,system-ui;color:${INK}}h1{font-weight:600;letter-spacing:-.04em;font-size:28px;margin:0 0 20px}
h2{font-size:15px;font-weight:600;margin:0 0 10px}section{margin-bottom:28px}.row{display:flex;gap:22px;align-items:flex-end;flex-wrap:wrap}
.ic{flex:none;overflow:hidden;box-shadow:0 2px 10px rgba(60,40,90,.15)}.darkbox{background:#111;padding:20px;border-radius:22px}</style>
<h1>Peep: refinements</h1>
${Object.entries(v).map(([, [n, s]]) => `<section><h2>${n}</h2><div class="row">${sizes.map((z) => big(s, z)).join('')}<div class="darkbox">${big(s, 120)}</div></div></section>`).join('')}`)
