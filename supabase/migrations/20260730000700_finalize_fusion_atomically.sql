alter table public.fusion_operations
add column if not exists commit_receipt jsonb;

alter table public.fusion_operations
drop constraint if exists fusion_operations_commit_receipt_shape;

alter table public.fusion_operations
add constraint fusion_operations_commit_receipt_shape
check (
    commit_receipt is null
    or (
        jsonb_typeof(commit_receipt) = 'object'
        and octet_length(commit_receipt::text) <= 65536
    )
);

comment on column public.fusion_operations.commit_receipt is
    'Idempotent receipt for the atomic cloud-save lineage commit. Contains no player identity.';

create or replace function public.finalize_fusion_operation(
    p_user_id uuid,
    p_operation_id text,
    p_names jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_operation public.fusion_operations;
    v_game_state jsonb;
    v_save_version text;
    v_revision bigint;
    v_names text[];
    v_names_fingerprint text;
    v_creatures jsonb;
    v_children jsonb := '[]'::jsonb;
    v_child_result jsonb;
    v_child_data jsonb;
    v_genes jsonb;
    v_child jsonb;
    v_child_id text;
    v_index integer;
    v_first_offspring_index integer;
    v_max_creatures integer;
    v_committed_at timestamptz := timezone('utc', clock_timestamp());
    v_committed_at_ms bigint;
    v_shrine jsonb;
    v_history jsonb;
    v_completed_ids jsonb;
    v_history_entry jsonb;
    v_commit_base jsonb;
    v_commit_receipt jsonb;
begin
    if p_user_id is null then
        raise exception 'fusion_user_required'
            using errcode = '42501';
    end if;
    if p_operation_id is null
        or p_operation_id !~ '^fusion_[A-Za-z0-9_-]{1,160}$'
        or p_names is null
        or jsonb_typeof(p_names) <> 'array'
        or octet_length(p_names::text) > 512 then
        raise exception 'invalid_fusion_finalization'
            using errcode = '22023';
    end if;

    select array_agg(btrim(value) order by ordinality)
    into v_names
    from jsonb_array_elements_text(p_names)
        with ordinality as submitted_name(value, ordinality);

    if v_names is null
        or exists (
            select 1
            from unnest(v_names) as submitted_name
            where char_length(submitted_name) < 1
               or char_length(submitted_name) > 20
               or submitted_name ~ '[[:cntrl:]<>]'
        ) then
        raise exception 'invalid_fusion_names'
            using errcode = '22023';
    end if;
    v_names_fingerprint := md5(to_jsonb(v_names)::text);

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
    if cardinality(v_names) <> v_operation.offspring_count then
        raise exception 'fusion_name_count_mismatch'
            using errcode = '22023';
    end if;

    select save_version, revision, game_state
    into v_save_version, v_revision, v_game_state
    from public.game_saves
    where user_id = p_user_id
      and save_slot = 'primary'
    for update;

    if not found then
        raise exception 'cloud_save_required_for_fusion_finalization'
            using errcode = '22023';
    end if;

    if v_operation.status = 'committed' then
        if v_operation.commit_receipt->>'namesFingerprint' <>
            v_names_fingerprint then
            raise exception 'fusion_commit_replay_mismatch'
                using errcode = '23505';
        end if;
        return jsonb_build_object(
            'schemaVersion', 1,
            'operationId', v_operation.operation_id,
            'status', v_operation.status,
            'revision', v_revision,
            'gameState', v_game_state,
            'offspringIds', to_jsonb(v_operation.offspring_ids),
            'receipt', v_operation.commit_receipt,
            'replay', true
        );
    end if;
    if v_operation.status <> 'staged'
        or v_operation.result is null
        or v_operation.result_receipt is null then
        raise exception 'fusion_operation_not_finalizable'
            using errcode = '22023';
    end if;
    if v_operation.result->>'operationId' <> p_operation_id
        or jsonb_typeof(v_operation.result->'offspring') <> 'array'
        or jsonb_array_length(v_operation.result->'offspring') <>
            v_operation.offspring_count then
        raise exception 'fusion_staged_result_invalid'
            using errcode = '22023';
    end if;

    v_creatures := coalesce(v_game_state->'creatures', '[]'::jsonb);
    if jsonb_typeof(v_creatures) <> 'array' then
        raise exception 'invalid_cloud_creature_collection'
            using errcode = '22023';
    end if;
    if exists (
        select 1
        from jsonb_array_elements(v_creatures) as creature
        where creature->>'id' = any(v_operation.offspring_ids)
    ) then
        raise exception 'fusion_offspring_identity_already_exists'
            using errcode = '23505';
    end if;

    v_max_creatures := case
        when coalesce(v_game_state->>'maxCreatures', '') ~ '^[0-9]{1,3}$'
            then (v_game_state->>'maxCreatures')::integer
        else 8
    end;
    if jsonb_array_length(v_creatures) + v_operation.offspring_count >
        v_max_creatures then
        raise exception 'fusion_collection_capacity'
            using errcode = '22023';
    end if;

    v_committed_at_ms := floor(
        extract(epoch from v_committed_at) * 1000
    )::bigint;
    v_first_offspring_index := jsonb_array_length(v_creatures);

    for v_index in 0..v_operation.offspring_count - 1 loop
        v_child_result := v_operation.result->'offspring'->v_index;
        v_child_data := coalesce(
            v_child_result->'offspringData',
            '{}'::jsonb
        );
        v_genes := coalesce(
            v_child_result->'offspringGenes',
            '{}'::jsonb
        );
        v_child_id := v_child_data->>'creatureId';

        if v_child_id is distinct from v_operation.offspring_ids[v_index + 1] then
            raise exception 'fusion_result_identity_mismatch'
                using errcode = '42501';
        end if;

        v_child := jsonb_build_object(
            'id', v_child_id,
            'name', v_names[v_index + 1],
            'genes', v_genes,
            'dna', v_genes,
            'personality', coalesce(v_genes->'personality', 'null'::jsonb),
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
                'schemaVersion', 1,
                'activeStage', 'null'::jsonb,
                'byStage', jsonb_build_object()
            ),
            'hatchTime', v_committed_at_ms,
            'lifecycle', jsonb_build_object(
                'birthDate', v_committed_at_ms,
                'stage', 'baby',
                'lastStageChange', v_committed_at_ms,
                'evolutionHistory', jsonb_build_array()
            ),
            'cosmicAffinity', coalesce(
                v_genes->'cosmicAffinity',
                'null'::jsonb
            ),
            'rarity', coalesce(v_child_data->>'rarity', 'common'),
            'addedAt', v_committed_at_ms,
            'isOffspring', true,
            'generation', case
                when coalesce(v_child_data->>'generation', '') ~ '^[0-9]+$'
                    then greatest((v_child_data->>'generation')::integer, 2)
                else 2
            end,
            'parentIds', coalesce(
                v_child_data->'parentIds',
                to_jsonb(v_operation.parent_ids)
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
            'isShiny', coalesce(v_child_data->'isShiny', 'false'::jsonb),
            'hasDualAffinity', coalesce(
                v_child_data->'hasDualAffinity',
                'false'::jsonb
            ),
            'dualAffinity', coalesce(
                v_child_data->'dualAffinity',
                'null'::jsonb
            ),
            'lineage', jsonb_build_object(
                'schemaVersion', 1,
                'creatureId', v_child_id,
                'origin', 'fusion',
                'generation', case
                    when coalesce(v_child_data->>'generation', '') ~ '^[0-9]+$'
                        then greatest(
                            (v_child_data->>'generation')::integer,
                            2
                        )
                    else 2
                end,
                'parentIds', to_jsonb(v_operation.parent_ids),
                'fusionOperationId', p_operation_id,
                'createdAt', v_committed_at_ms
            )
        );

        if v_operation.offspring_count = 2 then
            v_child := v_child || jsonb_build_object(
                'isTwin', true,
                'twinIndex', v_index + 1,
                'twinSiblingId',
                    v_operation.offspring_ids[
                        case when v_index = 0 then 2 else 1 end
                    ],
                'twinSiblingName',
                    v_names[case when v_index = 0 then 2 else 1 end]
            );
        end if;
        v_children := v_children || jsonb_build_array(v_child);
    end loop;

    v_shrine := coalesce(v_game_state->'breedingShrine', '{}'::jsonb);
    v_history := case
        when jsonb_typeof(v_shrine->'breedingHistory') = 'array'
            then v_shrine->'breedingHistory'
        else '[]'::jsonb
    end;
    v_completed_ids := case
        when jsonb_typeof(v_shrine->'completedOperationIds') = 'array'
            then v_shrine->'completedOperationIds'
        else '[]'::jsonb
    end;
    v_history_entry := jsonb_build_object(
        'schemaVersion', 1,
        'operationId', p_operation_id,
        'parentIds', to_jsonb(v_operation.parent_ids),
        'offspringIds', to_jsonb(v_operation.offspring_ids),
        'offspringCount', v_operation.offspring_count,
        'authority', 'server_generated',
        'requestFingerprint', v_operation.request_fingerprint,
        'resultFingerprint',
            v_operation.result_receipt->>'resultFingerprint',
        'completedAt', v_committed_at_ms
    );

    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
    into v_history
    from (
        select value, ordinality
        from jsonb_array_elements(v_history || jsonb_build_array(v_history_entry))
            with ordinality as history_item(value, ordinality)
        order by ordinality desc
        limit 50
    ) as retained_history;

    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
    into v_completed_ids
    from (
        select value, ordinality
        from jsonb_array_elements(
            v_completed_ids || jsonb_build_array(p_operation_id)
        ) with ordinality as completed_item(value, ordinality)
        order by ordinality desc
        limit 50
    ) as retained_completed;

    v_shrine := jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    v_shrine,
                    '{lastBreedingTime}',
                    to_jsonb(v_committed_at_ms),
                    true
                ),
                '{breedingHistory}',
                v_history,
                true
            ),
            '{completedOperationIds}',
            v_completed_ids,
            true
        ),
        '{pendingFusion}',
        'null'::jsonb,
        true
    );

    v_game_state := jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        v_game_state,
                        '{creatures}',
                        v_creatures || v_children,
                        true
                    ),
                    '{activeCreatureIndex}',
                    to_jsonb(v_first_offspring_index),
                    true
                ),
                '{creature}',
                v_children->0,
                true
            ),
            '{breedingShrine}',
            v_shrine,
            true
        ),
        '{savedAt}',
        to_jsonb(v_committed_at_ms),
        true
    );

    v_commit_base := jsonb_build_object(
        'schemaVersion', 1,
        'operationId', p_operation_id,
        'authority', 'server_finalized',
        'requestFingerprint', v_operation.request_fingerprint,
        'serverFingerprint', v_operation.server_fingerprint,
        'resultFingerprint',
            v_operation.result_receipt->>'resultFingerprint',
        'namesFingerprint', v_names_fingerprint,
        'offspringIds', to_jsonb(v_operation.offspring_ids),
        'saveRevision', v_revision + 1,
        'completedAt', v_committed_at_ms
    );
    v_commit_receipt := v_commit_base || jsonb_build_object(
        'receiptFingerprint',
        'fusion-commit-v1:' || md5(v_commit_base::text)
    );

    update public.game_saves
    set revision = v_revision + 1,
        game_state = v_game_state,
        client_saved_at = v_committed_at,
        save_version = v_save_version,
        updated_at = v_committed_at
    where user_id = p_user_id
      and save_slot = 'primary';

    update public.fusion_operations
    set status = 'committed',
        commit_receipt = v_commit_receipt,
        completed_at = v_committed_at
    where user_id = p_user_id
      and operation_id = p_operation_id
    returning * into v_operation;

    return jsonb_build_object(
        'schemaVersion', 1,
        'operationId', v_operation.operation_id,
        'status', v_operation.status,
        'revision', v_revision + 1,
        'gameState', v_game_state,
        'offspringIds', to_jsonb(v_operation.offspring_ids),
        'offspring', v_children,
        'receipt', v_operation.commit_receipt,
        'replay', false
    );
end;
$$;

comment on function public.finalize_fusion_operation(
    uuid,
    text,
    jsonb
) is
    'Atomically commits one staged server Fusion result into the owner cloud save. Callable only by the Edge service role.';

revoke all on function public.finalize_fusion_operation(
    uuid,
    text,
    jsonb
) from public;
revoke all on function public.finalize_fusion_operation(
    uuid,
    text,
    jsonb
) from authenticated;
grant execute on function public.finalize_fusion_operation(
    uuid,
    text,
    jsonb
) to service_role;
