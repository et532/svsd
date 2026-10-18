import { makeMockPeople } from './mockPeople'

export type Place = {
  city: string
  lat: number
  lng: number
}

// How you know someone. Drives the hue of their aura (Peepl design foundation: profile color coding).
export type Context = 'work' | 'social' | 'community' | 'family' | 'unsorted'

export type Person = {
  id: string
  name: string
  context: Context
  profession: string
  story: string
  tags: string[]
  from: Place
  met: Place & { context: string }
  livesNow: Place
  lastContacted: string // ISO date
  // Ids of people this person knows (mutuals mentioned when adding them). Links are symmetric.
  knows: string[]
  // Set by capture: how well you know them (aura depth 1-3). Falls back to recency when missing.
  closeness?: 1 | 2 | 3
  // Things to talk about next time (from capture's "follow up" and "remember" answers).
  todos?: Todo[]
  // Logged moments, newest first. Sample people without any show their story as the first meeting.
  moments?: Moment[]
}

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

// Sample people so the list and map have something to show.
const basePeople: Person[] = [
  {
    id: 'maya-chen',
    name: 'Maya Chen',
    context: 'work',
    profession: 'Climate tech founder',
    story: 'Building a startup that turns food waste into fertilizer.',
    tags: ['climate', 'founder'],
    from: { city: 'Taipei', lat: 25.033, lng: 121.565 },
    met: { city: 'New York', lat: 40.741, lng: -73.99, context: 'Climate Week' },
    livesNow: { city: 'Brooklyn, NY', lat: 40.678, lng: -73.944 },
    lastContacted: '2026-10-02',
    knows: ['aisha-khan', 'hannah-cohen', 'zara-ahmed', 'priya-nair'],
  },
  {
    id: 'daniel-okafor',
    name: 'Daniel Okafor',
    context: 'work',
    profession: 'Product designer',
    story: 'Runs a monthly sketch club and collects old film cameras.',
    tags: ['design', 'art'],
    from: { city: 'Lagos', lat: 6.524, lng: 3.379 },
    met: { city: 'San Francisco', lat: 37.776, lng: -122.417, context: 'Config' },
    livesNow: { city: 'San Francisco', lat: 37.761, lng: -122.435 },
    lastContacted: '2026-08-21',
    knows: ['priya-nair', 'omar-haddad'],
  },
  {
    id: 'sofia-ramirez',
    name: 'Sofía Ramírez',
    context: 'work',
    profession: 'Recruiter',
    story: 'Training for her first marathon; loves spicy food.',
    tags: ['recruiting', 'running'],
    from: { city: 'Mexico City', lat: 19.432, lng: -99.133 },
    met: { city: 'Austin', lat: 30.267, lng: -97.743, context: 'SXSW' },
    livesNow: { city: 'Austin', lat: 30.285, lng: -97.733 },
    lastContacted: '2026-06-11',
    knows: [],
  },
  {
    id: 'liam-oconnor',
    name: "Liam O'Connor",
    context: 'community',
    profession: 'Software engineer',
    story: 'Moved to Berlin for a robotics job. Plays in a jazz trio.',
    tags: ['engineering', 'music'],
    from: { city: 'Dublin', lat: 53.349, lng: -6.26 },
    met: { city: 'Dublin', lat: 53.343, lng: -6.254, context: 'College' },
    livesNow: { city: 'Berlin', lat: 52.52, lng: 13.405 },
    lastContacted: '2025-12-24',
    knows: ['emma-wright'],
  },
  {
    id: 'aisha-khan',
    name: 'Aisha Khan',
    context: 'work',
    profession: 'VC associate',
    story: 'Invests in health and hardware startups. Just adopted a corgi named Toast.',
    tags: ['investing', 'health'],
    from: { city: 'Karachi', lat: 24.861, lng: 67.01 },
    met: { city: 'New York', lat: 40.752, lng: -73.977, context: 'Demo Day' },
    livesNow: { city: 'Manhattan, NY', lat: 40.776, lng: -73.971 },
    lastContacted: '2026-10-12',
    knows: ['hannah-cohen', 'noah-patel'],
  },
  {
    id: 'kenji-watanabe',
    name: 'Kenji Watanabe',
    context: 'social',
    profession: 'Chef',
    story: 'Opening a ramen counter next spring. Promised me a tasting.',
    tags: ['food', 'founder', 'baseball'],
    from: { city: 'Osaka', lat: 34.694, lng: 135.502 },
    met: { city: 'Tokyo', lat: 35.676, lng: 139.65, context: 'Friend’s dinner' },
    livesNow: { city: 'Tokyo', lat: 35.662, lng: 139.704 },
    lastContacted: '2026-03-05',
    knows: ['lucas-silva'],
  },
  {
    id: 'priya-nair',
    name: 'Priya Nair',
    context: 'work',
    profession: 'Data scientist',
    story: 'Working on wildfire prediction models. Big board game fan.',
    tags: ['climate', 'data'],
    from: { city: 'Bangalore', lat: 12.972, lng: 77.595 },
    met: { city: 'San Francisco', lat: 37.789, lng: -122.401, context: 'Climate meetup' },
    livesNow: { city: 'Oakland, CA', lat: 37.804, lng: -122.271 },
    lastContacted: '2026-09-18',
    knows: ['omar-haddad'],
  },
  {
    id: 'tom-becker',
    name: 'Tom Becker',
    context: 'work',
    profession: 'Journalist',
    story: 'Writes about cities and transit. Bikes everywhere.',
    tags: ['media', 'cities', 'cycling'],
    from: { city: 'Hamburg', lat: 53.551, lng: 9.993 },
    met: { city: 'London', lat: 51.507, lng: -0.128, context: 'Conference' },
    livesNow: { city: 'London', lat: 51.52, lng: -0.09 },
    lastContacted: '2026-01-30',
    knows: ['noah-patel', 'liam-oconnor'],
  },
  {
    id: 'grace-kim',
    name: 'Grace Kim',
    context: 'community',
    profession: 'Med student',
    story: 'Roommate from freshman year. Wants to specialize in pediatrics.',
    tags: ['health', 'college', 'baseball', 'hiking'],
    from: { city: 'Seoul', lat: 37.566, lng: 126.978 },
    met: { city: 'Boston', lat: 42.36, lng: -71.059, context: 'College' },
    livesNow: { city: 'Boston', lat: 42.336, lng: -71.104 },
    lastContacted: '2026-07-04',
    knows: ['liam-oconnor', 'emma-wright'],
  },
  {
    id: 'lucas-silva',
    name: 'Lucas Silva',
    context: 'community',
    profession: 'Community organizer',
    story: 'Hosts a Sunday supper club for people new to the city.',
    tags: ['community', 'food'],
    from: { city: 'São Paulo', lat: -23.551, lng: -46.633 },
    met: { city: 'Lisbon', lat: 38.722, lng: -9.139, context: 'Web Summit' },
    livesNow: { city: 'Lisbon', lat: 38.711, lng: -9.146 },
    lastContacted: '2026-05-16',
    knows: [],
  },
  {
    id: 'hannah-cohen',
    name: 'Hannah Cohen',
    context: 'work',
    profession: 'Startup lawyer',
    story: 'Offered to look over our incorporation docs. Loves pottery.',
    tags: ['legal', 'founder'],
    from: { city: 'Chicago', lat: 41.878, lng: -87.63 },
    met: { city: 'New York', lat: 40.728, lng: -74.002, context: 'Founder dinner' },
    livesNow: { city: 'Manhattan, NY', lat: 40.735, lng: -74.003 },
    lastContacted: '2026-09-29',
    knows: ['zara-ahmed', 'ana-ruiz'],
  },
  {
    id: 'omar-haddad',
    name: 'Omar Haddad',
    context: 'social',
    profession: 'Architect',
    story: 'Designs passive houses. Just got back from hiking Patagonia.',
    tags: ['design', 'climate', 'hiking'],
    from: { city: 'Beirut', lat: 33.894, lng: 35.502 },
    met: { city: 'Paris', lat: 48.857, lng: 2.352, context: 'Mutual friend' },
    livesNow: { city: 'Paris', lat: 48.865, lng: 2.38 },
    lastContacted: '2026-04-09',
    knows: [],
  },
  {
    id: 'emma-wright',
    name: 'Emma Wright',
    context: 'community',
    profession: 'Teacher',
    story: 'Teaches middle school science. Childhood best friend.',
    tags: ['education', 'hometown', 'books'],
    from: { city: 'Sydney', lat: -33.869, lng: 151.209 },
    met: { city: 'Sydney', lat: -33.88, lng: 151.2, context: 'Primary school' },
    livesNow: { city: 'Melbourne', lat: -37.814, lng: 144.963 },
    lastContacted: '2025-11-12',
    knows: [],
  },
  {
    id: 'noah-patel',
    name: 'Noah Patel',
    context: 'work',
    profession: 'Growth marketer',
    story: 'Thinking about leaving his job to start a newsletter.',
    tags: ['marketing', 'media', 'baseball'],
    from: { city: 'Toronto', lat: 43.653, lng: -79.383 },
    met: { city: 'Toronto', lat: 43.645, lng: -79.39, context: 'Collision' },
    livesNow: { city: 'Toronto', lat: 43.665, lng: -79.4 },
    lastContacted: '2026-08-02',
    knows: [],
  },
  {
    id: 'ana-ruiz',
    name: 'Ana Ruiz',
    context: 'work',
    profession: 'Hardware engineer',
    story: 'Ex-Tesla battery engineer. Wants to advise early founders. Runs along the Hudson.',
    tags: ['hardware', 'batteries', 'running'],
    from: { city: 'Mexico City', lat: 19.433, lng: -99.133 },
    met: { city: 'New York', lat: 40.728, lng: -74.002, context: 'Founder dinner' },
    livesNow: { city: 'Manhattan, NY', lat: 40.758, lng: -73.985 },
    lastContacted: '2026-07-15',
    knows: ['hannah-cohen'],
  },
  {
    id: 'zara-ahmed',
    name: 'Zara Ahmed',
    context: 'social',
    profession: 'Musician',
    story: 'Plays cello and produces ambient music. Has a show in November. Just got into bouldering.',
    tags: ['music', 'art', 'climbing'],
    from: { city: 'Nairobi', lat: -1.292, lng: 36.822 },
    met: { city: 'Brooklyn, NY', lat: 40.714, lng: -73.961, context: 'Gallery opening' },
    livesNow: { city: 'Brooklyn, NY', lat: 40.707, lng: -73.957 },
    lastContacted: '2026-10-15',
    knows: [],
  },
]

// ?mock=200 swaps in that many fabricated people (see mockPeople.ts) to stress-test the mindmap.
const mockCount = Math.min(500, Number(new URLSearchParams(window.location.search).get('mock')) || 0)
export const samplePeople: Person[] = mockCount ? makeMockPeople(mockCount) : basePeople
