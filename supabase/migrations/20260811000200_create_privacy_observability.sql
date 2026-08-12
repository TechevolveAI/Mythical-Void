create table if not exists public.game_observability_events (
    id uuid primary key,
    received_at timestamptz not null default now(),
    occurred_at timestamptz not null,
    category text not null check (category in (
        'runtime', 'scene_transition', 'persistence', 'network', 'stuck_flow'
    )),
    code text not null check (code in (
        'runtime_uncaught',
        'promise_unhandled',
        'phaser_error',
        'scene_error',
        'scene_loading_timeout',
        'scene_no_active',
        'local_save_failed',
        'local_load_failed',
        'cloud_save_failed',
        'cloud_load_failed',
        'cloud_sync_failed',
        'cloud_sync_stalled',
        'cloud_save_conflict',
        'network_request_failed',
        'game_boot_failed',
        'unknown_critical'
    )),
    severity text not null check (severity in ('warning', 'error')),
    scene text not null,
    phase text not null check (phase in (
        'boot', 'runtime', 'start', 'create', 'transition', 'save', 'load', 'sync', 'unknown'
    )),
    recovery text not null check (recovery in (
        'continued', 'local_fallback', 'retry_scheduled', 'reload_offered',
        'manual_retry', 'none', 'unknown'
    )),
    connectivity text not null check (connectivity in ('online', 'offline', 'unknown')),
    viewport_class text not null check (viewport_class in ('compact', 'medium', 'wide', 'unknown')),
    user_visible boolean not null default false,
    deployment_id text not null default 'unknown',
    constraint game_observability_scene_length check (char_length(scene) between 1 and 64),
    constraint game_observability_deployment_length check (char_length(deployment_id) between 1 and 80)
);

comment on table public.game_observability_events is
    'PII-free operational diagnostics. No user ID, session ID, IP address, creature name, free text, stack, save payload, or coordinates.';
comment on column public.game_observability_events.scene is
    'Allowlisted Phaser scene key only; unknown values are stored as unknown.';

create index if not exists game_observability_received_at_idx
    on public.game_observability_events (received_at desc);
create index if not exists game_observability_code_received_idx
    on public.game_observability_events (code, received_at desc);

alter table public.game_observability_events enable row level security;
revoke all on table public.game_observability_events from anon, authenticated;
grant select, insert, delete on table public.game_observability_events to service_role;

create or replace function public.purge_old_game_observability_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.game_observability_events
    where received_at < now() - interval '30 days';
    return null;
end;
$$;

revoke all on function public.purge_old_game_observability_events() from public;
grant execute on function public.purge_old_game_observability_events() to service_role;

drop trigger if exists purge_old_game_observability_events_on_insert
    on public.game_observability_events;
create trigger purge_old_game_observability_events_on_insert
after insert on public.game_observability_events
for each statement execute function public.purge_old_game_observability_events();
