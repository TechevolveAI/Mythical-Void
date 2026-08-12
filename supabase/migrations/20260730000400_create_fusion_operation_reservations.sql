create table if not exists public.fusion_operations (
    user_id uuid not null references auth.users(id) on delete cascade,
    operation_id text not null
        check (operation_id ~ '^fusion_[A-Za-z0-9_-]{1,160}$'),
    schema_version smallint not null default 1
        check (schema_version = 1),
    request_fingerprint text not null
        check (request_fingerprint ~ '^fnv1a32-v1:[0-9a-f]{8}$'),
    server_fingerprint text not null
        check (server_fingerprint ~ '^[0-9a-f]{32}$'),
    parent_ids text[] not null
        check (cardinality(parent_ids) = 2)
        check (parent_ids[1] <> parent_ids[2]),
    offspring_ids text[] not null,
    offspring_count smallint not null
        check (offspring_count in (1, 2))
        check (cardinality(offspring_ids) = offspring_count),
    expected_save_revision bigint not null
        check (expected_save_revision >= 0),
    result_seed text not null,
    request jsonb not null
        check (jsonb_typeof(request) = 'object')
        check (octet_length(request::text) <= 65536),
    status text not null default 'reserved'
        check (status in ('reserved', 'staged', 'committed', 'cancelled')),
    result_receipt jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    expires_at timestamptz not null default timezone('utc', now()) + interval '30 minutes',
    completed_at timestamptz,
    primary key (user_id, operation_id)
);

comment on table public.fusion_operations is
    'Private, replay-protected Fusion reservations. Results remain local until a later server executor is deployed.';

alter table public.fusion_operations enable row level security;
alter table public.fusion_operations force row level security;

revoke all on table public.fusion_operations from anon;
revoke all on table public.fusion_operations from authenticated;
grant select on table public.fusion_operations to authenticated;

drop policy if exists "Players can read their own fusion operations"
on public.fusion_operations;
create policy "Players can read their own fusion operations"
on public.fusion_operations
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.reserve_fusion_operation(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_operation_id text;
    v_request_fingerprint text;
    v_server_fingerprint text;
    v_parent_ids text[];
    v_grant_ids text[];
    v_offspring_ids text[];
    v_offspring_count integer;
    v_expected_revision bigint;
    v_current_revision bigint;
    v_game_state jsonb;
    v_creatures jsonb;
    v_parent_count integer;
    v_max_creatures integer;
    v_existing public.fusion_operations;
    v_result_seed text;
    v_sanitized_request jsonb;
begin
    if v_user_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
    end if;
    if p_request is null
        or jsonb_typeof(p_request) <> 'object'
        or octet_length(p_request::text) > 65536 then
        raise exception 'invalid_fusion_request'
            using errcode = '22023';
    end if;
    if p_request->>'schemaVersion' <> '1' then
        raise exception 'unsupported_fusion_schema'
            using errcode = '22023';
    end if;
    if jsonb_typeof(p_request->'parentIds') <> 'array'
        or jsonb_typeof(p_request->'offspringIds') <> 'array'
        or jsonb_typeof(p_request#>'{consent,parentGrants}') <> 'array'
        or coalesce(p_request->>'offspringCount', '') !~ '^[12]$'
        or coalesce(p_request->>'expectedSaveRevision', '') !~ '^[0-9]{1,19}$' then
        raise exception 'invalid_fusion_contract'
            using errcode = '22023';
    end if;

    v_operation_id := p_request->>'operationId';
    v_request_fingerprint := p_request->>'requestFingerprint';
    if v_operation_id is null
        or v_operation_id !~ '^fusion_[A-Za-z0-9_-]{1,160}$'
        or v_request_fingerprint is null
        or v_request_fingerprint !~ '^fnv1a32-v1:[0-9a-f]{8}$' then
        raise exception 'invalid_fusion_identity'
            using errcode = '22023';
    end if;

    select array_agg(value order by ordinality)
    into v_parent_ids
    from jsonb_array_elements_text(coalesce(p_request->'parentIds', '[]'::jsonb))
        with ordinality as parent_id(value, ordinality);

    select array_agg(value order by ordinality)
    into v_offspring_ids
    from jsonb_array_elements_text(coalesce(p_request->'offspringIds', '[]'::jsonb))
        with ordinality as offspring_id(value, ordinality);

    select array_agg(grant_entry->>'creatureId' order by ordinality)
    into v_grant_ids
    from jsonb_array_elements(p_request#>'{consent,parentGrants}')
        with ordinality as parent_grant(grant_entry, ordinality)
    where grant_entry->>'grant' = 'lineage_synthesis';

    v_offspring_count := (p_request->>'offspringCount')::integer;
    v_expected_revision := (p_request->>'expectedSaveRevision')::bigint;
    if cardinality(v_parent_ids) <> 2
        or v_parent_ids[1] = v_parent_ids[2]
        or v_parent_ids[1] !~ '^[A-Za-z0-9_-]{1,180}$'
        or v_parent_ids[2] !~ '^[A-Za-z0-9_-]{1,180}$'
        or v_offspring_count not in (1, 2)
        or cardinality(v_offspring_ids) <> v_offspring_count
        or cardinality(array(select distinct unnest(v_offspring_ids))) <>
            v_offspring_count
        or exists (
            select 1
            from unnest(v_offspring_ids) as offspring_id
            where offspring_id !~ '^[A-Za-z0-9_-]{1,180}$'
        )
        or v_expected_revision < 1
        or p_request#>>'{consent,mode}' <> 'same_save_owner'
        or v_grant_ids is distinct from v_parent_ids then
        raise exception 'invalid_fusion_contract'
            using errcode = '22023';
    end if;

    v_server_fingerprint := md5((p_request - 'requestFingerprint')::text);

    select *
    into v_existing
    from public.fusion_operations
    where user_id = v_user_id
      and operation_id = v_operation_id;

    if found then
        if v_existing.server_fingerprint <> v_server_fingerprint then
            raise exception 'fusion_operation_replay_mismatch'
                using errcode = '23505';
        end if;
        return jsonb_build_object(
            'schemaVersion', 1,
            'operationId', v_existing.operation_id,
            'status', v_existing.status,
            'reservationMode', 'server_reserved',
            'requestFingerprint', v_existing.request_fingerprint,
            'serverFingerprint', v_existing.server_fingerprint,
            'resultSeed', v_existing.result_seed,
            'expiresAt', v_existing.expires_at,
            'replay', true
        );
    end if;

    select revision, game_state
    into v_current_revision, v_game_state
    from public.game_saves
    where user_id = v_user_id
      and save_slot = 'primary'
    for update;

    if not found then
        raise exception 'cloud_save_required_for_fusion_reservation'
            using errcode = '22023';
    end if;
    if v_current_revision <> v_expected_revision then
        raise exception 'save_revision_conflict'
            using
                errcode = '40001',
                detail = jsonb_build_object(
                    'expectedRevision', v_expected_revision,
                    'currentRevision', v_current_revision
                )::text;
    end if;

    select *
    into v_existing
    from public.fusion_operations
    where user_id = v_user_id
      and operation_id = v_operation_id;

    if found then
        if v_existing.server_fingerprint <> v_server_fingerprint then
            raise exception 'fusion_operation_replay_mismatch'
                using errcode = '23505';
        end if;
        return jsonb_build_object(
            'schemaVersion', 1,
            'operationId', v_existing.operation_id,
            'status', v_existing.status,
            'reservationMode', 'server_reserved',
            'requestFingerprint', v_existing.request_fingerprint,
            'serverFingerprint', v_existing.server_fingerprint,
            'resultSeed', v_existing.result_seed,
            'expiresAt', v_existing.expires_at,
            'replay', true
        );
    end if;

    v_creatures := coalesce(v_game_state->'creatures', '[]'::jsonb);
    if jsonb_typeof(v_creatures) <> 'array' then
        raise exception 'invalid_cloud_creature_collection'
            using errcode = '22023';
    end if;

    select count(distinct creature->>'id')
    into v_parent_count
    from jsonb_array_elements(v_creatures) as creature
    where creature->>'id' = any(v_parent_ids)
      and lower(coalesce(creature#>>'{lifecycle,stage}', '')) in ('adult', 'elder')
      and lower(coalesce(creature#>>'{lifecycle,hasDeparted}', 'false')) <> 'true'
      and nullif(creature#>>'{lifecycle,departureDate}', '') is null;

    if v_parent_count <> 2 then
        raise exception 'fusion_parent_ownership_or_eligibility_failed'
            using errcode = '42501';
    end if;

    v_max_creatures := case
        when coalesce(v_game_state->>'maxCreatures', '') ~ '^[0-9]{1,3}$'
            then (v_game_state->>'maxCreatures')::integer
        else 8
    end;
    if jsonb_array_length(v_creatures) + v_offspring_count > v_max_creatures then
        raise exception 'fusion_collection_capacity'
            using errcode = '22023';
    end if;

    v_result_seed := 'fusion-server-v1:' || md5(
        v_user_id::text || ':' ||
        v_operation_id || ':' ||
        v_server_fingerprint || ':' ||
        v_current_revision::text
    );
    v_sanitized_request := jsonb_build_object(
        'schemaVersion', 1,
        'operationId', v_operation_id,
        'parentIds', to_jsonb(v_parent_ids),
        'offspringIds', to_jsonb(v_offspring_ids),
        'offspringCount', v_offspring_count,
        'expectedSaveRevision', v_expected_revision,
        'requestFingerprint', v_request_fingerprint,
        'consent', jsonb_build_object(
            'mode', 'same_save_owner',
            'grant', 'lineage_synthesis'
        )
    );

    insert into public.fusion_operations (
        user_id,
        operation_id,
        request_fingerprint,
        server_fingerprint,
        parent_ids,
        offspring_ids,
        offspring_count,
        expected_save_revision,
        result_seed,
        request
    )
    values (
        v_user_id,
        v_operation_id,
        v_request_fingerprint,
        v_server_fingerprint,
        v_parent_ids,
        v_offspring_ids,
        v_offspring_count,
        v_expected_revision,
        v_result_seed,
        v_sanitized_request
    )
    returning * into v_existing;

    return jsonb_build_object(
        'schemaVersion', 1,
        'operationId', v_existing.operation_id,
        'status', v_existing.status,
        'reservationMode', 'server_reserved',
        'requestFingerprint', v_existing.request_fingerprint,
        'serverFingerprint', v_existing.server_fingerprint,
        'resultSeed', v_existing.result_seed,
        'expiresAt', v_existing.expires_at,
        'replay', false
    );
end;
$$;

comment on function public.reserve_fusion_operation(jsonb) is
    'Reserves an idempotent Fusion operation after locking the caller cloud save and validating revision, parent ownership, maturity, and capacity.';

revoke all on function public.reserve_fusion_operation(jsonb) from public;
grant execute on function public.reserve_fusion_operation(jsonb) to authenticated;
