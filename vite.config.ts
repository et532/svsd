import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { aiPlugin } from './server/ai'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // OPENAI_API_KEY (and optionally OPENAI_MODEL / OPENAI_TRANSCRIBE_MODEL / OPENAI_LIVE_MODEL) come from .env.local;
  // they are read here on the server and never reach the browser bundle. (Deployed, api/ai/[task].ts reads them from
  // the Vercel project's environment variables.)
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      aiPlugin({ key: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, transcribeModel: env.OPENAI_TRANSCRIBE_MODEL, liveModel: env.OPENAI_LIVE_MODEL }),
    ],
    // The model worker (src/lib/ml.worker.ts) is an ES module
    worker: { format: 'es' },
    server: {
      // Listen on IPv4 so http://localhost:5173 works in every browser (by default this Mac only got [::1], which
      // Chrome couldn't reach). Still local-only: not exposed to the network.
      host: '127.0.0.1',
    },
  }
})
