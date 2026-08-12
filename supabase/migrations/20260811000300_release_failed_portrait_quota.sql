update public.creature_portrait_jobs
set counts_toward_daily_limit = false,
    updated_at = timezone('utc', now())
where counts_toward_daily_limit = true
  and status in ('failed', 'canceled');

comment on column public.creature_portrait_jobs.counts_toward_daily_limit is
    'True only while a new immutable identity reservation is active or has a usable secured portrait. Failed and canceled generations release capacity.';
