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
    v_candidate_ids text[];
    v_offspring_ids text[];
    v_offspring_capacity integer;
    v_offspring_count integer;
    v_contract_version integer;
    v_expected_revision bigint;
    v_current_revision bigint;
    v_game_state jsonb;
    v_creatures jsonb;
    v_parent_count integer;
    v_max_creatures integer;
    v_existing public.fusion_operations;
    v_result_seed text;
    v_sanitized_request jsonb;
    v_twin_roll numeric;
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

    v_contract_version := case
        when coalesce(p_request->>'contractVersion', '') ~ '^[0-9]+$'
            then (p_request->>'contractVersion')::integer
        else 1
    end;
    if v_contract_version not in (1, 2) then
        raise exception 'unsupported_fusion_contract'
            using errcode = '22023';
    end if;
    if jsonb_typeof(p_request->'parentIds') <> 'array'
        or jsonb_typeof(p_request#>'{consent,parentGrants}') <> 'array'
        or coalesce(p_request->>'expectedSaveRevision', '') !~
            '^[0-9]{1,19}$' then
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
    v_expected_revision :=
        (p_request->>'expectedSaveRevision')::bigint;

    select array_agg(value order by ordinality)
    into v_parent_ids
    from jsonb_array_elements_text(
        coalesce(p_request->'parentIds', '[]'::jsonb)
    ) with ordinality as parent_id(value, ordinality);

    select array_agg(
        grant_entry->>'creatureId'
        order by ordinality
    )
    into v_grant_ids
    from jsonb_array_elements(p_request#>'{consent,parentGrants}')
        with ordinality as parent_grant(grant_entry, ordinality)
    where grant_entry->>'grant' = 'lineage_synthesis'
      and (
        v_contract_version = 1
        or grant_entry->>'decision' = 'willing'
      );

    if cardinality(v_parent_ids) <> 2
        or v_parent_ids[1] = v_parent_ids[2]
        or v_parent_ids[1] !~ '^[A-Za-z0-9_-]{1,180}$'
        or v_parent_ids[2] !~ '^[A-Za-z0-9_-]{1,180}$'
        or v_expected_revision < 1
        or p_request#>>'{consent,mode}' <> 'same_save_owner'
        or v_grant_ids is distinct from v_parent_ids then
        raise exception 'invalid_fusion_contract'
            using errcode = '22023';
    end if;

    if v_contract_version = 2 then
        if jsonb_typeof(p_request->'candidateOffspringIds') <> 'array'
            or coalesce(p_request->>'offspringCapacity', '') !~ '^[12]$'
            or p_request#>>'{consent,scope}' <> 'local_sanctuary'
            or p_request#>>'{consent,keeperGrant}' <> 'confirmed'
            or coalesce(
                p_request#>'{consent,sharedInvitationId}',
                '"missing"'::jsonb
            ) <> 'null'::jsonb then
            raise exception 'invalid_fusion_consent_or_capacity'
                using errcode = '22023';
        end if;
        select array_agg(value order by ordinality)
        into v_candidate_ids
        from jsonb_array_elements_text(
            p_request->'candidateOffspringIds'
        ) with ordinality as candidate_id(value, ordinality);
        v_offspring_capacity :=
            (p_request->>'offspringCapacity')::integer;
        if cardinality(v_candidate_ids) <> v_offspring_capacity
            or cardinality(
                array(select distinct unnest(v_candidate_ids))
            ) <> v_offspring_capacity
            or exists (
                select 1
                from unnest(v_candidate_ids) as candidate_id
                where candidate_id !~ '^[A-Za-z0-9_-]{1,180}$'
            ) then
            raise exception 'invalid_fusion_candidate_identity'
                using errcode = '22023';
        end if;
        v_twin_roll := (
            (
                'x' || right(v_request_fingerprint, 8)
            )::bit(32)::bigint
        )::numeric / 4294967296::numeric;
        v_offspring_count := case
            when v_offspring_capacity = 2 and v_twin_roll < 0.08
                then 2
            else 1
        end;
        v_offspring_ids :=
            v_candidate_ids[1:v_offspring_count];
    else
        if jsonb_typeof(p_request->'offspringIds') <> 'array'
            or coalesce(p_request->>'offspringCount', '') !~ '^[12]$' then
            raise exception 'invalid_legacy_fusion_contract'
                using errcode = '22023';
        end if;
        select array_agg(value order by ordinality)
        into v_offspring_ids
        from jsonb_array_elements_text(
            p_request->'offspringIds'
        ) with ordinality as offspring_id(value, ordinality);
        v_offspring_count := (p_request->>'offspringCount')::integer;
        v_offspring_capacity := v_offspring_count;
        v_candidate_ids := v_offspring_ids;
        if cardinality(v_offspring_ids) <> v_offspring_count
            or cardinality(
                array(select distinct unnest(v_offspring_ids))
            ) <> v_offspring_count then
            raise exception 'invalid_legacy_fusion_identity'
                using errcode = '22023';
        end if;
    end if;

    v_server_fingerprint := md5(
        (p_request - 'requestFingerprint')::text
    );

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
            'schemaVersion', v_existing.schema_version,
            'contractVersion', coalesce(
                (v_existing.request->>'contractVersion')::integer,
                1
            ),
            'operationId', v_existing.operation_id,
            'status', v_existing.status,
            'reservationMode', 'server_reserved',
            'requestFingerprint', v_existing.request_fingerprint,
            'serverFingerprint', v_existing.server_fingerprint,
            'resultSeed', v_existing.result_seed,
            'offspringIds', to_jsonb(v_existing.offspring_ids),
            'offspringCount', v_existing.offspring_count,
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

    v_creatures := coalesce(v_game_state->'creatures', '[]'::jsonb);
    if jsonb_typeof(v_creatures) <> 'array' then
        raise exception 'invalid_cloud_creature_collection'
            using errcode = '22023';
    end if;

    select count(distinct creature->>'id')
    into v_parent_count
    from jsonb_array_elements(v_creatures) as creature
    where creature->>'id' = any(v_parent_ids)
      and (
        lower(
            coalesce(creature#>>'{lifecycle,stage}', '')
        ) in ('adult', 'elder')
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
                extract(epoch from (now() - interval '2 days')) *
                1000
            )
        )
      )
      and lower(
        coalesce(
            creature#>>'{lifecycle,hasDeparted}',
            'false'
        )
      ) <> 'true'
      and nullif(
        creature#>>'{lifecycle,departureDate}',
        ''
      ) is null
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
      ) not in ('sad', 'abandoned');

    if v_parent_count <> 2 then
        raise exception 'fusion_parent_ownership_or_eligibility_failed'
            using errcode = '42501';
    end if;

    v_max_creatures := case
        when coalesce(v_game_state->>'maxCreatures', '') ~
            '^[0-9]{1,3}$'
            then (v_game_state->>'maxCreatures')::integer
        else 8
    end;
    if jsonb_array_length(v_creatures) + v_offspring_count >
        v_max_creatures then
        raise exception 'fusion_collection_capacity'
            using errcode = '22023';
    end if;

    v_result_seed := 'fusion-server-v2:' || md5(
        v_user_id::text || ':' ||
        v_operation_id || ':' ||
        v_server_fingerprint || ':' ||
        v_current_revision::text || ':' ||
        v_offspring_count::text
    );
    v_sanitized_request := jsonb_build_object(
        'schemaVersion', 1,
        'contractVersion', v_contract_version,
        'operationId', v_operation_id,
        'parentIds', to_jsonb(v_parent_ids),
        'candidateOffspringIds', to_jsonb(v_candidate_ids),
        'offspringCapacity', v_offspring_capacity,
        'offspringIds', to_jsonb(v_offspring_ids),
        'offspringCount', v_offspring_count,
        'expectedSaveRevision', v_expected_revision,
        'requestFingerprint', v_request_fingerprint,
        'consent', jsonb_build_object(
            'mode', 'same_save_owner',
            'scope', case
                when v_contract_version = 2
                    then 'local_sanctuary'
                else 'legacy_local'
            end,
            'grant', 'lineage_synthesis',
            'keeperGrant', case
                when v_contract_version = 2
                    then 'confirmed'
                else 'legacy'
            end,
            'sharedInvitationId', null
        )
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
        request
    )
    values (
        v_user_id,
        v_operation_id,
        1,
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
        'schemaVersion', v_existing.schema_version,
        'contractVersion', v_contract_version,
        'operationId', v_existing.operation_id,
        'status', v_existing.status,
        'reservationMode', 'server_reserved',
        'requestFingerprint', v_existing.request_fingerprint,
        'serverFingerprint', v_existing.server_fingerprint,
        'resultSeed', v_existing.result_seed,
        'offspringIds', to_jsonb(v_existing.offspring_ids),
        'offspringCount', v_existing.offspring_count,
        'expiresAt', v_existing.expires_at,
        'replay', false
    );
end;
$$;

comment on function public.reserve_fusion_operation(jsonb) is
    'Reserves v1 and v2 Fusion contracts. V2 validates explicit local-sanctuary consent and selects offspring count from bounded capacity before locking identities.';

revoke all on function public.reserve_fusion_operation(jsonb) from public;
grant execute on function public.reserve_fusion_operation(jsonb)
to authenticated;
