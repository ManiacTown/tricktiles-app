-- Actually grants badges — until now, badge_unlocks had a SELECT policy
-- and nothing else, matching the original schema comment's plan to defer
-- this to "a future function/trigger that evaluates criteria against
-- completed sessions" rather than let a client insert one directly.
--
-- A trigger (not a second RPC the client would have to remember to call)
-- so this rides along inside the same already-trusted complete_round()
-- transaction that flips a session to 'completed' — it can't be skipped
-- by a closed tab or a forgotten follow-up call.

-- placeholder_first_solve and placeholder_speedy already exist as live
-- rows in this project (created directly, never captured in a
-- migration) — these two inserts just make that reproducible from a
-- clean database too; on conflict do nothing means they're a no-op
-- against the already-existing live data.
insert into badges (slug, name, description, icon, category, rarity) values
  ('placeholder_first_solve', 'First Solve', 'Complete your first daily puzzle.', '🎉', 'Milestones', 'common'),
  ('placeholder_speedy', 'Speedy', 'Complete a daily puzzle in under 3 minutes.', '⚡', 'Skill', 'rare')
on conflict (slug) do nothing;

-- placeholder_perfectionist ("a perfect score") is left untouched here —
-- score was removed from the game, so its current description no longer
-- means anything, but its replacement meaning/criteria is still TBD.
-- No unlock logic for it yet; revisit once its new description exists.

-- placeholder_day_one ("played on the very first day Tricktiles
-- launched") is also deliberately left alone — there's no way to replay
-- a past day's puzzle, so it can only ever have been earned on the
-- actual launch day, which has already passed. Building automatic
-- criteria for a badge nobody can earn through normal play going forward
-- would just be dead code; left as a manually-grantable relic instead.

create or replace function check_and_grant_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_count int;
  elapsed_seconds int;
begin
  -- Only act on the actual in_progress -> completed transition, not
  -- every update to this row (e.g. final_board_state saves).
  if new.status != 'completed' or old.status = 'completed' then
    return new;
  end if;

  select count(*) into completed_count
  from game_sessions
  where user_id = new.user_id and status = 'completed';

  if completed_count = 1 then
    insert into badge_unlocks (user_id, badge_id, session_id)
    select new.user_id, id, new.id from badges where slug = 'placeholder_first_solve'
    on conflict (user_id, badge_id) do nothing;
  end if;

  -- Same elapsed-time expression the leaderboard view already uses, for
  -- consistency: seconds between session start and the LAST round's
  -- completion timestamp.
  select extract(epoch from (rc_last.completed_at - new.started_at))::int into elapsed_seconds
  from round_completions rc_last
  where rc_last.session_id = new.id
  order by rc_last.round_number desc
  limit 1;

  if elapsed_seconds is not null and elapsed_seconds < 180 then
    insert into badge_unlocks (user_id, badge_id, session_id)
    select new.user_id, id, new.id from badges where slug = 'placeholder_speedy'
    on conflict (user_id, badge_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists badges_on_session_complete on game_sessions;
create trigger badges_on_session_complete
  after update of status on game_sessions
  for each row
  execute function check_and_grant_badges();
