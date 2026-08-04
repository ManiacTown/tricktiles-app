-- Tricktiles initial schema: profiles, daily puzzles, game sessions,
-- server-timestamped round completions (the anti-cheat backbone), badges,
-- and a leaderboard view.
--
-- Open decision made here (not one of the section 0 locked calls, see
-- tricktiles_build_plan.md section 3): game_sessions stores the player's
-- own final board state for replay purposes, but not every intermediate
-- move — a middle ground between "no history" and "full move-by-move
-- replay," worth revisiting if a real replay feature gets prioritized.

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are publicly readable"
  on profiles for select
  using (true);

create policy "users can create their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------
-- daily_puzzles
-- Written only by the offline generator job (service role bypasses RLS,
-- so no insert/update policy is defined for regular clients).
-- ---------------------------------------------------------------------
create table daily_puzzles (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  seed bigint not null,
  -- [{ "round": 1, "letters": "CATSDOGRUN", "attempts": 1 }, ...]
  rounds jsonb not null,
  -- Reference solved board from solver/generate — an admin/solver
  -- artifact, not necessarily meant to be shipped to clients pre-completion
  -- (would trivially spoil a hint feature if exposed early).
  final_board jsonb not null,
  created_at timestamptz not null default now()
);

alter table daily_puzzles enable row level security;

create policy "daily puzzles are publicly readable"
  on daily_puzzles for select
  using (true);

-- ---------------------------------------------------------------------
-- game_sessions
-- One attempt per (user, daily puzzle). client_score is informational
-- only, never used for ranking — see the leaderboard view below, which
-- derives elapsed time from server-timestamped round_completions instead
-- of trusting anything the client reports.
-- ---------------------------------------------------------------------
create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  puzzle_id uuid not null references daily_puzzles (id) on delete cascade,
  started_at timestamptz not null default now(),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  client_score int,
  final_board_state jsonb,
  unique (user_id, puzzle_id)
);

alter table game_sessions enable row level security;

create policy "completed sessions are publicly readable for leaderboards"
  on game_sessions for select
  using (status = 'completed');

create policy "users can read their own sessions"
  on game_sessions for select
  using (auth.uid() = user_id);

create policy "users can create their own sessions"
  on game_sessions for insert
  with check (auth.uid() = user_id);

create policy "users can update their own in-progress sessions"
  on game_sessions for update
  using (auth.uid() = user_id and status = 'in_progress');

-- ---------------------------------------------------------------------
-- round_completions
-- completed_at is always server `now()`, never client-supplied — this is
-- the anti-cheat mechanism the build plan calls for as a minimum bar. No
-- insert policy is defined here on purpose: the only way to insert a row
-- is through complete_round() below, which enforces session ownership and
-- rejects out-of-range round numbers.
-- ---------------------------------------------------------------------
create table round_completions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions (id) on delete cascade,
  round_number int not null,
  completed_at timestamptz not null default now(),
  unique (session_id, round_number)
);

alter table round_completions enable row level security;

create policy "users can read their own round completions"
  on round_completions for select
  using (
    exists (
      select 1 from game_sessions gs
      where gs.id = round_completions.session_id
        and gs.user_id = auth.uid()
    )
  );

-- Records a round completion with a server-authoritative timestamp and
-- marks the session completed once the final round comes in. This is
-- deliberately scoped to the build plan's stated minimum bar ("validate
-- round transitions server-side") — it does NOT re-validate the actual
-- board content submitted for the round, so a client could still call
-- this out of order without having genuinely solved each round. Real
-- board-state validation (reusing the client/solver validator logic
-- server-side) is a natural follow-up, not built yet.
create or replace function complete_round(
  p_session_id uuid,
  p_round_number int,
  p_total_rounds int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_round_number < 1 or p_round_number > p_total_rounds then
    raise exception 'round_number out of range';
  end if;

  if not exists (
    select 1 from game_sessions
    where id = p_session_id
      and user_id = auth.uid()
      and status = 'in_progress'
  ) then
    raise exception 'session not found, not owned by caller, or already finished';
  end if;

  insert into round_completions (session_id, round_number)
  values (p_session_id, p_round_number)
  on conflict (session_id, round_number) do nothing;

  if p_round_number >= p_total_rounds then
    update game_sessions set status = 'completed' where id = p_session_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- badges / badge_unlocks
-- badges is a small reference table (public read). badge_unlocks has no
-- insert policy for the same reason round_completions doesn't: unlocking
-- a badge should happen through a trusted server-side path (a future
-- function/trigger that evaluates criteria against completed sessions),
-- not a direct client insert a player could forge.
-- ---------------------------------------------------------------------
create table badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon text
);

alter table badges enable row level security;

create policy "badges are publicly readable"
  on badges for select
  using (true);

create table badge_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  badge_id uuid not null references badges (id) on delete cascade,
  session_id uuid references game_sessions (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

alter table badge_unlocks enable row level security;

create policy "users can read their own badge unlocks"
  on badge_unlocks for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- leaderboard view
-- Elapsed time is derived from round_completions timestamps, not any
-- client-reported field. security_invoker means the view runs with the
-- querying user's own RLS-filtered access to game_sessions underneath —
-- combined with the "completed sessions are publicly readable" policy
-- above, that's what makes the leaderboard actually public.
-- ---------------------------------------------------------------------
create view leaderboard
  with (security_invoker = true)
as
select
  gs.id as session_id,
  gs.user_id,
  p.username,
  gs.puzzle_id,
  dp.date as puzzle_date,
  gs.started_at,
  rc_last.completed_at as finished_at,
  extract(epoch from (rc_last.completed_at - gs.started_at))::int as elapsed_seconds,
  gs.client_score
from game_sessions gs
join profiles p on p.id = gs.user_id
join daily_puzzles dp on dp.id = gs.puzzle_id
join lateral (
  select completed_at
  from round_completions rc
  where rc.session_id = gs.id
  order by round_number desc
  limit 1
) rc_last on true
where gs.status = 'completed';
