import { useSyncExternalStore } from 'react'

// When the mindmap's initials appear, set from the desktop side panel (InitialsPanel). `t` runs from 0 (initials fully
// shown at the fitted "everyone in frame" view) to 1 (only at the closest zoom, MAX_ZOOM); in between it's spaced on a
// zoom (log) scale so each step of the slider feels the same. `fitK` is the mindmap's fitted zoom, published so the
// panel can show the result in "×". Saved per browser.

export const MAX_ZOOM = 3 // keep in step with MAX_K in MindmapScreen
export const DEFAULT_T = 0.16 // fully shown at ~0.8× when the fitted view is ~0.62× (the setting before the panel)
const KEY = 'peepl.initialsAt.v1'

const read = () => {
  try {
    const v = Number(localStorage.getItem(KEY))
    return localStorage.getItem(KEY) !== null && v >= 0 && v <= 1 ? v : DEFAULT_T
  } catch {
    return DEFAULT_T
  }
}

let state = { t: read(), fitK: 0.62 }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function setInitialsAt(t: number) {
  state = { ...state, t }
  try {
    localStorage.setItem(KEY, String(t))
  } catch {
    // private window: the setting just isn't remembered
  }
  emit()
}

export function setFitZoom(fitK: number) {
  if (Math.abs(fitK - state.fitK) < 0.005) return
  state = { ...state, fitK }
  emit()
}

export const getInitialsAt = () => state
export const onInitialsAt = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useInitialsAt() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

// The zoom at which the initials are fully shown; they fade in over the 20% of zoom before it.
export const fullAt = (t: number, fitK: number) => fitK * Math.pow(Math.max(1, MAX_ZOOM / fitK), t)
export const initialsOpacity = (k: number, t: number, fitK: number) => {
  const full = fullAt(t, fitK)
  const start = full / 1.25
  return Math.min(1, Math.max(0, (k - start) / (full - start)))
}
