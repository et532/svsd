import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Voice in Brave / Firefox: the mic is recorded and OpenAI listens (words stream in; after Stop the whole recording is
// transcribed once more). There is no microphone here, so the browser pieces are faked: an audio context that hands
// over audio, a mic stream, a WebSocket to OpenAI and the server's /api/ai answers.

type Msg = Record<string, unknown>
const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0))
}

class FakeSocket {
  static OPEN = 1
  static all: FakeSocket[] = []
  readyState = 0
  sent: Msg[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  constructor(public url: string, public protocols: string[]) {
    FakeSocket.all.push(this)
    queueMicrotask(() => {
      this.readyState = 1
      this.onopen?.()
    })
  }
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.readyState = 3
  }
  say(msg: Msg) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
}

type Proc = { onaudioprocess: ((e: unknown) => void) | null }
const procs: Proc[] = []
class FakeAudioContext {
  destination = {}
  constructor(public opts?: { sampleRate?: number }) {}
  get sampleRate() {
    return this.opts?.sampleRate ?? 48000
  }
  createMediaStreamSource() {
    return { connect: (n: unknown) => n, disconnect() {} }
  }
  createScriptProcessor() {
    const p: Proc & { connect: () => { connect(): void }; disconnect(): void } = { onaudioprocess: null, connect: () => ({ connect() {} }), disconnect() {} }
    procs.push(p)
    return p
  }
  createGain() {
    return { gain: { value: 1 }, connect: () => ({}) }
  }
  close() {
    return Promise.resolve()
  }
}

const speak = (seconds: number) => {
  const chunk = { inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.2) } } // 0.256 s of audio per chunk
  for (let i = 0; i < Math.ceil(seconds / 0.256); i++) procs.at(-1)?.onaudioprocess?.(chunk)
}

// `server`: what /api/ai answers
function setup(server: { ready?: boolean; transcript?: string | null; micDenied?: boolean }) {
  const stopTrack = vi.fn()
  const calls: { url: string; body?: unknown }[] = []
  vi.stubGlobal('window', { location: { search: '' } })
  vi.stubGlobal('navigator', {
    language: 'en-US',
    mediaDevices: { getUserMedia: () => (server.micDenied ? Promise.reject(new Error('denied')) : Promise.resolve({ getTracks: () => [{ stop: stopTrack }] })) },
  })
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('fetch', async (url: string, init?: { body?: unknown }) => {
    calls.push({ url, body: init?.body })
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (url.endsWith('/status')) return json({ ready: server.ready ?? true })
    if (url.endsWith('/live')) return json({ secret: 'ek_test' })
    if (url.includes('/transcribe')) return server.transcript == null ? json({ error: 'nope' }, 503) : json({ text: server.transcript })
    return json({}, 404)
  })
  return { stopTrack, calls }
}

const run = async () => {
  vi.resetModules()
  const { listen } = await import('../src/lib/speech')
  const text = vi.fn()
  const fail = vi.fn()
  const busy = vi.fn()
  const stop = listen(text, fail, busy, () => ['Jordan Lee', 'Priyanka Raman'])!
  await flush()
  return { stop, text, fail, busy }
}

describe('voice through OpenAI (Brave / Firefox)', () => {
  beforeEach(() => {
    FakeSocket.all = []
    procs.length = 0
  })
  afterEach(() => vi.unstubAllGlobals())

  it('streams words while you talk, then replaces them with the final transcript after Stop', async () => {
    const { calls } = setup({ transcript: 'Met Saoirse Gallagher at the climbing gym.' })
    const { stop, text, fail, busy } = await run()

    // the connection opened at the tap, with the temporary key (never the real one)
    const ws = FakeSocket.all[0]
    expect(ws.url).toContain('realtime')
    expect(ws.protocols).toEqual(['realtime', 'openai-insecure-api-key.ek_test'])

    speak(1.5)
    await flush()
    expect(ws.sent.length).toBeGreaterThan(0)
    expect(ws.sent[0].type).toBe('input_audio_buffer.append')

    ws.say({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'Met Saoirse' })
    ws.say({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: ' Gallagher' })
    expect(text).toHaveBeenLastCalledWith('Met Saoirse Gallagher')

    stop()
    await flush()
    const transcribe = calls.find((c) => c.url.includes('/transcribe'))!
    expect(transcribe.url).toContain('names=Jordan+Lee')
    expect(text).toHaveBeenLastCalledWith('Met Saoirse Gallagher at the climbing gym.')
    expect(busy.mock.calls.map((c) => c[0])).toEqual([true, false])
    expect(fail).not.toHaveBeenCalled()
  })

  it('says voice is unavailable at once, and lets go of the mic, when OpenAI is not set up', async () => {
    const { stopTrack } = setup({ ready: false })
    const { text, fail } = await run()
    expect(fail).toHaveBeenCalledWith('unavailable')
    expect(text).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalled()
  })

  it('keeps the streamed words if the final transcript fails', async () => {
    setup({ transcript: null })
    const { stop, text, fail } = await run()
    speak(1.5)
    await flush()
    FakeSocket.all[0].say({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'Hello there' })
    stop()
    await flush()
    expect(text).toHaveBeenLastCalledWith('Hello there')
    expect(fail).not.toHaveBeenCalled()
  })

  it('says voice is unavailable if nothing was heard and the final transcript fails', async () => {
    setup({ transcript: null })
    const { stop, fail } = await run()
    speak(1.5)
    await flush()
    stop()
    await flush()
    expect(fail).toHaveBeenCalledWith('unavailable')
  })

  it('reports a blocked microphone', async () => {
    setup({ micDenied: true })
    const { fail } = await run()
    expect(fail).toHaveBeenCalledWith('not-allowed')
  })

  it('transcribes nothing when you tap Stop without saying anything', async () => {
    const { calls } = setup({ transcript: 'should not be asked' })
    const { stop, text, busy } = await run()
    stop()
    await flush()
    expect(calls.some((c) => c.url.includes('/transcribe'))).toBe(false)
    expect(text).not.toHaveBeenCalled()
    expect(busy).not.toHaveBeenCalled()
  })
})
