import { useSyncExternalStore } from 'react'
import type { PfpStyle } from './people'

// A tiny global store for the avatar gradient style chosen in the StylePanel, so the
// list and search avatars update live without threading a prop through everything.
// This is a design-exploration control, not app state.

let current: PfpStyle = 'sphere'
const listeners = new Set<() => void>()

export function setPfpStyle(style: PfpStyle) {
  current = style
  for (const listener of listeners) listener()
}

function getPfpStyle(): PfpStyle {
  return current
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePfpStyle(): PfpStyle {
  return useSyncExternalStore(subscribe, getPfpStyle, getPfpStyle)
}
