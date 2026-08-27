const fs = require('fs');
const path = require('path');

describe('Fusion server outcome contract', () => {
    const migrationSource = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/20260730000600_add_fusion_server_outcomes.sql'
        ),
        'utf8'
    );
    const functionSource = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/functions/execute-fusion/index.ts'
        ),
        'utf8'
    );

    test('keeps execution RPCs behind the Edge service role', () => {
        expect(migrationSource).toContain(
            'public.get_fusion_execution_context'
        );
        expect(migrationSource).toContain(
            'public.stage_fusion_operation_result'
        );
        expect(migrationSource).toContain('for update');
        expect(migrationSource).toContain(
            "'fusion_result_replay_mismatch'"
        );
        expect(migrationSource).toContain(
            'grant execute on function public.get_fusion_execution_context'
        );
        expect(migrationSource).toContain('to service_role');
        expect(migrationSource).toContain('from authenticated');
    });

    test('binds every staged result to reserved operation and offspring IDs', () => {
        expect(migrationSource).toContain(
            'v_result_ids is distinct from v_operation.offspring_ids'
        );
        expect(migrationSource).toContain(
            "p_receipt->>'authority' <> 'server_generated'"
        );
        expect(migrationSource).toContain(
            "p_receipt->>'serverFingerprint'"
        );
        expect(migrationSource).toContain(
            "set status = 'staged'"
        );
    });

    test('authenticates the caller before using the server-only database path', () => {
        expect(functionSource).toContain(
            "request.headers.get('Authorization')"
        );
        expect(functionSource).toContain('callerClient.auth.getUser()');
        expect(functionSource).toContain(
            "'get_fusion_execution_context'"
        );
        expect(functionSource).toContain(
            "'stage_fusion_operation_result'"
        );
        expect(functionSource).toContain('getSupabaseRuntimeKeys');
        expect(functionSource).toContain(
            'p_user_id: userResult.data.user.id'
        );
    });

    test('generates deterministic genetics, events, and result receipts', () => {
        expect(functionSource).toContain('createRandom(resultSeed)');
        expect(functionSource).toContain(
            "executionVersion: 'fusion-outcome-v1'"
        );
        expect(functionSource).toContain(
            "authority: 'server_generated'"
        );
        expect(functionSource).toContain(
            'resultFingerprint: fingerprint(outcome)'
        );
        expect(functionSource).toContain('crossoverMendelian');
        expect(functionSource).toContain('rollEvents');
        expect(functionSource).toContain('secretAbilities');
    });
});
