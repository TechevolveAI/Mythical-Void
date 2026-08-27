const fs = require('fs');
const path = require('path');

describe('Fusion server finalization contract', () => {
    const migrationSource = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/20260730000700_finalize_fusion_atomically.sql'
        ),
        'utf8'
    );
    const functionSource = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/functions/finalize-fusion/index.ts'
        ),
        'utf8'
    );

    test('keeps the finalization RPC behind the Edge service role', () => {
        expect(migrationSource).toContain(
            'public.finalize_fusion_operation'
        );
        expect(migrationSource).toContain('from authenticated');
        expect(migrationSource).toContain('to service_role');
        expect(functionSource).toContain(
            "request.headers.get('Authorization')"
        );
        expect(functionSource).toContain('callerClient.auth.getUser()');
        expect(functionSource).toContain('getSupabaseRuntimeKeys');
    });

    test('locks operation and save before one atomic lineage commit', () => {
        expect(migrationSource.match(/for update;/g)).toHaveLength(2);
        expect(migrationSource).toContain("status = 'committed'");
        expect(migrationSource).toContain(
            "'{completedOperationIds}'"
        );
        expect(migrationSource).toContain("'{pendingFusion}'");
        expect(migrationSource).toContain(
            'revision = v_revision + 1'
        );
        expect(migrationSource).toContain(
            "'fusion_commit_replay_mismatch'"
        );
    });

    test('accepts names but rebuilds children from the staged result', () => {
        expect(functionSource).toContain('p_names: names');
        expect(functionSource).not.toContain('offspringGenes');
        expect(functionSource).not.toContain('gameState');
        expect(migrationSource).toContain(
            "v_operation.result->'offspring'->v_index"
        );
        expect(migrationSource).toContain(
            "v_child_result->'offspringGenes'"
        );
        expect(migrationSource).toContain(
            "'authority', 'server_finalized'"
        );
    });
});
