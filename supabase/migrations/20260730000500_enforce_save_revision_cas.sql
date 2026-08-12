-- Promoted from the deferred post-deploy step after deploy
-- 6a6b9306422cdc14b5dbe29e was verified to call save_game_state.
-- Reads and explicit deletion continue through table RLS policies.
revoke insert, update on table public.game_saves from authenticated;

comment on table public.game_saves is
    'Optional Mythical Void cloud saves. Writes use save_game_state compare-and-swap; local browser saves remain available.';
