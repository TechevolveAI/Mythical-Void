create or replace function public.shared_fusion_save_is_busy(
    p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_state jsonb;
    v_last_breeding bigint;
    v_cooldown bigint;
    v_now_ms bigint := floor(
        extract(epoch from timezone('utc', now())) * 1000
    )::bigint;
begin
    select game_state
    into v_state
    from public.game_saves
    where user_id = p_user_id
      and save_slot = 'primary';
    if not found then
        return true;
    end if;
    if coalesce(v_state#>'{breedingShrine,pendingFusion}', 'null'::jsonb)
        <> 'null'::jsonb then
        return true;
    end if;
    if jsonb_typeof(
        v_state#>'{breedingShrine,reconciliationQueue}'
    ) = 'array' and jsonb_array_length(
        v_state#>'{breedingShrine,reconciliationQueue}'
    ) > 0 then
        return true;
    end if;

    v_last_breeding := case
        when coalesce(
            v_state#>>'{breedingShrine,lastBreedingTime}',
            ''
        ) ~ '^[0-9]{10,16}$'
            then (
                v_state#>>'{breedingShrine,lastBreedingTime}'
            )::bigint
        else null
    end;
    v_cooldown := case
        when coalesce(
            v_state#>>'{breedingShrine,breedingCooldown}',
            ''
        ) ~ '^[0-9]{1,16}$'
            then (
                v_state#>>'{breedingShrine,breedingCooldown}'
            )::bigint
        else 86400000
    end;
    return v_last_breeding is not null
        and v_now_ms - v_last_breeding < v_cooldown;
end;
$$;

create or replace function public.guard_shared_fusion_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        if public.shared_fusion_save_is_busy(new.host_user_id) then
            raise exception 'shared_fusion_sanctuary_busy'
                using errcode = '22023';
        end if;
        return new;
    end if;

    if old.guest_user_id is null and new.guest_user_id is not null then
        if public.shared_fusion_save_is_busy(new.guest_user_id) then
            raise exception 'shared_fusion_sanctuary_busy'
                using errcode = '22023';
        end if;
    end if;
    if old.status is distinct from 'ready' and new.status = 'ready' then
        if public.shared_fusion_save_is_busy(new.host_user_id)
            or public.shared_fusion_save_is_busy(new.guest_user_id) then
            raise exception 'shared_fusion_sanctuary_busy'
                using errcode = '22023';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists guard_shared_fusion_invitation
on public.shared_fusion_invitations;
create trigger guard_shared_fusion_invitation
before insert or update on public.shared_fusion_invitations
for each row execute function public.guard_shared_fusion_invitation();

create or replace function public.guard_local_fusion_during_shared()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.request#>>'{consent,mode}' = 'same_save_owner'
        and exists (
            select 1
            from public.shared_fusion_invitations
            where (
                host_user_id = new.user_id
                or guest_user_id = new.user_id
            )
              and status in (
                'waiting',
                'paired',
                'ready',
                'executing',
                'staged'
              )
              and expires_at > timezone('utc', now())
        ) then
        raise exception 'shared_fusion_in_progress'
            using errcode = '40001';
    end if;
    return new;
end;
$$;

drop trigger if exists guard_local_fusion_during_shared
on public.fusion_operations;
create trigger guard_local_fusion_during_shared
before insert on public.fusion_operations
for each row execute function public.guard_local_fusion_during_shared();

create or replace function public.guard_breeding_commit_during_shared()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_new_breeding text := new.game_state#>>
        '{breedingShrine,lastBreedingTime}';
    v_old_breeding text := old.game_state#>>
        '{breedingShrine,lastBreedingTime}';
    v_shared_operation_id text;
    v_history jsonb;
begin
    if v_new_breeding is not distinct from v_old_breeding then
        return new;
    end if;
    select operation_id
    into v_shared_operation_id
    from public.shared_fusion_invitations
    where (
        host_user_id = new.user_id
        or guest_user_id = new.user_id
    )
      and status in (
        'waiting',
        'paired',
        'ready',
        'executing',
        'staged'
      )
      and expires_at > timezone('utc', now())
    order by created_at
    limit 1;
    if v_shared_operation_id is null then
        return new;
    end if;

    v_history := coalesce(
        new.game_state#>'{breedingShrine,breedingHistory}',
        '[]'::jsonb
    );
    if jsonb_typeof(v_history) <> 'array'
        or not exists (
            select 1
            from jsonb_array_elements(v_history) as entry
            where entry->>'operationId' = v_shared_operation_id
              and entry->>'origin' = 'shared_fusion'
        ) then
        raise exception 'shared_fusion_in_progress'
            using errcode = '40001';
    end if;
    return new;
end;
$$;

drop trigger if exists guard_breeding_commit_during_shared
on public.game_saves;
create trigger guard_breeding_commit_during_shared
before update on public.game_saves
for each row execute function public.guard_breeding_commit_during_shared();

revoke all on function public.shared_fusion_save_is_busy(uuid)
from public;
revoke all on function public.guard_shared_fusion_invitation()
from public;
revoke all on function public.guard_local_fusion_during_shared()
from public;
revoke all on function public.guard_breeding_commit_during_shared()
from public;
