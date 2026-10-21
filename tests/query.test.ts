import { describe, expect, it } from 'vitest'
import { parseQuery } from '../src/lib/query'

describe('parseQuery', () => {
  it('reads the Bushwick fashion party', () => {
    const c = parseQuery('someone for me to invite to a house party in Bushwick that is like fashion themed')
    expect(c.intent).toBe('plan')
    expect(c.activity?.id).toBe('house-party')
    expect(c.place?.name).toBe('Bushwick')
    expect(c.named).toBe(true)
    expect(c.theme).toEqual(['fashion'])
    expect(c.groups.flat()).toContain('stylist')
    expect(c.contexts.social).toBe(1)
  })
  it('gates an in-person plan to home when no place is named', () => {
    const c = parseQuery('someone to play pickleball with')
    expect(c.intent).toBe('plan')
    expect(c.place?.id).toBe('new-york')
    expect(c.named).toBe(false)
    expect(c.theme).toContain('pickleball')
  })
  it('does not gate a knowledge question', () => {
    const c = parseQuery('who knows about taxes')
    expect(c.intent).toBe('knowledge')
    expect(c.place).toBeUndefined()
    expect(c.theme).toEqual(['taxes'])
  })
  it('reads life stage and place', () => {
    const c = parseQuery('college friends who moved to New York')
    expect(c.stage).toBe('college')
    expect(c.place?.id).toBe('new-york')
    expect(c.theme).toEqual([])
  })
})
