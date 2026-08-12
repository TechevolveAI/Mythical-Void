create or replace function public.sync_shared_kinship_beacon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_history jsonb := new.game_state#>
        '{breedingShrine,breedingHistory}';
    v_latest_shared jsonb;
    v_first_shared jsonb;
    v_first_lineage jsonb;
    v_latest_lineage jsonb;
    v_existing jsonb := coalesce(
        new.game_state#>
            '{world,sanctuaryDecorations,kinshipBeacon}',
        '{}'::jsonb
    );
    v_world jsonb := coalesce(
        new.game_state->'world',
        '{}'::jsonb
    );
    v_decorations jsonb;
    v_beacon jsonb;
    v_lineage_count integer := 0;
    v_shared_count integer := 0;
    v_first_lit bigint;
    v_last_lit bigint;
    v_first_shared_at bigint;
    v_last_shared_at bigint;
begin
    if jsonb_typeof(v_history) <> 'array' then
        return new;
    end if;

    select entry.value
    into v_latest_shared
    from jsonb_array_elements(v_history)
        with ordinality as entry(value, position)
    where entry.value->>'origin' = 'shared_fusion'
      and coalesce(entry.value->>'operationId', '') <>
        ''
    order by entry.position desc
    limit 1;
    if v_latest_shared is null then
        return new;
    end if;

    select entry.value
    into v_first_shared
    from jsonb_array_elements(v_history)
        with ordinality as entry(value, position)
    where entry.value->>'origin' = 'shared_fusion'
      and coalesce(entry.value->>'operationId', '') <>
        ''
    order by entry.position
    limit 1;
    select entry.value
    into v_first_lineage
    from jsonb_array_elements(v_history)
        with ordinality as entry(value, position)
    where coalesce(entry.value->>'operationId', '') <> ''
    order by entry.position
    limit 1;
    select entry.value
    into v_latest_lineage
    from jsonb_array_elements(v_history)
        with ordinality as entry(value, position)
    where coalesce(entry.value->>'operationId', '') <> ''
    order by entry.position desc
    limit 1;

    select count(distinct entry.value->>'operationId')
    into v_lineage_count
    from jsonb_array_elements(v_history) as entry(value)
    where coalesce(entry.value->>'operationId', '') <> '';
    select count(distinct entry.value->>'operationId')
    into v_shared_count
    from jsonb_array_elements(v_history) as entry(value)
    where entry.value->>'origin' = 'shared_fusion'
      and coalesce(entry.value->>'operationId', '') <> '';

    v_first_lit := case
        when coalesce(v_existing->>'firstLitAt', '') ~
            '^[0-9]{10,16}$'
            then (v_existing->>'firstLitAt')::bigint
        when coalesce(v_first_lineage->>'completedAt', '') ~
            '^[0-9]{10,16}$'
            then (v_first_lineage->>'completedAt')::bigint
        else floor(
            extract(epoch from timezone('utc', now())) * 1000
        )::bigint
    end;
    v_last_lit := case
        when coalesce(v_latest_lineage->>'completedAt', '') ~
            '^[0-9]{10,16}$'
            then (v_latest_lineage->>'completedAt')::bigint
        else floor(
            extract(epoch from timezone('utc', now())) * 1000
        )::bigint
    end;
    v_first_shared_at := case
        when coalesce(v_existing->>'firstSharedAt', '') ~
            '^[0-9]{10,16}$'
            then (v_existing->>'firstSharedAt')::bigint
        when coalesce(v_first_shared->>'completedAt', '') ~
            '^[0-9]{10,16}$'
            then (v_first_shared->>'completedAt')::bigint
        else v_last_lit
    end;
    v_last_shared_at := case
        when coalesce(v_latest_shared->>'completedAt', '') ~
            '^[0-9]{10,16}$'
            then (v_latest_shared->>'completedAt')::bigint
        else v_last_lit
    end;

    v_beacon := jsonb_build_object(
        'schemaVersion', 2,
        'unlocked', true,
        'firstOperationId', coalesce(
            nullif(v_existing->>'firstOperationId', ''),
            v_first_lineage->>'operationId'
        ),
        'firstLitAt', v_first_lit,
        'lineageCount', greatest(
            coalesce(
                case
                    when coalesce(
                        v_existing->>'lineageCount',
                        ''
                    ) ~ '^[0-9]{1,6}$'
                        then (
                            v_existing->>'lineageCount'
                        )::integer
                    else 0
                end,
                0
            ),
            v_lineage_count
        ),
        'lastOperationId', v_latest_lineage->>'operationId',
        'lastLitAt', v_last_lit,
        'sharedLineageCount', greatest(
            coalesce(
                case
                    when coalesce(
                        v_existing->>'sharedLineageCount',
                        ''
                    ) ~ '^[0-9]{1,6}$'
                        then (
                            v_existing->>'sharedLineageCount'
                        )::integer
                    else 0
                end,
                0
            ),
            v_shared_count
        ),
        'firstSharedOperationId', coalesce(
            nullif(v_existing->>'firstSharedOperationId', ''),
            v_first_shared->>'operationId'
        ),
        'firstSharedAt', v_first_shared_at,
        'lastSharedOperationId',
            v_latest_shared->>'operationId',
        'lastSharedAt', v_last_shared_at
    );
    v_decorations := coalesce(
        v_world->'sanctuaryDecorations',
        '{}'::jsonb
    );
    v_decorations := jsonb_set(
        v_decorations,
        '{kinshipBeacon}',
        v_beacon,
        true
    );
    v_world := jsonb_set(
        v_world,
        '{sanctuaryDecorations}',
        v_decorations,
        true
    );
    new.game_state := jsonb_set(
        new.game_state,
        '{world}',
        v_world,
        true
    );
    return new;
end;
$$;

drop trigger if exists sync_shared_kinship_beacon
on public.game_saves;
create trigger sync_shared_kinship_beacon
before update on public.game_saves
for each row execute function public.sync_shared_kinship_beacon();

revoke all on function public.sync_shared_kinship_beacon()
from public;
