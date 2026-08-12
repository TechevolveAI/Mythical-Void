const fs = require('fs');
const path = require('path');

describe('Fusion server reservation contract', () => {
    const migrationSource = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/20260730000400_create_fusion_operation_reservations.sql'
        ),
        'utf8'
    );
    const contractV2Source = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/20260731000100_add_fusion_contract_v2.sql'
        ),
        'utf8'
    );

    test('keeps operation records private and write-protected', () => {
        expect(migrationSource).toContain(
            'alter table public.fusion_operations force row level security'
        );
        expect(migrationSource).toContain(
            'revoke all on table public.fusion_operations from authenticated'
        );
        expect(migrationSource).toContain(
            'grant select on table public.fusion_operations to authenticated'
        );
        expect(migrationSource).not.toContain(
            'grant insert on table public.fusion_operations'
        );
        expect(migrationSource).not.toContain(
            'grant update on table public.fusion_operations'
        );
    });

    test('locks the cloud save and validates revision, ownership, maturity, and capacity', () => {
        expect(migrationSource).toContain("and save_slot = 'primary'");
        expect(migrationSource).toContain('for update');
        expect(migrationSource).toContain(
            'if v_current_revision <> v_expected_revision'
        );
        expect(migrationSource).toContain(
            "in ('adult', 'elder')"
        );
        expect(migrationSource).toContain(
            "'fusion_parent_ownership_or_eligibility_failed'"
        );
        expect(migrationSource).toContain(
            'jsonb_array_length(v_creatures) + v_offspring_count > v_max_creatures'
        );
    });

    test('supports idempotent retries and rejects operation replay mismatches', () => {
        expect(migrationSource).toContain(
            'v_existing.server_fingerprint <> v_server_fingerprint'
        );
        expect(migrationSource).toContain(
            "'fusion_operation_replay_mismatch'"
        );
        expect(migrationSource).toContain("'replay', true");
        expect(migrationSource).toContain("'replay', false");
    });

    test('stores a privacy-minimized request and a server-owned seed', () => {
        expect(migrationSource).toContain(
            "v_sanitized_request := jsonb_build_object"
        );
        expect(migrationSource).toContain(
            "v_result_seed := 'fusion-server-v1:'"
        );
        expect(migrationSource).not.toContain("'name',");
        expect(migrationSource).not.toContain("'email',");
    });

    test('requires explicit local consent while shared Fusion remains sealed', () => {
        expect(contractV2Source).toContain(
            "p_request#>>'{consent,mode}' <> 'same_save_owner'"
        );
        expect(contractV2Source).toContain(
            "p_request#>>'{consent,scope}' <> 'local_sanctuary'"
        );
        expect(contractV2Source).toContain(
            "p_request#>>'{consent,keeperGrant}' <> 'confirmed'"
        );
        expect(contractV2Source).toContain(
            "grant_entry->>'decision' = 'willing'"
        );
        expect(contractV2Source).toContain(
            "p_request#>'{consent,sharedInvitationId}'"
        );
        expect(contractV2Source).toContain('"missing"');
    });

    test('selects offspring identity and count inside the reservation', () => {
        expect(contractV2Source).toContain(
            "p_request->'candidateOffspringIds'"
        );
        expect(contractV2Source).toContain(
            "(p_request->>'offspringCapacity')::integer"
        );
        expect(contractV2Source).toContain(
            'v_offspring_count := case'
        );
        expect(contractV2Source).toContain(
            'v_candidate_ids[1:v_offspring_count]'
        );
        expect(contractV2Source).toContain(
            "'offspringIds', to_jsonb(v_offspring_ids)"
        );
        expect(contractV2Source).toContain(
            "'offspringCount', v_offspring_count"
        );
    });

    test('keeps version-one reservations replay-compatible', () => {
        expect(contractV2Source).toContain(
            'if v_contract_version not in (1, 2)'
        );
        expect(contractV2Source).toContain(
            'if v_contract_version = 2 then'
        );
        expect(contractV2Source).toContain(
            "p_request->'offspringIds'"
        );
    });

    test('checks legacy adulthood and current wellbeing from the locked save', () => {
        expect(contractV2Source).toContain(
            "creature#>>'{lifecycle,birthDate}'"
        );
        expect(contractV2Source).toContain("interval '2 days'");
        expect(contractV2Source).toContain(
            "creature#>>'{stats,happiness}'"
        );
        expect(contractV2Source).toContain(
            "not in ('sad', 'abandoned')"
        );
        expect(contractV2Source).toContain(
            "creature#>>'{lifecycle,isStuck}'"
        );
    });
});
