import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { handleAi, type AiEnv } from '../server/ai'
import { CHALLENGE_TTL_MS, TOKEN_TTL_MS, cbor, challengeValid, makeChallenge, signToken, verifyToken } from '../server/appAttest'

const S = 'test-secret'

describe('app tokens', () => {
  it('signs, verifies and expires', () => {
    const t0 = 1_000_000
    const { token, exp } = signToken(S, 'key1', t0)
    expect(exp).toBe(t0 + TOKEN_TTL_MS)
    expect(verifyToken(S, token, t0 + 1000)).toBe('key1')
    expect(verifyToken(S, token, exp)).toBeNull()
    expect(verifyToken('other', token, t0)).toBeNull()
    expect(verifyToken(S, token.replace(/.$/, 'x'), t0)).toBeNull()
    expect(verifyToken(S, 'garbage', t0)).toBeNull()
  })
  it('challenges expire after 5 minutes and cannot be forged', () => {
    const t0 = 5_000_000
    const c = makeChallenge(S, t0)
    expect(challengeValid(S, c, t0 + CHALLENGE_TTL_MS - 1)).toBe(true)
    expect(challengeValid(S, c, t0 + CHALLENGE_TTL_MS + 1)).toBe(false)
    expect(challengeValid('other', c, t0)).toBe(false)
  })
  it('reads CBOR maps, arrays, bytes and text', () => {
    // {"fmt": "x", "a": [1, 300], "b": h'0102'}
    const b = Buffer.from('a363666d74 6178 6161 82 01 19012c 6162 42 0102'.replace(/ /g, ''), 'hex')
    const m = cbor(b) as Record<string, unknown>
    expect(m.fmt).toBe('x')
    expect(m.a).toEqual([1, 300])
    expect(m.b).toEqual(Buffer.from([1, 2]))
  })
})

describe('AI endpoint, native vs web', () => {
  const call = async (env: AiEnv, path: string, headers: Record<string, string> = {}, body: unknown = { text: 'hi' }) => {
    const server = createServer((req, res) => void handleAi(req, res, env))
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    try {
      const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ai/${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
      return { status: r.status, body: await r.json().catch(() => null) }
    } finally {
      server.close()
    }
  }
  // task body 'bad' is rejected with 400 after auth passes, so no OpenAI call is made
  const bad = { nope: 1 }
  const env: AiEnv = { key: 'sk-test', appTokenSecret: S, appleAppId: 'T.com.x' }

  it('401s a native request without a valid token, accepts a good one', async () => {
    expect((await call(env, 'parse', {}, bad)).status).toBe(401)
    expect((await call(env, 'parse', { authorization: 'Bearer nope' }, bad)).status).toBe(401)
    expect((await call(env, 'parse', { authorization: `Bearer ${signToken(S, 'k', Date.now() - TOKEN_TTL_MS - 1).token}` }, bad)).status).toBe(401)
    expect((await call(env, 'parse', { authorization: `Bearer ${signToken(S, 'k').token}` }, bad)).status).toBe(400) // got past auth
  })
  it('keeps web same-site requests working with no token, and still refuses other sites', async () => {
    expect((await call(env, 'parse', { 'sec-fetch-site': 'same-origin' }, bad)).status).toBe(400)
    expect((await call(env, 'parse', { origin: 'https://evil.example' }, bad)).status).toBe(403)
  })
  it('fails closed (503) when APP_TOKEN_SECRET is unset, and the debug token only works when set', async () => {
    expect((await call({ key: 'sk-test' }, 'parse', {}, bad)).status).toBe(503)
    expect((await call({ key: 'sk-test' }, 'attest-challenge')).status).toBe(503)
    const dbg: AiEnv = { key: 'sk-test', debugToken: 'dbg' }
    expect((await call(dbg, 'parse', { authorization: 'Bearer dbg' }, bad)).status).toBe(400)
    expect((await call(dbg, 'parse', { authorization: 'Bearer x' }, bad)).status).toBe(401)
  })
  it('issues a challenge and rejects a bad attestation', async () => {
    const { status, body } = await call(env, 'attest-challenge')
    expect(status).toBe(200)
    expect(challengeValid(S, body.challenge)).toBe(true)
    const a = { keyId: 'AA==', attestation: 'AA==', challenge: body.challenge }
    expect((await call(env, 'attest', {}, a)).status).toBe(401)
    expect((await call(env, 'attest', {}, { ...a, challenge: makeChallenge(S, 1) })).status).toBe(401) // expired
  })
})
