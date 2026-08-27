const fs = require('fs');
const path = require('path');

describe('Supabase Edge Function key migration contract', () => {
    const packageJson = require('../../package.json');
    const sharedSource = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/functions/_shared/supabase-keys.ts'
        ),
        'utf8'
    );
    const functionNames = [
        'delete-cloud-identity',
        'execute-fusion',
        'finalize-fusion'
    ];

    test('prefers independently rotatable key maps before legacy fallbacks', () => {
        expect(sharedSource).toContain("readNamedKeyMap('SUPABASE_PUBLISHABLE_KEYS')");
        expect(sharedSource).toContain("readNamedKeyMap('SUPABASE_SECRET_KEYS')");
        expect(sharedSource.indexOf('SUPABASE_PUBLISHABLE_KEYS'))
            .toBeLessThan(sharedSource.indexOf('SUPABASE_ANON_KEY'));
        expect(sharedSource.indexOf('SUPABASE_SECRET_KEYS'))
            .toBeLessThan(sharedSource.indexOf('SUPABASE_SERVICE_ROLE_KEY'));
    });

    test('keeps Deno type checking available as a release command', () => {
        expect(packageJson.scripts['check:edge-functions']).toContain('deno check');
        functionNames.forEach(functionName => {
            expect(packageJson.scripts['check:edge-functions']).toContain(
                `supabase/functions/${functionName}/index.ts`
            );
        });
    });

    test.each(functionNames)('%s uses the shared key resolver', functionName => {
        const source = fs.readFileSync(
            path.join(
                __dirname,
                `../../supabase/functions/${functionName}/index.ts`
            ),
            'utf8'
        );
        expect(source).toContain(
            "import { getSupabaseRuntimeKeys } from '../_shared/supabase-keys.ts'"
        );
        expect(source).toContain(
            'const { publishableKey, secretKey } = getSupabaseRuntimeKeys()'
        );
        expect(source).not.toContain("Deno.env.get('SUPABASE_ANON_KEY')");
        expect(source).not.toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    });
});
