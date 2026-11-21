import { createHash, createHmac, randomBytes, timingSafeEqual, X509Certificate } from 'node:crypto'

// Client authentication for the native iOS app (it sends no Origin header, so the web same-site check can't vouch for it).
// Apple App Attest proves a request-signing key lives in a genuine Peepl app on a real device; we then hand out a short
// token (HMAC with APP_TOKEN_SECRET) that every /api/ai/<task> call must carry. Stateless: nothing is stored server side.
// shortcut: a challenge can be reused until it expires (5 min), because we keep no state; the counter-0 and key-hash
// checks mean a replay only re-issues a token for the same device key. Upgrade to a nonce store if that ever matters.

export const TOKEN_TTL_MS = 60 * 60 * 1000
export const CHALLENGE_TTL_MS = 5 * 60 * 1000

// Apple App Attestation Root CA (https://www.apple.com/certificateauthority/Apple_App_Attestation_Root_CA.pem)
const APPLE_ROOT = `-----BEGIN CERTIFICATE-----
MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNa
Fw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlv
biBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9y
bmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdh
NbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9au
Yen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/
MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYw
CgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn
53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijV
oyFraWVIyd/dganmrduC1bmTBGwD
-----END CERTIFICATE-----`

const sha256 = (...parts: Buffer[]) => createHash('sha256').update(Buffer.concat(parts)).digest()
const b64u = (b: Buffer) => b.toString('base64url')
const mac = (secret: string, s: string) => createHmac('sha256', secret).update(s).digest('base64url')
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

// ---- Signed values: "<payload>.<hmac>" ----

function seal(secret: string, payload: string) {
  return `${payload}.${mac(secret, payload)}`
}
function open(secret: string, value: string): string | null {
  const i = value.lastIndexOf('.')
  if (i < 1 || !same(value.slice(i + 1), mac(secret, value.slice(0, i)))) return null
  return value.slice(0, i)
}

export function makeChallenge(secret: string, now = Date.now()): string {
  return seal(secret, `c:${randomBytes(16).toString('base64url')}:${now + CHALLENGE_TTL_MS}`)
}
export function challengeValid(secret: string, challenge: string, now = Date.now()): boolean {
  const p = open(secret, challenge)?.split(':')
  return !!p && p[0] === 'c' && Number(p[2]) > now
}

export function signToken(secret: string, did: string, now = Date.now()): { token: string; exp: number } {
  const exp = now + TOKEN_TTL_MS
  return { token: seal(secret, b64u(Buffer.from(JSON.stringify({ did, exp })))), exp }
}
// The device id the token was issued to, or null when it is forged or expired.
export function verifyToken(secret: string, token: string, now = Date.now()): string | null {
  const p = open(secret, token)
  if (!p) return null
  try {
    const { did, exp } = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as { did?: string; exp?: number }
    return typeof did === 'string' && typeof exp === 'number' && exp > now ? did : null
  } catch {
    return null
  }
}

// ---- Minimal CBOR reader: enough for an attestation object (maps, arrays, byte / text strings, unsigned ints) ----

export function cbor(buf: Buffer): unknown {
  let o = 0
  const item = (): unknown => {
    const b = buf[o++]
    const major = b >> 5
    let n = b & 31
    if (n === 24) n = buf[o++]
    else if (n === 25) { n = buf.readUInt16BE(o); o += 2 }
    else if (n === 26) { n = buf.readUInt32BE(o); o += 4 }
    else if (n > 26) throw new Error('unsupported CBOR')
    switch (major) {
      case 0: return n
      case 2: { const v = buf.subarray(o, o + n); o += n; return v }
      case 3: { const v = buf.toString('utf8', o, o + n); o += n; return v }
      case 4: return Array.from({ length: n }, item)
      case 5: { const m: Record<string, unknown> = {}; for (let i = 0; i < n; i++) { const k = item() as string; m[k] = item() } return m }
      default: throw new Error('unsupported CBOR')
    }
  }
  return item()
}

// ---- Verifying an App Attest attestation (https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server) ----

const NONCE_EXT = Buffer.from('06092a864886f763640802', 'hex') // OID 1.2.840.113635.100.8.2

// Returns the keyId (base64) the attestation vouches for, or throws.
export function verifyAttestation(opts: { attestation: Buffer; challenge: string; keyId: string; appId: string; now?: number; root?: string }): void {
  const { attestation, challenge, keyId, appId } = opts
  const now = opts.now ?? Date.now()
  const att = cbor(attestation) as { fmt?: string; attStmt?: { x5c?: Buffer[] }; authData?: Buffer }
  const authData = att.authData
  const x5c = att.attStmt?.x5c
  if (att.fmt !== 'apple-appattest' || !authData || !x5c || x5c.length < 2) throw new Error('bad attestation')

  // 1. chain: leaf <- intermediate <- Apple root
  const root = new X509Certificate(opts.root ?? APPLE_ROOT)
  const [leaf, inter] = [new X509Certificate(x5c[0]), new X509Certificate(x5c[1])]
  const t = new Date(now)
  for (const c of [leaf, inter, root]) if (t < new Date(c.validFrom) || t > new Date(c.validTo)) throw new Error('certificate expired')
  if (!leaf.verify(inter.publicKey) || !inter.verify(root.publicKey)) throw new Error('bad certificate chain')

  // 2. nonce = SHA256(authData || SHA256(challenge)) must be the one inside the leaf certificate
  const nonce = sha256(authData, sha256(Buffer.from(challenge)))
  const at = leaf.raw.indexOf(NONCE_EXT)
  const inCert = at < 0 ? null : leaf.raw.subarray(leaf.raw.indexOf(Buffer.from('3024a1220420', 'hex'), at) + 6).subarray(0, 32)
  if (!inCert || !inCert.equals(nonce)) throw new Error('bad nonce')

  // 3. key id = SHA256 of the leaf's public key (uncompressed point)
  const jwk = leaf.publicKey.export({ format: 'jwk' }) as { x: string; y: string }
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')])
  const id = sha256(pub)
  if (!id.equals(Buffer.from(keyId, 'base64'))) throw new Error('key id mismatch')

  // 4. authData: rpIdHash = SHA256(app id), counter 0, credentialId = key id
  if (!authData.subarray(0, 32).equals(sha256(Buffer.from(appId)))) throw new Error('wrong app')
  if (authData.readUInt32BE(33) !== 0) throw new Error('counter not zero')
  const credLen = authData.readUInt16BE(53)
  if (!authData.subarray(55, 55 + credLen).equals(id)) throw new Error('credential id mismatch')
}
