-- Adds profiles.wheel_mode: whether scrolling the mouse wheel over the
-- board/rack/controls scrolls the page normally ('scroll', the default —
-- doesn't hijack anything) or zooms the board/rack/controls in and out
-- ('zoom'). Synced to the account (not just localStorage) so it follows
-- the player across devices, same as selected_emoji. No new RLS policy
-- needed — "users can update their own profile" already covers any
-- column on this row, the check constraint below is what actually
-- constrains the value.
alter table profiles add column wheel_mode text not null default 'scroll'
  check (wheel_mode in ('scroll', 'zoom'));
