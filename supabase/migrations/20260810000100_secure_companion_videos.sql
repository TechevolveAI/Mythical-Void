create table if not exists public.companion_video_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    portrait_job_id uuid not null references public.creature_portrait_jobs(id) on delete cascade,
    identity_key text not null
        check (char_length(identity_key) between 1 and 180),
    stage text not null
        check (stage in ('baby', 'juvenile', 'adult', 'elder')),
    moment_id text not null
        check (moment_id ~ '^[a-z0-9][a-z0-9:_-]{0,63}$'),
    shot_version integer not null default 1
        check (shot_version between 1 and 100),
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

comment on table public.companion_video_jobs is
    'Private personalized story-video jobs. Browser roles cannot read provider IDs or storage paths.';

create index if not exists companion_video_jobs_user_created_idx
on public.companion_video_jobs (user_id, created_at desc);

create unique index if not exists companion_video_jobs_active_moment_idx
on public.companion_video_jobs (
    user_id,
    portrait_job_id,
    moment_id,
    shot_version
)
where status in ('starting', 'processing', 'succeeded');

alter table public.companion_video_jobs enable row level security;
alter table public.companion_video_jobs force row level security;
revoke all on table public.companion_video_jobs from public, anon, authenticated;

create or replace function public.reserve_companion_video_job(
    p_user_id uuid,
    p_portrait_job_id uuid,
    p_moment_id text,
    p_shot_version integer default 1,
    p_daily_limit integer default 2
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    portrait_job public.creature_portrait_jobs%rowtype;
    existing_job public.companion_video_jobs%rowtype;
    new_job public.companion_video_jobs%rowtype;
    recent_count integer;
    retry_at timestamptz;
begin
    if p_daily_limit < 1 or p_daily_limit > 10 then
        raise exception 'invalid video limit';
    end if;
    if p_shot_version < 1 or p_shot_version > 100 then
        raise exception 'invalid shot version';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 23));

    if not exists (
        select 1
        from public.player_privacy_profiles profile
        where profile.user_id = p_user_id
          and profile.ai_media_enabled = true
          and profile.age_group in ('age_16_17', 'age_18_plus')
    ) then
        return jsonb_build_object('allowed', false, 'reason', 'age_restricted');
    end if;

    select *
    into portrait_job
    from public.creature_portrait_jobs
    where id = p_portrait_job_id
      and user_id = p_user_id
      and status = 'succeeded'
      and storage_path is not null;

    if not found then
        return jsonb_build_object('allowed', false, 'reason', 'portrait_unavailable');
    end if;

    update public.companion_video_jobs
    set status = 'failed',
        error_code = 'stale_start',
        updated_at = timezone('utc', now()),
        completed_at = timezone('utc', now())
    where user_id = p_user_id
      and portrait_job_id = p_portrait_job_id
      and moment_id = p_moment_id
      and shot_version = p_shot_version
      and status = 'starting'
      and created_at < timezone('utc', now()) - interval '10 minutes';

    select *
    into existing_job
    from public.companion_video_jobs
    where user_id = p_user_id
      and portrait_job_id = p_portrait_job_id
      and moment_id = p_moment_id
      and shot_version = p_shot_version
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
    from public.companion_video_jobs
    where user_id = p_user_id
      and created_at >= timezone('utc', now()) - interval '24 hours';

    if recent_count >= p_daily_limit then
        return jsonb_build_object(
            'allowed', false,
            'reason', 'rate_limited',
            'retry_at', retry_at
        );
    end if;

    insert into public.companion_video_jobs (
        user_id,
        portrait_job_id,
        identity_key,
        stage,
        moment_id,
        shot_version
    )
    values (
        p_user_id,
        portrait_job.id,
        portrait_job.identity_key,
        portrait_job.stage,
        p_moment_id,
        p_shot_version
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

revoke all on function public.reserve_companion_video_job(
    uuid,
    uuid,
    text,
    integer,
    integer
) from public, anon, authenticated;
grant execute on function public.reserve_companion_video_job(
    uuid,
    uuid,
    text,
    integer,
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
    'companion-videos',
    'companion-videos',
    false,
    52428800,
    array['video/mp4']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
