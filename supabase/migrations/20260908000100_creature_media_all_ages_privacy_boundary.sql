-- Creature media describes a fictional creature and is available to every
-- selected age band. Cloud Save and social features keep their own age rules.
-- Anonymous auth remains an ownership and abuse-control boundary only.

alter table public.companion_video_jobs
add column if not exists counts_toward_daily_limit boolean not null default true;

alter table public.companion_video_jobs
add column if not exists input_storage_path text;

update public.companion_video_jobs
set counts_toward_daily_limit = false
where status in ('failed', 'canceled');

create index if not exists companion_video_jobs_quota_idx
on public.companion_video_jobs (user_id, created_at)
where counts_toward_daily_limit = true;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
) values (
    'creature-media-inputs',
    'creature-media-inputs',
    false,
    12582912,
    array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Remove the former service-role overloads that accepted an arbitrary owner.
-- Reservations now derive ownership only from the authenticated JWT.
drop function if exists public.reserve_creature_portrait_job(
    uuid, text, text, text, integer
);
drop function if exists public.reserve_companion_video_job(
    uuid, uuid, text, integer, integer
);

create or replace function public.reserve_creature_portrait_job(
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
    v_user_id uuid := auth.uid();
    existing_job public.creature_portrait_jobs%rowtype;
    new_job public.creature_portrait_jobs%rowtype;
    identity_previously_seen boolean;
    recent_count integer;
    retry_at timestamptz;
begin
    if v_user_id is null then
        return jsonb_build_object('allowed', false, 'reason', 'authentication_required');
    end if;
    if p_daily_limit < 1 or p_daily_limit > 20 then
        raise exception 'invalid portrait limit';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

    update public.creature_portrait_jobs
    set status = 'failed',
        error_code = 'stale_start',
        counts_toward_daily_limit = false,
        updated_at = timezone('utc', now()),
        completed_at = timezone('utc', now())
    where user_id = v_user_id
      and identity_key = p_identity_key
      and status = 'starting'
      and created_at < timezone('utc', now()) - interval '2 minutes';

    select *
    into existing_job
    from public.creature_portrait_jobs
    where user_id = v_user_id
      and identity_key = p_identity_key
      and status in ('starting', 'processing', 'succeeded')
    order by created_at desc
    limit 1;

    if found then
        return jsonb_build_object(
            'allowed', true,
            'reused', true,
            'job_id', existing_job.id,
            'status', existing_job.status,
            'counts_toward_daily_limit', false
        );
    end if;

    select exists (
        select 1
        from public.creature_portrait_jobs
        where user_id = v_user_id
          and identity_key = p_identity_key
    ) into identity_previously_seen;

    if not identity_previously_seen then
        select count(*), min(created_at) + interval '24 hours'
        into recent_count, retry_at
        from public.creature_portrait_jobs
        where user_id = v_user_id
          and counts_toward_daily_limit = true
          and created_at >= timezone('utc', now()) - interval '24 hours';

        if recent_count >= p_daily_limit then
            return jsonb_build_object(
                'allowed', false,
                'reason', 'rate_limited',
                'retry_at', retry_at
            );
        end if;
    end if;

    insert into public.creature_portrait_jobs (
        user_id,
        identity_key,
        stage,
        style,
        counts_toward_daily_limit
    ) values (
        v_user_id,
        p_identity_key,
        p_stage,
        p_style,
        not identity_previously_seen
    ) returning * into new_job;

    return jsonb_build_object(
        'allowed', true,
        'reused', false,
        'retry', identity_previously_seen,
        'job_id', new_job.id,
        'status', new_job.status,
        'counts_toward_daily_limit', new_job.counts_toward_daily_limit
    );
end;
$$;

revoke all on function public.reserve_creature_portrait_job(
    text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.reserve_creature_portrait_job(
    text, text, text, integer
) to authenticated;

create or replace function public.reserve_companion_video_job(
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
    v_user_id uuid := auth.uid();
    portrait_job public.creature_portrait_jobs%rowtype;
    existing_job public.companion_video_jobs%rowtype;
    new_job public.companion_video_jobs%rowtype;
    recent_count integer;
    retry_at timestamptz;
begin
    if v_user_id is null then
        return jsonb_build_object('allowed', false, 'reason', 'authentication_required');
    end if;
    if p_daily_limit < 1 or p_daily_limit > 10 then
        raise exception 'invalid video limit';
    end if;
    if p_shot_version < 1 or p_shot_version > 100 then
        raise exception 'invalid shot version';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 23));

    select *
    into portrait_job
    from public.creature_portrait_jobs
    where id = p_portrait_job_id
      and user_id = v_user_id
      and status = 'succeeded'
      and storage_path is not null;

    if not found then
        return jsonb_build_object('allowed', false, 'reason', 'portrait_unavailable');
    end if;

    update public.companion_video_jobs
    set status = 'failed',
        error_code = 'stale_start',
        counts_toward_daily_limit = false,
        updated_at = timezone('utc', now()),
        completed_at = timezone('utc', now())
    where user_id = v_user_id
      and portrait_job_id = p_portrait_job_id
      and moment_id = p_moment_id
      and shot_version = p_shot_version
      and status = 'starting'
      and created_at < timezone('utc', now()) - interval '10 minutes';

    select *
    into existing_job
    from public.companion_video_jobs
    where user_id = v_user_id
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
    where user_id = v_user_id
      and counts_toward_daily_limit = true
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
        shot_version,
        counts_toward_daily_limit
    ) values (
        v_user_id,
        portrait_job.id,
        portrait_job.identity_key,
        portrait_job.stage,
        p_moment_id,
        p_shot_version,
        true
    ) returning * into new_job;

    return jsonb_build_object(
        'allowed', true,
        'reused', false,
        'job_id', new_job.id,
        'status', new_job.status
    );
end;
$$;

revoke all on function public.reserve_companion_video_job(
    uuid, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.reserve_companion_video_job(
    uuid, text, integer, integer
) to authenticated;

comment on table public.creature_portrait_jobs is
    'Private fictional-creature media jobs. Player identity is never sent to an image model.';
comment on table public.companion_video_jobs is
    'Private fictional-creature story-video jobs. Player identity is never sent to a video model.';
