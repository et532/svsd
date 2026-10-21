-- Peepl backend: people, moments, links, search chunks (pgvector), places (PostGIS).
-- One fixed workspace and NO auth for now (the user is the person in NYC). The policies at the bottom let the
-- anon key read and write everything: DEMO ONLY. Real users need an owner_id column + row level security.

create extension if not exists vector;
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ---------- places ----------
create table places (
  id        text primary key,
  name      text not null,
  kind      text not null check (kind in ('hood', 'borough', 'city', 'region')),
  parent_id text references places (id),
  geo       geography (point, 4326) not null,
  aliases   text[] not null default '{}',
  metro_id  text
);
create index places_geo on places using gist (geo);
create index places_name_trgm on places using gin (name gin_trgm_ops);

-- ---------- people ----------
create table people (
  id             text primary key,
  name           text not null,
  job            text not null default '',
  story          text not null default '',
  context        text not null default 'unsorted' check (context in ('work', 'social', 'community', 'family', 'unsorted')),
  also_context   text,
  closeness      int check (closeness between 1 and 3),
  life_stage     text check (life_stage in ('family', 'hometown', 'high-school', 'college', 'first-job', 'nyc-work', 'nyc-social', 'networking')),
  last_contacted date,
  met_on         date,
  from_city      text, from_lat float8, from_lng float8, from_place  text references places (id),
  met_city       text, met_lat  float8, met_lng  float8, met_place   text references places (id), met_context text,
  lives_city     text, lives_lat float8, lives_lng float8, lives_place text references places (id), lives_neighborhood text,
  lives_geo      geography (point, 4326)
);
create index people_lives_geo on people using gist (lives_geo);
create index people_name_trgm on people using gin (name gin_trgm_ops);
create index people_life_stage on people (life_stage);

create function people_set_geo() returns trigger language plpgsql as $$
begin
  new.lives_geo := case when new.lives_lat is null or new.lives_lng is null then null
                        else st_setsrid(st_makepoint(new.lives_lng, new.lives_lat), 4326)::geography end;
  return new;
end $$;
create trigger people_geo before insert or update of lives_lat, lives_lng on people
  for each row execute function people_set_geo();

-- Who knows whom. Stored in both directions so a person's list is one lookup; `note` is a's caption for b.
create table person_links (
  a    text not null references people (id) on delete cascade,
  b    text not null references people (id) on delete cascade,
  note text,
  primary key (a, b),
  check (a <> b)
);
create index person_links_b on person_links (b);

create table moments (
  id            text primary key,
  person_id     text not null references people (id) on delete cascade,
  date          date not null,
  title         text not null,
  text          text,
  transcript    text,
  seconds       int,
  first_meeting boolean not null default false
);
create index moments_person on moments (person_id, date desc);

create table todos (
  id        text primary key,
  person_id text not null references people (id) on delete cascade,
  text      text not null,
  done      boolean not null default false,
  position  int not null default 0
);
create index todos_person on todos (person_id);

create table tags (
  person_id text not null references people (id) on delete cascade,
  tag       text not null,
  weight    real not null default 1,
  position  int not null default 0,
  primary key (person_id, tag)
);

-- Each piece of what you know about someone (job, story sentence, tag, to-do, moment sentence), embedded once at
-- write time so a search only has to embed the question. all-MiniLM-L6-v2 = 384 dimensions.
create table chunks (
  id        bigint generated always as identity primary key,
  person_id text not null references people (id) on delete cascade,
  moment_id text references moments (id) on delete cascade,
  kind      text not null check (kind in ('profile', 'tag', 'todo', 'moment')),
  text      text not null,
  embedding vector (384),
  tsv       tsvector generated always as (to_tsvector('english', text)) stored,
  unique (person_id, text)
);
create index chunks_embedding on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_tsv on chunks using gin (tsv);
create index chunks_person on chunks (person_id);

-- Misheard voice names -> what was meant (nameFixes.ts)
create table name_fixes (heard text primary key, meant text not null);

-- Settings for the one workspace
create table profile (
  id         int primary key default 1 check (id = 1),
  home_place text references places (id) default 'new-york'
);
insert into profile default values;

-- ---------- reading everyone: one call, the shape the app already uses ----------
create function get_people() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(x.j order by x.name), '[]'::jsonb) from (
    select p.name, jsonb_strip_nulls(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'context', p.context,
      'alsoContext', p.also_context,
      'profession', p.job,
      'story', p.story,
      'tags', coalesce((select jsonb_agg(t.tag order by t.position) from tags t where t.person_id = p.id), '[]'::jsonb),
      'from', jsonb_build_object('city', coalesce(p.from_city, ''), 'lat', coalesce(p.from_lat, 0), 'lng', coalesce(p.from_lng, 0)),
      'met', jsonb_build_object('city', coalesce(p.met_city, ''), 'lat', coalesce(p.met_lat, 0), 'lng', coalesce(p.met_lng, 0), 'context', coalesce(p.met_context, '')),
      'livesNow', jsonb_build_object('city', coalesce(p.lives_city, ''), 'lat', coalesce(p.lives_lat, 0), 'lng', coalesce(p.lives_lng, 0), 'hood', p.lives_neighborhood),
      'lastContacted', p.last_contacted,
      'knows', coalesce((select jsonb_agg(l.b order by l.b) from person_links l where l.a = p.id), '[]'::jsonb),
      'mutualNotes', (select jsonb_object_agg(l.b, l.note) from person_links l where l.a = p.id and l.note is not null),
      'closeness', p.closeness,
      'lifeStage', p.life_stage,
      'todos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'text', d.text, 'done', d.done) order by d.position) from todos d where d.person_id = p.id), '[]'::jsonb),
      'moments', coalesce((select jsonb_agg(jsonb_build_object(
          'id', m.id, 'date', m.date, 'title', m.title, 'text', m.text, 'transcript', m.transcript, 'seconds', m.seconds,
          'firstMeeting', case when m.first_meeting then true end) order by m.date desc, m.id) from moments m where m.person_id = p.id), '[]'::jsonb)
    )) as j
    from people p
  ) x
$$;

-- ---------- writing one person: everything about them in one call ----------
-- p: the app's Person JSON plus `places` ({from, met, lives} -> place ids) and `metOn`.
-- chunk_list: [{text, kind, momentId?, embedding?}]; chunks no longer listed are removed.
create function upsert_person(p jsonb, chunk_list jsonb default '[]') returns void language plpgsql as $$
declare
  pid text := p ->> 'id';
begin
  insert into people (id, name, job, story, context, also_context, closeness, life_stage, last_contacted, met_on,
                      from_city, from_lat, from_lng, from_place,
                      met_city, met_lat, met_lng, met_place, met_context,
                      lives_city, lives_lat, lives_lng, lives_place, lives_neighborhood)
  values (pid, p ->> 'name', coalesce(p ->> 'profession', ''), coalesce(p ->> 'story', ''), coalesce(p ->> 'context', 'unsorted'),
          p ->> 'alsoContext', (p ->> 'closeness')::int, p ->> 'lifeStage', (p ->> 'lastContacted')::date, (p ->> 'metOn')::date,
          p #>> '{from,city}', (p #>> '{from,lat}')::float8, (p #>> '{from,lng}')::float8, p #>> '{places,from}',
          p #>> '{met,city}', (p #>> '{met,lat}')::float8, (p #>> '{met,lng}')::float8, p #>> '{places,met}', p #>> '{met,context}',
          p #>> '{livesNow,city}', (p #>> '{livesNow,lat}')::float8, (p #>> '{livesNow,lng}')::float8, p #>> '{places,lives}', p #>> '{livesNow,hood}')
  on conflict (id) do update set
    name = excluded.name, job = excluded.job, story = excluded.story, context = excluded.context,
    also_context = excluded.also_context, closeness = excluded.closeness, life_stage = excluded.life_stage,
    last_contacted = excluded.last_contacted, met_on = excluded.met_on,
    from_city = excluded.from_city, from_lat = excluded.from_lat, from_lng = excluded.from_lng, from_place = excluded.from_place,
    met_city = excluded.met_city, met_lat = excluded.met_lat, met_lng = excluded.met_lng, met_place = excluded.met_place, met_context = excluded.met_context,
    lives_city = excluded.lives_city, lives_lat = excluded.lives_lat, lives_lng = excluded.lives_lng, lives_place = excluded.lives_place,
    lives_neighborhood = excluded.lives_neighborhood;

  delete from tags where person_id = pid;
  insert into tags (person_id, tag, position)
    select pid, t.tag, min(t.n)::int from jsonb_array_elements_text(coalesce(p -> 'tags', '[]')) with ordinality as t (tag, n) group by t.tag;

  delete from todos where person_id = pid;
  insert into todos (id, person_id, text, done, position)
    select d ->> 'id', pid, d ->> 'text', coalesce((d ->> 'done')::boolean, false), (n - 1)::int
    from jsonb_array_elements(coalesce(p -> 'todos', '[]')) with ordinality as t (d, n);

  delete from moments where person_id = pid
    and id not in (select m ->> 'id' from jsonb_array_elements(coalesce(p -> 'moments', '[]')) m);
  insert into moments (id, person_id, date, title, text, transcript, seconds, first_meeting)
    select m ->> 'id', pid, (m ->> 'date')::date, m ->> 'title', m ->> 'text', m ->> 'transcript', (m ->> 'seconds')::int,
           coalesce((m ->> 'firstMeeting')::boolean, false)
    from jsonb_array_elements(coalesce(p -> 'moments', '[]')) m
  on conflict (id) do update set date = excluded.date, title = excluded.title, text = excluded.text,
    transcript = excluded.transcript, seconds = excluded.seconds, first_meeting = excluded.first_meeting;

  -- links, both ways (only to people that exist; the other side may be added later and link back then)
  delete from person_links where a = pid;
  insert into person_links (a, b, note)
    select pid, k, p #>> array['mutualNotes', k]
    from jsonb_array_elements_text(coalesce(p -> 'knows', '[]')) k
    where k <> pid and exists (select 1 from people o where o.id = k)
  on conflict do nothing;
  insert into person_links (a, b)
    select l.b, l.a from person_links l where l.a = pid
  on conflict do nothing;

  delete from chunks where person_id = pid
    and text not in (select c ->> 'text' from jsonb_array_elements(chunk_list) c);
  insert into chunks (person_id, moment_id, kind, text, embedding)
    select pid, nullif(c ->> 'momentId', ''), c ->> 'kind', c ->> 'text', (c ->> 'embedding')::vector
    from jsonb_array_elements(chunk_list) c
  on conflict (person_id, text) do update set
    moment_id = excluded.moment_id, kind = excluded.kind, embedding = coalesce(excluded.embedding, chunks.embedding);
end $$;

-- ---------- search: geo gate + meaning + words, in one query ----------
-- Best matching chunk per person, closest first. p_lat / p_lng / p_radius_km gate by where people live (omit for
-- no gate); p_stage keeps one life stage. query_text is OR-ed words ('fashion | style') for the full-text part.
-- At 20,000+ chunks raise `set hnsw.ef_search` / use iterative scans so the gate can't starve the ANN list.
create function search_people(
  query_vec   vector (384),
  query_text  text default null,
  p_lat       float8 default null,
  p_lng       float8 default null,
  p_radius_km float8 default null,
  p_stage     text default null,
  p_limit     int default 50
) returns table (person_id text, chunk_text text, moment_id text, kind text, sim float8, text_rank real)
language sql stable as $$
  with allowed as (
    select p.id from people p
    where (p_lat is null or st_dwithin(p.lives_geo, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000))
      and (p_stage is null or p.life_stage = p_stage)
  ), top as (
    select c.person_id, c.text as chunk_text, c.moment_id, c.kind,
           1 - (c.embedding <=> query_vec) as sim,
           case when query_text is null or query_text = '' then 0::real else ts_rank(c.tsv, to_tsquery('english', query_text)) end as text_rank
    from chunks c join allowed a on a.id = c.person_id
    where c.embedding is not null
    order by c.embedding <=> query_vec
    limit 200
  )
  select * from (
    select distinct on (t.person_id) t.person_id, t.chunk_text, t.moment_id, t.kind, t.sim, t.text_rank
    from top t order by t.person_id, (t.sim + 0.2 * t.text_rank) desc
  ) best
  order by (best.sim + 0.2 * best.text_rank) desc
  limit p_limit
$$;

-- ---------- DEMO-ONLY open access for the anon key ----------
do $$
declare t text;
begin
  foreach t in array array['places', 'people', 'person_links', 'moments', 'todos', 'tags', 'chunks', 'name_fixes', 'profile'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy demo_open on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
