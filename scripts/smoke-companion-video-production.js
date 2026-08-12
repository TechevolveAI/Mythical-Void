const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://mythicalvoid.com';
const PORTRAIT_ENDPOINT = `${ORIGIN}/.netlify/functions/generate-ai-art`;
const VIDEO_ENDPOINT = `${ORIGIN}/.netlify/functions/generate-companion-video`;
const SPEC_PATH = '/private/tmp/mythical-void-portrait-specimen.json';
const REFERENCE_PATH = '/private/tmp/mythical-void-hatch-reference.png';
const OUTPUT_PATH = '/private/tmp/mythical-void-first-forest-smoke.mp4';

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

async function requestJson(url, options) {
    const response = await fetch(url, options);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(result.error || `Media service error (${response.status})`);
    }
    return result;
}

async function poll({ endpoint, assetRef, accessToken, timeoutMs }) {
    const startedAt = Date.now();
    let count = 0;
    while (Date.now() - startedAt < timeoutMs) {
        await new Promise(resolve => setTimeout(
            resolve,
            Math.min(8000, 1000 + count * 500)
        ));
        count += 1;
        const result = await requestJson(
            `${endpoint}?assetRef=${encodeURIComponent(assetRef)}`,
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                    Origin: ORIGIN
                }
            }
        );
        if (result.status === 'succeeded') return { result, pollCount: count };
        if (['failed', 'canceled'].includes(result.status)) {
            throw new Error(result.error || 'Media generation failed');
        }
    }
    throw new Error(`Media generation exceeded ${Math.round(timeoutMs / 1000)} seconds`);
}

async function run() {
    const root = path.join(__dirname, '..');
    const env = {
        ...readEnvFile(path.join(root, '.env.local')),
        ...process.env
    };
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
        throw new Error('Public Supabase client configuration is unavailable');
    }
    const specimen = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
    const referenceImage = `data:image/png;base64,${
        fs.readFileSync(REFERENCE_PATH).toString('base64')
    }`;
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(
        env.VITE_SUPABASE_URL,
        env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    let cleanup = false;
    let signedIn = false;
    const startedAt = Date.now();

    try {
        const auth = await client.auth.signInAnonymously();
        const accessToken = auth.data?.session?.access_token;
        if (auth.error || !accessToken) {
            throw new Error(`Anonymous authentication failed: ${auth.error?.message}`);
        }
        signedIn = true;

        let portrait = await requestJson(PORTRAIT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                Origin: ORIGIN
            },
            body: JSON.stringify({
                style: 'cinematic',
                portraitSpec: specimen.portraitSpec,
                referenceImage,
                ageGroup: 'age_18_plus'
            })
        });
        let portraitPollCount = 0;
        if (portrait.status !== 'succeeded') {
            const polled = await poll({
                endpoint: PORTRAIT_ENDPOINT,
                assetRef: portrait.assetRef,
                accessToken,
                timeoutMs: 240000
            });
            portrait = polled.result;
            portraitPollCount = polled.pollCount;
        }
        if (!portrait.imageUrl || !portrait.assetRef) {
            throw new Error('Production portrait did not produce a protected asset');
        }

        let video = await requestJson(VIDEO_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                Origin: ORIGIN
            },
            body: JSON.stringify({
                momentId: 'first_forest_arrival',
                portraitAssetRef: portrait.assetRef
            })
        });
        let videoPollCount = 0;
        if (video.status !== 'succeeded') {
            const polled = await poll({
                endpoint: VIDEO_ENDPOINT,
                assetRef: video.assetRef,
                accessToken,
                timeoutMs: 600000
            });
            video = polled.result;
            videoPollCount = polled.pollCount;
        }
        if (!video.videoUrl || !video.assetRef) {
            throw new Error('Production video did not produce a protected asset');
        }

        const mediaResponse = await fetch(video.videoUrl, {
            headers: { Accept: 'video/mp4' }
        });
        if (!mediaResponse.ok) {
            throw new Error(`Protected video download failed (${mediaResponse.status})`);
        }
        const bytes = Buffer.from(await mediaResponse.arrayBuffer());
        if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp') {
            throw new Error('Protected video is not a valid MP4 file');
        }
        fs.writeFileSync(OUTPUT_PATH, bytes);

        console.log(JSON.stringify({
            authenticated: true,
            portrait: {
                status: portrait.status,
                provider: portrait.provider,
                model: portrait.model,
                storage: portrait.storage,
                assetRef: portrait.assetRef,
                pollCount: portraitPollCount
            },
            video: {
                status: video.status,
                provider: video.provider,
                model: video.model,
                storage: video.storage,
                assetRef: video.assetRef,
                momentId: video.momentId,
                pollCount: videoPollCount,
                bytes: bytes.length,
                contentType: mediaResponse.headers.get('content-type'),
                outputPath: OUTPUT_PATH
            },
            totalMs: Date.now() - startedAt
        }, null, 2));
    } finally {
        if (signedIn) {
            const deletion = await client.functions.invoke('delete-cloud-identity');
            cleanup = !deletion.error;
            if (deletion.error) {
                console.error(`WARNING cleanup failed: ${deletion.error.message}`);
            }
        }
        if (!cleanup) {
            await client.auth.signOut().catch(() => {});
        }
        console.log(JSON.stringify({ testIdentityDeleted: cleanup }));
    }
}

run().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
