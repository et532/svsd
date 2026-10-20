// The background behind the mindmap and list: the Figma "Aura" in "Disc study · Default" (node 317:13603), four big
// blurred color orbs on the light grey ground, with the light grain under them (index.css). Positions are orb centers and
// sizes are full width / height, in the 393 × 852 phone; the Figma blur (stdDeviation 150) is a CSS blur of 150px.
// On the mindmap the same orbs move to wrap the groups when a filter is on (MindmapScreen), so the colors never change.

export type AuraOrb = { color: string; x: number; y: number; w: number; h: number }

export const AURA_W = 393
export const AURA_H = 852
export const AURA_BLUR = 150

export const AURA: AuraOrb[] = [
  { color: '#d6347f', x: 86, y: 102, w: 414, h: 414 }, // pink, top left
  { color: '#e8c22e', x: 322, y: 294, w: 386, h: 386 }, // yellow, right
  { color: '#2f4fd0', x: 49, y: 487, w: 442, h: 586 }, // blue, left (an ellipse)
  { color: '#ec5a32', x: 269.5, y: 701.5, w: 325, h: 325 }, // orange, bottom right
]
