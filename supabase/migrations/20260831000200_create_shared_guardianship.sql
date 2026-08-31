-- Shared Guardianship V1: one canonical child, two private guardians.
-- Existing two-sibling Shared Fusion records and functions are intentionally
-- left unchanged as the rollback boundary.

create table if not exists public.shared_guardianship_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    age_band text not null check (age_band in ('age_16_17', 'age_18_plus')),
    terms_version text not null check (terms_version ~ '^[A-Za-z0-9_-]{1,80}$'),
    privacy_version text not null check (privacy_version ~ '^[A-Za-z0-9_-]{1,80}$'),
    attested_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shared_guardianship_invitations (
    invitation_id uuid primary key default gen_random_uuid(),
    code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
    host_user_id uuid not null references auth.users(id) on delete cascade,
    guest_user_id uuid references auth.users(id) on delete cascade,
    host_parent_id text not null check (host_parent_id ~ '^[A-Za-z0-9_-]{1,180}$'),
    guest_parent_id text check (guest_parent_id is null or guest_parent_id ~ '^[A-Za-z0-9_-]{1,180}$'),
    host_parent_fingerprint text not null check (host_parent_fingerprint ~ '^[0-9a-f]{32}$'),
    guest_parent_fingerprint text check (guest_parent_fingerprint is null or guest_parent_fingerprint ~ '^[0-9a-f]{32}$'),
    host_parent_record jsonb not null check (jsonb_typeof(host_parent_record) = 'object') check (octet_length(host_parent_record::text) <= 32768),
    guest_parent_record jsonb check (guest_parent_record is null or jsonb_typeof(guest_parent_record) = 'object') check (guest_parent_record is null or octet_length(guest_parent_record::text) <= 32768),
    host_save_revision bigint not null check (host_save_revision > 0),
    guest_save_revision bigint check (guest_save_revision > 0),
    host_confirmed_at timestamptz,
    guest_confirmed_at timestamptz,
    host_name_choice text,
    guest_name_choice text,
    status text not null default 'waiting' check (status in ('waiting', 'paired', 'ready', 'executing', 'staged', 'committed', 'cancelled', 'expired')),
    operation_id text unique check (operation_id is null or operation_id ~ '^fusion_guardianship_[A-Za-z0-9_-]{1,160}$'),
    child_id uuid unique,
    child_runtime_id text unique check (child_runtime_id is null or child_runtime_id ~ '^creature_guardianship_[A-Za-z0-9_-]{1,180}$'),
    result_receipt jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    expires_at timestamptz not null default timezone('utc', now()) + interval '30 minutes',
    committed_at timestamptz,
    check (guest_user_id is null or guest_user_id <> host_user_id),
    check (
        (guest_user_id is null and guest_parent_id is null and guest_parent_fingerprint is null and guest_parent_record is null and guest_save_revision is null)
        or
        (guest_user_id is not null and guest_parent_id is not null and guest_parent_fingerprint is not null and guest_parent_record is not null and guest_save_revision is not null)
    )
);

create table if not exists public.shared_guardianship_join_attempts (
    attempt_id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    attempted_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shared_guardianship_creatures (
    creature_id uuid primary key,
    runtime_id text not null unique check (runtime_id ~ '^creature_guardianship_[A-Za-z0-9_-]{1,180}$'),
    source_invitation_id uuid unique references public.shared_guardianship_invitations(invitation_id) on delete set null,
    name text not null check (name in ('Aster', 'Beacon', 'Cinder', 'Echo', 'Lumen', 'Nova', 'Orbit', 'Solace')),
    genes jsonb not null check (jsonb_typeof(genes) = 'object') check (octet_length(genes::text) <= 262144),
    lifecycle jsonb not null check (jsonb_typeof(lifecycle) = 'object'),
    care_state jsonb not null check (jsonb_typeof(care_state) = 'object'),
    revision bigint not null default 1 check (revision > 0),
    status text not null default 'active' check (status in ('active', 'archived')),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.shared_guardianship_invitations
    add constraint shared_guardianship_invitation_child_fk
    foreign key (child_id) references public.shared_guardianship_creatures(creature_id) on delete set null
    deferrable initially deferred;

create table if not exists public.shared_guardianship_participants (
    creature_id uuid not null references public.shared_guardianship_creatures(creature_id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('host', 'guest')),
    guardian_label text not null check (guardian_label in ('Guardian A', 'Guardian B')),
    status text not null default 'active' check (status in ('active', 'left')),
    terms_version text not null,
    privacy_version text not null,
    notifications_muted boolean not null default false,
    joined_at timestamptz not null default timezone('utc', now()),
    left_at timestamptz,
    primary key (creature_id, user_id),
    unique (creature_id, role)
);

create table if not exists public.shared_guardianship_parentage (
    creature_id uuid not null references public.shared_guardianship_creatures(creature_id) on delete cascade,
    source_role text not null check (source_role in ('host', 'guest')),
    parent_fingerprint text not null check (parent_fingerprint ~ '^[0-9a-f]{32}$'),
    parent_reference text not null check (parent_reference ~ '^protected-parent-v1:[0-9a-f]{32}$'),
    primary key (creature_id, source_role)
);

create table if not exists public.shared_guardianship_events (
    event_id uuid primary key default gen_random_uuid(),
    creature_id uuid not null references public.shared_guardianship_creatures(creature_id) on delete cascade,
    actor_user_id uuid references auth.users(id) on delete set null,
    actor_label text not null check (actor_label in ('Guardian A', 'Guardian B', 'The Fusion Pod')),
    idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,120}$'),
    event_kind text not null check (event_kind in ('birth', 'tend', 'play', 'rest', 'departure')),
    summary text not null check (char_length(summary) between 1 and 160),
    payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object') check (octet_length(payload::text) <= 8192),
    before_revision bigint not null check (before_revision >= 0),
    after_revision bigint not null check (after_revision > before_revision),
    created_at timestamptz not null default timezone('utc', now()),
    unique (creature_id, idempotency_key)
);

create index if not exists shared_guardianship_invite_host_live_idx on public.shared_guardianship_invitations(host_user_id, expires_at desc);
create index if not exists shared_guardianship_invite_guest_live_idx on public.shared_guardianship_invitations(guest_user_id, expires_at desc) where guest_user_id is not null;
create index if not exists shared_guardianship_join_attempts_idx on public.shared_guardianship_join_attempts(user_id, attempted_at desc);
create index if not exists shared_guardianship_events_creature_idx on public.shared_guardianship_events(creature_id, after_revision desc);
create unique index if not exists shared_guardianship_one_active_per_user_idx
on public.shared_guardianship_participants(user_id)
where status = 'active';

alter table public.shared_guardianship_profiles enable row level security;
alter table public.shared_guardianship_profiles force row level security;
alter table public.shared_guardianship_invitations enable row level security;
alter table public.shared_guardianship_invitations force row level security;
alter table public.shared_guardianship_join_attempts enable row level security;
alter table public.shared_guardianship_join_attempts force row level security;
alter table public.shared_guardianship_creatures enable row level security;
alter table public.shared_guardianship_creatures force row level security;
alter table public.shared_guardianship_participants enable row level security;
alter table public.shared_guardianship_participants force row level security;
alter table public.shared_guardianship_parentage enable row level security;
alter table public.shared_guardianship_parentage force row level security;
alter table public.shared_guardianship_events enable row level security;
alter table public.shared_guardianship_events force row level security;

revoke all on table public.shared_guardianship_profiles from anon, authenticated;
revoke all on table public.shared_guardianship_invitations from anon, authenticated;
revoke all on table public.shared_guardianship_join_attempts from anon, authenticated;
revoke all on table public.shared_guardianship_creatures from anon, authenticated;
revoke all on table public.shared_guardianship_participants from anon, authenticated;
revoke all on table public.shared_guardianship_parentage from anon, authenticated;
revoke all on table public.shared_guardianship_events from anon, authenticated;

create or replace function public.shared_guardianship_user_is_permanent(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from auth.users as account
        where account.id = p_user_id
          and account.is_anonymous is false
          and account.email is not null
          and account.email_confirmed_at is not null
    );
$$;

create or replace function public.shared_guardianship_require_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'authentication_required' using errcode = '42501';
    end if;
    if not public.shared_guardianship_user_is_permanent(v_user_id) then
        raise exception 'shared_guardianship_permanent_identity_required' using errcode = '42501';
    end if;
    return v_user_id;
end;
$$;

create or replace function public.shared_guardianship_user_is_eligible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.shared_guardianship_user_is_permanent(p_user_id)
       and exists (
            select 1
            from public.shared_guardianship_profiles as profile
            where profile.user_id = p_user_id
              and profile.age_band in ('age_16_17', 'age_18_plus')
              and profile.terms_version = 'shared-guardianship-2026-08-31'
              and profile.privacy_version = 'shared-guardianship-2026-08-31'
       );
$$;

create or replace function public.shared_guardianship_require_eligible_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_user();
begin
    if not public.shared_guardianship_user_is_eligible(v_user_id) then
        raise exception 'shared_guardianship_eligibility_required' using errcode = '42501';
    end if;
    return v_user_id;
end;
$$;

create or replace function public.shared_guardianship_invitation_view(
    p_invitation public.shared_guardianship_invitations,
    p_user_id uuid
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
    v_role text;
    v_peer jsonb;
    v_own_parent_id text;
begin
    if p_user_id = p_invitation.host_user_id then
        v_role := 'host';
        v_peer := p_invitation.guest_parent_record;
        v_own_parent_id := p_invitation.host_parent_id;
    elsif p_user_id = p_invitation.guest_user_id then
        v_role := 'guest';
        v_peer := p_invitation.host_parent_record;
        v_own_parent_id := p_invitation.guest_parent_id;
    else
        raise exception 'shared_guardianship_invitation_not_found' using errcode = '42501';
    end if;
    return jsonb_strip_nulls(jsonb_build_object(
        'schemaVersion', 1,
        'invitationId', p_invitation.invitation_id,
        'role', v_role,
        'status', p_invitation.status,
        'ownParentId', v_own_parent_id,
        'peerSignal', case when v_peer is null then null else jsonb_build_object(
            'rarity', coalesce(v_peer->>'rarity', 'common'),
            'affinity', coalesce(v_peer#>>'{cosmicAffinity,element}', v_peer->>'cosmicAffinity', 'unclassified'),
            'generation', case when coalesce(v_peer->>'generation', '') ~ '^[0-9]+$' then (v_peer->>'generation')::integer else 1 end,
            'stage', coalesce(v_peer#>>'{lifecycle,stage}', 'adult')
        ) end,
        'hostConfirmed', p_invitation.host_confirmed_at is not null,
        'guestConfirmed', p_invitation.guest_confirmed_at is not null,
        'ownNameChoice', case when v_role = 'host' then p_invitation.host_name_choice else p_invitation.guest_name_choice end,
        'peerNameChoice', case when v_role = 'host' then p_invitation.guest_name_choice else p_invitation.host_name_choice end,
        'nameAgreed', p_invitation.host_name_choice is not null and p_invitation.host_name_choice = p_invitation.guest_name_choice,
        'createdAt', p_invitation.created_at,
        'expiresAt', p_invitation.expires_at,
        'operationId', p_invitation.operation_id,
        'sharedCreatureId', p_invitation.child_id,
        'sharedRuntimeId', p_invitation.child_runtime_id
    ));
end;
$$;

create or replace function public.attest_shared_guardianship_eligibility(
    p_age_band text,
    p_terms_version text,
    p_privacy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_user();
begin
    if p_age_band not in ('age_16_17', 'age_18_plus')
        or p_terms_version <> 'shared-guardianship-2026-08-31'
        or p_privacy_version <> 'shared-guardianship-2026-08-31' then
        raise exception 'shared_guardianship_eligibility_required' using errcode = '42501';
    end if;
    insert into public.shared_guardianship_profiles(user_id, age_band, terms_version, privacy_version)
    values (v_user_id, p_age_band, p_terms_version, p_privacy_version)
    on conflict (user_id) do update set
        age_band = excluded.age_band,
        terms_version = excluded.terms_version,
        privacy_version = excluded.privacy_version,
        attested_at = timezone('utc', now()),
        updated_at = timezone('utc', now());
    return jsonb_build_object('eligible', true, 'termsVersion', p_terms_version, 'privacyVersion', p_privacy_version);
end;
$$;

create or replace function public.create_shared_guardianship_invitation(
    p_parent_id text,
    p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
    v_revision bigint;
    v_game_state jsonb;
    v_parent jsonb;
    v_code text;
    v_hash text;
    v_invitation public.shared_guardianship_invitations;
    v_attempt integer := 0;
begin
    if not exists (select 1 from public.shared_guardianship_profiles where user_id = v_user_id) then
        raise exception 'shared_guardianship_eligibility_required' using errcode = '42501';
    end if;
    if exists (select 1 from public.shared_guardianship_participants where user_id = v_user_id and status = 'active') then
        raise exception 'shared_guardianship_limit_reached' using errcode = '22023';
    end if;
    delete from public.shared_guardianship_join_attempts
    where attempted_at < timezone('utc', now()) - interval '24 hours';
    update public.shared_guardianship_invitations set status = 'expired', updated_at = timezone('utc', now())
    where (host_user_id = v_user_id or guest_user_id = v_user_id)
      and status in ('waiting', 'paired', 'ready') and expires_at <= timezone('utc', now());
    delete from public.shared_guardianship_invitations
    where status in ('cancelled', 'expired', 'committed')
      and coalesce(committed_at, updated_at) < timezone('utc', now()) - interval '30 days';
    if exists (
        select 1 from public.shared_guardianship_invitations
        where (host_user_id = v_user_id or guest_user_id = v_user_id)
          and status in ('waiting', 'paired', 'ready', 'executing', 'staged')
          and expires_at > timezone('utc', now())
    ) then
        raise exception 'shared_guardianship_invitation_limit' using errcode = '22023';
    end if;
    select revision, game_state into v_revision, v_game_state
    from public.game_saves where user_id = v_user_id and save_slot = 'primary' for update;
    if not found then raise exception 'shared_guardianship_cloud_save_required' using errcode = '22023'; end if;
    if p_expected_revision is null or p_expected_revision <> v_revision then
        raise exception 'save_revision_conflict' using errcode = '40001';
    end if;
    v_parent := public.shared_fusion_parent_record(v_game_state, p_parent_id);
    if v_parent is null then raise exception 'shared_guardianship_parent_unavailable' using errcode = '42501'; end if;
    loop
        v_attempt := v_attempt + 1;
        v_code := upper(encode(extensions.gen_random_bytes(6), 'hex'));
        v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');
        exit when not exists (select 1 from public.shared_guardianship_invitations where code_hash = v_hash);
        if v_attempt >= 5 then raise exception 'shared_guardianship_code_generation_failed' using errcode = '40001'; end if;
    end loop;
    insert into public.shared_guardianship_invitations(
        code_hash, host_user_id, host_parent_id, host_parent_fingerprint, host_parent_record, host_save_revision
    ) values (
        v_hash, v_user_id, p_parent_id, md5(v_parent::text), v_parent, v_revision
    ) returning * into v_invitation;
    return public.shared_guardianship_invitation_view(v_invitation, v_user_id) || jsonb_build_object(
        'code', substr(v_code,1,4) || '-' || substr(v_code,5,4) || '-' || substr(v_code,9,4)
    );
end;
$$;

create or replace function public.join_shared_guardianship_invitation(
    p_code text,
    p_parent_id text,
    p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
    v_compact text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-F]', '', 'g'));
    v_hash text;
    v_attempts integer;
    v_revision bigint;
    v_game_state jsonb;
    v_parent jsonb;
    v_invitation public.shared_guardianship_invitations;
begin
    if not exists (select 1 from public.shared_guardianship_profiles where user_id = v_user_id) then
        raise exception 'shared_guardianship_eligibility_required' using errcode = '42501';
    end if;
    if exists (select 1 from public.shared_guardianship_participants where user_id = v_user_id and status = 'active') then
        raise exception 'shared_guardianship_limit_reached' using errcode = '22023';
    end if;
    delete from public.shared_guardianship_join_attempts where attempted_at < timezone('utc', now()) - interval '24 hours';
    select count(*) into v_attempts from public.shared_guardianship_join_attempts
    where user_id = v_user_id and attempted_at > timezone('utc', now()) - interval '10 minutes';
    if v_attempts >= 8 then raise exception 'shared_guardianship_join_rate_limited' using errcode = '22023'; end if;
    insert into public.shared_guardianship_join_attempts(user_id) values (v_user_id);
    if v_compact !~ '^[0-9A-F]{12}$' then raise exception 'shared_guardianship_invitation_unavailable' using errcode = '22023'; end if;
    v_hash := encode(extensions.digest(v_compact, 'sha256'), 'hex');
    select * into v_invitation from public.shared_guardianship_invitations
    where code_hash = v_hash for update;
    if not found or v_invitation.status <> 'waiting' or v_invitation.expires_at <= timezone('utc', now()) or v_invitation.host_user_id = v_user_id then
        raise exception 'shared_guardianship_invitation_unavailable' using errcode = '22023';
    end if;
    select revision, game_state into v_revision, v_game_state
    from public.game_saves where user_id = v_user_id and save_slot = 'primary' for update;
    if not found then raise exception 'shared_guardianship_cloud_save_required' using errcode = '22023'; end if;
    if p_expected_revision is null or p_expected_revision <> v_revision then raise exception 'save_revision_conflict' using errcode = '40001'; end if;
    v_parent := public.shared_fusion_parent_record(v_game_state, p_parent_id);
    if v_parent is null then raise exception 'shared_guardianship_parent_unavailable' using errcode = '42501'; end if;
    update public.shared_guardianship_invitations set
        guest_user_id = v_user_id,
        guest_parent_id = p_parent_id,
        guest_parent_fingerprint = md5(v_parent::text),
        guest_parent_record = v_parent,
        guest_save_revision = v_revision,
        status = 'paired',
        updated_at = timezone('utc', now())
    where invitation_id = v_invitation.invitation_id and status = 'waiting'
    returning * into v_invitation;
    if not found then raise exception 'shared_guardianship_invitation_unavailable' using errcode = '40001'; end if;
    return public.shared_guardianship_invitation_view(v_invitation, v_user_id);
end;
$$;

create or replace function public.get_shared_guardianship_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
    v_invitation public.shared_guardianship_invitations;
begin
    update public.shared_guardianship_invitations set status = 'expired', updated_at = timezone('utc', now())
    where invitation_id = p_invitation_id and status in ('waiting','paired','ready') and expires_at <= timezone('utc', now());
    select * into v_invitation from public.shared_guardianship_invitations
    where invitation_id = p_invitation_id and (host_user_id = v_user_id or guest_user_id = v_user_id);
    if not found then raise exception 'shared_guardianship_invitation_not_found' using errcode = '42501'; end if;
    return public.shared_guardianship_invitation_view(v_invitation, v_user_id);
end;
$$;

create or replace function public.confirm_shared_guardianship_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
    v_invitation public.shared_guardianship_invitations;
    v_revision bigint;
    v_game_state jsonb;
    v_parent jsonb;
    v_parent_id text;
    v_fingerprint text;
    v_operation_id text;
    v_child_id uuid;
    v_runtime_id text;
    v_seed text;
    v_request jsonb;
    v_request_fingerprint text;
begin
    select * into v_invitation from public.shared_guardianship_invitations
    where invitation_id = p_invitation_id and (host_user_id = v_user_id or guest_user_id = v_user_id) for update;
    if not found then raise exception 'shared_guardianship_invitation_not_found' using errcode = '42501'; end if;
    if v_invitation.status not in ('paired','ready') or v_invitation.expires_at <= timezone('utc', now()) then
        raise exception 'shared_guardianship_invitation_not_confirmable' using errcode = '22023';
    end if;
    if v_user_id = v_invitation.host_user_id then
        v_parent_id := v_invitation.host_parent_id; v_fingerprint := v_invitation.host_parent_fingerprint;
    else
        v_parent_id := v_invitation.guest_parent_id; v_fingerprint := v_invitation.guest_parent_fingerprint;
    end if;
    select revision, game_state into v_revision, v_game_state from public.game_saves
    where user_id = v_user_id and save_slot = 'primary' for update;
    if not found then raise exception 'shared_guardianship_cloud_save_required' using errcode = '22023'; end if;
    v_parent := public.shared_fusion_parent_record(v_game_state, v_parent_id);
    if v_parent is null or md5(v_parent::text) <> v_fingerprint then
        raise exception 'shared_guardianship_parent_changed' using errcode = '40001';
    end if;
    if v_user_id = v_invitation.host_user_id then
        update public.shared_guardianship_invitations set host_confirmed_at = coalesce(host_confirmed_at, timezone('utc', now())), host_save_revision = v_revision,
            status = case when guest_confirmed_at is not null then 'ready' else 'paired' end, updated_at = timezone('utc', now())
        where invitation_id = p_invitation_id returning * into v_invitation;
    else
        update public.shared_guardianship_invitations set guest_confirmed_at = coalesce(guest_confirmed_at, timezone('utc', now())), guest_save_revision = v_revision,
            status = case when host_confirmed_at is not null then 'ready' else 'paired' end, updated_at = timezone('utc', now())
        where invitation_id = p_invitation_id returning * into v_invitation;
    end if;
    if v_invitation.status = 'ready' and v_invitation.operation_id is null then
        v_operation_id := 'fusion_guardianship_' || gen_random_uuid()::text;
        v_child_id := gen_random_uuid();
        v_runtime_id := 'creature_guardianship_' || v_child_id::text;
        v_seed := 'fusion-server-guardianship-v1:' || md5(v_invitation.invitation_id::text || ':' || v_invitation.host_parent_fingerprint || ':' || v_invitation.guest_parent_fingerprint);
        v_request := jsonb_build_object(
            'schemaVersion', 1, 'contractVersion', 1, 'operationId', v_operation_id,
            'parentIds', jsonb_build_array(v_invitation.host_parent_id, v_invitation.guest_parent_id),
            'candidateOffspringIds', jsonb_build_array(v_runtime_id), 'offspringCapacity', 1,
            'expectedSaveRevision', v_invitation.host_save_revision,
            'requestedAt', floor(extract(epoch from timezone('utc', now())) * 1000)::bigint,
            'resultSeed', v_seed, 'executionMode', 'server_shared_guardianship',
            'consent', jsonb_build_object(
                'mode', 'shared_guardianship', 'scope', 'protected_invitation', 'keeperGrant', 'dual_confirmed',
                'termsVersion', 'shared-guardianship-2026-08-31', 'privacyVersion', 'shared-guardianship-2026-08-31',
                'parentGrants', jsonb_build_array(
                    jsonb_build_object('creatureId', v_invitation.host_parent_id, 'grant', 'lineage_synthesis', 'decision', 'willing'),
                    jsonb_build_object('creatureId', v_invitation.guest_parent_id, 'grant', 'lineage_synthesis', 'decision', 'willing')
                ),
                'sharedGuardianshipInvitationId', v_invitation.invitation_id
            )
        );
        v_request_fingerprint := 'fnv1a32-v1:' || substr(md5(v_request::text),1,8);
        v_request := v_request || jsonb_build_object('requestFingerprint', v_request_fingerprint);
        insert into public.fusion_operations(
            user_id, operation_id, request_fingerprint, server_fingerprint, parent_ids, offspring_ids,
            offspring_count, expected_save_revision, result_seed, request, status, expires_at
        ) values (
            v_invitation.host_user_id, v_operation_id, v_request_fingerprint,
            md5((v_request - 'requestFingerprint')::text),
            array[v_invitation.host_parent_id, v_invitation.guest_parent_id], array[v_runtime_id],
            1, v_invitation.host_save_revision, v_seed, v_request, 'reserved', timezone('utc', now()) + interval '30 minutes'
        );
        update public.shared_guardianship_invitations set operation_id = v_operation_id, child_id = v_child_id,
            child_runtime_id = v_runtime_id, expires_at = timezone('utc', now()) + interval '30 minutes', updated_at = timezone('utc', now())
        where invitation_id = p_invitation_id returning * into v_invitation;
    end if;
    return public.shared_guardianship_invitation_view(v_invitation, v_user_id);
end;
$$;

create or replace function public.resolve_shared_guardianship_execution(p_user_id uuid, p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_invitation public.shared_guardianship_invitations;
    v_role text;
begin
    if not public.shared_guardianship_user_is_eligible(p_user_id) then raise exception 'shared_guardianship_eligibility_required' using errcode = '42501'; end if;
    select * into v_invitation from public.shared_guardianship_invitations where invitation_id = p_invitation_id for update;
    if not found or v_invitation.status not in ('ready','executing','staged') then raise exception 'shared_guardianship_invitation_not_executable' using errcode = '42501'; end if;
    if p_user_id = v_invitation.host_user_id then v_role := 'host'; elsif p_user_id = v_invitation.guest_user_id then v_role := 'guest'; else raise exception 'shared_guardianship_invitation_not_found' using errcode = '42501'; end if;
    if v_invitation.host_confirmed_at is null or v_invitation.guest_confirmed_at is null or v_invitation.operation_id is null then
        raise exception 'shared_guardianship_dual_consent_required' using errcode = '42501';
    end if;
    return jsonb_build_object('invitationId', v_invitation.invitation_id, 'operationOwnerId', v_invitation.host_user_id, 'operationId', v_invitation.operation_id, 'role', v_role, 'status', v_invitation.status);
end;
$$;

create or replace function public.get_shared_guardianship_execution_context(p_user_id uuid, p_operation_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_operation public.fusion_operations;
    v_invitation public.shared_guardianship_invitations;
begin
    select * into v_operation from public.fusion_operations where user_id = p_user_id and operation_id = p_operation_id for update;
    if not found or v_operation.request#>>'{consent,mode}' <> 'shared_guardianship' then raise exception 'shared_guardianship_operation_not_found' using errcode = '42501'; end if;
    select * into v_invitation from public.shared_guardianship_invitations
    where host_user_id = p_user_id and operation_id = p_operation_id for update;
    if not found then raise exception 'shared_guardianship_invitation_not_found' using errcode = '42501'; end if;
    if v_operation.status = 'staged' and v_operation.result is not null then
        return jsonb_build_object('schemaVersion',1,'operationId',v_operation.operation_id,'status',v_operation.status,
            'requestFingerprint',v_operation.request_fingerprint,'serverFingerprint',v_operation.server_fingerprint,
            'resultSeed',v_operation.result_seed,'result',v_operation.result,'receipt',v_operation.result_receipt,
            'sharedGuardianship',true,'replay',true);
    end if;
    if v_operation.status <> 'reserved' or v_operation.expires_at <= timezone('utc', now())
        or v_invitation.status not in ('ready','executing') or v_invitation.host_confirmed_at is null or v_invitation.guest_confirmed_at is null then
        raise exception 'shared_guardianship_operation_not_executable' using errcode = '22023';
    end if;
    update public.shared_guardianship_invitations set status = 'executing', updated_at = timezone('utc', now())
    where invitation_id = v_invitation.invitation_id and status = 'ready';
    return jsonb_build_object(
        'schemaVersion',1,'operationId',v_operation.operation_id,'status',v_operation.status,
        'requestFingerprint',v_operation.request_fingerprint,'serverFingerprint',v_operation.server_fingerprint,
        'resultSeed',v_operation.result_seed,'offspringIds',to_jsonb(v_operation.offspring_ids),'offspringCount',1,
        'parentIds',to_jsonb(v_operation.parent_ids),'parentRecords',jsonb_build_array(v_invitation.host_parent_record,v_invitation.guest_parent_record),
        'reservedAt',v_operation.created_at,'sharedGuardianship',true,'replay',false
    );
end;
$$;

create or replace function public.stage_shared_guardianship_result(
    p_user_id uuid,
    p_operation_id text,
    p_server_fingerprint text,
    p_result jsonb,
    p_receipt jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_operation public.fusion_operations;
    v_invitation public.shared_guardianship_invitations;
begin
    select * into v_operation from public.fusion_operations where user_id = p_user_id and operation_id = p_operation_id for update;
    if not found or v_operation.request#>>'{consent,mode}' <> 'shared_guardianship' then raise exception 'shared_guardianship_operation_not_found' using errcode = '42501'; end if;
    select * into v_invitation from public.shared_guardianship_invitations where host_user_id = p_user_id and operation_id = p_operation_id for update;
    if not found then raise exception 'shared_guardianship_invitation_not_found' using errcode = '42501'; end if;
    if v_operation.status = 'staged' and v_operation.result is not null then
        if v_operation.result_receipt->>'receiptFingerprint' <> p_receipt->>'receiptFingerprint' then raise exception 'shared_guardianship_result_replay_mismatch' using errcode = '23505'; end if;
        return jsonb_build_object('result',v_operation.result,'receipt',v_operation.result_receipt,'replay',true);
    end if;
    if v_operation.status <> 'reserved' or v_operation.server_fingerprint <> p_server_fingerprint
        or p_result->>'operationId' <> p_operation_id or jsonb_array_length(coalesce(p_result->'offspring','[]'::jsonb)) <> 1
        or p_result#>>'{offspring,0,offspringData,creatureId}' <> v_invitation.child_runtime_id
        or p_receipt->>'operationId' <> p_operation_id or p_receipt->>'serverFingerprint' <> p_server_fingerprint then
        raise exception 'shared_guardianship_result_invalid' using errcode = '42501';
    end if;
    update public.fusion_operations set status = 'staged', result = p_result, result_receipt = p_receipt
    where user_id = p_user_id and operation_id = p_operation_id returning * into v_operation;
    update public.shared_guardianship_invitations set status = 'staged', updated_at = timezone('utc', now())
    where invitation_id = v_invitation.invitation_id;
    return jsonb_build_object('result',v_operation.result,'receipt',v_operation.result_receipt,'replay',false);
end;
$$;

create or replace function public.submit_shared_guardianship_name(p_invitation_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
    v_name text;
    v_invitation public.shared_guardianship_invitations;
    v_operation public.fusion_operations;
    v_child_result jsonb;
    v_now timestamptz := timezone('utc', now());
    v_now_ms bigint;
begin
    select names.candidate into v_name
    from unnest(array['Aster','Beacon','Cinder','Echo','Lumen','Nova','Orbit','Solace']) as names(candidate)
    where lower(names.candidate) = lower(btrim(coalesce(p_name,'')));
    if v_name is null then raise exception 'shared_guardianship_name_invalid' using errcode = '22023'; end if;
    select * into v_invitation from public.shared_guardianship_invitations
    where invitation_id = p_invitation_id and (host_user_id = v_user_id or guest_user_id = v_user_id) for update;
    if not found then raise exception 'shared_guardianship_invitation_not_found' using errcode = '42501'; end if;
    if v_invitation.status = 'committed' then return public.shared_guardianship_invitation_view(v_invitation,v_user_id) || jsonb_build_object('replay',true); end if;
    if v_invitation.status <> 'staged' then raise exception 'shared_guardianship_result_not_ready' using errcode = '22023'; end if;
    if v_user_id = v_invitation.host_user_id then
        update public.shared_guardianship_invitations set host_name_choice = v_name, updated_at = v_now where invitation_id = p_invitation_id returning * into v_invitation;
    else
        update public.shared_guardianship_invitations set guest_name_choice = v_name, updated_at = v_now where invitation_id = p_invitation_id returning * into v_invitation;
    end if;
    if v_invitation.host_name_choice is null or v_invitation.guest_name_choice is null or v_invitation.host_name_choice <> v_invitation.guest_name_choice then
        return public.shared_guardianship_invitation_view(v_invitation,v_user_id) || jsonb_build_object('awaitingAgreement',true);
    end if;
    select * into v_operation from public.fusion_operations where user_id = v_invitation.host_user_id and operation_id = v_invitation.operation_id for update;
    if not found or v_operation.status <> 'staged' then raise exception 'shared_guardianship_staged_result_invalid' using errcode = '42501'; end if;
    v_child_result := v_operation.result->'offspring'->0;
    v_now_ms := floor(extract(epoch from v_now) * 1000)::bigint;
    insert into public.shared_guardianship_creatures(
        creature_id,runtime_id,source_invitation_id,name,genes,lifecycle,care_state
    ) values (
        v_invitation.child_id,v_invitation.child_runtime_id,v_invitation.invitation_id,v_name,
        coalesce(v_child_result->'offspringGenes','{}'::jsonb),
        jsonb_build_object('stage','baby','birthDate',v_now_ms,'lastStageChange',v_now_ms),
        jsonb_build_object('comfort',100,'curiosity',50,'energy',100,'lastCareAt',v_now_ms)
    ) on conflict (creature_id) do nothing;
    insert into public.shared_guardianship_participants(creature_id,user_id,role,guardian_label,terms_version,privacy_version)
    values
        (v_invitation.child_id,v_invitation.host_user_id,'host','Guardian A','shared-guardianship-2026-08-31','shared-guardianship-2026-08-31'),
        (v_invitation.child_id,v_invitation.guest_user_id,'guest','Guardian B','shared-guardianship-2026-08-31','shared-guardianship-2026-08-31')
    on conflict do nothing;
    insert into public.shared_guardianship_parentage(creature_id,source_role,parent_fingerprint,parent_reference)
    values
        (v_invitation.child_id,'host',v_invitation.host_parent_fingerprint,'protected-parent-v1:' || md5(v_invitation.invitation_id::text || ':host')),
        (v_invitation.child_id,'guest',v_invitation.guest_parent_fingerprint,'protected-parent-v1:' || md5(v_invitation.invitation_id::text || ':guest'))
    on conflict do nothing;
    insert into public.shared_guardianship_events(creature_id,actor_user_id,actor_label,idempotency_key,event_kind,summary,before_revision,after_revision)
    values (v_invitation.child_id,null,'The Fusion Pod','birth_' || replace(v_invitation.invitation_id::text,'-',''),'birth',v_name || ' awakened between two Sanctuaries.',0,1)
    on conflict do nothing;
    update public.fusion_operations set status = 'committed', completed_at = v_now where user_id = v_invitation.host_user_id and operation_id = v_invitation.operation_id;
    update public.shared_guardianship_invitations set status = 'committed', committed_at = v_now, updated_at = v_now, result_receipt = v_operation.result_receipt
    where invitation_id = p_invitation_id returning * into v_invitation;
    return public.shared_guardianship_invitation_view(v_invitation,v_user_id) || jsonb_build_object('awaitingAgreement',false,'replay',false);
end;
$$;

create or replace function public.get_shared_guardianship_projection(p_creature_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
    v_creature public.shared_guardianship_creatures;
    v_participant public.shared_guardianship_participants;
    v_history jsonb;
begin
    select * into v_participant from public.shared_guardianship_participants
    where creature_id = p_creature_id and user_id = v_user_id and status = 'active';
    if not found then raise exception 'shared_guardianship_access_denied' using errcode = '42501'; end if;
    select * into v_creature from public.shared_guardianship_creatures where creature_id = p_creature_id and status = 'active';
    if not found then raise exception 'shared_guardianship_creature_not_found' using errcode = '22023'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('kind',event_kind,'summary',summary,'guardianLabel',actor_label,'revision',after_revision,'createdAt',created_at) order by after_revision desc),'[]'::jsonb)
    into v_history from (select * from public.shared_guardianship_events where creature_id = p_creature_id order by after_revision desc limit 20) events;
    return jsonb_build_object(
        'schemaVersion',1,'sharedCreatureId',v_creature.creature_id,'runtimeId',v_creature.runtime_id,'name',v_creature.name,
        'genes',v_creature.genes,'lifecycle',v_creature.lifecycle,'care',v_creature.care_state,'revision',v_creature.revision,
        'status',v_creature.status,'guardianRole',v_participant.role,'guardianLabel',v_participant.guardian_label,
        'notificationsMuted',v_participant.notifications_muted,'history',v_history,'updatedAt',v_creature.updated_at
    );
end;
$$;

create or replace function public.list_shared_guardianship_creatures()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
    v_result jsonb := '[]'::jsonb;
    v_id uuid;
begin
    for v_id in select creature_id from public.shared_guardianship_participants where user_id = v_user_id and status = 'active' order by joined_at loop
        v_result := v_result || jsonb_build_array(public.get_shared_guardianship_projection(v_id));
    end loop;
    return v_result;
end;
$$;

create or replace function public.perform_shared_guardianship_care(
    p_creature_id uuid,
    p_action text,
    p_idempotency_key text,
    p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
    v_creature public.shared_guardianship_creatures;
    v_participant public.shared_guardianship_participants;
    v_comfort integer;
    v_curiosity integer;
    v_energy integer;
    v_summary text;
    v_now_ms bigint := floor(extract(epoch from timezone('utc', now())) * 1000)::bigint;
begin
    if p_action not in ('tend','play','rest') or p_idempotency_key !~ '^[A-Za-z0-9_-]{8,120}$' then raise exception 'shared_guardianship_action_invalid' using errcode = '22023'; end if;
    select * into v_participant from public.shared_guardianship_participants
    where creature_id = p_creature_id and user_id = v_user_id and status = 'active';
    if not found then raise exception 'shared_guardianship_access_denied' using errcode = '42501'; end if;
    if exists (select 1 from public.shared_guardianship_events where creature_id = p_creature_id and actor_user_id = v_user_id and idempotency_key = p_idempotency_key) then
        return public.get_shared_guardianship_projection(p_creature_id) || jsonb_build_object('replay',true);
    end if;
    select * into v_creature from public.shared_guardianship_creatures where creature_id = p_creature_id and status = 'active' for update;
    if not found then raise exception 'shared_guardianship_creature_not_found' using errcode = '22023'; end if;
    if p_expected_revision is null or p_expected_revision <> v_creature.revision then raise exception 'shared_guardianship_revision_conflict' using errcode = '40001'; end if;
    v_comfort := least(100,greatest(0,coalesce((v_creature.care_state->>'comfort')::integer,50) + case when p_action='tend' then 8 when p_action='rest' then 3 else 2 end));
    v_curiosity := least(100,greatest(0,coalesce((v_creature.care_state->>'curiosity')::integer,50) + case when p_action='play' then 8 when p_action='tend' then 2 else 1 end));
    v_energy := least(100,greatest(0,coalesce((v_creature.care_state->>'energy')::integer,50) + case when p_action='rest' then 10 when p_action='play' then -4 else 2 end));
    v_summary := case p_action when 'tend' then v_participant.guardian_label || ' tended the shared habitat.' when 'play' then v_participant.guardian_label || ' explored a new response.' else v_participant.guardian_label || ' helped the creature rest.' end;
    update public.shared_guardianship_creatures set
        care_state = jsonb_build_object('comfort',v_comfort,'curiosity',v_curiosity,'energy',v_energy,'lastCareAt',v_now_ms),
        revision = revision + 1, updated_at = timezone('utc', now())
    where creature_id = p_creature_id returning * into v_creature;
    insert into public.shared_guardianship_events(creature_id,actor_user_id,actor_label,idempotency_key,event_kind,summary,payload,before_revision,after_revision)
    values (p_creature_id,v_user_id,v_participant.guardian_label,p_idempotency_key,p_action,v_summary,jsonb_build_object('action',p_action),v_creature.revision-1,v_creature.revision);
    delete from public.shared_guardianship_events
    where event_id in (
        select event_id from public.shared_guardianship_events
        where creature_id = p_creature_id
        order by after_revision desc
        offset 100
    );
    return public.get_shared_guardianship_projection(p_creature_id) || jsonb_build_object('replay',false);
end;
$$;

create or replace function public.leave_shared_guardianship(p_creature_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
    v_participant public.shared_guardianship_participants;
    v_creature public.shared_guardianship_creatures;
begin
    select * into v_participant from public.shared_guardianship_participants
    where creature_id = p_creature_id and user_id = v_user_id and status = 'active' for update;
    if not found then raise exception 'shared_guardianship_access_denied' using errcode = '42501'; end if;
    if not exists (select 1 from public.shared_guardianship_participants where creature_id = p_creature_id and user_id <> v_user_id and status = 'active') then
        raise exception 'shared_guardianship_last_guardian_required' using errcode = '22023';
    end if;
    select * into v_creature from public.shared_guardianship_creatures where creature_id = p_creature_id for update;
    update public.shared_guardianship_events set actor_user_id = null
    where creature_id = p_creature_id and actor_user_id = v_user_id;
    delete from public.shared_guardianship_participants
    where creature_id = p_creature_id and user_id = v_user_id;
    update public.shared_guardianship_creatures set revision = revision + 1, updated_at = timezone('utc', now())
    where creature_id = p_creature_id returning * into v_creature;
    insert into public.shared_guardianship_events(creature_id,actor_user_id,actor_label,idempotency_key,event_kind,summary,before_revision,after_revision)
    values (p_creature_id,null,v_participant.guardian_label,'departure_' || replace(gen_random_uuid()::text,'-',''),'departure',v_participant.guardian_label || ' left Shared Guardianship.',v_creature.revision-1,v_creature.revision);
    delete from public.shared_guardianship_events
    where event_id in (
        select event_id from public.shared_guardianship_events
        where creature_id = p_creature_id
        order by after_revision desc
        offset 100
    );
    return jsonb_build_object('left',true,'sharedCreatureId',p_creature_id,'revision',v_creature.revision);
end;
$$;

create or replace function public.cancel_shared_guardianship_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
    v_invitation public.shared_guardianship_invitations;
begin
    select * into v_invitation from public.shared_guardianship_invitations
    where invitation_id = p_invitation_id and (host_user_id = v_user_id or guest_user_id = v_user_id) for update;
    if not found then raise exception 'shared_guardianship_invitation_not_found' using errcode = '42501'; end if;
    if v_invitation.status not in ('waiting','paired','ready') then raise exception 'shared_guardianship_invitation_locked' using errcode = '22023'; end if;
    update public.shared_guardianship_invitations set status = 'cancelled', updated_at = timezone('utc', now())
    where invitation_id = p_invitation_id returning * into v_invitation;
    return public.shared_guardianship_invitation_view(v_invitation,v_user_id);
end;
$$;

create or replace function public.set_shared_guardianship_notifications(
    p_creature_id uuid,
    p_muted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := public.shared_guardianship_require_eligible_user();
begin
    update public.shared_guardianship_participants
    set notifications_muted = coalesce(p_muted, false)
    where creature_id = p_creature_id
      and user_id = v_user_id
      and status = 'active';
    if not found then
        raise exception 'shared_guardianship_access_denied' using errcode = '42501';
    end if;
    return public.get_shared_guardianship_projection(p_creature_id);
end;
$$;

create or replace function public.archive_orphaned_shared_guardianship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not exists (
        select 1
        from public.shared_guardianship_participants
        where creature_id = old.creature_id
          and status = 'active'
    ) then
        update public.shared_guardianship_creatures
        set status = 'archived',
            revision = revision + 1,
            updated_at = timezone('utc', now())
        where creature_id = old.creature_id
          and status = 'active';
    end if;
    return null;
end;
$$;

create trigger archive_orphaned_shared_guardianship_after_participant_change
after delete or update of status on public.shared_guardianship_participants
for each row execute function public.archive_orphaned_shared_guardianship();

revoke all on function public.shared_guardianship_user_is_permanent(uuid) from public;
revoke all on function public.shared_guardianship_require_user() from public;
revoke all on function public.shared_guardianship_user_is_eligible(uuid) from public;
revoke all on function public.shared_guardianship_require_eligible_user() from public;
revoke all on function public.shared_guardianship_invitation_view(public.shared_guardianship_invitations,uuid) from public;
revoke all on function public.archive_orphaned_shared_guardianship() from public;
revoke all on function public.resolve_shared_guardianship_execution(uuid,uuid) from public;
revoke all on function public.get_shared_guardianship_execution_context(uuid,text) from public;
revoke all on function public.stage_shared_guardianship_result(uuid,text,text,jsonb,jsonb) from public;
grant execute on function public.resolve_shared_guardianship_execution(uuid,uuid) to service_role;
grant execute on function public.get_shared_guardianship_execution_context(uuid,text) to service_role;
grant execute on function public.stage_shared_guardianship_result(uuid,text,text,jsonb,jsonb) to service_role;

revoke all on function public.attest_shared_guardianship_eligibility(text,text,text) from public;
revoke all on function public.create_shared_guardianship_invitation(text,bigint) from public;
revoke all on function public.join_shared_guardianship_invitation(text,text,bigint) from public;
revoke all on function public.get_shared_guardianship_invitation(uuid) from public;
revoke all on function public.confirm_shared_guardianship_invitation(uuid) from public;
revoke all on function public.submit_shared_guardianship_name(uuid,text) from public;
revoke all on function public.get_shared_guardianship_projection(uuid) from public;
revoke all on function public.list_shared_guardianship_creatures() from public;
revoke all on function public.perform_shared_guardianship_care(uuid,text,text,bigint) from public;
revoke all on function public.leave_shared_guardianship(uuid) from public;
revoke all on function public.cancel_shared_guardianship_invitation(uuid) from public;
revoke all on function public.set_shared_guardianship_notifications(uuid,boolean) from public;

grant execute on function public.attest_shared_guardianship_eligibility(text,text,text) to authenticated;
grant execute on function public.create_shared_guardianship_invitation(text,bigint) to authenticated;
grant execute on function public.join_shared_guardianship_invitation(text,text,bigint) to authenticated;
grant execute on function public.get_shared_guardianship_invitation(uuid) to authenticated;
grant execute on function public.confirm_shared_guardianship_invitation(uuid) to authenticated;
grant execute on function public.submit_shared_guardianship_name(uuid,text) to authenticated;
grant execute on function public.get_shared_guardianship_projection(uuid) to authenticated;
grant execute on function public.list_shared_guardianship_creatures() to authenticated;
grant execute on function public.perform_shared_guardianship_care(uuid,text,text,bigint) to authenticated;
grant execute on function public.leave_shared_guardianship(uuid) to authenticated;
grant execute on function public.cancel_shared_guardianship_invitation(uuid) to authenticated;
grant execute on function public.set_shared_guardianship_notifications(uuid,boolean) to authenticated;

comment on table public.shared_guardianship_creatures is 'Canonical one-child Shared Guardianship state; clients receive participant-scoped projections only.';
comment on table public.shared_guardianship_participants is 'Private access grants. Emails and account profile data are never copied here.';
comment on table public.shared_guardianship_events is 'Bounded idempotent care history using neutral guardian labels only.';
