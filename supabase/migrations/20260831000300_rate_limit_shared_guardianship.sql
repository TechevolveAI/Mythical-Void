-- Shared Guardianship abuse hardening. These trigger checks run in the same
-- transaction as the canonical mutation, so a rejected burst cannot partially
-- change creature state or create an invitation.

create index if not exists shared_guardianship_invite_host_created_idx
    on public.shared_guardianship_invitations(host_user_id, created_at desc);

create index if not exists shared_guardianship_commands_actor_created_idx
    on public.shared_guardianship_commands(actor_user_id, created_at desc)
    where actor_user_id is not null;

create or replace function public.enforce_shared_guardianship_invitation_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if (
        select count(*)
        from public.shared_guardianship_invitations
        where host_user_id = new.host_user_id
          and created_at > timezone('utc', now()) - interval '1 hour'
    ) >= 5 then
        raise exception 'shared_guardianship_invitation_rate_limited' using errcode = '42900';
    end if;
    return new;
end;
$$;

create trigger enforce_shared_guardianship_invitation_rate_before_insert
before insert on public.shared_guardianship_invitations
for each row execute function public.enforce_shared_guardianship_invitation_rate();

create or replace function public.enforce_shared_guardianship_command_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_limit integer := case when new.command_kind = 'care' then 30 else 10 end;
begin
    -- Departure is a safety control and must never be throttled.
    if new.actor_user_id is null or new.command_kind = 'leave' then
        return new;
    end if;
    if (
        select count(*)
        from public.shared_guardianship_commands
        where actor_user_id = new.actor_user_id
          and command_kind = new.command_kind
          and created_at > timezone('utc', now()) - interval '1 minute'
    ) >= v_limit then
        raise exception 'shared_guardianship_action_rate_limited' using errcode = '42900';
    end if;
    return new;
end;
$$;

create trigger enforce_shared_guardianship_command_rate_before_insert
before insert on public.shared_guardianship_commands
for each row execute function public.enforce_shared_guardianship_command_rate();

revoke all on function public.enforce_shared_guardianship_invitation_rate() from public;
revoke all on function public.enforce_shared_guardianship_command_rate() from public;

