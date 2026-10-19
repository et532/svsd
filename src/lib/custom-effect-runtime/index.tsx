import { useEffect, useRef } from 'react'

// A small stand-in for Figma's shader runtime (its own runtime files weren't available to copy): it gives a
// Figma custom-effect module (setup / render, exported verbatim from the design) a WebGPU canvas and the `frame`
// object it expects, and renders it once, again whenever the canvas resizes, and every frame if the effect is
// animated. Without WebGPU the canvas stays empty and whatever is behind it shows.

type Frame = {
  state: Record<string, unknown>
  params: Record<string, unknown>
  time: number
  output: { format: string; width: number; height: number; physicalWidth: number; physicalHeight: number; createView: () => unknown }
}

type Shader = {
  setup: (device: unknown, frame: Frame) => void
  render: (device: unknown, frame: Frame) => void
  params: Record<string, unknown>
  manifest?: { isAnimated?: boolean }
}

type Gpu = {
  requestAdapter: () => Promise<{ requestDevice: () => Promise<unknown> } | null>
  getPreferredCanvasFormat: () => string
}

type GpuContext = {
  configure: (options: { device: unknown; format: string; alphaMode: string }) => void
  getCurrentTexture: () => { createView: () => unknown }
}

export function ShaderFill({ shader, className }: { shader: Shader; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const gpu = (navigator as Navigator & { gpu?: Gpu }).gpu
    if (!canvas || !gpu) return
    let stopped = false
    let raf = 0
    let observer: ResizeObserver | undefined

    void (async () => {
      const adapter = await gpu.requestAdapter()
      const device = await adapter?.requestDevice()
      const context = canvas.getContext('webgpu') as unknown as GpuContext | null
      if (stopped || !device || !context) return
      const format = gpu.getPreferredCanvasFormat()
      context.configure({ device, format, alphaMode: 'premultiplied' })

      const start = performance.now()
      const frame: Frame = {
        state: {},
        params: shader.params,
        time: 0,
        output: { format, width: 1, height: 1, physicalWidth: 1, physicalHeight: 1, createView: () => context.getCurrentTexture().createView() },
      }
      const size = () => {
        const dpr = window.devicePixelRatio || 1
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
        canvas.width = w
        canvas.height = h
        Object.assign(frame.output, { width: canvas.clientWidth, height: canvas.clientHeight, physicalWidth: w, physicalHeight: h })
      }
      const draw = () => {
        frame.time = (performance.now() - start) / 1000
        shader.render(device, frame)
      }

      size()
      shader.setup(device, frame)
      draw()
      observer = new ResizeObserver(() => {
        size()
        draw()
      })
      observer.observe(canvas)
      if (shader.manifest?.isAnimated) {
        const loop = () => {
          draw()
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      }
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [shader])

  return <canvas ref={canvasRef} className={className} aria-hidden />
}
