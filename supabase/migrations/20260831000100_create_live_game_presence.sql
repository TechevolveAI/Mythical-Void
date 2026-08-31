create table if not exists public.live_game_presence (
    session_hash text primary key,
    last_seen_at timestamptz not null default now(),
    constraint live_game_presence_hash_format
        check (session_hash ~ '^[0-9a-f]{64}$')
);

alter table public.live_game_presence enable row level security;

revoke all on table public.live_game_presence from public, anon, authenticated;

create index if not exists live_game_presence_last_seen_idx
    on public.live_game_presence (last_seen_at);

create or replace function public.touch_live_game_presence(
    p_session_hash text default null,
    p_active_seconds integer default 90
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    safe_active_seconds integer := greatest(30, least(coalesce(p_active_seconds, 90), 180));
    active_count integer;
begin
    if p_session_hash is not null then
        if p_session_hash !~ '^[0-9a-f]{64}$' then
            raise exception 'Invalid presence hash';
        end if;

        insert into public.live_game_presence (session_hash, last_seen_at)
        values (p_session_hash, now())
        on conflict (session_hash)
        do update set last_seen_at = excluded.last_seen_at;
    end if;

    delete from public.live_game_presence
    where last_seen_at < now() - interval '10 minutes';

    select count(*)::integer
    into active_count
    from public.live_game_presence
    where last_seen_at >= now() - make_interval(secs => safe_active_seconds);

    return active_count;
end;
$$;

revoke all on function public.touch_live_game_presence(text, integer)
    from public, anon, authenticated;
grant execute on function public.touch_live_game_presence(text, integer)
    to service_role;

comment on table public.live_game_presence is
    'Short-lived, one-way anonymous game-session heartbeats used for the approximate Playing now website signal.';
comment on function public.touch_live_game_presence(text, integer) is
    'Refreshes an anonymous active-game heartbeat and returns the current active-session count.';
