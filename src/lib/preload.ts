import { loadLive } from './live'
import { preload } from './ml'
import { getPeople } from './peopleStore'
import { warmUp } from './semantic'
import { usesLocalVoice } from './speech'

// Gets the local models ready as soon as the app opens, in the background, so they are already there when the mic
// or Find is first used. One at a time, so they don't slow each other's download: the word-by-word voice model first,
// then the accurate one for the final text, then everyone's moments for search. A browser that has its own speech
// service (Chrome, Edge, Safari) doesn't need the two voice models.
export function preloadModels() {
  const start = async () => {
    if (usesLocalVoice) {
      await loadLive().catch(() => {})
      await preload('whisper').catch(() => {})
    }
    await warmUp(getPeople())
  }
  // Let the first screen draw before any of it starts
  window.setTimeout(() => void start(), 1500)
}
