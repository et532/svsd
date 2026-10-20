import { ShaderFill } from '../lib/custom-effect-runtime'
import { manifest, render, setup } from '../lib/custom-effects/CodeComponentId_3f03519cd6fb9dd0902b984c6179893f45bedc85_7048'

// The background behind the mindmap and list: the Figma "Pastel mesh · Lavender veil" (node 234:2092), a very pale
// lavender mesh gradient rendered with its own shader and parameters, with the violet noise on top (index.css).
// It replaced a darker rose-and-cobalt mesh.
const shader = {
  setup,
  render,
  manifest,
  params: {
    p02: { x: 0, y: 76, color: { r: 0.8442352414131165, g: 0.8598617315292358, b: 0.9228546023368835, a: 1 } },
    p01: { x: 0, y: 39, color: { r: 0.8260853886604309, g: 0.7609177231788635, b: 0.8631808161735535, a: 1 } },
    p21: { x: 64.58268737792969, y: 34.28630828857422, color: { r: 0.8606287837028503, g: 0.8057180047035217, b: 0.8918856978416443, a: 1 } },
    p30: { x: 100, y: 0, color: { r: 0.7972461581230164, g: 0.7817668318748474, b: 0.8849623799324036, a: 1 } },
    p20: { x: 79.2830810546875, y: 0, color: { r: 0.8973404169082642, g: 0.9110276103019714, b: 0.9662038087844849, a: 1 } },
    p03: { x: 0, y: 100, color: { r: 0.9045523405075073, g: 0.8731101751327515, b: 0.9224501848220825, a: 1 } },
    tessellation: 128,
    p33: { x: 100, y: 100, color: { r: 0.8493673205375671, g: 0.7968875169754028, b: 0.9228390455245972, a: 1 } },
    p00: { x: 0, y: 0, color: { r: 0.8665148019790649, g: 0.8245590925216675, b: 0.890397310256958, a: 1 } },
    p23: { x: 68, y: 100, color: { r: 0.8506765961647034, g: 0.7995964288711548, b: 0.8797529935836792, a: 1 } },
    p12: { x: 30.284364700317383, y: 60.86076354980469, color: { r: 0.8322333693504333, g: 0.7687779068946838, b: 0.8683540225028992, a: 1 } },
    p22: { x: 65.6224136352539, y: 74.61067962646484, color: { r: 0.9246941804885864, g: 0.8613457679748535, b: 0.934440016746521, a: 1 } },
    p32: { x: 100, y: 83, color: { r: 0.8549196720123291, g: 0.811954140663147, b: 0.879377007484436, a: 1 } },
    p13: { x: 35, y: 100, color: { r: 0.7849553823471069, g: 0.811470627784729, b: 0.9175311326980591, a: 1 } },
    p10: { x: 20, y: 0, color: { r: 0.9369857907295227, g: 0.8364141583442688, b: 0.8829750418663025, a: 1 } },
    p11: { x: 38.89922332763672, y: 17.391647338867188, color: { r: 0.9101468920707703, g: 0.8292802572250366, b: 0.9115175008773804, a: 1 } },
    p31: { x: 100, y: 42, color: { r: 0.7899514436721802, g: 0.8133229613304138, b: 0.9075394868850708, a: 1 } },
  },
}

export function MeshBackground() {
  return (
    <div className="main-bg" aria-hidden>
      <ShaderFill className="main-bg-mesh" shader={shader} />
    </div>
  )
}
