create or replace function public.save_game_state(
    p_save_slot text,
    p_save_version text,
    p_game_state jsonb,
    p_client_saved_at timestamptz,
    p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_current_revision bigint;
    v_saved public.game_saves;
begin
    if v_user_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
    end if;
    if p_save_slot is null or p_save_slot !~ '^[a-z0-9_-]{1,32}$' then
        raise exception 'invalid_save_slot'
            using errcode = '22023';
    end if;
    if p_save_version is null or char_length(p_save_version) not between 1 and 32 then
        raise exception 'invalid_save_version'
            using errcode = '22023';
    end if;
    if p_game_state is null
        or jsonb_typeof(p_game_state) <> 'object'
        or octet_length(p_game_state::text) > 2097152 then
        raise exception 'invalid_game_state'
            using errcode = '22023';
    end if;
    if p_client_saved_at is null then
        raise exception 'invalid_client_saved_at'
            using errcode = '22023';
    end if;
    if p_expected_revision is null or p_expected_revision < 0 then
        raise exception 'invalid_expected_revision'
            using errcode = '22023';
    end if;

    select revision
    into v_current_revision
    from public.game_saves
    where user_id = v_user_id
      and save_slot = p_save_slot
    for update;

    if found then
        if v_current_revision <> p_expected_revision then
            raise exception 'save_revision_conflict'
                using
                    errcode = '40001',
                    detail = jsonb_build_object(
                        'expectedRevision', p_expected_revision,
                        'currentRevision', v_current_revision
                    )::text;
        end if;

        update public.game_saves
        set save_version = p_save_version,
            game_state = p_game_state,
            client_saved_at = p_client_saved_at
        where user_id = v_user_id
          and save_slot = p_save_slot
        returning * into v_saved;
    else
        if p_expected_revision <> 0 then
            raise exception 'save_revision_conflict'
                using
                    errcode = '40001',
                    detail = jsonb_build_object(
                        'expectedRevision', p_expected_revision,
                        'currentRevision', 0
                    )::text;
        end if;

        begin
            insert into public.game_saves (
                user_id,
                save_slot,
                save_version,
                revision,
                game_state,
                client_saved_at
            )
            values (
                v_user_id,
                p_save_slot,
                p_save_version,
                1,
                p_game_state,
                p_client_saved_at
            )
            returning * into v_saved;
        exception
            when unique_violation then
                select revision
                into v_current_revision
                from public.game_saves
                where user_id = v_user_id
                  and save_slot = p_save_slot;

                raise exception 'save_revision_conflict'
                    using
                        errcode = '40001',
                        detail = jsonb_build_object(
                            'expectedRevision', 0,
                            'currentRevision', coalesce(v_current_revision, 0)
                        )::text;
        end;
    end if;

    return jsonb_build_object(
        'revision', v_saved.revision,
        'updated_at', v_saved.updated_at,
        'client_saved_at', v_saved.client_saved_at
    );
end;
$$;

comment on function public.save_game_state(text, text, jsonb, timestamptz, bigint) is
    'Atomically creates or updates the caller''s cloud save only when the expected revision matches.';

revoke all on function public.save_game_state(
    text,
    text,
    jsonb,
    timestamptz,
    bigint
) from public;
grant execute on function public.save_game_state(
    text,
    text,
    jsonb,
    timestamptz,
    bigint
) to authenticated;

-- Direct writes remain temporarily available so the currently deployed client
-- continues to save while the RPC-capable client rolls out. Migration 003
-- removes them only after the new client is live.
