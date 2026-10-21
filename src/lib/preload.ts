import { loadLive } from './live'
import { preload } from './ml'
import { getPeople } from './peopleStore'
import { warmUp } from './semantic'
import { usesLocalVoice } from './speech'

// Gets the local models ready as soon as the app opens, in the background, so they are already there when the mic
// or Find is first used: everyone's moments for search (with the live-words model loading beside it, in its own
// thread), then the accurate voice model for the final text. A browser that has its own speech
// service (Chrome, Edge, Safari) doesn't need the two voice models.
export function preloadModels() {
  const start = async () => {
    // Search first: it is the one thing a question can't be answered without, and the live-words model runs in its
    // own thread, so the two don't wait on each other
    const search = warmUp(getPeople())
    if (usesLocalVoice) {
      await loadLive().catch(() => {})
      await search
      await preload('whisper').catch(() => {})
    }
  }
  // Let the first screen draw before any of it starts
  window.setTimeout(() => void start(), 1500)
}
