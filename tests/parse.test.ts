import { describe, expect, it } from 'vitest'
import { draftToPerson, parseFrom, parseLives, parsePerson, voiceScript } from '../src/lib/capture'

const parse = (t: string) => parsePerson(t, [])

describe('parsePerson', () => {
  it('reads a messy "bumped into" note', () => {
    const d = parse(
      "Bumped into Priyanka Raman at a friend's rooftop thing last night. She works at Notion as a PM, grew up in Austin, now in Brooklyn. Super into ceramics and wants to open a studio. Promised to send her the pottery class link.",
    )
    expect(d).toMatchObject({ name: 'Priyanka Raman', company: 'Notion', does: 'PM', from: 'Austin', lives: 'Brooklyn', met: 'rooftop thing' })
    expect(d.remember).toBe('Super into ceramics')
    expect(d.goal).toBe('Wants to open a studio')
  })

  it('keeps the company for other roles', () => {
    const d = parse('Met Jules Marlowe at a climbing gym. Jules is a chef at Nopa.')
    expect(d).toMatchObject({ name: 'Jules Marlowe', company: 'Nopa', met: 'climbing gym' })
    const p = draftToPerson(d, { voice: false, text: '', seconds: 0 }, new Set())
    expect(p.profession).toBe('Chef @ Nopa')
  })

  it('still reads the plain notes', () => {
    expect(parse('Met Riley Brooks at a pickleball meetup. Riley is a designer at Kiln.')).toMatchObject({
      name: 'Riley Brooks',
      company: 'Kiln',
      met: 'pickleball meetup',
    })
    expect(parse(voiceScript)).toMatchObject({ name: 'Jorden Lee', company: 'Voltsel', from: 'Seattle', lives: 'Brooklyn', met: 'Demo Day' })
  })

  // [note, what it must read]. Notes written the way people actually type them.
  const cases: [string, Record<string, string>][] = [
    ["Met Tomás Herrera at Config. He's a product manager at Figma, lives in San Francisco. Loves surfing.", { name: 'Tomás Herrera', company: 'Figma', lives: 'San Francisco', met: 'Config' }],
    ["Ran into Aisha Khan at the farmers market. She's a nurse at Mount Sinai, originally from Chicago. Into hiking and wants to run a marathon.", { name: 'Aisha Khan', company: 'Mount Sinai', from: 'Chicago', met: 'farmers market', remember: 'Into hiking' }],
    ["Had dinner with my cousin Leo Park. He's a software engineer at Google, based in Seattle.", { name: 'Leo Park', company: 'Google', lives: 'Seattle' }],
    ["Spoke with Dr. Elena Rossi at church. She's a doctor at NYU Langone, grew up in Rome.", { name: 'Elena Rossi', company: 'NYU Langone', from: 'Rome', met: 'church' }],
    ['Came across Ben Carter at a house party yesterday. He teaches high school math and plays guitar.', { name: 'Ben Carter', does: 'teacher', met: 'house party', remember: 'plays guitar' }],
    ['Sam from the climbing gym. Really into bouldering, lives in Queens.', { name: 'Sam', met: 'climbing gym', lives: 'Queens' }],
    ["Bumped into Jamal Brown at the gym this morning. He's a barista at Blue Bottle and a big fan of jazz.", { name: 'Jamal Brown', does: 'barista at Blue Bottle', company: 'Blue Bottle', met: 'gym' }],
    ["Met Zoë Müller at a book club. She's a translator at the UN, from Berlin, now in Queens.", { name: 'Zoë Müller', company: 'UN', from: 'Berlin', lives: 'Queens', met: 'book club' }],
    ['Went to a wedding and sat next to Marcus Webb. He\'s a lawyer in Chicago and collects vintage watches.', { name: 'Marcus Webb', lives: 'Chicago', met: 'wedding' }],
    ['Met Kenji Ito in Tokyo through my friend Hana. Photographer, loves analog film.', { name: 'Kenji Ito', met: 'Tokyo' }],
    ['Talked to Nina Alvarez after the pickleball tournament. She coaches tennis in Miami and wants to open an academy.', { name: 'Nina Alvarez', does: 'tennis coach', goal: 'Wants to open an academy' }],
    ['Met a guy named Felix at a bar who builds drones.', { name: 'Felix', met: 'bar' }],
    ["Ran into Dr. James O'Neil at the gym. Dentist at SmileCo, lives in Queens.", { name: "James O'Neil", company: 'SmileCo', lives: 'Queens', met: 'gym' }],
    ['Met Ana María López at a salsa class. Software developer at Mercado Libre, from Buenos Aires.', { name: 'Ana María López', company: 'Mercado Libre', from: 'Buenos Aires', met: 'salsa class' }],
  ]
  it.each(cases)('%s', (note, want) => {
    expect(parse(note)).toMatchObject(want)
  })

  it('finds a name after "met a" and the cities that are said (they get outlined too)', () => {
    const note = "I just came back from a climbing gym and I met a Sally Gallagher. She's a founder at Cork and she lives in Brooklyn now."
    expect(parse(note)).toMatchObject({ name: 'Sally Gallagher', company: 'Cork', lives: 'Brooklyn' })
    expect([parseFrom("She's from Bogotá and lives in São Paulo now."), parseLives("She's from Bogotá and lives in São Paulo now.")]).toEqual(['Bogotá', 'São Paulo'])
    expect(parseFrom("she's from Cork's")).toBeUndefined() // a possessive is not a place
  })

  it('does not take "into" in "bumped into" for an interest', () => {
    expect(parse('Bumped into Sam Lee at the gym.').remember).toBeUndefined()
  })
})
