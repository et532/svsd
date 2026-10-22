import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Action } from '../src/lib/ask'
import { samplePeople } from '../src/data/people'

// Without a key the dev server answers 503 and the app must carry on exactly as it did before AI.
describe('AI is optional', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('falls back to the template draft on 503, and stops asking after the first 503', async () => {
    // semantic.ts (imported by ai.ts) reads the page's URL when it loads
    vi.stubGlobal('window', { location: { search: '' } })
    const { ai, aiReady, draftMessage, transcribeWithAi, startAiLive } = await import('../src/lib/ai')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const action: Action = { kind: 'message', label: 'Draft a message', to: 'Dana Reyes', draft: 'Hey Dana! Want to play this week?' }
    expect(await aiReady()).toBe(false) // so the local speech models are the ones to load
    expect(await draftMessage(samplePeople[0], action)).toBe(action.draft)
    expect(await ai('rank', {})).toBeNull()
    expect(await transcribeWithAi(new Float32Array(16000), 16000, [])).toBeNull()
    // the live words just stay quiet (the local ones carry on)
    const heard = vi.fn()
    const live = startAiLive(heard)
    live.feed(new Float32Array(4096))
    live.stop()
    expect(heard).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1) // one 503 (the status check), then it stopped asking
  })
})

describe('toWav', () => {
  it('writes a 16-bit mono WAV the transcription endpoint accepts', async () => {
    vi.stubGlobal('window', { location: { search: '' } })
    const { toWav } = await import('../src/lib/ai')
    const view = new DataView(await toWav(Float32Array.of(0, 1, -1, 0.5), 16000).arrayBuffer())
    const tag = (at: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(at + i)))
    expect([tag(0), tag(8), tag(36)]).toEqual(['RIFF', 'WAVE', 'data'])
    expect(view.getUint32(24, true)).toBe(16000) // sample rate
    expect(view.getUint32(40, true)).toBe(8) // 4 samples x 2 bytes
    expect([view.getInt16(46, true), view.getInt16(48, true)]).toEqual([32767, -32767]) // 1 and -1, clipped to 16 bits
  })
})

describe('pcm24', () => {
  it('turns 16 kHz samples into 24 kHz 16-bit PCM (1.5x the samples, base64)', async () => {
    vi.stubGlobal('window', { location: { search: '' } })
    const { pcm24 } = await import('../src/lib/ai')
    const bytes = Uint8Array.from(atob(pcm24(new Float32Array(160).fill(0.5), 16000)), (c) => c.charCodeAt(0))
    expect(bytes.length).toBe(240 * 2)
    expect(new Int16Array(bytes.buffer)[100]).toBe(16383) // 0.5 stays 0.5
  })
})
