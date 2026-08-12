const fs = require('fs');
const path = require('path');

describe('living portrait modern Netlify runtime', () => {
    const adapterPath = path.join(
        __dirname,
        '../../netlify/functions/generate-ai-art.mjs'
    );
    const adapterSource = fs.readFileSync(adapterPath, 'utf8');

    test('uses a modern ESM default handler so AI Gateway variables are available', () => {
        expect(adapterSource).toContain("import { GoogleGenAI } from '@google/genai'");
        expect(adapterSource).toContain("import { createClient } from '@supabase/supabase-js'");
        expect(adapterSource).toContain('export default async function generateAIArt(request)');
        expect(adapterSource).toContain('new Response(');
        expect(adapterSource).not.toContain('exports.handler');
    });

    test('preserves the existing request contract through the core handler', () => {
        expect(adapterSource).toContain("import portraitCore from '../lib/generate-ai-art-core.cjs'");
        expect(adapterSource).toContain('httpMethod: request.method');
        expect(adapterSource).toContain('queryStringParameters:');
        expect(adapterSource).toContain('event.body = await request.text()');
        expect(adapterSource).toContain('status: result.statusCode');
    });
});
