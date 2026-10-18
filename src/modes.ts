// The three kinds of places the map can show.

export type Mode = 'from' | 'met' | 'livesNow'

// Always shown in this order: from, met, lives now.
export const modeOrder: Mode[] = ['from', 'met', 'livesNow']

export const modeInfo: Record<Mode, {
  label: string
  short: string
  // For the small side button and chip
  tiny: string
  description: string
  color: string
}> = {
  from: {
    label: 'Where they’re from',
    short: 'From',
    tiny: 'From',
    description: 'Hometowns and where people grew up',
    color: '#D9822B',
  },
  met: {
    label: 'Where you met',
    short: 'Met',
    tiny: 'Met',
    description: 'The place you first crossed paths',
    color: '#E4572E',
  },
  livesNow: {
    label: 'Where they live now',
    short: 'Lives now',
    tiny: 'Now',
    description: 'The city each person calls home today',
    color: '#2F8F6B',
  },
}
