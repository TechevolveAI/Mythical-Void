// Explicit live-development qualification. No AI generation and no real email.
// Uses short-lived synthetic anonymous legacy-media fixtures, erased in finally.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const { createServer } = require('vite');
const root = path.resolve(__dirname, '../..');
const project = 'mythical-void-dev-eu';
const preview = 'https://mythical-void-frontend-preview-wihawqqnka-ew.a.run.app';
const api = 'https://mythical-void-adult-accounts-dev-wihawqqnka-ew.a.run.app/v1/adventures';
const legacy = 'https://mkcmdbzcihjgidjuypqe.supabase.co';
const origin = 'http://127.0.0.1:8147';
const output = path.join(root, '.visual-review/adult-media-transfer');
const check = (value, label) => assert(value, label);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function run() {
    check(process.argv.includes('--live-development'), 'Explicit --live-development required');
    check(!process.env.FIREBASE_AUTH_EMULATOR_HOST && !process.env.FIRESTORE_EMULATOR_HOST, 'Live check cannot use emulators');
    check(process.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Existing public anonymous media key required');
    const reviewEndpoint = process.env.MYTHICAL_MEDIA_REVIEW_ENDPOINT;
    check(/^https:\/\/[a-f0-9]+--mythicalvoid\.netlify\.app\/\.netlify\/functions\/adult-media-review$/.test(reviewEndpoint || ''), 'Exact private draft endpoint required');
    check(process.env.MYTHICAL_MEDIA_REVIEW_TOKEN && process.env.MYTHICAL_MEDIA_REVIEW_RUN, 'Expiring private review access required');
    async function review(action, body) {
        const r = await fetch(reviewEndpoint + '?reviewAction=' + action, { method: body ? 'POST' : 'GET', headers: {
            'x-mythical-review-key': process.env.MYTHICAL_MEDIA_REVIEW_TOKEN, 'Content-Type': 'application/json'
        }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
        const data = await r.json(); check(r.ok, 'Private media draft: ' + data.error); return data;
    }
    const probe = await review('probe'); check(probe.runId === process.env.MYTHICAL_MEDIA_REVIEW_RUN && probe.hasMediaCredential, 'Private draft scope mismatch');
    const image = fs.readFileSync(process.env.MYTHICAL_TEST_PORTRAIT);
    const film = fs.readFileSync(process.env.MYTHICAL_TEST_VIDEO);
    check(image.length < 12 * 1024 * 1024 && image.subarray(1, 4).toString() === 'PNG', 'Bounded PNG fixture required');
    check(film.length < 20 * 1024 * 1024 && film.subarray(4, 8).toString() === 'ftyp', 'Bounded MP4 fixture required');
    const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n').map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]));
    check(env.VITE_FIREBASE_PROJECT_ID === project, 'Development Firebase configuration required');
    const config = { apiKey: env.VITE_FIREBASE_API_KEY, projectId: project, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, appId: env.VITE_FIREBASE_APP_ID };
    const adminToken = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    async function google(url, method = 'GET', body) {
        const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + adminToken,
            'x-goog-user-project': project, 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
        const data = r.status === 204 ? {} : await r.json();
        if (!r.ok) { const e = Error('Synthetic Google operation failed: ' + r.status); e.status = r.status; throw e; } return data;
    }
    const counters = { accountMediaRequests: 0, legacyRequests: 0, firebaseTokensToLegacy: 0, generationRequests: 0 };
    const guardedLegacyFetch = async (url, options = {}) => {
        check(new URL(url).origin === legacy, 'Unexpected media destination');
        const authorization = new Headers(options.headers).get('authorization') || '';
        let claims; try { claims = JSON.parse(Buffer.from(authorization.split('.')[1], 'base64url')); } catch { /* Public keys are not JWTs. */ }
        if (String(claims?.iss).startsWith('https://securetoken.google.com/')) {
            counters.firebaseTokensToLegacy++; throw Error('Firebase token cannot reach legacy media');
        }
        check(!String(options.body || '').includes('@example.test'), 'Email cannot reach legacy media');
        counters.legacyRequests++;
        return fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(30000) });
    };
    const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: guardedLegacyFetch } };
    const accounts = [], anonymous = [], assets = [], jobs = [], checks = [];
    let server, browser, failure, seedAttempted = false, stage = 'setup';
    const pageErrors = [];
    fs.mkdirSync(output, { recursive: true });
    const recordOwned = () => fs.writeFileSync(path.join(output, 'owned-synthetic-records.json'), JSON.stringify({
        project, accounts: accounts.map(a => a.uid), anonymous: anonymous.map(a => a.id), assets, jobs
    }, null, 2), { mode: 0o600 });
    try {
        for (let i = 0; i < 2; i++) {
            const uid = 'adult-media-check-' + randomBytes(10).toString('hex');
            const account = { uid, email: uid + '@example.test', password: randomBytes(32).toString('base64url') };
            await google('https://identitytoolkit.googleapis.com/v1/projects/' + project + '/accounts', 'POST', {
                localId: uid, email: account.email, password: account.password, emailVerified: true }); accounts.push(account); recordOwned();
        }
        for (let i = 0; i < 2; i++) {
            const client = createClient(legacy, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, options);
            const result = await client.auth.signInAnonymously({ options: { data: { adult_media_check_run: process.env.MYTHICAL_MEDIA_REVIEW_RUN } } });
            check(!result.error && result.data.user?.is_anonymous, 'Synthetic anonymous media identity failed');
            anonymous.push({ client, session: result.data.session, id: result.data.user.id }); recordOwned();
        }
        seedAttempted = true;
        const refs = await review('seed', { anonymousToken: anonymous[0].session.access_token });
        assets.push(refs.portrait, refs.video); jobs.push(refs.portrait, refs.video); recordOwned();
        const routes = {
            '/.netlify/functions/generate-ai-art': 'portrait',
            '/.netlify/functions/generate-companion-video': 'video'
        };
        server = await createServer({ root, logLevel: 'silent', server: { host: '127.0.0.1', port: 8147, strictPort: true, open: false }, plugins: [{
            name: 'synthetic-account-media-check', configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url, origin), route = routes[url.pathname];
                if (!route && url.pathname !== '/v1/adventures') return next();
                try {
                    const chunks = []; for await (const chunk of req) chunks.push(chunk);
                    const body = Buffer.concat(chunks); check(body.length < 2200000, 'Fixture body too large');
                    const headers = { Authorization: req.headers.authorization || '', Origin: preview, Host: new URL(preview).host, 'Content-Type': 'application/json' };
                    const request = { method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body } : {}) };
                    if (route && url.searchParams.has('accountAdventure')) counters.accountMediaRequests++;
                    if (route && req.method === 'POST' && !url.searchParams.has('accountAdventure')) { counters.generationRequests++; throw Error('Generation forbidden'); }
                    const response = route ? await fetch(reviewEndpoint + url.search + '&kind=' + route, { ...request,
                        headers: { ...headers, 'x-mythical-review-key': process.env.MYTHICAL_MEDIA_REVIEW_TOKEN }, signal: AbortSignal.timeout(30000) })
                        : await fetch(api + url.search, { ...request, signal: AbortSignal.timeout(30000) });
                    res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
                    res.end(Buffer.from(await response.arrayBuffer()));
                } catch { res.writeHead(503); res.end('{"error":"synthetic_bridge_unavailable"}'); }
            }); }
        }] }); await server.listen();
        browser = await chromium.launch({ channel: process.env.MYTHICAL_BROWSER_CHANNEL || 'chrome', headless: true, args: ['--mute-audio'] });
        async function device(account, legacyIdentity) {
            stage = 'open-phone-fixture';
            const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
            const page = await context.newPage(); page.on('pageerror', e => pageErrors.push(e.message.replace(/https?:\/\/\S+/g, '[URL]').slice(0, 250)));
            await page.goto(origin + '/scripts/review/adult-media-preview.html');
            await page.waitForFunction(() => window.mediaReview);
            stage = 'phone-sign-in';
            await page.evaluate(input => window.mediaReview.login(input), { config, email: account.email, password: account.password, legacySession: legacyIdentity.session });
            return page;
        }
        const one = await device(accounts[0], anonymous[0]);
        stage = 'save-original-adventure';
        const adventureId = await one.evaluate(refs => window.mediaReview.save(refs), refs);
        check(await one.evaluate(() => !window.mediaReview.savedBytes().includes('@example.test')), 'Email found in game save');
        for (const kind of ['portrait', 'video']) check((await one.evaluate(({ kind, ref }) => window.mediaReview.resolve(kind, ref), { kind, ref: refs[kind] })).status === 200, 'Original anonymous owner read failed');
        check(counters.accountMediaRequests === 0, 'Original media path unexpectedly needed account bridge'); checks.push('original-anonymous-media-path');
        const two = await device(accounts[0], anonymous[1]);
        stage = 'import-on-second-device';
        const imported = await two.evaluate(id => window.mediaReview.open(id), adventureId);
        check(imported.localCopies === 2, 'Local adventure was replaced');
        check(!imported.portrait.imageUrl && !imported.video.videoUrl, 'Expired URLs were copied'); checks.push('new-device-import-preserves-local-save-and-durable-refs');
        for (const kind of ['portrait', 'video']) {
            const result = await two.evaluate(({ kind, ref }) => window.mediaReview.resolve(kind, ref), { kind, ref: refs[kind] });
            check(result.status === 200 && result.assetRef === refs[kind] && result.expiresAt > Date.now(), 'Account protected read failed: ' + kind);
        }
        stage = 'decode-protected-image-and-video';
        await two.waitForFunction(() => document.querySelector('#portrait').naturalWidth > 0 && document.querySelector('#film').readyState >= 1);
        const playback = await two.evaluate(async () => { const v = document.querySelector('#film'); v.muted = true; await v.play();
            await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Muted film did not advance')), 10000);
                v.ontimeupdate = () => { if (v.currentTime > 0.05) { clearTimeout(timer); v.ontimeupdate = null; resolve(); } }; });
            v.pause(); return { muted: v.muted, currentTime: v.currentTime, duration: v.duration, width: v.videoWidth }; });
        check(playback.muted && playback.currentTime > 0 && playback.duration > 0 && playback.width > 0, 'Video playback failed');
        check(counters.accountMediaRequests >= 2, 'New device did not use account media authorisation'); checks.push('new-device-portrait-decoded', 'new-device-video-played-muted');
        await two.screenshot({ path: path.join(output, 'new-device-media.png'), fullPage: true });
        for (const kind of ['portrait', 'video']) {
            const repeat = await two.evaluate(({ kind, ref }) => window.mediaReview.resolve(kind, ref), { kind, ref: refs[kind] });
            check(repeat.status === 200, 'Protected media URL refresh failed');
            check(await two.evaluate(({ kind, ref, id }) => window.mediaReview.direct(kind, ref, id, 'POST'), { kind, ref: refs[kind], id: adventureId }) === 403, 'Account bridge allowed generation');
        }
        checks.push('repeat-signed-media-access', 'account-generation-denied');
        check(await two.evaluate(({ id }) => window.mediaReview.direct('portrait', 'portrait-job-v1:00000000-0000-4000-8000-000000000001', id), { id: adventureId }) === 403, 'Unsaved media reference accepted');
        check(await two.evaluate(({ ref, id }) => window.mediaReview.direct('portrait', ref, id, 'GET', 'invalid-token'), { ref: refs.portrait, id: adventureId }) === 403, 'Invalid account token accepted');
        const other = await device(accounts[1], anonymous[1]);
        for (const kind of ['portrait', 'video']) check(await other.evaluate(({ kind, ref, id }) => window.mediaReview.direct(kind, ref, id), { kind, ref: refs[kind], id: adventureId }) === 403, 'Another account read the original adventure');
        const copiedId = await other.evaluate(refs => window.mediaReview.save(refs), refs);
        for (const kind of ['portrait', 'video']) check(await other.evaluate(({ kind, ref, id }) => window.mediaReview.direct(kind, ref, id), { kind, ref: refs[kind], id: copiedId }) === 403, 'Copied reference bypassed anonymous ownership');
        checks.push('foreign-account-denied', 'copied-reference-owner-mismatch-denied', 'unsaved-reference-denied', 'invalid-token-denied');
        await two.evaluate(() => window.mediaReview.signOut());
        for (const kind of ['portrait', 'video']) check((await two.evaluate(({ kind, ref }) => window.mediaReview.resolve(kind, ref), { kind, ref: refs[kind] })).status === 404, 'Signed-out media unexpectedly accessible');
        checks.push('signed-out-new-device-denied');
        check(pageErrors.length === 0, 'Browser errors occurred'); check(counters.generationRequests === 0 && counters.firebaseTokensToLegacy === 0, 'Media boundary failed');
        checks.push('no-generation-no-email-no-firebase-token-to-legacy');
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), project,
            mode: 'private-hosted-candidate-gateway-with-real-Google-and-private-legacy-storage', checks, counters, playback,
            fixtures: { portraitSha256: digest(image), videoSha256: digest(film) }, emailsSent: 0, generatedAssets: 0, checkedAt: new Date().toISOString() }, null, 2));
    } catch (e) {
        failure = e;
        fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ stage, message: e.message.replace(/https?:\/\/\S+/g, '[URL]').slice(0, 250), pageErrors }, null, 2));
        const page = browser?.contexts().at(-1)?.pages().at(-1);
        if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    }
    finally {
        await browser?.close(); await server?.close();
        const errors = [];
        const attempt = async fn => { try { await fn(); } catch (e) { errors.push(e.message); } };
        if (seedAttempted) await attempt(() => review('cleanup', { anonymousToken: anonymous[0].session.access_token }));
        for (const row of anonymous) await attempt(async () => { const r = await row.client.functions.invoke('delete-cloud-identity'); check(!r.error, 'Anonymous cleanup failed'); });
        for (const account of accounts) {
            const doc = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/adultAccounts/${account.uid}`;
            await attempt(async () => {
                let list;
                try { list = await google(doc + '/adventures'); } catch (e) { if (e.status === 404) return; throw e; }
                for (const row of list.documents || []) {
                    const payload = await google('https://firestore.googleapis.com/v1/' + row.name + '/payload');
                    for (const chunk of payload.documents || []) await google('https://firestore.googleapis.com/v1/' + chunk.name, 'DELETE');
                    await google('https://firestore.googleapis.com/v1/' + row.name, 'DELETE');
                }
                try { await google(doc, 'DELETE'); } catch (e) { if (e.status !== 404) throw e; }
            });
            await attempt(() => google('https://identitytoolkit.googleapis.com/v1/projects/' + project + '/accounts:delete', 'POST', { localId: account.uid }));
        }
        fs.writeFileSync(path.join(output, 'cleanup.json'), JSON.stringify({ syntheticGoogleAccounts: accounts.length, anonymousMediaIdentities: anonymous.length,
            mediaFiles: assets.length, mediaJobs: jobs.length, passed: !errors.length, errors, emailsSent: 0, productionDeploymentChanged: false }, null, 2));
        if (errors.length) failure = Error((failure?.message || 'Check complete') + '; synthetic cleanup needs attention: ' + errors.join(', '));
    }
    if (failure) throw failure;
    console.log('PASS: ' + checks.length + ' real development media-transfer checks; synthetic accounts, records and files removed; no emails or generation.');
}
run().catch(e => { console.error(e.message); process.exitCode = 1; });
