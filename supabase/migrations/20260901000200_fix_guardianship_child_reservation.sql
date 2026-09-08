-- A child UUID is reserved when both guardians confirm, before the generated
-- creature is committed after naming. The original FK was therefore too early:
-- it required the child row during the confirmation transaction.

alter table public.shared_guardianship_invitations
    drop constraint if exists shared_guardianship_invitation_child_fk;

create or replace function public.assert_committed_guardianship_child_exists()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.status = 'committed'
        and new.child_id is not null
        and not exists (
            select 1
            from public.shared_guardianship_creatures creature
            where creature.creature_id = new.child_id
        ) then
        raise exception 'shared_guardianship_committed_child_missing'
            using errcode = '23503';
    end if;
    return new;
end;
$$;

drop trigger if exists assert_committed_guardianship_child_exists
    on public.shared_guardianship_invitations;

create constraint trigger assert_committed_guardianship_child_exists
after insert or update of status, child_id
on public.shared_guardianship_invitations
deferrable initially deferred
for each row execute function public.assert_committed_guardianship_child_exists();

create or replace function public.clear_guardianship_child_reservation_on_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    update public.shared_guardianship_invitations
    set child_id = null,
        updated_at = timezone('utc', now())
    where child_id = old.creature_id;
    return old;
end;
$$;

drop trigger if exists clear_guardianship_child_reservation_on_delete
    on public.shared_guardianship_creatures;

create trigger clear_guardianship_child_reservation_on_delete
before delete on public.shared_guardianship_creatures
for each row execute function public.clear_guardianship_child_reservation_on_delete();

revoke all on function public.assert_committed_guardianship_child_exists() from public;
revoke all on function public.assert_committed_guardianship_child_exists() from anon, authenticated;
revoke all on function public.clear_guardianship_child_reservation_on_delete() from public;
revoke all on function public.clear_guardianship_child_reservation_on_delete() from anon, authenticated;

