import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleAi } from '../../server/ai.js'

// The deployed AI endpoint (Vercel runs this file as a serverless function at /api/ai/<task>). It is the same handler
// the dev server uses (server/ai.ts); the key and model names come from the project's Environment Variables.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleAi(req, res, {
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL,
    liveModel: process.env.OPENAI_LIVE_MODEL,
  })
}
