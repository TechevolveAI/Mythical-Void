const fs = require('fs');
const path = require('path');

// Supabase Realtime performs an eager runtime capability check even though this
// smoke test uses only Auth and HTTP. Supply the installed implementation when
// the Node process does not expose WebSocket globally.
if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = require('ws');
}

const DEFAULT_ENDPOINT = 'https://mythicalvoid.com/.netlify/functions/generate-ai-art';
const DEFAULT_SPEC_PATH = '/private/tmp/mythical-void-portrait-specimen.json';
const DEFAULT_REFERENCE_PATH = '/private/tmp/mythical-void-hatch-reference.png';
const DEFAULT_OUTPUT_BASE = '/private/tmp/mythical-void-production-portrait';

function readEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return Object.fromEntries(
        fs.readFileSync(filePath, 'utf8')
            .split(/\r?\n/)
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const separator = line.indexOf('=');
                return [line.slice(0, separator), line.slice(separator + 1)];
            })
    );
}

function getArgument(name, fallback) {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1]
        ? process.argv[index + 1]
        : fallback;
}

function fail(message) {
    throw new Error(message);
}

async function readJson(response) {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        fail(result.error || `Portrait service error (${response.status})`);
    }
    return result;
}

async function run() {
    const root = path.join(__dirname, '..');
    const env = {
        ...readEnvFile(path.join(root, '.env.local')),
        ...process.env
    };
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) {
        fail('Production portrait smoke test requires public Supabase client configuration.');
    }

    const endpoint = getArgument('--endpoint', DEFAULT_ENDPOINT);
    const specPath = getArgument('--spec', DEFAULT_SPEC_PATH);
    const referencePath = getArgument('--reference', DEFAULT_REFERENCE_PATH);
    const outputBase = getArgument('--output', DEFAULT_OUTPUT_BASE);
    const specimen = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    const portraitSpec = specimen.portraitSpec;
    const referenceImage = `data:image/png;base64,${
        fs.readFileSync(referencePath).toString('base64')
    }`;

    const { createClient } = await import('@supabase/supabase-js');
    const websocketTransport = globalThis.WebSocket
        || require('ws').WebSocket
        || require('ws');
    const client = createClient(supabaseUrl, publishableKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        },
        realtime: { transport: websocketTransport }
    });
    const startedAt = Date.now();
    let initialResponseMs = null;
    let pollCount = 0;

    try {
        const authResult = await client.auth.signInAnonymously();
        const accessToken = authResult.data?.session?.access_token;
        if (authResult.error || !accessToken) {
            fail(`Anonymous authentication failed: ${authResult.error?.message}`);
        }

        const requestHeaders = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            Origin: 'https://mythicalvoid.com'
        };
        const requestBody = JSON.stringify({
            style: 'cinematic',
            portraitSpec,
            referenceImage,
            ageGroup: 'age_18_plus'
        });
        const request = await fetch(endpoint, {
            method: 'POST',
            headers: requestHeaders,
            body: requestBody
        });
        let result = await readJson(request);
        initialResponseMs = Date.now() - startedAt;
        const jobId = result.jobId;
        const pollDelays = [750, 1000, 1500, 2000, 2500];
        const timeoutAt = Date.now() + 120000;

        while (result.status !== 'succeeded' && Date.now() < timeoutAt) {
            if (!jobId) fail('Portrait service did not return a job ID.');
            const delay = pollDelays[Math.min(pollCount, pollDelays.length - 1)];
            await new Promise(resolve => setTimeout(resolve, delay));
            pollCount += 1;
            result = await readJson(await fetch(
                `${endpoint}?jobId=${encodeURIComponent(jobId)}`,
                {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                        Origin: 'https://mythicalvoid.com'
                    }
                }
            ));
            if (result.status === 'failed' || result.status === 'canceled') {
                fail(result.error || 'Portrait generation failed.');
            }
        }

        if (result.status !== 'succeeded' || !result.imageUrl) {
            fail('Portrait generation timed out.');
        }

        const imageResponse = await fetch(result.imageUrl, {
            headers: { Accept: 'image/webp,image/png,image/jpeg' }
        });
        if (!imageResponse.ok) {
            fail(`Generated portrait download failed (${imageResponse.status}).`);
        }
        const contentType = String(imageResponse.headers.get('content-type') || '')
            .split(';')[0]
            .trim()
            .toLowerCase();
        const extension = {
            'image/webp': 'webp',
            'image/png': 'png',
            'image/jpeg': 'jpg'
        }[contentType];
        if (!extension) fail(`Unsupported portrait type: ${contentType || 'unknown'}`);
        const outputPath = `${outputBase}.${extension}`;
        const bytes = Buffer.from(await imageResponse.arrayBuffer());
        fs.writeFileSync(outputPath, bytes);

        const reuseStartedAt = Date.now();
        const reused = await readJson(await fetch(endpoint, {
            method: 'POST',
            headers: requestHeaders,
            body: requestBody
        }));
        if (
            reused.status !== 'succeeded' ||
            reused.identityCacheHit !== true ||
            reused.quotaConsumed !== false ||
            reused.assetRef !== result.assetRef
        ) {
            fail(`Portrait identity cache was not reused: ${JSON.stringify({
                status: reused.status,
                identityCacheHit: reused.identityCacheHit,
                quotaConsumed: reused.quotaConsumed,
                assetRefMatches: reused.assetRef === result.assetRef
            })}`);
        }

        console.log(JSON.stringify({
            authenticated: true,
            identityKey: portraitSpec.identityKey,
            status: result.status,
            initialResponseMs,
            totalMs: Date.now() - startedAt,
            pollCount,
            provider: result.provider,
            model: result.model,
            storage: result.storage,
            assetRef: result.assetRef,
            contentType,
            bytes: bytes.length,
            outputPath,
            reuseMs: Date.now() - reuseStartedAt,
            identityCacheHit: reused.identityCacheHit,
            quotaConsumedOnReuse: reused.quotaConsumed
        }, null, 2));
    } finally {
        await client.auth.signOut();
    }
}

run().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
