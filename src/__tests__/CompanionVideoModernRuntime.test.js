const fs = require('fs');
const path = require('path');

describe('companion video modern Netlify runtime', () => {
    const adapterPath = path.join(
        __dirname,
        '../../netlify/functions/generate-companion-video.mjs'
    );
    const adapterSource = fs.readFileSync(adapterPath, 'utf8');

    test('uses the modern request handler required by the managed AI Gateway', () => {
        expect(adapterSource).toContain("import { GoogleGenAI } from '@google/genai'");
        expect(adapterSource).toContain("import { createClient } from '@supabase/supabase-js'");
        expect(adapterSource).toContain("import WebSocket from 'ws'");
        expect(adapterSource).toContain('transport: WebSocket');
        expect(adapterSource).toContain('new GoogleGenAI({})');
        expect(adapterSource).toContain(
            'export default async function generateCompanionVideo(request)'
        );
        expect(adapterSource).toContain('new Response(');
        expect(adapterSource).not.toContain('export { handler };');
    });

    test('preserves the existing Lambda request contract through the core handler', () => {
        expect(adapterSource).toContain(
            "import videoCore from '../lib/generate-companion-video-core.cjs'"
        );
        expect(adapterSource).toContain('httpMethod: request.method');
        expect(adapterSource).toContain('queryStringParameters:');
        expect(adapterSource).toContain('event.body = await request.text()');
        expect(adapterSource).toContain('status: result.statusCode');
    });
});
