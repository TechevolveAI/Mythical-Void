const fs = require('fs');
const path = require('path');

const migration = [
    '20260831000200_create_shared_guardianship.sql',
    '20260831000300_rate_limit_shared_guardianship.sql'
].map(file => fs.readFileSync(path.join(
    __dirname,
    `../../supabase/migrations/${file}`
), 'utf8')).join('\n');
const edgeFunction = fs.readFileSync(path.join(
    __dirname,
    '../../supabase/functions/execute-fusion/index.ts'
), 'utf8');
const governance = fs.readFileSync(path.join(
    __dirname,
    '../../docs/planning/SHARED_GUARDIANSHIP_GOVERNANCE.md'
), 'utf8');

describe('Shared Guardianship server and governance contract', () => {
    test('keeps canonical tables private and exposes bounded authenticated commands', () => {
        [
            'shared_guardianship_profiles',
            'shared_guardianship_invitations',
            'shared_guardianship_creatures',
            'shared_guardianship_participants',
            'shared_guardianship_parentage',
            'shared_guardianship_events',
            'shared_guardianship_commands'
        ].forEach(table => {
            expect(migration).toContain(`alter table public.${table} force row level security`);
            expect(migration).toContain(`revoke all on table public.${table} from anon, authenticated`);
        });
        expect(migration).toContain('grant execute on function public.perform_shared_guardianship_care(uuid,text,text,bigint) to authenticated');
        expect(migration).not.toContain('grant select on table public.shared_guardianship');
    });

    test('enforces durable identity, current 16+ consent and no self pairing', () => {
        expect(migration).toContain('account.is_anonymous is false');
        expect(migration).toContain("profile.age_band in ('age_16_17', 'age_18_plus')");
        expect(migration).toContain("profile.terms_version = 'shared-guardianship-2026-08-31'");
        expect(migration).toContain('check (guest_user_id is null or guest_user_id <> host_user_id)');
    });

    test('enforces one active shared creature and one canonical child per invitation', () => {
        expect(migration).toContain('shared_guardianship_one_active_per_user_idx');
        expect(migration).toContain("where status = 'active'");
        expect(migration).toContain('source_invitation_id uuid unique');
        expect(migration).toContain('child_id uuid unique');
        expect(migration).toContain("jsonb_array_length(coalesce(p_result->'offspring','[]'::jsonb)) <> 1");
    });

    test('uses revision checks and idempotency for shared care', () => {
        expect(migration).toContain('unique (creature_id, idempotency_key)');
        expect(migration).toContain('p_expected_revision < v_creature.revision - 1');
        expect(migration).toContain("jsonb_build_object('conflict',true,'replay',false,'rebased',false)");
        expect(migration).toContain("jsonb_build_object('replay',true,'rebased',false)");
        expect(migration).toContain("v_rebased := p_expected_revision = v_creature.revision - 1");
        expect(migration).toContain("command_kind in ('care', 'notifications', 'leave')");
    });

    test('bounds abuse records, history and departing-guardian attribution', () => {
        expect(migration).toContain("interval '24 hours'");
        expect(migration).toContain("interval '30 days'");
        expect(migration).toContain('offset 100');
        expect(migration).toContain('update public.shared_guardianship_events set actor_user_id = null');
        expect(migration).toContain('archive_orphaned_shared_guardianship_after_participant_change');
        expect(migration).toContain('purge_shared_guardianship_retention');
        expect(migration).toContain("status = case when v_remaining = 0 then 'archived' else status end");
        expect(migration).toContain('enforce_shared_guardianship_invitation_rate_before_insert');
        expect(migration).toContain("command_kind = 'care' then 30 else 10");
        expect(migration).toContain("new.command_kind = 'leave'");
    });

    test('persists guessing attempts and makes invitation creation and joining retryable', () => {
        expect(migration).toContain('create_idempotency_key text not null');
        expect(migration).toContain('shared_guardianship_invite_create_replay_idx');
        expect(migration).toContain("'errorCode', 'shared_guardianship_invitation_unavailable'");
        expect(migration).toContain("v_invitation.guest_user_id = v_user_id");
        expect(migration).toContain("jsonb_build_object('replay', true)");
    });

    test('keeps service-role generation behind a participant-scoped invitation', () => {
        expect(edgeFunction).toContain('resolve_shared_guardianship_execution');
        expect(edgeFunction).toContain('get_shared_guardianship_execution_context');
        expect(edgeFunction).toContain('stage_shared_guardianship_result');
        expect(edgeFunction).toContain('sharedGuardianshipParticipantResponse');
        expect(edgeFunction).toContain('Choose one protected Fusion mode');
    });

    test('records the safety boundary and required release evidence', () => {
        expect(governance).toContain('No absence, missed action or departure can injure or delete the creature.');
        expect(governance).toContain('No test account credentials, email addresses or invitation codes are committed');
        expect(governance).toContain('two permanent-account invitation, consent and one-child proof');
        expect(governance).toContain('manual-linking and production email delivery smoke');
    });
});
