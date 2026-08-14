const fs = require('fs');
const path = require('path');

describe('living portrait modern Netlify runtime', () => {
    const adapterPath = path.join(
        __dirname,
        '../../netlify/functions/generate-ai-art.mjs'
    );
    const adapterSource = fs.readFileSync(adapterPath, 'utf8');

    test('keeps provider SDKs out of the function entrypoint', () => {
        expect(adapterSource).not.toContain("from '@google/genai'");
        expect(adapterSource).not.toContain("from '@supabase/supabase-js'");
        expect(adapterSource).not.toContain("from 'ws'");
        expect(adapterSource).not.toContain('exports.handler');
    });

    test('preserves the existing request contract through the core handler', () => {
        expect(adapterSource).toContain("import portraitCore from '../lib/generate-ai-art-core.cjs'");
        expect(adapterSource).toContain('export const handler = portraitCore.handler');
    });
});
