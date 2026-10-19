import { ShaderFill } from '../lib/custom-effect-runtime'
import { manifest, render, setup } from '../lib/custom-effects/CodeComponentId_3f03519cd6fb9dd0902b984c6179893f45bedc85_7048'

// The background behind the mindmap and list: the Figma mesh gradient "Pastel mesh · Rose and cobalt"
// (node 234:2094), rendered with its own shader and parameters, with the same grain as the Add / Find auras on top.
const shader = {
  setup,
  render,
  manifest,
  params: {
    p02: { x: 0, y: 76, color: { r: 0.608470618724823, g: 0.6687058806419373, b: 0.9115294218063354, a: 1 } },
    p01: { x: 0, y: 39, color: { r: 0.951764702796936, g: 0.7611764669418335, b: 0.8494117856025696, a: 1 } },
    p21: { x: 58, y: 28, color: { r: 0.5269019603729248, g: 0.5996862649917603, b: 0.8930980563163757, a: 1 } },
    p30: { x: 100, y: 0, color: { r: 0.608470618724823, g: 0.6687058806419373, b: 0.9115294218063354, a: 1 } },
    p20: { x: 72, y: 0, color: { r: 0.8779411911964417, g: 0.8142156600952148, b: 0.9142156839370728, a: 1 } },
    p03: { x: 0, y: 100, color: { r: 0.4942745268344879, g: 0.5720784664154053, b: 0.8857254981994629, a: 1 } },
    tessellation: 128,
    p33: { x: 100, y: 100, color: { r: 0.9292548894882202, g: 0.6497254967689514, b: 0.7791372537612915, a: 1 } },
    p00: { x: 0, y: 0, color: { r: 0.9196078777313232, g: 0.6019607782363892, b: 0.7490196228027344, a: 1 } },
    p23: { x: 68, y: 100, color: { r: 0.8291176557540894, g: 0.7399019598960876, b: 0.8799019455909729, a: 1 } },
    p12: { x: 19, y: 63, color: { r: 0.7716078162193298, g: 0.8067451119422913, b: 0.9483921527862549, a: 1 } },
    p22: { x: 79, y: 66, color: { r: 0.938901960849762, g: 0.6974902153015137, b: 0.8092548847198486, a: 1 } },
    p32: { x: 100, y: 83, color: { r: 0.9067450761795044, g: 0.5382745265960693, b: 0.7088627219200134, a: 1 } },
    p13: { x: 35, y: 100, color: { r: 0.608470618724823, g: 0.6687058806419373, b: 0.9115294218063354, a: 1 } },
    p10: { x: 20, y: 0, color: { r: 0.8970980644226074, g: 0.4905098080635071, b: 0.6787450909614563, a: 1 } },
    p11: { x: 31, y: 18, color: { r: 0.9260392189025879, g: 0.6338039040565491, b: 0.7690980434417725, a: 1 } },
    p31: { x: 100, y: 42, color: { r: 0.46980392932891846, g: 0.5513725280761719, b: 0.8801960945129395, a: 1 } },
  },
}

export function MeshBackground() {
  return (
    <div className="main-bg" aria-hidden>
      <ShaderFill className="main-bg-mesh" shader={shader} />
    </div>
  )
}
