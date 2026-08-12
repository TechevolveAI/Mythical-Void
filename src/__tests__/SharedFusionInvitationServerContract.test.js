const fs = require('fs');
const path = require('path');

describe('Shared Fusion invitation server contract', () => {
    const migration = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/' +
                '20260731000200_create_shared_fusion_invitations.sql'
        ),
        'utf8'
    );
    const productContract = fs.readFileSync(
        path.join(
            __dirname,
            '../../docs/planning/SHARED_FUSION_INVITATION_CONTRACT.md'
        ),
        'utf8'
    );
    const executor = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/functions/execute-fusion/index.ts'
        ),
        'utf8'
    );
    const concurrency = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/' +
                '20260731000300_guard_shared_fusion_concurrency.sql'
        ),
        'utf8'
    );
    const consequence = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/' +
                '20260731000400_sync_shared_kinship_beacon.sql'
        ),
        'utf8'
    );

    test('keeps invitation, profile, and attempt tables inaccessible', () => {
        [
            'shared_fusion_profiles',
            'shared_fusion_invitations',
            'shared_fusion_join_attempts'
        ].forEach(table => {
            expect(migration).toContain(
                `alter table public.${table} force row level security`
            );
            expect(migration).toContain(
                `revoke all on table public.${table} from authenticated`
            );
        });
        expect(migration).not.toContain(
            'grant select on table public.shared_fusion_invitations'
        );
        expect(migration).not.toContain(
            'grant insert on table public.shared_fusion_invitations'
        );
    });

    test('stores only a hash of a random 48-bit expiring code', () => {
        expect(migration).toContain('code_hash text not null unique');
        expect(migration).toContain(
            "extensions.gen_random_bytes(6)"
        );
        expect(migration).toContain(
            "extensions.digest(v_code, 'sha256')"
        );
        expect(migration).toContain("interval '15 minutes'");
        expect(migration).not.toMatch(/\n\s+code text/);
    });

    test('requires self-attested 16+ eligibility without collecting identity', () => {
        expect(migration).toContain(
            "age_band in ('age_16_17', 'age_18_plus')"
        );
        expect(migration).toContain(
            'shared_fusion_age_attestation_required'
        );
        expect(migration).not.toContain('date_of_birth');
        expect(migration).not.toContain('email');
        expect(migration).not.toContain('legal_name');
    });

    test('server extracts and fingerprints both willing companions from locked saves', () => {
        expect(migration).toContain(
            'public.shared_fusion_parent_record(v_game_state, p_parent_id)'
        );
        expect(migration).toContain(
            "in ('adult', 'elder')"
        );
        expect(migration).toContain(
            "not in ('sad', 'abandoned')"
        );
        expect(migration).toContain(
            "creature#>>'{lifecycle,isStuck}'"
        );
        expect(migration).toContain(
            "where user_id = v_user_id\n      and save_slot = 'primary'\n    for update"
        );
        expect(migration).toContain(
            'md5(v_parent_record::text)'
        );
    });

    test('returns only participant-scoped bounded peer signal data', () => {
        const viewStart = migration.indexOf(
            'create or replace function public.shared_fusion_invitation_view'
        );
        const viewEnd = migration.indexOf(
            'create or replace function public.attest_shared_fusion_eligibility'
        );
        const view = migration.slice(viewStart, viewEnd);

        expect(view).toContain("'peerSignal'");
        expect(view).toContain("'rarity'");
        expect(view).toContain("'affinity'");
        expect(view).toContain("'generation'");
        expect(view).toContain("'stage'");
        expect(view).not.toContain("'hostUserId'");
        expect(view).not.toContain("'guestUserId'");
        expect(view).not.toContain("'name'");
        expect(view).not.toContain("'email'");
    });

    test('uses generic unavailable errors and limits guessing', () => {
        expect(migration.match(
            /shared_fusion_invitation_unavailable/g
        ).length).toBeGreaterThanOrEqual(3);
        expect(migration).toContain(
            "interval '10 minutes'"
        );
        expect(migration).toContain(
            'if v_recent_attempts >= 10'
        );
        expect(migration).toContain(
            'if v_live_count >= 3'
        );
    });

    test('requires a second review and allows either participant to cancel', () => {
        expect(migration).toContain(
            'host_confirmed_at = coalesce'
        );
        expect(migration).toContain(
            'guest_confirmed_at = coalesce'
        );
        expect(migration).toContain(
            "when guest_confirmed_at is not null then 'ready'"
        );
        expect(migration).toContain(
            "when host_confirmed_at is not null then 'ready'"
        );
        expect(migration).toContain(
            'or guest_user_id = v_user_id'
        );
        expect(migration).toContain(
            "set status = 'cancelled'"
        );
    });

    test('reserves two server identities only after both confirmations', () => {
        expect(migration).toContain(
            "if v_invitation.status = 'ready'"
        );
        expect(migration).toContain(
            "'fusion_shared_' || gen_random_uuid()::text"
        );
        expect(migration).toContain(
            "'creature_shared_' || gen_random_uuid()::text"
        );
        expect(migration).toContain(
            "'mode', 'cross_owner'"
        );
        expect(migration).toContain(
            "'keeperGrant', 'dual_confirmed'"
        );
        expect(migration).toContain(
            "v_operation.request#>>'{consent,mode}' = 'cross_owner'"
        );
    });

    test('lets either participant execute but returns only their assigned result', () => {
        expect(executor).toContain(
            "'resolve_shared_fusion_execution'"
        );
        expect(executor).toContain(
            'context.shared === true && !sharedRole'
        );
        expect(executor).toContain(
            "const index = role === 'host' ? 0 : 1"
        );
        expect(executor).toContain(
            'delete selectedData.parentIds'
        );
        expect(executor).toContain(
            'sharedParticipantResponse('
        );
    });

    test('atomically commits one unique linked sibling into each locked save', () => {
        expect(migration).toContain(
            'create or replace function public.submit_shared_fusion_name'
        );
        expect(migration).toContain(
            'order by user_id\n    for update'
        );
        expect(migration).toContain(
            "v_host_creatures || jsonb_build_array(v_host_child)"
        );
        expect(migration).toContain(
            "v_guest_creatures || jsonb_build_array(v_guest_child)"
        );
        expect(migration).toContain(
            "'authority', 'server_shared_finalized'"
        );
        expect(migration).toContain(
            "'fusion-shared-commit-v1:'"
        );
        expect(migration).toContain(
            "set status = 'committed'"
        );
    });

    test('stores opaque remote-parent references instead of peer companion IDs', () => {
        const childBuilderStart = migration.indexOf(
            'create or replace function public.build_shared_fusion_child'
        );
        const childBuilderEnd = migration.indexOf(
            'create or replace function public.submit_shared_fusion_name'
        );
        const childBuilder = migration.slice(
            childBuilderStart,
            childBuilderEnd
        );
        expect(childBuilder).toContain("'parentIds'");
        expect(childBuilder).toContain('p_remote_parent_ref');
        expect(childBuilder).toContain("'linkedSiblingId'");
        expect(migration).toContain("'protected-parent-v1:'");
        expect(childBuilder).not.toContain('host_parent_id');
        expect(childBuilder).not.toContain('guest_parent_id');
    });

    test('shares the local cooldown and blocks cross-device lineage races', () => {
        expect(concurrency).toContain(
            'public.shared_fusion_save_is_busy'
        );
        expect(concurrency).toContain(
            "'{breedingShrine,lastBreedingTime}'"
        );
        expect(concurrency).toContain(
            "'{breedingShrine,breedingCooldown}'"
        );
        expect(concurrency).toContain(
            "new.request#>>'{consent,mode}' = 'same_save_owner'"
        );
        expect(concurrency).toContain(
            "raise exception 'shared_fusion_in_progress'"
        );
        expect(concurrency).toContain(
            "entry->>'origin' = 'shared_fusion'"
        );
        expect(concurrency).toContain(
            'before update on public.game_saves'
        );
    });

    test('atomically lights the private shared-lineage beacon', () => {
        expect(consequence).toContain(
            'public.sync_shared_kinship_beacon'
        );
        expect(consequence).toContain(
            'before update on public.game_saves'
        );
        expect(consequence).toContain(
            "entry.value->>'origin' = 'shared_fusion'"
        );
        expect(consequence).toContain(
            "'sharedLineageCount'"
        );
        expect(consequence).toContain(
            "'schemaVersion', 2"
        );
        expect(consequence).toContain(
            'revoke all on function public.sync_shared_kinship_beacon()'
        );
    });

    test('defines linked-sibling ownership without opening trading or chat', () => {
        expect(productContract).toContain(
            'A successful Shared Fusion stabilizes two linked siblings.'
        );
        expect(productContract).toContain(
            'Each sanctuary receives one distinct sibling'
        );
        expect(productContract).toContain(
            'Neither parent leaves its sanctuary'
        );
        expect(productContract).toContain(
            'public matchmaking or suggested partners'
        );
        expect(productContract).toContain(
            'usernames, friend lists, direct messaging, chat'
        );
        expect(productContract).toContain(
            'Partial cross-save commit is prohibited.'
        );
    });
});
