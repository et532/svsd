import { aiReady } from './ai'
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
  const start = () => {
    // All three at once: voice is the thing the user reaches for first, so it no longer waits behind search
    void warmUp(getPeople())
    if (usesLocalVoice) {
      // The quick local words load at once: they show first, and carry on if OpenAI isn't there
      const live = loadLive().catch(() => {})
      // Whisper (~80 MB) only matters when OpenAI can't do the listening, so it isn't downloaded when it can, and when it
      // is, it waits for the live-words model instead of competing with it
      void aiReady().then((ready) => {
        if (!ready) void live.then(() => preload('whisper')).catch(() => {})
      })
    }
  }
  // Right after the first render, not after a delay
  window.setTimeout(start, 0)
}
