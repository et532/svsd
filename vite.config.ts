import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The model worker (src/lib/ml.worker.ts) is an ES module
  worker: { format: 'es' },
  server: {
    // Listen on IPv4 so http://localhost:5173 works in every browser (by default this Mac only got [::1], which
    // Chrome couldn't reach). Still local-only: not exposed to the network.
    host: '127.0.0.1',
  },
})
