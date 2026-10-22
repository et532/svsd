import { makeMockPeople } from './mockPeople'
import { linkAll, seed } from './seed'
import { nycSeeds } from './nyc'
import { pickDiverse } from '../lib/diverse'

export type Place = {
  city: string
  lat: number
  lng: number
  // Neighborhood, when known ("Bushwick"); `city` stays the broader place ("Brooklyn, NY")
  hood?: string
}

// How you know someone. Drives the hue of their aura (Peepl design foundation: profile color coding).
export type Context = 'work' | 'social' | 'community' | 'family' | 'unsorted'

export type Person = {
  id: string
  name: string
  context: Context
  // A second way you know them, for a two-color blend aura (Figma "Aura/Blend work–social" etc.)
  alsoContext?: Context
  profession: string
  story: string
  tags: string[]
  from: Place
  met: Place & { context: string }
  livesNow: Place
  lastContacted: string // ISO date
  // Ids of people this person knows (mutuals mentioned when adding them). Links are symmetric.
  knows: string[]
  // Optional caption per mutual, shown under their avatar (e.g. "introduced you").
  mutualNotes?: Record<string, string>
  // Set by capture: how well you know them (aura depth 1-3). Falls back to recency when missing.
  closeness?: 1 | 2 | 3
  // Where in your life they come from (hometown, college, nyc-work...), for "who do I know from where".
  lifeStage?: LifeStage
  // Things to talk about next time (from capture's "follow up" and "remember" answers).
  todos?: Todo[]
  // Logged moments, newest first. Sample people without any show their story as the first meeting.
  moments?: Moment[]
}

export type LifeStage = 'family' | 'hometown' | 'high-school' | 'college' | 'first-job' | 'nyc-work' | 'nyc-social' | 'networking'

export type Todo = { id: string; text: string; done: boolean }

export type Moment = {
  id: string
  date: string // ISO date
  // Short line shown when the moment is collapsed.
  title: string
  // Longer text shown when it's expanded.
  text?: string
  // Voice notes keep their transcript and length; typed notes have neither.
  transcript?: string
  seconds?: number
  firstMeeting?: boolean
}

// Jordan is normally added in the demo with the + / Ask capture flow. For now he's built in so Ask's
// "climbing buddy" answer matches the Figma "Ask flow" (Jordan + Zara) without adding anyone first.
const jordanLee: Person = 
  {
    id: 'jordan-lee',
    name: 'Jordan Lee',
    context: 'work',
    profession: 'Founder @ [Startup]',
    story: 'Building battery recycling for e-bikes. Grew up in Seattle, just moved to Brooklyn. Climbs Tuesdays and wants a climbing buddy.',
    tags: ['climate tech', 'founder', 'climbing', 'e-bikes'],
    from: { city: 'Seattle', lat: 47.606, lng: -122.332 },
    met: { city: 'New York', lat: 40.741, lng: -73.99, context: 'Climate Demo Day' },
    livesNow: { city: 'Brooklyn', lat: 40.7304, lng: -73.9515, hood: 'Greenpoint' },
    lifeStage: 'networking',
    lastContacted: '2026-10-13',
    knows: ['aisha-khan'],
    mutualNotes: { 'aisha-khan': 'introduced you' },
    closeness: 2,
    todos: [
      { id: 'jordan-priya', text: 'Intro to Priya for battery data', done: false },
      { id: 'jordan-hardware', text: 'Intro to someone in hardware', done: false },
      { id: 'jordan-climb', text: 'Climbs Tuesdays, wants a climbing buddy', done: false },
    ],
    moments: [
      {
        id: 'jordan-coffee',
        date: '2026-10-13',
        title: 'Coffee near Union Square',
        text: 'Coffee near Union Square. Closed their pre-seed round.',
        transcript: 'Grabbed coffee with Jordan near Union Square. They just closed their pre-seed round. I should intro them to Priya for battery data.',
        seconds: 14,
      },
      {
        id: 'jordan-first',
        date: '2026-10-11',
        firstMeeting: true,
        title: 'Met at Climate Demo Day',
        transcript:
          'Just met Jordan Lee at Climate Demo Day. Founder, they do battery recycling for e-bikes. Aisha Khan introduced us. Grew up in Seattle, just moved to Brooklyn. Climbs on Tuesdays and wants a climbing buddy. Asked me for an intro to someone in hardware.',
        seconds: 19,
      },
    ],
  }

// 500 sample people with stories, to-dos and moments (see nyc/); every link is made two-way.
// In the app only 200 of them are shown, picked to be as different from each other as possible (see pickDiverse), so a
// question finds a couple of people, not ten. Links to people left out are dropped. Open /?all for all 500. Scripts and
// tests get all 500. `keep` are the people the demo answers rely on.
const inApp = typeof window !== 'undefined' && !new URLSearchParams(window.location.search).has('all')
const keep = new Set(['ty-nakamura', 'zara-ahmed', 'aisha-khan', 'ana-ruiz', 'jordan-smith', 'maya-chen', 'daniel-okafor', 'dana-reyes'])
const allSeeded = nycSeeds.map(seed)
const shown = inApp ? pickDiverse(allSeeded, 200, keep) : allSeeded
const basePeople: Person[] = linkAll([...shown, jordanLee])

// ?mock=200 swaps in that many fabricated people (see mockPeople.ts) to stress-test the mindmap.
const mockCount = Math.min(500, Number(new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('mock')) || 0)
export const samplePeople: Person[] = mockCount ? makeMockPeople(mockCount) : basePeople
