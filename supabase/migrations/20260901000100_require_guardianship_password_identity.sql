-- Shared Guardianship requires a recoverable password credential in addition
-- to a verified email. Client metadata is intentionally not trusted because
-- users may edit their own raw_user_meta_data.

create or replace function public.shared_guardianship_user_is_permanent(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from auth.users as account
        where account.id = p_user_id
          and account.is_anonymous is false
          and account.email is not null
          and account.email_confirmed_at is not null
          and coalesce(account.encrypted_password, '') <> ''
    );
$$;

create or replace function public.set_shared_guardianship_notifications(
    p_creature_id uuid,
    p_muted boolean,
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
    v_command public.shared_guardianship_commands;
    v_rebased boolean := false;
begin
    if p_idempotency_key !~ '^[A-Za-z0-9_-]{8,120}$' then
        raise exception 'shared_guardianship_action_invalid' using errcode = '22023';
    end if;
    if not exists (
        select 1
        from public.shared_guardianship_participants
        where creature_id = p_creature_id
          and user_id = v_user_id
          and status = 'active'
    ) then
        raise exception 'shared_guardianship_access_denied' using errcode = '42501';
    end if;
    select * into v_creature
    from public.shared_guardianship_creatures
    where creature_id = p_creature_id and status = 'active'
    for update;
    if not found then
        raise exception 'shared_guardianship_creature_not_found' using errcode = '22023';
    end if;
    select * into v_command
    from public.shared_guardianship_commands
    where creature_id = p_creature_id and idempotency_key = p_idempotency_key;
    if found then
        if v_command.actor_user_id is distinct from v_user_id
            or v_command.command_kind <> 'notifications' then
            raise exception 'shared_guardianship_action_invalid' using errcode = '22023';
        end if;
        return public.get_shared_guardianship_projection(p_creature_id)
            || jsonb_build_object('replay', true, 'rebased', false);
    end if;
    if p_expected_revision is null
        or p_expected_revision > v_creature.revision
        or p_expected_revision < v_creature.revision - 1 then
        return public.get_shared_guardianship_projection(p_creature_id)
            || jsonb_build_object('conflict', true, 'replay', false, 'rebased', false);
    end if;
    v_rebased := p_expected_revision = v_creature.revision - 1;
    update public.shared_guardianship_participants
    set notifications_muted = coalesce(p_muted, false)
    where creature_id = p_creature_id and user_id = v_user_id;
    update public.shared_guardianship_creatures
    set revision = revision + 1, updated_at = timezone('utc', now())
    where creature_id = p_creature_id
    returning * into v_creature;
    insert into public.shared_guardianship_commands(
        creature_id, actor_user_id, idempotency_key, command_kind, result
    ) values (
        p_creature_id, v_user_id, p_idempotency_key, 'notifications',
        jsonb_build_object('acceptedRevision', v_creature.revision)
    );
    return public.get_shared_guardianship_projection(p_creature_id)
        || jsonb_build_object('replay', false, 'rebased', v_rebased);
end;
$$;

revoke all on function public.shared_guardianship_user_is_permanent(uuid) from public;
revoke all on function public.set_shared_guardianship_notifications(uuid,boolean,text,bigint) from public;
grant execute on function public.set_shared_guardianship_notifications(uuid,boolean,text,bigint) to authenticated;
