create table if not exists public.player_privacy_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    age_group text not null
        check (age_group in ('age_16_17', 'age_18_plus')),
    ai_media_enabled boolean not null default false,
    assertion_version integer not null default 1
        check (assertion_version = 1),
    asserted_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.player_privacy_profiles is
    'Server-side record of the player self-attested age band used for optional AI media.';

alter table public.player_privacy_profiles enable row level security;
alter table public.player_privacy_profiles force row level security;
revoke all on table public.player_privacy_profiles from public, anon, authenticated;

create table if not exists public.creature_portrait_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    identity_key text not null
        check (char_length(identity_key) between 1 and 180),
    stage text not null
        check (stage in ('baby', 'juvenile', 'adult', 'elder')),
    style text not null
        check (style in ('cinematic', 'storybook', 'cosmic', 'watercolor')),
    status text not null default 'starting'
        check (status in ('starting', 'processing', 'succeeded', 'failed', 'canceled')),
    provider text,
    model text,
    provider_prediction_id text,
    storage_path text,
    error_code text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    completed_at timestamptz
);

comment on table public.creature_portrait_jobs is
    'Private AI portrait jobs. Provider IDs and storage paths are never directly readable by browser roles.';

create index if not exists creature_portrait_jobs_user_created_idx
on public.creature_portrait_jobs (user_id, created_at desc);

create unique index if not exists creature_portrait_jobs_active_identity_idx
on public.creature_portrait_jobs (user_id, identity_key, style)
where status in ('starting', 'processing', 'succeeded');

alter table public.creature_portrait_jobs enable row level security;
alter table public.creature_portrait_jobs force row level security;
revoke all on table public.creature_portrait_jobs from public, anon, authenticated;

create or replace function public.reserve_creature_portrait_job(
    p_user_id uuid,
    p_identity_key text,
    p_stage text,
    p_style text,
    p_daily_limit integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing_job public.creature_portrait_jobs%rowtype;
    new_job public.creature_portrait_jobs%rowtype;
    recent_count integer;
    retry_at timestamptz;
begin
    if p_daily_limit < 1 or p_daily_limit > 20 then
        raise exception 'invalid portrait limit';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    if not exists (
        select 1
        from public.player_privacy_profiles profile
        where profile.user_id = p_user_id
          and profile.ai_media_enabled = true
          and profile.age_group in ('age_16_17', 'age_18_plus')
    ) then
        return jsonb_build_object('allowed', false, 'reason', 'age_restricted');
    end if;

    update public.creature_portrait_jobs
    set status = 'failed',
        error_code = 'stale_start',
        updated_at = timezone('utc', now()),
        completed_at = timezone('utc', now())
    where user_id = p_user_id
      and identity_key = p_identity_key
      and style = p_style
      and status = 'starting'
      and created_at < timezone('utc', now()) - interval '2 minutes';

    select *
    into existing_job
    from public.creature_portrait_jobs
    where user_id = p_user_id
      and identity_key = p_identity_key
      and style = p_style
      and status in ('starting', 'processing', 'succeeded')
    order by created_at desc
    limit 1;

    if found then
        return jsonb_build_object(
            'allowed', true,
            'reused', true,
            'job_id', existing_job.id,
            'status', existing_job.status
        );
    end if;

    select count(*), min(created_at) + interval '24 hours'
    into recent_count, retry_at
    from public.creature_portrait_jobs
    where user_id = p_user_id
      and created_at >= timezone('utc', now()) - interval '24 hours';

    if recent_count >= p_daily_limit then
        return jsonb_build_object(
            'allowed', false,
            'reason', 'rate_limited',
            'retry_at', retry_at
        );
    end if;

    insert into public.creature_portrait_jobs (
        user_id,
        identity_key,
        stage,
        style
    )
    values (
        p_user_id,
        p_identity_key,
        p_stage,
        p_style
    )
    returning * into new_job;

    return jsonb_build_object(
        'allowed', true,
        'reused', false,
        'job_id', new_job.id,
        'status', new_job.status
    );
end;
$$;

revoke all on function public.reserve_creature_portrait_job(
    uuid,
    text,
    text,
    text,
    integer
) from public, anon, authenticated;
grant execute on function public.reserve_creature_portrait_job(
    uuid,
    text,
    text,
    text,
    integer
) to service_role;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'creature-portraits',
    'creature-portraits',
    false,
    12582912,
    array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
