import { ShaderFill } from '../lib/custom-effect-runtime'
import { manifest, render, setup } from '../lib/custom-effects/CodeComponentId_3f03519cd6fb9dd0902b984c6179893f45bedc85_7048'

// The background behind the mindmap and list: the Figma mesh gradient "Pastel mesh · Lavender veil" (from the
// "Mindmap · current" frame, node 260:2993; it replaced "Rose and cobalt"), rendered with its own shader and
// parameters, with the same grain as the Add / Find auras on top.
const shader = {
  setup,
  render,
  manifest,
  params: {
    p02: { x: 0, y: 76, color: { r: 0.7960784435272217, g: 0.8274509906768799, b: 0.9539215564727783, a: 1 } },
    p01: { x: 0, y: 39, color: { r: 0.8242353200912476, g: 0.7324705719947815, b: 0.8764705657958984, a: 1 } },
    p21: { x: 58, y: 28, color: { r: 0.8925882577896118, g: 0.8365098237991333, b: 0.9245098233222961, a: 1 } },
    p30: { x: 100, y: 0, color: { r: 0.8535293936729431, g: 0.7770588397979736, b: 0.8970588445663452, a: 1 } },
    p20: { x: 72, y: 0, color: { r: 0.8368627429008484, g: 0.861960768699646, b: 0.9631372690200806, a: 1 } },
    p03: { x: 0, y: 100, color: { r: 0.9121176600456238, g: 0.8662353157997131, b: 0.9382352828979492, a: 1 } },
    tessellation: 128,
    p33: { x: 100, y: 100, color: { r: 0.9803921580314636, g: 0.8588235378265381, b: 0.9098039269447327, a: 1 } },
    p00: { x: 0, y: 0, color: { r: 0.8779411911964417, g: 0.8142156600952148, b: 0.9142156839370728, a: 1 } },
    p23: { x: 68, y: 100, color: { r: 0.8925882577896118, g: 0.8365098237991333, b: 0.9245098233222961, a: 1 } },
    p12: { x: 19, y: 63, color: { r: 0.8437647223472595, g: 0.7621960639953613, b: 0.8901960849761963, a: 1 } },
    p22: { x: 79, y: 66, color: { r: 0.9581961035728455, g: 0.7930195927619934, b: 0.8694902062416077, a: 1 } },
    p32: { x: 100, y: 83, color: { r: 0.8535293936729431, g: 0.7770588397979736, b: 0.8970588445663452, a: 1 } },
    p13: { x: 35, y: 100, color: { r: 0.8666666746139526, g: 0.8901960849761963, b: 0.9843137264251709, a: 1 } },
    p10: { x: 20, y: 0, color: { r: 0.9710588455200195, g: 0.856705904006958, b: 0.9096470475196838, a: 1 } },
    p11: { x: 31, y: 18, color: { r: 0.951764702796936, g: 0.7611764669418335, b: 0.8494117856025696, a: 1 } },
    p31: { x: 100, y: 42, color: { r: 0.7389804124832153, g: 0.7791372537612915, b: 0.941019594669342, a: 1 } },
  },
}

export function MeshBackground() {
  return (
    <div className="main-bg" aria-hidden>
      <ShaderFill className="main-bg-mesh" shader={shader} />
    </div>
  )
}
