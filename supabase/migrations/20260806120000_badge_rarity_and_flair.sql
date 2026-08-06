-- Adds rarity tiers to badges (common/rare/legendary/special, mirroring
-- Pushdle's own badge model) and a category column for the Badges page's
-- container grouping — an earlier pass approximated category client-side
-- since this session had no DB migration access yet; now that it does,
-- this replaces that workaround with the real thing.
--
-- Also adds profiles.selected_emoji for the "decorate your name with a
-- rare-or-better badge's emoji" flair feature, same pattern as Pushdle's
-- own selected_emoji column: a plain allowlist check (not a check that
-- THIS user actually earned that specific badge — that gating stays
-- client-side, same as Pushdle, see the comment there). The allowed list
-- must stay in sync with whichever badges are rarity >= rare — there's no
-- way to express "any icon belonging to a rare+ badge" as a static SQL
-- check, so this is deliberately a hand-maintained list, same tradeoff
-- Pushdle makes.
alter table badges add column category text not null default 'General';
alter table badges add column rarity text not null default 'common'
  check (rarity in ('common', 'rare', 'legendary', 'special'));

update badges set category = 'Milestones', rarity = 'common' where slug = 'placeholder_first_solve';
update badges set category = 'Skill', rarity = 'rare' where slug = 'placeholder_speedy';

insert into badges (slug, name, description, icon, category, rarity) values
  ('placeholder_perfectionist', 'Perfectionist', 'Complete a daily puzzle with a perfect score', '👑', 'Skill', 'legendary'),
  ('placeholder_day_one', 'Day One', 'Played on the very first day Tricktiles launched', '🌟', 'Milestones', 'special')
on conflict (slug) do nothing;

-- No explicit GRANTs here — matches the rest of this schema, which relies
-- entirely on RLS policies (+ Supabase's default table privileges) rather
-- than column-restricted grants. "users can update their own profile"
-- (already in place) covers this new column the same way it already
-- covers username: any column on your own row, gated by auth.uid() = id.
alter table profiles add column selected_emoji text
  check (selected_emoji is null or selected_emoji in ('⚡', '👑', '🌟'));
