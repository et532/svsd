// node build.mjs -> a-node.svg ... d-peep.svg + sheet.html (contact sheet)
import { writeFileSync } from 'node:fs'
const INK = '#1c1522'
const aura = (id) => `
<defs>
${[['p', 260, 234, 520, '#d6347f'], ['y', 800, 424, 480, '#e8c22e'], ['b', 220, 774, 500, '#2f4fd0'], ['o', 780, 824, 500, '#ec5a32']]
  .map(([k, x, y, r, c]) => `<radialGradient id="${id}${k}" gradientUnits="userSpaceOnUse" cx="${x}" cy="${y}" r="${r}"><stop offset="0" stop-color="${c}" stop-opacity=".85"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('')}
<filter id="${id}s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="#000" flood-opacity=".18"/></filter>
</defs>
<rect width="1024" height="1024" fill="#f4f4f4"/>
${['p', 'y', 'b', 'o'].map((k) => `<rect width="1024" height="1024" fill="url(#${id}${k})"/>`).join('')}`
// a disc: translucent white disc + hairline ring + white dot (the mindmap node)
const node = (id, x, y, r, dotK = 0.3, ring = true) => `
<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity=".72"/>
${ring ? `<circle cx="${x}" cy="${y}" r="${r + 10}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="${Math.max(4, r / 25)}"/>` : ''}
<circle cx="${x}" cy="${y}" r="${r * dotK}" fill="#fff" filter="url(#${id}s)"/>`
const link = (x1, y1, x2, y2, w = 12) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-opacity=".9"/>`
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${body}</svg>\n`

const logos = {
  'a-node': ['Node', 'One person. The mindmap dot in its disc: simple, calm, close to the current icon.',
    svg(aura('a') + node('a', 512, 512, 235))],
  'b-link': ['Link', 'Two people and the link between them: "who do you know, and how".',
    svg(aura('b') + link(390, 430, 660, 630, 14) + node('b', 390, 430, 190, 0.3) + node('b', 665, 635, 125, 0.32))],
  'c-constellation': ['Constellation', 'Your people as the mindmap: a big disc, smaller ones around it, tiers as in the app.',
    svg(aura('c') + [[270, 300], [790, 320], [770, 790], [250, 760]].map(([x, y]) => link(512, 540, x, y, 10)).join('') +
      node('c', 512, 540, 175, 0.3) + node('c', 270, 300, 92, 0.34, false) + node('c', 790, 320, 108, 0.34, false) + node('c', 770, 790, 80, 0.34, false) + node('c', 250, 760, 70, 0.34, false))],
  'd-peep': ['Peep', 'A blob peeking up from the bottom, with two dot eyes. A pun on the name and echoes the Blob club avatars.',
    svg(aura('d') + `<circle cx="512" cy="830" r="330" fill="#fff" fill-opacity=".9" filter="url(#ds)"/><circle cx="395" cy="640" r="34" fill="${INK}"/><circle cx="629" cy="640" r="34" fill="${INK}"/>`)],
}
for (const [k, [, , s]] of Object.entries(logos)) writeFileSync(`${k}.svg`, s)

// contact sheet. Wordmark option E is built in HTML (the e's become the eyes).
const sizes = [180, 120, 60, 29]
const card = ([k, [name, why, s]]) => `
<section><h2>${name}</h2><p>${why}</p>
<div class="row">${sizes.map((z) => `<div class="ic" style="width:${z}px;height:${z}px;border-radius:${z * 0.2237}px">${s.replace('width="1024" height="1024"', 'width="100%" height="100%"')}</div>`).join('')}
<div class="darkbox"><div class="ic" style="width:120px;height:120px;border-radius:27px">${s.replace('width="1024" height="1024"', 'width="100%" height="100%"')}</div></div></div></section>`
const eye = `<span class="eye"><i></i></span>`
writeFileSync('sheet.html', `<!doctype html><meta charset="utf-8"><title>Peepl logo proposals</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<style>
body{margin:0;padding:40px;background:#f4f4f4;font:15px/1.4 Geist,system-ui,sans-serif;color:${INK}}
h1{font-weight:600;letter-spacing:-.04em;font-size:30px;margin:0 0 24px}
h2{font-weight:600;letter-spacing:-.03em;margin:0}p{color:#6b6672;margin:4px 0 14px;max-width:560px}
section{margin-bottom:36px}.row{display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap}
.ic{overflow:hidden;box-shadow:0 2px 10px rgba(60,40,90,.15)}.darkbox{background:#111;padding:24px;border-radius:24px}
.word{font-size:96px;font-weight:600;letter-spacing:-.06em;display:flex;align-items:center;height:110px}
.eye{display:inline-block;width:.56em;height:.56em;margin:0 .01em;border-radius:50%;background:rgba(255,255,255,.8);position:relative;box-shadow:0 0 0 .05em rgba(255,255,255,.7);vertical-align:middle;transform:translateY(.04em)}
.eye i{position:absolute;inset:0;margin:auto;width:.2em;height:.2em;border-radius:50%;background:${INK}}
.wbg{display:inline-block;padding:30px 50px;border-radius:28px;background:radial-gradient(circle at 12% 15%,#d6347f88,transparent 55%),radial-gradient(circle at 90% 35%,#e8c22e88,transparent 50%),radial-gradient(circle at 10% 90%,#2f4fd066,transparent 55%),radial-gradient(circle at 90% 95%,#ec5a3288,transparent 55%),#f4f4f4}
</style>
<h1>Peepl logo proposals</h1>
${Object.entries(logos).map(card).join('')}
<section><h2>Wordmark (for header artwork, not the icon)</h2><p>"peepl" in Geist SemiBold with the two e's as node discs with a dark dot, like eyes. Pairs with the Peep icon.</p>
<div class="wbg"><div class="word">p${eye}${eye}pl</div></div></section>`)
