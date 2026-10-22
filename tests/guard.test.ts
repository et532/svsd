import { describe, expect, it } from 'vitest'
import { crossSite, rateLimited } from '../server/ai'

// The deployed site is public: the AI endpoint must not be open to other websites or to a script hammering it.
describe('AI endpoint guards', () => {
  it('refuses requests a browser sent from another site, allows our own pages and plain scripts', () => {
    expect(crossSite({ 'sec-fetch-site': 'cross-site', host: 'peepl.vercel.app' })).toBe(true)
    expect(crossSite({ origin: 'https://evil.example', host: 'peepl.vercel.app' })).toBe(true)
    expect(crossSite({ origin: 'not a url', host: 'peepl.vercel.app' })).toBe(true)
    expect(crossSite({ 'sec-fetch-site': 'same-origin', origin: 'https://peepl.vercel.app', host: 'peepl.vercel.app' })).toBe(false)
    expect(crossSite({ origin: 'https://peepl.vercel.app', 'x-forwarded-host': 'peepl.vercel.app', host: 'internal' })).toBe(false)
    expect(crossSite({ host: 'localhost:5173' })).toBe(false) // curl sends neither header
  })

  it('lets one visitor make a normal number of calls, then asks them to wait, and frees them later', () => {
    const t0 = 1_000_000
    for (let i = 0; i < 15; i++) expect(rateLimited('1.2.3.4', 'live', t0 + i)).toBe(0)
    const wait = rateLimited('1.2.3.4', 'live', t0 + 20)
    expect(wait).toBeGreaterThan(0)
    expect(wait).toBeLessThanOrEqual(600)
    expect(rateLimited('5.6.7.8', 'live', t0 + 20)).toBe(0) // someone else is unaffected
    expect(rateLimited('1.2.3.4', 'parse', t0 + 20)).toBe(0) // and other tasks have their own count
    expect(rateLimited('1.2.3.4', 'live', t0 + 11 * 60 * 1000)).toBe(0) // after 10 minutes it is free again
  })
})
