alter table public.creature_portrait_jobs
add column if not exists counts_toward_daily_limit boolean not null default true;

comment on column public.creature_portrait_jobs.counts_toward_daily_limit is
    'True only for the first reservation of a user and immutable identity. Retries and style changes never spend new-identity quota.';

with ranked_jobs as (
    select
        id,
        row_number() over (
            partition by user_id, identity_key
            order by created_at asc, id asc
        ) as identity_attempt
    from public.creature_portrait_jobs
)
update public.creature_portrait_jobs jobs
set counts_toward_daily_limit = ranked_jobs.identity_attempt = 1
from ranked_jobs
where ranked_jobs.id = jobs.id;

create index if not exists creature_portrait_jobs_new_identity_quota_idx
on public.creature_portrait_jobs (user_id, created_at)
where counts_toward_daily_limit = true;

with ranked_active_jobs as (
    select
        id,
        row_number() over (
            partition by user_id, identity_key
            order by
                case status when 'succeeded' then 0 else 1 end,
                created_at desc,
                id desc
        ) as active_attempt
    from public.creature_portrait_jobs
    where status in ('starting', 'processing', 'succeeded')
)
update public.creature_portrait_jobs jobs
set status = 'failed',
    error_code = 'superseded_identity_job',
    updated_at = timezone('utc', now()),
    completed_at = coalesce(completed_at, timezone('utc', now()))
from ranked_active_jobs
where ranked_active_jobs.id = jobs.id
  and ranked_active_jobs.active_attempt > 1;

drop index if exists public.creature_portrait_jobs_active_identity_idx;
create unique index creature_portrait_jobs_active_identity_idx
on public.creature_portrait_jobs (user_id, identity_key)
where status in ('starting', 'processing', 'succeeded');

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
    identity_previously_seen boolean;
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
      and status = 'starting'
      and created_at < timezone('utc', now()) - interval '2 minutes';

    select *
    into existing_job
    from public.creature_portrait_jobs
    where user_id = p_user_id
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
        where user_id = p_user_id
          and identity_key = p_identity_key
    ) into identity_previously_seen;

    if not identity_previously_seen then
        select count(*), min(created_at) + interval '24 hours'
        into recent_count, retry_at
        from public.creature_portrait_jobs
        where user_id = p_user_id
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
    )
    values (
        p_user_id,
        p_identity_key,
        p_stage,
        p_style,
        not identity_previously_seen
    )
    returning * into new_job;

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
