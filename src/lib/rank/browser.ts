import type { Person } from '../../data/people'
import type { AskResult } from '../ask'
import { localHits } from '../semantic'
import { remoteHits } from '../supabaseRepo'
import { answer } from './search'

// In the app: candidates come from Supabase when it is set up (and reachable), otherwise from the vectors on this device.
export const searchPeople = (query: string, people: Person[]): Promise<AskResult> =>
  answer(query, people, async (c, ppl) => (await remoteHits(c, ppl).catch(() => null)) ?? localHits(c.embedText, ppl))
