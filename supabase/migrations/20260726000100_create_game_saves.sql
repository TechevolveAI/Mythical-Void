create table if not exists public.game_saves (
    user_id uuid not null references auth.users(id) on delete cascade,
    save_slot text not null default 'primary'
        check (save_slot ~ '^[a-z0-9_-]{1,32}$'),
    save_version text not null
        check (char_length(save_version) between 1 and 32),
    revision bigint not null default 1
        check (revision > 0),
    game_state jsonb not null
        check (jsonb_typeof(game_state) = 'object')
        check (octet_length(game_state::text) <= 2097152),
    client_saved_at timestamptz not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (user_id, save_slot)
);

comment on table public.game_saves is
    'Optional Mythical Void cloud saves. Local browser saves remain the primary persistence layer.';
comment on column public.game_saves.game_state is
    'Versioned, privacy-filtered game-state snapshot. Session and guardian secrets are excluded.';

create or replace function public.prepare_game_save_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        new.revision := 1;
        new.created_at := timezone('utc', now());
    else
        new.user_id := old.user_id;
        new.save_slot := old.save_slot;
        new.created_at := old.created_at;
        new.revision := old.revision + 1;
    end if;

    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists prepare_game_save_write on public.game_saves;
create trigger prepare_game_save_write
before insert or update on public.game_saves
for each row execute function public.prepare_game_save_write();

alter table public.game_saves enable row level security;
alter table public.game_saves force row level security;

revoke all on table public.game_saves from anon;
revoke all on table public.game_saves from authenticated;
grant select, insert, update, delete on table public.game_saves to authenticated;

drop policy if exists "Players can read their own saves" on public.game_saves;
create policy "Players can read their own saves"
on public.game_saves
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Players can create their own saves" on public.game_saves;
create policy "Players can create their own saves"
on public.game_saves
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Players can update their own saves" on public.game_saves;
create policy "Players can update their own saves"
on public.game_saves
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Players can delete their own saves" on public.game_saves;
create policy "Players can delete their own saves"
on public.game_saves
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on function public.prepare_game_save_write() from public;
