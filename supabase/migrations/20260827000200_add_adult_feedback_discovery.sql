alter table public.adult_feedback_pulses
    add column if not exists discovery_source text not null default 'not_asked',
    add column if not exists try_reason text not null default 'not_asked';

alter table public.adult_feedback_pulses
    drop constraint if exists adult_feedback_discovery_source_check,
    add constraint adult_feedback_discovery_source_check check (discovery_source in (
        'friend_family', 'search', 'social_video', 'school_library_club',
        'website_creator', 'knew_founder_studio', 'not_sure', 'not_asked'
    )),
    drop constraint if exists adult_feedback_try_reason_check,
    add constraint adult_feedback_try_reason_check check (try_reason in (
        'creature_hatch', 'world_story', 'missions_action', 'nasa_stem',
        'free_easy_start', 'father_son_story', 'hatch_invitation',
        'not_sure', 'not_asked'
    ));

comment on column public.adult_feedback_pulses.discovery_source is
    'Adult-selected broad discovery route. No referrer URL, account, contact, device or location is stored.';

comment on column public.adult_feedback_pulses.try_reason is
    'Adult-selected reason for trying Mythical Void. Fixed choice only; no free text is stored.';

