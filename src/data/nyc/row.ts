import type { Context, LifeStage } from '../people'
import type { Seed } from '../seed'

// A compact way to write the 150 people added for the New York persona (see supabase/seed/README.md for the life
// story they all fit): one tuple per person, decoded into the Seed that seed() already understands.
//
// [id, name, how you know them ('social' or 'social+community'), life stage, job,
//  lives ('City, ST' or 'City, ST/Neighborhood'), from, met ('City|where'), day you met, last talked, closeness,
//  tags (comma separated), story, what you said when you met, knows (ids), to-dos (' ; ' separated, '✓ ' = done),
//  moments [date, title, text, voice-note seconds?][]]
export type Row = [
  id: string,
  name: string,
  ctx: string,
  stage: LifeStage,
  job: string,
  lives: string,
  from: string,
  met: string,
  since: string,
  last: string,
  close: 1 | 2 | 3,
  tags: string,
  story: string,
  first: string,
  knows: string,
  todos: string,
  moments: [date: string, title: string, text: string, seconds?: number][],
]

export const rows = (list: Row[]): Seed[] =>
  list.map(([id, name, ctx, stage, job, lives, from, met, since, last, close, tags, story, first, knows, todos, moments]) => {
    const [main, also] = ctx.split('+') as Context[]
    const [city, hood] = lives.split('/')
    const [metCity, metWhere] = met.split('|')
    return {
      id,
      name,
      ctx: main,
      ...(also ? { also } : {}),
      stage,
      job,
      lives: city,
      ...(hood ? { hood } : {}),
      from,
      met: [metCity, metWhere],
      since,
      last,
      close,
      tags: tags.split(',').map((t) => t.trim()),
      story,
      first,
      knows: knows ? knows.split(',').map((k) => k.trim()) : [],
      todos: todos ? todos.split(' ; ') : [],
      moments,
    }
  })
