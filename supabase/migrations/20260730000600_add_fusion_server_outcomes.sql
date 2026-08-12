alter table public.fusion_operations
add column if not exists result jsonb;

alter table public.fusion_operations
drop constraint if exists fusion_operations_result_shape;

alter table public.fusion_operations
add constraint fusion_operations_result_shape
check (
    result is null
    or (
        jsonb_typeof(result) = 'object'
        and octet_length(result::text) <= 2097152
    )
);

comment on column public.fusion_operations.result is
    'Deterministic server-generated offspring outcome. Creature names are assigned later by the player and are not stored here.';

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
    v_game_state jsonb;
    v_creatures jsonb;
    v_parent_records jsonb;
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
        raise exception 'fusion_operation_expired'
            using errcode = '22023';
    end if;

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
                    then greatest((creature->>'generation')::integer, 1)
                else 1
            end,
            'rarity', coalesce(
                creature->>'rarity',
                creature#>>'{genes,rarity}',
                'common'
            ),
            'genes', coalesce(creature->'genes', creature->'dna', '{}'::jsonb),
            'dna', coalesce(creature->'dna', creature->'genes', '{}'::jsonb),
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
        order by array_position(v_operation.parent_ids, creature->>'id')
    )
    into v_parent_records
    from jsonb_array_elements(v_creatures) as creature
    where creature->>'id' = any(v_operation.parent_ids)
      and lower(coalesce(creature#>>'{lifecycle,stage}', '')) in ('adult', 'elder')
      and lower(coalesce(creature#>>'{lifecycle,hasDeparted}', 'false')) <> 'true'
      and nullif(creature#>>'{lifecycle,departureDate}', '') is null;

    if jsonb_array_length(coalesce(v_parent_records, '[]'::jsonb)) <> 2 then
        raise exception 'fusion_parent_ownership_or_eligibility_failed'
            using errcode = '42501';
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

    return jsonb_build_object(
        'schemaVersion', 1,
        'operationId', v_operation.operation_id,
        'status', v_operation.status,
        'result', v_operation.result,
        'receipt', v_operation.result_receipt,
        'replay', false
    );
end;
$$;

comment on function public.get_fusion_execution_context(uuid, text) is
    'Returns the supplied operation owner a privacy-minimized deterministic execution context or the previously staged Fusion result. Callable only by the Edge service role.';
comment on function public.stage_fusion_operation_result(uuid, text, text, jsonb, jsonb) is
    'Atomically stages one server-generated Fusion outcome and returns the original result on an idempotent retry.';

revoke all on function public.get_fusion_execution_context(uuid, text)
from public;
revoke all on function public.get_fusion_execution_context(uuid, text)
from authenticated;
grant execute on function public.get_fusion_execution_context(uuid, text)
to service_role;

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
grant execute on function public.stage_fusion_operation_result(
    uuid,
    text,
    text,
    jsonb,
    jsonb
) to service_role;
