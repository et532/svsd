import { getPeople } from './peopleStore'
import { warmUp } from './semantic'

// Gets search ready as soon as the app opens, in the background, so it is quick when Find is first used (the small
// search model downloads and everyone's moments are matched to their shipped vectors). Voice needs nothing here: it
// is the browser's own recognizer, or OpenAI (ai.ts), with no local speech models to download.
export function preloadModels() {
  // Right after the first render, not after a delay
  window.setTimeout(() => void warmUp(getPeople()), 0)
}
