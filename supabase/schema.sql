-- LearnBall database (applied to the Learnball.io Supabase project on 2026-11-09).
-- Players can only ADD rows (no reading), and the rank comes from a function that returns counts only.

create table if not exists public.plays (
  id bigint generated always as identity primary key,
  day text not null,
  game int,
  set_index int,
  score int not null check (score between 0 and 700),
  results jsonb,
  player text not null,
  created_at timestamptz not null default now(),
  unique (day, player)
);

create table if not exists public.guesses (
  id bigint generated always as identity primary key,
  day text not null,
  prompt_id text not null,
  guess text not null,
  matched text,
  tier text,
  player text,
  test boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  day text not null,
  prompt_id text not null,
  guess text not null,
  player text,
  created_at timestamptz not null default now()
);

create index if not exists plays_day_score on public.plays (day, score);
create index if not exists guesses_prompt on public.guesses (prompt_id) where matched is null;

alter table public.plays enable row level security;
alter table public.guesses enable row level security;
alter table public.reports enable row level security;

drop policy if exists "players add plays" on public.plays;
create policy "players add plays" on public.plays for insert to anon with check (char_length(day) = 10 and char_length(player) <= 64);
drop policy if exists "players add guesses" on public.guesses;
create policy "players add guesses" on public.guesses for insert to anon with check (char_length(guess) <= 120 and char_length(prompt_id) <= 64);
drop policy if exists "players add reports" on public.reports;
create policy "players add reports" on public.reports for insert to anon with check (char_length(guess) <= 120 and char_length(prompt_id) <= 64);

-- Top X% today: share of today's players who scored strictly higher, rounded up (min 1%).
create or replace function public.score_rank(p_day text, p_score int)
returns table (players bigint, top_pct int)
language sql stable security definer set search_path = public as $$
  select count(*) as players,
         greatest(1, ceil(100.0 * (count(*) filter (where score > p_score) + 1) / greatest(count(*), 1)))::int as top_pct
  from plays where day = p_day;
$$;
grant execute on function public.score_rank(text, int) to anon;

-- Handy views for you (not visible to players): the most common misses per question.
create or replace view public.top_misses with (security_invoker = true) as
  select prompt_id, lower(guess) as guess, count(*) as times
  from guesses where matched is null and not test
  group by 1, 2 order by times desc;
revoke all on public.top_misses from anon, authenticated;
