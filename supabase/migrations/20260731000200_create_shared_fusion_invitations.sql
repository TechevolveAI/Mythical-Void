create table if not exists public.shared_fusion_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    age_band text not null
        check (age_band in ('age_16_17', 'age_18_plus')),
    policy_version text not null
        check (policy_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    attested_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.shared_fusion_profiles is
    'Private self-attested eligibility boundary for Shared Fusion. It is not identity or high-assurance age verification.';

alter table public.shared_fusion_profiles enable row level security;
alter table public.shared_fusion_profiles force row level security;
revoke all on table public.shared_fusion_profiles from anon;
revoke all on table public.shared_fusion_profiles from authenticated;

create table if not exists public.shared_fusion_invitations (
    invitation_id uuid primary key default gen_random_uuid(),
    code_hash text not null unique
        check (code_hash ~ '^[0-9a-f]{64}$'),
    host_user_id uuid not null references auth.users(id) on delete cascade,
    guest_user_id uuid references auth.users(id) on delete cascade,
    host_parent_id text not null
        check (host_parent_id ~ '^[A-Za-z0-9_-]{1,180}$'),
    guest_parent_id text
        check (
            guest_parent_id is null
            or guest_parent_id ~ '^[A-Za-z0-9_-]{1,180}$'
        ),
    host_parent_fingerprint text not null
        check (host_parent_fingerprint ~ '^[0-9a-f]{32}$'),
    guest_parent_fingerprint text
        check (
            guest_parent_fingerprint is null
            or guest_parent_fingerprint ~ '^[0-9a-f]{32}$'
        ),
    host_parent_record jsonb not null
        check (jsonb_typeof(host_parent_record) = 'object')
        check (octet_length(host_parent_record::text) <= 32768),
    guest_parent_record jsonb
        check (
            guest_parent_record is null
            or jsonb_typeof(guest_parent_record) = 'object'
        )
        check (
            guest_parent_record is null
            or octet_length(guest_parent_record::text) <= 32768
        ),
    host_save_revision bigint not null check (host_save_revision > 0),
    guest_save_revision bigint check (guest_save_revision > 0),
    host_confirmed_at timestamptz,
    guest_confirmed_at timestamptz,
    status text not null default 'waiting'
        check (
            status in (
                'waiting',
                'paired',
                'ready',
                'executing',
                'staged',
                'committed',
                'cancelled',
                'expired'
            )
        ),
    operation_id text unique
        check (
            operation_id is null
            or operation_id ~ '^fusion_shared_[A-Za-z0-9_-]{1,160}$'
        ),
    host_offspring_id text unique
        check (
            host_offspring_id is null
            or host_offspring_id ~ '^[A-Za-z0-9_-]{1,180}$'
        ),
    guest_offspring_id text unique
        check (
            guest_offspring_id is null
            or guest_offspring_id ~ '^[A-Za-z0-9_-]{1,180}$'
        ),
    host_offspring_name text
        check (
            host_offspring_name is null
            or char_length(host_offspring_name) between 1 and 20
        ),
    guest_offspring_name text
        check (
            guest_offspring_name is null
            or char_length(guest_offspring_name) between 1 and 20
        ),
    result_receipt jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    expires_at timestamptz not null
        default timezone('utc', now()) + interval '15 minutes',
    committed_at timestamptz,
    check (guest_user_id is null or guest_user_id <> host_user_id),
    check (
        (
            guest_user_id is null
            and
            guest_parent_id is null
            and guest_parent_fingerprint is null
            and guest_parent_record is null
            and guest_save_revision is null
        )
        or
        (
            guest_user_id is not null
            and guest_parent_id is not null
            and guest_parent_fingerprint is not null
            and guest_parent_record is not null
            and guest_save_revision is not null
        )
    )
);

comment on table public.shared_fusion_invitations is
    'Private, short-lived, participant-bound Shared Fusion invitations. Codes are stored only as SHA-256 hashes.';

create index if not exists shared_fusion_invitations_host_live_idx
on public.shared_fusion_invitations (host_user_id, expires_at desc);

create index if not exists shared_fusion_invitations_guest_live_idx
on public.shared_fusion_invitations (guest_user_id, expires_at desc)
where guest_user_id is not null;

alter table public.shared_fusion_invitations enable row level security;
alter table public.shared_fusion_invitations force row level security;
revoke all on table public.shared_fusion_invitations from anon;
revoke all on table public.shared_fusion_invitations from authenticated;

create table if not exists public.shared_fusion_join_attempts (
    attempt_id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    attempted_at timestamptz not null default timezone('utc', now())
);

create index if not exists shared_fusion_join_attempts_user_time_idx
on public.shared_fusion_join_attempts (user_id, attempted_at desc);

alter table public.shared_fusion_join_attempts enable row level security;
alter table public.shared_fusion_join_attempts force row level security;
revoke all on table public.shared_fusion_join_attempts from anon;
revoke all on table public.shared_fusion_join_attempts from authenticated;

create or replace function public.shared_fusion_parent_record(
    p_game_state jsonb,
    p_parent_id text
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
    v_parent jsonb;
    v_record jsonb;
begin
    if p_parent_id is null
        or p_parent_id !~ '^[A-Za-z0-9_-]{1,180}$'
        or jsonb_typeof(coalesce(p_game_state->'creatures', 'null'::jsonb))
            <> 'array' then
        return null;
    end if;

    select creature
    into v_parent
    from jsonb_array_elements(p_game_state->'creatures') as creature
    where creature->>'id' = p_parent_id
      and (
        lower(coalesce(creature#>>'{lifecycle,stage}', ''))
            in ('adult', 'elder')
        or (
            coalesce(creature#>>'{lifecycle,stage}', '') = ''
            and coalesce(
                creature#>>'{lifecycle,birthDate}',
                creature->>'hatchTime',
                ''
            ) ~ '^[0-9]{10,16}$'
            and (
                coalesce(
                    creature#>>'{lifecycle,birthDate}',
                    creature->>'hatchTime'
                )::numeric
            ) <= (
                extract(epoch from (now() - interval '2 days')) * 1000
            )
        )
      )
      and lower(
        coalesce(creature#>>'{lifecycle,hasDeparted}', 'false')
      ) <> 'true'
      and nullif(creature#>>'{lifecycle,departureDate}', '') is null
      and lower(
        coalesce(creature#>>'{lifecycle,isStuck}', 'false')
      ) <> 'true'
      and case
        when coalesce(creature#>>'{stats,happiness}', '') ~
            '^[0-9]+([.][0-9]+)?$'
            then (creature#>>'{stats,happiness}')::numeric >= 50
        else true
      end
      and lower(
        coalesce(creature#>>'{mood,current}', 'steady')
      ) not in ('sad', 'abandoned')
    limit 1;

    if v_parent is null then
        return null;
    end if;

    v_record := jsonb_strip_nulls(jsonb_build_object(
        'id', p_parent_id,
        'genes', v_parent->'genes',
        'dna', v_parent->'dna',
        'rarity', coalesce(
            v_parent->>'rarity',
            v_parent#>>'{genes,rarity}',
            'common'
        ),
        'generation', greatest(
            1,
            case
                when coalesce(v_parent->>'generation', '') ~ '^[0-9]{1,4}$'
                    then (v_parent->>'generation')::integer
                else 1
            end
        ),
        'cosmicAffinity', coalesce(
            v_parent->'cosmicAffinity',
            v_parent#>'{genes,cosmicAffinity}'
        ),
        'lifecycle', jsonb_build_object(
            'stage',
            lower(coalesce(v_parent#>>'{lifecycle,stage}', 'adult'))
        )
    ));

    if octet_length(v_record::text) > 32768 then
        raise exception 'shared_fusion_parent_record_too_large'
            using errcode = '22023';
    end if;
    return v_record;
end;
$$;

create or replace function public.shared_fusion_invitation_view(
    p_invitation public.shared_fusion_invitations,
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
        raise exception 'shared_fusion_invitation_not_found'
            using errcode = '42501';
    end if;

    return jsonb_strip_nulls(jsonb_build_object(
        'schemaVersion', 1,
        'invitationId', p_invitation.invitation_id,
        'role', v_role,
        'status', p_invitation.status,
        'ownParentId', v_own_parent_id,
        'peerSignal', case
            when v_peer is null then null
            else jsonb_build_object(
                'rarity', coalesce(v_peer->>'rarity', 'common'),
                'affinity', coalesce(
                    v_peer#>>'{cosmicAffinity,element}',
                    v_peer->>'cosmicAffinity',
                    'unclassified'
                ),
                'generation', coalesce(
                    (v_peer->>'generation')::integer,
                    1
                ),
                'stage', coalesce(
                    v_peer#>>'{lifecycle,stage}',
                    'adult'
                )
            )
        end,
        'hostConfirmed', p_invitation.host_confirmed_at is not null,
        'guestConfirmed', p_invitation.guest_confirmed_at is not null,
        'createdAt', p_invitation.created_at,
        'expiresAt', p_invitation.expires_at,
        'operationId', p_invitation.operation_id
        ,
        'ownOffspringId', case
            when v_role = 'host' then p_invitation.host_offspring_id
            else p_invitation.guest_offspring_id
        end,
        'ownNameSubmitted', case
            when v_role = 'host'
                then p_invitation.host_offspring_name is not null
            else p_invitation.guest_offspring_name is not null
        end
    ));
end;
$$;

create or replace function public.attest_shared_fusion_eligibility(
    p_age_band text,
    p_policy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
    end if;
    if p_age_band not in ('age_16_17', 'age_18_plus')
        or p_policy_version is null
        or p_policy_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'shared_fusion_age_ineligible'
            using errcode = '42501';
    end if;

    insert into public.shared_fusion_profiles (
        user_id,
        age_band,
        policy_version,
        attested_at,
        updated_at
    )
    values (
        v_user_id,
        p_age_band,
        p_policy_version,
        timezone('utc', now()),
        timezone('utc', now())
    )
    on conflict (user_id) do update
    set age_band = excluded.age_band,
        policy_version = excluded.policy_version,
        attested_at = excluded.attested_at,
        updated_at = excluded.updated_at;

    return jsonb_build_object(
        'eligible', true,
        'policyVersion', p_policy_version
    );
end;
$$;

create or replace function public.create_shared_fusion_invitation(
    p_parent_id text,
    p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_age_eligible boolean;
    v_revision bigint;
    v_game_state jsonb;
    v_parent_record jsonb;
    v_parent_fingerprint text;
    v_max_creatures integer;
    v_live_count integer;
    v_code text;
    v_code_hash text;
    v_invitation public.shared_fusion_invitations;
    v_attempt integer := 0;
begin
    if v_user_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
    end if;

    select true
    into v_age_eligible
    from public.shared_fusion_profiles
    where user_id = v_user_id;
    if coalesce(v_age_eligible, false) is not true then
        raise exception 'shared_fusion_age_attestation_required'
            using errcode = '42501';
    end if;

    update public.shared_fusion_invitations
    set status = 'expired',
        updated_at = timezone('utc', now())
    where (host_user_id = v_user_id or guest_user_id = v_user_id)
      and status in ('waiting', 'paired', 'ready')
      and expires_at <= timezone('utc', now());

    select count(*)
    into v_live_count
    from public.shared_fusion_invitations
    where (host_user_id = v_user_id or guest_user_id = v_user_id)
      and status in ('waiting', 'paired', 'ready', 'executing')
      and expires_at > timezone('utc', now());
    if v_live_count >= 3 then
        raise exception 'shared_fusion_invitation_limit'
            using errcode = '22023';
    end if;

    select revision, game_state
    into v_revision, v_game_state
    from public.game_saves
    where user_id = v_user_id
      and save_slot = 'primary'
    for update;
    if not found then
        raise exception 'shared_fusion_cloud_save_required'
            using errcode = '22023';
    end if;
    if p_expected_revision is null
        or p_expected_revision <> v_revision then
        raise exception 'save_revision_conflict'
            using errcode = '40001';
    end if;

    v_parent_record :=
        public.shared_fusion_parent_record(v_game_state, p_parent_id);
    if v_parent_record is null then
        raise exception 'shared_fusion_parent_unavailable'
            using errcode = '42501';
    end if;

    v_max_creatures := case
        when coalesce(v_game_state->>'maxCreatures', '') ~ '^[0-9]{1,3}$'
            then (v_game_state->>'maxCreatures')::integer
        else 8
    end;
    if jsonb_array_length(v_game_state->'creatures') + 1 > v_max_creatures then
        raise exception 'shared_fusion_collection_capacity'
            using errcode = '22023';
    end if;

    v_parent_fingerprint := md5(v_parent_record::text);
    loop
        v_attempt := v_attempt + 1;
        v_code := upper(encode(extensions.gen_random_bytes(6), 'hex'));
        v_code_hash := encode(
            extensions.digest(v_code, 'sha256'),
            'hex'
        );
        exit when not exists (
            select 1
            from public.shared_fusion_invitations
            where code_hash = v_code_hash
        );
        if v_attempt >= 5 then
            raise exception 'shared_fusion_code_generation_failed'
                using errcode = '40001';
        end if;
    end loop;

    insert into public.shared_fusion_invitations (
        code_hash,
        host_user_id,
        host_parent_id,
        host_parent_fingerprint,
        host_parent_record,
        host_save_revision
    )
    values (
        v_code_hash,
        v_user_id,
        p_parent_id,
        v_parent_fingerprint,
        v_parent_record,
        v_revision
    )
    returning * into v_invitation;

    return public.shared_fusion_invitation_view(
        v_invitation,
        v_user_id
    ) || jsonb_build_object(
        'code',
        substr(v_code, 1, 4) || '-' ||
            substr(v_code, 5, 4) || '-' ||
            substr(v_code, 9, 4)
    );
end;
$$;

create or replace function public.join_shared_fusion_invitation(
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
    v_user_id uuid := auth.uid();
    v_age_eligible boolean;
    v_recent_attempts integer;
    v_normalized_code text;
    v_code_hash text;
    v_revision bigint;
    v_game_state jsonb;
    v_parent_record jsonb;
    v_max_creatures integer;
    v_invitation public.shared_fusion_invitations;
begin
    if v_user_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
    end if;
    select true
    into v_age_eligible
    from public.shared_fusion_profiles
    where user_id = v_user_id;
    if coalesce(v_age_eligible, false) is not true then
        raise exception 'shared_fusion_age_attestation_required'
            using errcode = '42501';
    end if;

    delete from public.shared_fusion_join_attempts
    where attempted_at < timezone('utc', now()) - interval '1 day';
    select count(*)
    into v_recent_attempts
    from public.shared_fusion_join_attempts
    where user_id = v_user_id
      and attempted_at >
        timezone('utc', now()) - interval '10 minutes';
    if v_recent_attempts >= 10 then
        raise exception 'shared_fusion_join_rate_limited'
            using errcode = '22023';
    end if;
    insert into public.shared_fusion_join_attempts (user_id)
    values (v_user_id);

    if p_code is null or p_code !~ '^[0-9A-Fa-f-]{12,14}$' then
        raise exception 'shared_fusion_invitation_unavailable'
            using errcode = '22023';
    end if;
    v_normalized_code := upper(replace(p_code, '-', ''));
    if v_normalized_code !~ '^[0-9A-F]{12}$' then
        raise exception 'shared_fusion_invitation_unavailable'
            using errcode = '22023';
    end if;
    v_code_hash := encode(
        extensions.digest(v_normalized_code, 'sha256'),
        'hex'
    );

    select *
    into v_invitation
    from public.shared_fusion_invitations
    where code_hash = v_code_hash
      and status = 'waiting'
      and guest_user_id is null
      and expires_at > timezone('utc', now())
    for update;
    if not found or v_invitation.host_user_id = v_user_id then
        raise exception 'shared_fusion_invitation_unavailable'
            using errcode = '22023';
    end if;

    select revision, game_state
    into v_revision, v_game_state
    from public.game_saves
    where user_id = v_user_id
      and save_slot = 'primary'
    for update;
    if not found then
        raise exception 'shared_fusion_cloud_save_required'
            using errcode = '22023';
    end if;
    if p_expected_revision is null
        or p_expected_revision <> v_revision then
        raise exception 'save_revision_conflict'
            using errcode = '40001';
    end if;

    v_parent_record :=
        public.shared_fusion_parent_record(v_game_state, p_parent_id);
    if v_parent_record is null then
        raise exception 'shared_fusion_parent_unavailable'
            using errcode = '42501';
    end if;

    v_max_creatures := case
        when coalesce(v_game_state->>'maxCreatures', '') ~ '^[0-9]{1,3}$'
            then (v_game_state->>'maxCreatures')::integer
        else 8
    end;
    if jsonb_array_length(v_game_state->'creatures') + 1 > v_max_creatures then
        raise exception 'shared_fusion_collection_capacity'
            using errcode = '22023';
    end if;

    update public.shared_fusion_invitations
    set guest_user_id = v_user_id,
        guest_parent_id = p_parent_id,
        guest_parent_fingerprint = md5(v_parent_record::text),
        guest_parent_record = v_parent_record,
        guest_save_revision = v_revision,
        host_confirmed_at = null,
        guest_confirmed_at = null,
        status = 'paired',
        updated_at = timezone('utc', now())
    where invitation_id = v_invitation.invitation_id
    returning * into v_invitation;

    return public.shared_fusion_invitation_view(
        v_invitation,
        v_user_id
    );
end;
$$;

create or replace function public.get_shared_fusion_invitation(
    p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_invitation public.shared_fusion_invitations;
begin
    if v_user_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
    end if;

    update public.shared_fusion_invitations
    set status = 'expired',
        updated_at = timezone('utc', now())
    where invitation_id = p_invitation_id
      and status in ('waiting', 'paired', 'ready')
      and expires_at <= timezone('utc', now());

    select *
    into v_invitation
    from public.shared_fusion_invitations
    where invitation_id = p_invitation_id
      and (
        host_user_id = v_user_id
        or guest_user_id = v_user_id
      );
    if not found then
        raise exception 'shared_fusion_invitation_not_found'
            using errcode = '42501';
    end if;

    return public.shared_fusion_invitation_view(
        v_invitation,
        v_user_id
    );
end;
$$;

create or replace function public.confirm_shared_fusion_invitation(
    p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_invitation public.shared_fusion_invitations;
    v_revision bigint;
    v_game_state jsonb;
    v_parent_id text;
    v_expected_fingerprint text;
    v_parent_record jsonb;
    v_max_creatures integer;
    v_operation_id text;
    v_host_offspring_id text;
    v_guest_offspring_id text;
    v_result_seed text;
    v_request jsonb;
    v_request_fingerprint text;
    v_server_fingerprint text;
begin
    if v_user_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
    end if;

    select *
    into v_invitation
    from public.shared_fusion_invitations
    where invitation_id = p_invitation_id
      and (
        host_user_id = v_user_id
        or guest_user_id = v_user_id
      )
    for update;
    if not found then
        raise exception 'shared_fusion_invitation_not_found'
            using errcode = '42501';
    end if;
    if v_invitation.expires_at <= timezone('utc', now()) then
        update public.shared_fusion_invitations
        set status = 'expired',
            updated_at = timezone('utc', now())
        where invitation_id = p_invitation_id;
        select *
        into v_invitation
        from public.shared_fusion_invitations
        where invitation_id = p_invitation_id;
        return public.shared_fusion_invitation_view(
            v_invitation,
            v_user_id
        );
    end if;
    if v_invitation.status not in ('paired', 'ready') then
        raise exception 'shared_fusion_invitation_not_confirmable'
            using errcode = '22023';
    end if;

    if v_user_id = v_invitation.host_user_id then
        v_parent_id := v_invitation.host_parent_id;
        v_expected_fingerprint := v_invitation.host_parent_fingerprint;
    else
        v_parent_id := v_invitation.guest_parent_id;
        v_expected_fingerprint := v_invitation.guest_parent_fingerprint;
    end if;

    select revision, game_state
    into v_revision, v_game_state
    from public.game_saves
    where user_id = v_user_id
      and save_slot = 'primary'
    for update;
    if not found then
        raise exception 'shared_fusion_cloud_save_required'
            using errcode = '22023';
    end if;
    v_parent_record :=
        public.shared_fusion_parent_record(v_game_state, v_parent_id);
    if v_parent_record is null
        or md5(v_parent_record::text) <> v_expected_fingerprint then
        raise exception 'shared_fusion_parent_changed'
            using errcode = '40001';
    end if;

    v_max_creatures := case
        when coalesce(v_game_state->>'maxCreatures', '') ~ '^[0-9]{1,3}$'
            then (v_game_state->>'maxCreatures')::integer
        else 8
    end;
    if jsonb_array_length(v_game_state->'creatures') + 1 > v_max_creatures then
        raise exception 'shared_fusion_collection_capacity'
            using errcode = '22023';
    end if;

    if v_user_id = v_invitation.host_user_id then
        update public.shared_fusion_invitations
        set host_confirmed_at = coalesce(
                host_confirmed_at,
                timezone('utc', now())
            ),
            host_save_revision = v_revision,
            status = case
                when guest_confirmed_at is not null then 'ready'
                else 'paired'
            end,
            updated_at = timezone('utc', now())
        where invitation_id = p_invitation_id
        returning * into v_invitation;
    else
        update public.shared_fusion_invitations
        set guest_confirmed_at = coalesce(
                guest_confirmed_at,
                timezone('utc', now())
            ),
            guest_save_revision = v_revision,
            status = case
                when host_confirmed_at is not null then 'ready'
                else 'paired'
            end,
            updated_at = timezone('utc', now())
        where invitation_id = p_invitation_id
        returning * into v_invitation;
    end if;

    if v_invitation.status = 'ready'
        and v_invitation.operation_id is null then
        v_operation_id :=
            'fusion_shared_' || gen_random_uuid()::text;
        v_host_offspring_id :=
            'creature_shared_' || gen_random_uuid()::text;
        v_guest_offspring_id :=
            'creature_shared_' || gen_random_uuid()::text;
        v_result_seed := 'fusion-server-shared-v1:' || md5(
            v_invitation.invitation_id::text || ':' ||
            v_invitation.host_parent_fingerprint || ':' ||
            v_invitation.guest_parent_fingerprint
        );
        v_request := jsonb_build_object(
            'schemaVersion', 1,
            'contractVersion', 3,
            'operationId', v_operation_id,
            'parentIds', jsonb_build_array(
                v_invitation.host_parent_id,
                v_invitation.guest_parent_id
            ),
            'candidateOffspringIds', jsonb_build_array(
                v_host_offspring_id,
                v_guest_offspring_id
            ),
            'offspringCapacity', 2,
            'expectedSaveRevision',
                v_invitation.host_save_revision,
            'requestedAt', floor(
                extract(epoch from timezone('utc', now())) * 1000
            )::bigint,
            'resultSeed', v_result_seed,
            'executionMode', 'server_shared',
            'consent', jsonb_build_object(
                'mode', 'cross_owner',
                'scope', 'protected_invitation',
                'keeperGrant', 'dual_confirmed',
                'parentGrants', jsonb_build_array(
                    jsonb_build_object(
                        'creatureId',
                        v_invitation.host_parent_id,
                        'grant',
                        'lineage_synthesis',
                        'decision',
                        'willing'
                    ),
                    jsonb_build_object(
                        'creatureId',
                        v_invitation.guest_parent_id,
                        'grant',
                        'lineage_synthesis',
                        'decision',
                        'willing'
                    )
                ),
                'sharedInvitationId',
                    v_invitation.invitation_id
            )
        );
        v_request_fingerprint :=
            'fnv1a32-v1:' || substr(md5(v_request::text), 1, 8);
        v_request := v_request || jsonb_build_object(
            'requestFingerprint',
            v_request_fingerprint
        );
        v_server_fingerprint := md5(
            (v_request - 'requestFingerprint')::text
        );

        insert into public.fusion_operations (
            user_id,
            operation_id,
            schema_version,
            request_fingerprint,
            server_fingerprint,
            parent_ids,
            offspring_ids,
            offspring_count,
            expected_save_revision,
            result_seed,
            request,
            status,
            expires_at
        )
        values (
            v_invitation.host_user_id,
            v_operation_id,
            1,
            v_request_fingerprint,
            v_server_fingerprint,
            array[
                v_invitation.host_parent_id,
                v_invitation.guest_parent_id
            ],
            array[v_host_offspring_id, v_guest_offspring_id],
            2,
            v_invitation.host_save_revision,
            v_result_seed,
            v_request,
            'reserved',
            timezone('utc', now()) + interval '30 minutes'
        );

        update public.shared_fusion_invitations
        set operation_id = v_operation_id,
            host_offspring_id = v_host_offspring_id,
            guest_offspring_id = v_guest_offspring_id,
            expires_at =
                timezone('utc', now()) + interval '30 minutes',
            updated_at = timezone('utc', now())
        where invitation_id = p_invitation_id
        returning * into v_invitation;
    end if;

    return public.shared_fusion_invitation_view(
        v_invitation,
        v_user_id
    );
end;
$$;

create or replace function public.cancel_shared_fusion_invitation(
    p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_invitation public.shared_fusion_invitations;
begin
    if v_user_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
    end if;
    select *
    into v_invitation
    from public.shared_fusion_invitations
    where invitation_id = p_invitation_id
      and (
        host_user_id = v_user_id
        or guest_user_id = v_user_id
      )
    for update;
    if not found then
        raise exception 'shared_fusion_invitation_not_found'
            using errcode = '42501';
    end if;
    if v_invitation.status in ('executing', 'committed') then
        raise exception 'shared_fusion_invitation_locked'
            using errcode = '22023';
    end if;
    if v_invitation.status not in ('cancelled', 'expired') then
        update public.shared_fusion_invitations
        set status = 'cancelled',
            updated_at = timezone('utc', now())
        where invitation_id = p_invitation_id
        returning * into v_invitation;
    end if;

    return public.shared_fusion_invitation_view(
        v_invitation,
        v_user_id
    );
end;
$$;

create or replace function public.resolve_shared_fusion_execution(
    p_user_id uuid,
    p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_invitation public.shared_fusion_invitations;
    v_role text;
begin
    if p_user_id is null then
        raise exception 'fusion_user_required'
            using errcode = '42501';
    end if;
    select *
    into v_invitation
    from public.shared_fusion_invitations
    where invitation_id = p_invitation_id
      and (
        host_user_id = p_user_id
        or guest_user_id = p_user_id
      );
    if not found
        or v_invitation.operation_id is null
        or v_invitation.status not in (
            'ready',
            'executing',
            'staged',
            'committed'
        ) then
        raise exception 'shared_fusion_invitation_not_executable'
            using errcode = '42501';
    end if;
    v_role := case
        when v_invitation.host_user_id = p_user_id then 'host'
        else 'guest'
    end;
    return jsonb_build_object(
        'invitationId', v_invitation.invitation_id,
        'operationOwnerId', v_invitation.host_user_id,
        'operationId', v_invitation.operation_id,
        'role', v_role,
        'status', v_invitation.status
    );
end;
$$;

create or replace function public.get_fusion_execution_context(
    p_user_id uuid,
    p_operation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_operation public.fusion_operations;
    v_invitation public.shared_fusion_invitations;
    v_game_state jsonb;
    v_creatures jsonb;
    v_parent_records jsonb;
    v_shared boolean := false;
begin
    if p_user_id is null then
        raise exception 'fusion_user_required'
            using errcode = '42501';
    end if;
    if p_operation_id is null
        or p_operation_id !~ '^fusion_[A-Za-z0-9_-]{1,160}$' then
        raise exception 'invalid_fusion_operation_id'
            using errcode = '22023';
    end if;

    select *
    into v_operation
    from public.fusion_operations
    where user_id = p_user_id
      and operation_id = p_operation_id;
    if not found then
        raise exception 'fusion_operation_not_found'
            using errcode = '22023';
    end if;

    v_shared := v_operation.request#>>'{consent,mode}' = 'cross_owner';
    if v_operation.status = 'staged' and v_operation.result is not null then
        return jsonb_build_object(
            'schemaVersion', 1,
            'operationId', v_operation.operation_id,
            'status', v_operation.status,
            'requestFingerprint', v_operation.request_fingerprint,
            'serverFingerprint', v_operation.server_fingerprint,
            'resultSeed', v_operation.result_seed,
            'result', v_operation.result,
            'receipt', v_operation.result_receipt,
            'shared', v_shared,
            'replay', true
        );
    end if;
    if v_operation.status <> 'reserved' then
        raise exception 'fusion_operation_not_executable'
            using errcode = '22023';
    end if;
    if v_operation.expires_at <= timezone('utc', now()) then
        update public.fusion_operations
        set status = 'cancelled'
        where user_id = p_user_id
          and operation_id = p_operation_id;
        if v_shared then
            update public.shared_fusion_invitations
            set status = 'expired',
                updated_at = timezone('utc', now())
            where operation_id = p_operation_id;
        end if;
        raise exception 'fusion_operation_expired'
            using errcode = '22023';
    end if;

    if v_shared then
        select *
        into v_invitation
        from public.shared_fusion_invitations
        where host_user_id = p_user_id
          and operation_id = p_operation_id
          and status in ('ready', 'executing')
        for update;
        if not found
            or v_invitation.host_confirmed_at is null
            or v_invitation.guest_confirmed_at is null then
            raise exception 'shared_fusion_dual_consent_required'
                using errcode = '42501';
        end if;
        v_parent_records := jsonb_build_array(
            v_invitation.host_parent_record,
            v_invitation.guest_parent_record
        );
        update public.shared_fusion_invitations
        set status = 'executing',
            updated_at = timezone('utc', now())
        where invitation_id = v_invitation.invitation_id
          and status = 'ready';
    else
        select game_state
        into v_game_state
        from public.game_saves
        where user_id = p_user_id
          and save_slot = 'primary';
        if not found then
            raise exception 'cloud_save_required_for_fusion_execution'
                using errcode = '22023';
        end if;
        v_creatures := coalesce(v_game_state->'creatures', '[]'::jsonb);
        if jsonb_typeof(v_creatures) <> 'array' then
            raise exception 'invalid_cloud_creature_collection'
                using errcode = '22023';
        end if;

        select jsonb_agg(
            jsonb_build_object(
                'id', creature->>'id',
                'generation', case
                    when creature->>'generation' ~ '^[0-9]+$'
                        then greatest(
                            (creature->>'generation')::integer,
                            1
                        )
                    else 1
                end,
                'rarity', coalesce(
                    creature->>'rarity',
                    creature#>>'{genes,rarity}',
                    'common'
                ),
                'genes', coalesce(
                    creature->'genes',
                    creature->'dna',
                    '{}'::jsonb
                ),
                'dna', coalesce(
                    creature->'dna',
                    creature->'genes',
                    '{}'::jsonb
                ),
                'cosmicAffinity', coalesce(
                    creature->'cosmicAffinity',
                    creature#>'{genes,cosmicAffinity}',
                    'null'::jsonb
                ),
                'personality', coalesce(
                    creature->'personality',
                    creature#>'{genes,personality}',
                    'null'::jsonb
                ),
                'lifecycle', jsonb_build_object(
                    'stage', creature#>>'{lifecycle,stage}'
                )
            )
            order by array_position(
                v_operation.parent_ids,
                creature->>'id'
            )
        )
        into v_parent_records
        from jsonb_array_elements(v_creatures) as creature
        where creature->>'id' = any(v_operation.parent_ids)
          and lower(
            coalesce(creature#>>'{lifecycle,stage}', '')
          ) in ('adult', 'elder')
          and lower(
            coalesce(
                creature#>>'{lifecycle,hasDeparted}',
                'false'
            )
          ) <> 'true'
          and nullif(
            creature#>>'{lifecycle,departureDate}',
            ''
          ) is null;
        if jsonb_array_length(
            coalesce(v_parent_records, '[]'::jsonb)
        ) <> 2 then
            raise exception
                'fusion_parent_ownership_or_eligibility_failed'
                using errcode = '42501';
        end if;
    end if;

    return jsonb_build_object(
        'schemaVersion', 1,
        'operationId', v_operation.operation_id,
        'status', v_operation.status,
        'requestFingerprint', v_operation.request_fingerprint,
        'serverFingerprint', v_operation.server_fingerprint,
        'resultSeed', v_operation.result_seed,
        'offspringIds', to_jsonb(v_operation.offspring_ids),
        'offspringCount', v_operation.offspring_count,
        'parentIds', to_jsonb(v_operation.parent_ids),
        'parentRecords', v_parent_records,
        'reservedAt', v_operation.created_at,
        'shared', v_shared,
        'replay', false
    );
end;
$$;

create or replace function public.stage_fusion_operation_result(
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
    v_result_ids text[];
begin
    if p_user_id is null then
        raise exception 'fusion_user_required'
            using errcode = '42501';
    end if;
    if p_result is null
        or jsonb_typeof(p_result) <> 'object'
        or octet_length(p_result::text) > 2097152
        or p_receipt is null
        or jsonb_typeof(p_receipt) <> 'object'
        or octet_length(p_receipt::text) > 65536 then
        raise exception 'invalid_fusion_server_result'
            using errcode = '22023';
    end if;

    select *
    into v_operation
    from public.fusion_operations
    where user_id = p_user_id
      and operation_id = p_operation_id
    for update;
    if not found then
        raise exception 'fusion_operation_not_found'
            using errcode = '22023';
    end if;
    if v_operation.server_fingerprint <> p_server_fingerprint then
        raise exception 'fusion_server_fingerprint_mismatch'
            using errcode = '42501';
    end if;
    if v_operation.status = 'staged' and v_operation.result is not null then
        if v_operation.result_receipt->>'receiptFingerprint' <>
            p_receipt->>'receiptFingerprint' then
            raise exception 'fusion_result_replay_mismatch'
                using errcode = '23505';
        end if;
        return jsonb_build_object(
            'schemaVersion', 1,
            'operationId', v_operation.operation_id,
            'status', v_operation.status,
            'result', v_operation.result,
            'receipt', v_operation.result_receipt,
            'shared',
                v_operation.request#>>'{consent,mode}' = 'cross_owner',
            'replay', true
        );
    end if;
    if v_operation.status <> 'reserved'
        or v_operation.expires_at <= timezone('utc', now()) then
        raise exception 'fusion_operation_not_stageable'
            using errcode = '22023';
    end if;
    if p_result->>'schemaVersion' <> '1'
        or p_result->>'operationId' <> p_operation_id
        or jsonb_typeof(p_result->'offspring') <> 'array'
        or jsonb_array_length(p_result->'offspring') <>
            v_operation.offspring_count then
        raise exception 'fusion_result_contract_mismatch'
            using errcode = '22023';
    end if;
    select array_agg(
        offspring#>>'{offspringData,creatureId}'
        order by ordinality
    )
    into v_result_ids
    from jsonb_array_elements(p_result->'offspring')
        with ordinality as result_offspring(offspring, ordinality);
    if v_result_ids is distinct from v_operation.offspring_ids
        or p_receipt->>'schemaVersion' <> '1'
        or p_receipt->>'operationId' <> p_operation_id
        or p_receipt->>'authority' <> 'server_generated'
        or p_receipt->>'requestFingerprint' <>
            v_operation.request_fingerprint
        or p_receipt->>'serverFingerprint' <>
            v_operation.server_fingerprint
        or coalesce(p_receipt->>'resultFingerprint', '') = ''
        or coalesce(p_receipt->>'receiptFingerprint', '') = '' then
        raise exception 'fusion_result_identity_mismatch'
            using errcode = '42501';
    end if;

    update public.fusion_operations
    set status = 'staged',
        result = p_result,
        result_receipt = p_receipt
    where user_id = p_user_id
      and operation_id = p_operation_id
    returning * into v_operation;
    if v_operation.request#>>'{consent,mode}' = 'cross_owner' then
        update public.shared_fusion_invitations
        set status = 'staged',
            updated_at = timezone('utc', now())
        where host_user_id = p_user_id
          and operation_id = p_operation_id;
    end if;

    return jsonb_build_object(
        'schemaVersion', 1,
        'operationId', v_operation.operation_id,
        'status', v_operation.status,
        'result', v_operation.result,
        'receipt', v_operation.result_receipt,
        'shared',
            v_operation.request#>>'{consent,mode}' = 'cross_owner',
        'replay', false
    );
end;
$$;

create or replace function public.build_shared_fusion_child(
    p_child_result jsonb,
    p_child_id text,
    p_name text,
    p_own_parent_id text,
    p_remote_parent_ref text,
    p_sibling_id text,
    p_operation_id text,
    p_invitation_id uuid,
    p_created_at_ms bigint
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
    v_child_data jsonb := coalesce(
        p_child_result->'offspringData',
        '{}'::jsonb
    );
    v_genes jsonb := coalesce(
        p_child_result->'offspringGenes',
        '{}'::jsonb
    );
    v_generation integer := case
        when coalesce(
            p_child_result#>>'{offspringData,generation}',
            ''
        ) ~ '^[0-9]+$'
            then greatest(
                (
                    p_child_result#>>'{offspringData,generation}'
                )::integer,
                2
            )
        else 2
    end;
begin
    return jsonb_build_object(
        'id', p_child_id,
        'name', p_name,
        'genes', v_genes,
        'dna', v_genes,
        'personality', coalesce(
            v_genes->'personality',
            'null'::jsonb
        ),
        'personalityState', 'null'::jsonb,
        'stats', jsonb_build_object(
            'happiness', 100,
            'energy', 100,
            'health', 100
        ),
        'level', 1,
        'experience', 0,
        'textureName', 'null'::jsonb,
        'portraits', jsonb_build_object(
            'schemaVersion', 2,
            'activeStage', 'null'::jsonb,
            'byStage', jsonb_build_object()
        ),
        'hatchTime', p_created_at_ms,
        'lifecycle', jsonb_build_object(
            'birthDate', p_created_at_ms,
            'stage', 'baby',
            'lastStageChange', p_created_at_ms,
            'evolutionHistory', jsonb_build_array()
        ),
        'cosmicAffinity', coalesce(
            v_genes->'cosmicAffinity',
            'null'::jsonb
        ),
        'rarity', coalesce(v_child_data->>'rarity', 'common'),
        'addedAt', p_created_at_ms,
        'isOffspring', true,
        'isSharedSibling', true,
        'generation', v_generation,
        'parentIds', jsonb_build_array(
            p_own_parent_id,
            p_remote_parent_ref
        ),
        'offspringBonus', coalesce(
            v_child_data->'offspringBonus',
            'null'::jsonb
        ),
        'birthEvents', coalesce(
            v_child_data->'birthEvents',
            '[]'::jsonb
        ),
        'secretAbilities', coalesce(
            v_child_data->'secretAbilities',
            '[]'::jsonb
        ),
        'isShiny', coalesce(
            v_child_data->'isShiny',
            'false'::jsonb
        ),
        'hasDualAffinity', coalesce(
            v_child_data->'hasDualAffinity',
            'false'::jsonb
        ),
        'dualAffinity', coalesce(
            v_child_data->'dualAffinity',
            'null'::jsonb
        ),
        'linkedSiblingId', p_sibling_id,
        'lineage', jsonb_build_object(
            'schemaVersion', 2,
            'creatureId', p_child_id,
            'origin', 'shared_fusion',
            'generation', v_generation,
            'parentIds', jsonb_build_array(
                p_own_parent_id,
                p_remote_parent_ref
            ),
            'fusionOperationId', p_operation_id,
            'sharedInvitationId', p_invitation_id,
            'linkedSiblingId', p_sibling_id,
            'createdAt', p_created_at_ms
        )
    );
end;
$$;

create or replace function public.submit_shared_fusion_name(
    p_invitation_id uuid,
    p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_name text := btrim(coalesce(p_name, ''));
    v_invitation public.shared_fusion_invitations;
    v_operation public.fusion_operations;
    v_host_state jsonb;
    v_guest_state jsonb;
    v_host_revision bigint;
    v_guest_revision bigint;
    v_host_save_version text;
    v_guest_save_version text;
    v_host_parent jsonb;
    v_guest_parent jsonb;
    v_host_creatures jsonb;
    v_guest_creatures jsonb;
    v_host_max integer;
    v_guest_max integer;
    v_host_child_result jsonb;
    v_guest_child_result jsonb;
    v_host_child jsonb;
    v_guest_child jsonb;
    v_host_shrine jsonb;
    v_guest_shrine jsonb;
    v_host_shared jsonb;
    v_guest_shared jsonb;
    v_host_history jsonb;
    v_guest_history jsonb;
    v_completed_at timestamptz :=
        timezone('utc', clock_timestamp());
    v_completed_at_ms bigint;
    v_host_parent_ref text;
    v_guest_parent_ref text;
    v_history_entry jsonb;
    v_commit_base jsonb;
    v_commit_receipt jsonb;
    v_view jsonb;
begin
    if v_user_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
    end if;
    if char_length(v_name) < 1
        or char_length(v_name) > 20
        or v_name ~ '[[:cntrl:]<>]' then
        raise exception 'invalid_shared_fusion_name'
            using errcode = '22023';
    end if;

    select *
    into v_invitation
    from public.shared_fusion_invitations
    where invitation_id = p_invitation_id
      and (
        host_user_id = v_user_id
        or guest_user_id = v_user_id
      )
    for update;
    if not found then
        raise exception 'shared_fusion_invitation_not_found'
            using errcode = '42501';
    end if;
    if v_invitation.status = 'committed' then
        return public.shared_fusion_invitation_view(
            v_invitation,
            v_user_id
        ) || jsonb_build_object('replay', true);
    end if;
    if v_invitation.status <> 'staged'
        or v_invitation.operation_id is null then
        raise exception 'shared_fusion_result_not_ready'
            using errcode = '22023';
    end if;

    if v_user_id = v_invitation.host_user_id then
        if v_invitation.host_offspring_name is not null
            and v_invitation.host_offspring_name <> v_name then
            raise exception 'shared_fusion_name_replay_mismatch'
                using errcode = '23505';
        end if;
        update public.shared_fusion_invitations
        set host_offspring_name = coalesce(
                host_offspring_name,
                v_name
            ),
            updated_at = timezone('utc', now())
        where invitation_id = p_invitation_id
        returning * into v_invitation;
    else
        if v_invitation.guest_offspring_name is not null
            and v_invitation.guest_offspring_name <> v_name then
            raise exception 'shared_fusion_name_replay_mismatch'
                using errcode = '23505';
        end if;
        update public.shared_fusion_invitations
        set guest_offspring_name = coalesce(
                guest_offspring_name,
                v_name
            ),
            updated_at = timezone('utc', now())
        where invitation_id = p_invitation_id
        returning * into v_invitation;
    end if;

    if v_invitation.host_offspring_name is null
        or v_invitation.guest_offspring_name is null then
        return public.shared_fusion_invitation_view(
            v_invitation,
            v_user_id
        ) || jsonb_build_object(
            'awaitingOtherKeeper', true,
            'replay', false
        );
    end if;

    select *
    into v_operation
    from public.fusion_operations
    where user_id = v_invitation.host_user_id
      and operation_id = v_invitation.operation_id
    for update;
    if not found
        or v_operation.status <> 'staged'
        or v_operation.result is null
        or v_operation.result_receipt is null
        or v_operation.offspring_ids is distinct from array[
            v_invitation.host_offspring_id,
            v_invitation.guest_offspring_id
        ] then
        raise exception 'shared_fusion_staged_result_invalid'
            using errcode = '42501';
    end if;

    perform user_id
    from public.game_saves
    where user_id in (
        v_invitation.host_user_id,
        v_invitation.guest_user_id
    )
      and save_slot = 'primary'
    order by user_id
    for update;

    select save_version, revision, game_state
    into v_host_save_version, v_host_revision, v_host_state
    from public.game_saves
    where user_id = v_invitation.host_user_id
      and save_slot = 'primary';
    select save_version, revision, game_state
    into v_guest_save_version, v_guest_revision, v_guest_state
    from public.game_saves
    where user_id = v_invitation.guest_user_id
      and save_slot = 'primary';
    if v_host_state is null or v_guest_state is null then
        raise exception 'shared_fusion_cloud_saves_required'
            using errcode = '22023';
    end if;

    v_host_parent := public.shared_fusion_parent_record(
        v_host_state,
        v_invitation.host_parent_id
    );
    v_guest_parent := public.shared_fusion_parent_record(
        v_guest_state,
        v_invitation.guest_parent_id
    );
    if v_host_parent is null
        or v_guest_parent is null
        or md5(v_host_parent::text) <>
            v_invitation.host_parent_fingerprint
        or md5(v_guest_parent::text) <>
            v_invitation.guest_parent_fingerprint then
        raise exception 'shared_fusion_parent_changed'
            using errcode = '40001';
    end if;

    v_host_creatures := coalesce(
        v_host_state->'creatures',
        '[]'::jsonb
    );
    v_guest_creatures := coalesce(
        v_guest_state->'creatures',
        '[]'::jsonb
    );
    if jsonb_typeof(v_host_creatures) <> 'array'
        or jsonb_typeof(v_guest_creatures) <> 'array' then
        raise exception 'invalid_cloud_creature_collection'
            using errcode = '22023';
    end if;
    if exists (
        select 1
        from jsonb_array_elements(v_host_creatures) as creature
        where creature->>'id' = any(v_operation.offspring_ids)
    ) or exists (
        select 1
        from jsonb_array_elements(v_guest_creatures) as creature
        where creature->>'id' = any(v_operation.offspring_ids)
    ) then
        raise exception 'shared_fusion_offspring_identity_exists'
            using errcode = '23505';
    end if;

    v_host_max := case
        when coalesce(v_host_state->>'maxCreatures', '') ~ '^[0-9]{1,3}$'
            then (v_host_state->>'maxCreatures')::integer
        else 8
    end;
    v_guest_max := case
        when coalesce(v_guest_state->>'maxCreatures', '') ~ '^[0-9]{1,3}$'
            then (v_guest_state->>'maxCreatures')::integer
        else 8
    end;
    if jsonb_array_length(v_host_creatures) + 1 > v_host_max
        or jsonb_array_length(v_guest_creatures) + 1 > v_guest_max then
        raise exception 'shared_fusion_collection_capacity'
            using errcode = '22023';
    end if;

    v_host_child_result := v_operation.result->'offspring'->0;
    v_guest_child_result := v_operation.result->'offspring'->1;
    if v_host_child_result#>>'{offspringData,creatureId}' <>
            v_invitation.host_offspring_id
        or v_guest_child_result#>>'{offspringData,creatureId}' <>
            v_invitation.guest_offspring_id then
        raise exception 'shared_fusion_result_identity_mismatch'
            using errcode = '42501';
    end if;

    v_completed_at_ms := floor(
        extract(epoch from v_completed_at) * 1000
    )::bigint;
    v_host_parent_ref :=
        'protected-parent-v1:' || md5(
            v_invitation.invitation_id::text || ':host'
        );
    v_guest_parent_ref :=
        'protected-parent-v1:' || md5(
            v_invitation.invitation_id::text || ':guest'
        );
    v_host_child := public.build_shared_fusion_child(
        v_host_child_result,
        v_invitation.host_offspring_id,
        v_invitation.host_offspring_name,
        v_invitation.host_parent_id,
        v_guest_parent_ref,
        v_invitation.guest_offspring_id,
        v_invitation.operation_id,
        v_invitation.invitation_id,
        v_completed_at_ms
    );
    v_guest_child := public.build_shared_fusion_child(
        v_guest_child_result,
        v_invitation.guest_offspring_id,
        v_invitation.guest_offspring_name,
        v_invitation.guest_parent_id,
        v_host_parent_ref,
        v_invitation.host_offspring_id,
        v_invitation.operation_id,
        v_invitation.invitation_id,
        v_completed_at_ms
    );

    v_history_entry := jsonb_build_object(
        'schemaVersion', 2,
        'operationId', v_invitation.operation_id,
        'origin', 'shared_fusion',
        'authority', 'server_shared',
        'offspringCount', 1,
        'completedAt', v_completed_at_ms
    );

    v_host_shrine := coalesce(
        v_host_state->'breedingShrine',
        '{}'::jsonb
    );
    v_guest_shrine := coalesce(
        v_guest_state->'breedingShrine',
        '{}'::jsonb
    );
    v_host_history := case
        when jsonb_typeof(v_host_shrine->'breedingHistory') = 'array'
            then v_host_shrine->'breedingHistory'
        else '[]'::jsonb
    end;
    v_guest_history := case
        when jsonb_typeof(v_guest_shrine->'breedingHistory') = 'array'
            then v_guest_shrine->'breedingHistory'
        else '[]'::jsonb
    end;
    v_host_shared := coalesce(
        v_host_shrine->'sharedFusion',
        '{}'::jsonb
    );
    v_guest_shared := coalesce(
        v_guest_shrine->'sharedFusion',
        '{}'::jsonb
    );

    v_host_shared := jsonb_build_object(
        'schemaVersion', 1,
        'activeInvitation', 'null'::jsonb,
        'completedOperationIds', coalesce(
            v_host_shared->'completedOperationIds',
            '[]'::jsonb
        ) || jsonb_build_array(v_invitation.operation_id),
        'pendingReveal', jsonb_build_object(
            'invitationId', v_invitation.invitation_id,
            'operationId', v_invitation.operation_id,
            'creatureId', v_invitation.host_offspring_id,
            'receivedAt', v_completed_at_ms
        )
    );
    v_guest_shared := jsonb_build_object(
        'schemaVersion', 1,
        'activeInvitation', 'null'::jsonb,
        'completedOperationIds', coalesce(
            v_guest_shared->'completedOperationIds',
            '[]'::jsonb
        ) || jsonb_build_array(v_invitation.operation_id),
        'pendingReveal', jsonb_build_object(
            'invitationId', v_invitation.invitation_id,
            'operationId', v_invitation.operation_id,
            'creatureId', v_invitation.guest_offspring_id,
            'receivedAt', v_completed_at_ms
        )
    );

    v_host_shrine := jsonb_set(
        jsonb_set(
            jsonb_set(
                v_host_shrine,
                '{lastBreedingTime}',
                to_jsonb(v_completed_at_ms),
                true
            ),
            '{breedingHistory}',
            (
                select coalesce(
                    jsonb_agg(value order by ordinality),
                    '[]'::jsonb
                )
                from (
                    select value, ordinality
                    from jsonb_array_elements(
                        v_host_history ||
                        jsonb_build_array(v_history_entry)
                    ) with ordinality as entry(value, ordinality)
                    order by ordinality desc
                    limit 50
                ) as retained
            ),
            true
        ),
        '{sharedFusion}',
        v_host_shared,
        true
    );
    v_guest_shrine := jsonb_set(
        jsonb_set(
            jsonb_set(
                v_guest_shrine,
                '{lastBreedingTime}',
                to_jsonb(v_completed_at_ms),
                true
            ),
            '{breedingHistory}',
            (
                select coalesce(
                    jsonb_agg(value order by ordinality),
                    '[]'::jsonb
                )
                from (
                    select value, ordinality
                    from jsonb_array_elements(
                        v_guest_history ||
                        jsonb_build_array(v_history_entry)
                    ) with ordinality as entry(value, ordinality)
                    order by ordinality desc
                    limit 50
                ) as retained
            ),
            true
        ),
        '{sharedFusion}',
        v_guest_shared,
        true
    );

    v_host_state := jsonb_set(
        jsonb_set(
            jsonb_set(
                v_host_state,
                '{creatures}',
                v_host_creatures || jsonb_build_array(v_host_child),
                true
            ),
            '{breedingShrine}',
            v_host_shrine,
            true
        ),
        '{savedAt}',
        to_jsonb(v_completed_at_ms),
        true
    );
    v_guest_state := jsonb_set(
        jsonb_set(
            jsonb_set(
                v_guest_state,
                '{creatures}',
                v_guest_creatures || jsonb_build_array(v_guest_child),
                true
            ),
            '{breedingShrine}',
            v_guest_shrine,
            true
        ),
        '{savedAt}',
        to_jsonb(v_completed_at_ms),
        true
    );

    update public.game_saves
    set game_state = v_host_state,
        client_saved_at = v_completed_at,
        save_version = v_host_save_version
    where user_id = v_invitation.host_user_id
      and save_slot = 'primary';
    update public.game_saves
    set game_state = v_guest_state,
        client_saved_at = v_completed_at,
        save_version = v_guest_save_version
    where user_id = v_invitation.guest_user_id
      and save_slot = 'primary';

    v_commit_base := jsonb_build_object(
        'schemaVersion', 1,
        'operationId', v_invitation.operation_id,
        'authority', 'server_shared_finalized',
        'requestFingerprint', v_operation.request_fingerprint,
        'serverFingerprint', v_operation.server_fingerprint,
        'resultFingerprint',
            v_operation.result_receipt->>'resultFingerprint',
        'hostOffspringId', v_invitation.host_offspring_id,
        'guestOffspringId', v_invitation.guest_offspring_id,
        'completedAt', v_completed_at_ms
    );
    v_commit_receipt := v_commit_base || jsonb_build_object(
        'receiptFingerprint',
        'fusion-shared-commit-v1:' || md5(v_commit_base::text)
    );
    update public.fusion_operations
    set status = 'committed',
        commit_receipt = v_commit_receipt,
        completed_at = v_completed_at
    where user_id = v_invitation.host_user_id
      and operation_id = v_invitation.operation_id;
    update public.shared_fusion_invitations
    set status = 'committed',
        result_receipt = v_commit_receipt,
        committed_at = v_completed_at,
        updated_at = v_completed_at
    where invitation_id = p_invitation_id
    returning * into v_invitation;

    v_view := public.shared_fusion_invitation_view(
        v_invitation,
        v_user_id
    );
    return v_view || jsonb_build_object(
        'replay', false,
        'ownOffspring', case
            when v_user_id = v_invitation.host_user_id
                then v_host_child
            else v_guest_child
        end
    );
end;
$$;

revoke all on function public.shared_fusion_parent_record(jsonb, text)
from public;
revoke all on function public.shared_fusion_invitation_view(
    public.shared_fusion_invitations,
    uuid
) from public;
revoke all on function public.attest_shared_fusion_eligibility(text, text)
from public;
revoke all on function public.create_shared_fusion_invitation(text, bigint)
from public;
revoke all on function public.join_shared_fusion_invitation(
    text,
    text,
    bigint
) from public;
revoke all on function public.get_shared_fusion_invitation(uuid)
from public;
revoke all on function public.confirm_shared_fusion_invitation(uuid)
from public;
revoke all on function public.cancel_shared_fusion_invitation(uuid)
from public;
revoke all on function public.resolve_shared_fusion_execution(uuid, uuid)
from public;
revoke all on function public.resolve_shared_fusion_execution(uuid, uuid)
from authenticated;
revoke all on function public.get_fusion_execution_context(uuid, text)
from public;
revoke all on function public.get_fusion_execution_context(uuid, text)
from authenticated;
revoke all on function public.stage_fusion_operation_result(
    uuid,
    text,
    text,
    jsonb,
    jsonb
) from public;
revoke all on function public.stage_fusion_operation_result(
    uuid,
    text,
    text,
    jsonb,
    jsonb
) from authenticated;
revoke all on function public.build_shared_fusion_child(
    jsonb,
    text,
    text,
    text,
    text,
    text,
    text,
    uuid,
    bigint
) from public;
revoke all on function public.submit_shared_fusion_name(uuid, text)
from public;

grant execute on function public.attest_shared_fusion_eligibility(text, text)
to authenticated;
grant execute on function public.create_shared_fusion_invitation(text, bigint)
to authenticated;
grant execute on function public.join_shared_fusion_invitation(
    text,
    text,
    bigint
) to authenticated;
grant execute on function public.get_shared_fusion_invitation(uuid)
to authenticated;
grant execute on function public.confirm_shared_fusion_invitation(uuid)
to authenticated;
grant execute on function public.cancel_shared_fusion_invitation(uuid)
to authenticated;
grant execute on function public.resolve_shared_fusion_execution(uuid, uuid)
to service_role;
grant execute on function public.get_fusion_execution_context(uuid, text)
to service_role;
grant execute on function public.stage_fusion_operation_result(
    uuid,
    text,
    text,
    jsonb,
    jsonb
) to service_role;
grant execute on function public.submit_shared_fusion_name(uuid, text)
to authenticated;
