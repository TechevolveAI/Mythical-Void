create table if not exists public.adult_feedback_pulses (
    id bigint generated always as identity primary key,
    received_at timestamptz not null default now(),
    audience_role text not null check (audience_role in (
        'adult_player', 'parent_guardian', 'educator', 'other_adult'
    )),
    journey text not null check (journey in (
        'not_started', 'started', 'hatched', 'explored', 'restored'
    )),
    overall text not null check (overall in (
        'loved_it', 'promising', 'confusing', 'could_not_start'
    )),
    best_part text not null check (best_part in (
        'creature', 'world_story', 'exploration_action', 'building_choices',
        'nasa_stem', 'not_sure'
    )),
    next_improvement text not null check (next_improvement in (
        'creature_visibility', 'instructions', 'controls', 'phone_layout',
        'performance', 'story_clarity', 'more_content', 'nothing_yet'
    )),
    recommendation text not null check (recommendation in ('yes', 'maybe', 'no')),
    release_id text not null default 'unknown',
    constraint adult_feedback_release_length check (char_length(release_id) between 1 and 80)
);

comment on table public.adult_feedback_pulses is
    'Adult-confirmed, fixed-choice Mythical Void feedback. No name, email, user ID, session ID, IP address, creature name, free text, exact age, device detail or location.';

create index if not exists adult_feedback_received_at_idx
    on public.adult_feedback_pulses (received_at desc);

alter table public.adult_feedback_pulses enable row level security;
alter table public.adult_feedback_pulses force row level security;
revoke all on table public.adult_feedback_pulses from anon, authenticated;
grant select, insert, delete on table public.adult_feedback_pulses to service_role;

create or replace function public.purge_old_adult_feedback_pulses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.adult_feedback_pulses
    where received_at < now() - interval '180 days';
    return null;
end;
$$;

revoke all on function public.purge_old_adult_feedback_pulses() from public;
grant execute on function public.purge_old_adult_feedback_pulses() to service_role;

drop trigger if exists purge_old_adult_feedback_pulses_on_insert
    on public.adult_feedback_pulses;
create trigger purge_old_adult_feedback_pulses_on_insert
after insert on public.adult_feedback_pulses
for each statement execute function public.purge_old_adult_feedback_pulses();
