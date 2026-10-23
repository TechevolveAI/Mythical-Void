// Development integration only. No emails are sent. Only this run's synthetic user/data are removed.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const project = 'mythical-void-dev-eu';
const origin = 'https://mythical-void-frontend-preview-wihawqqnka-ew.a.run.app';
const service = fs.readFileSync('.visual-review/adult-firebase/service-url.txt', 'utf8').trim();
assert.equal(new URL(service).hostname, 'mythical-void-adult-accounts-dev-wihawqqnka-ew.a.run.app');
(async () => {
    const checks = []; // Google reserves /healthz at its edge; probe the actual API route.
    const denied = await fetch(service + '/v1/adventures?action=list', { headers: { Origin: origin }, signal: AbortSignal.timeout(30000) });
    assert.equal(denied.status, 401); checks.push('unauthenticated-data-denied');
    const cors = await fetch(service + '/v1/adventures?action=list', { headers: { Origin: 'https://untrusted.example.test' }, signal: AbortSignal.timeout(30000) });
    assert.equal(cors.status, 403); checks.push('untrusted-origin-denied');
    if (!process.argv.includes('--synthetic-account')) { console.log(JSON.stringify({ checks })); return; }
    const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
    async function admin(url, body, method = 'POST') {
        const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token,
            'x-goog-user-project': project, 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
        const d = r.status === 204 ? {} : await r.json();
        if (!r.ok) { const e = Error(`Development admin operation failed: ${r.status} ${d.error?.status || ''}`); e.status = r.status; throw e; }
        return d;
    }
    const key = fs.readFileSync('.env.local', 'utf8').match(/^VITE_FIREBASE_API_KEY=(.+)$/m)?.[1]; assert(key);
    const uid = 'adult-dev-smoke-' + randomBytes(10).toString('hex'), adventureId = randomUUID();
    const email = uid + '@example.test', password = randomBytes(32).toString('base64url');
    const adminBase = 'https://identitytoolkit.googleapis.com/v1/projects/' + project;
    let created = false, deleted = false, idToken;
    try {
        await admin(adminBase + '/accounts', { localId: uid, email, emailVerified: true, password }); created = true;
        const login = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(key), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }), signal: AbortSignal.timeout(30000) });
        const session = await login.json(); assert.equal(login.status, 200, 'synthetic sign-in failed'); assert.equal(session.localId, uid); idToken = session.idToken;
        const call = async (action, values = {}, read = false) => {
            const query = new URLSearchParams({ action, ...values });
            const r = await fetch(service + '/v1/adventures' + (read ? '?' + query : ''), { method: read ? 'GET' : 'POST',
                headers: { Origin: origin, Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json' },
                ...(read ? {} : { body: JSON.stringify({ action, ...values }) }), signal: AbortSignal.timeout(30000) });
            return { status: r.status, data: await r.json() };
        };
        assert.equal((await call('list', {}, true)).status, 403); checks.push('adult-declaration-required');
        assert.equal((await call('consent', { adultDeclared: true, policyVersion: '2026-10-23' })).status, 200); checks.push('adult-declaration');
        const state = { version: '1.0', savedAt: Date.now(), creature: { name: 'Synthetic Cloud Fern', hatched: true } };
        const saved = await call('save', { id: adventureId, revision: 0, operationId: randomUUID(), state });
        assert.equal(saved.status, 200, 'development save failed: ' + saved.data.error); checks.push('service-identity-firestore-write');
        const read = await call('read', { id: adventureId }, true); assert.equal(read.status, 200); assert.deepEqual(read.data.adventure.game_state, state); checks.push('firestore-round-trip');
        assert.equal((await call('save', { id: adventureId, revision: 0, operationId: randomUUID(), state })).status, 409); checks.push('stale-save-denied');
        const erased = await call('delete-account', { confirm: 'delete-account' }); assert.equal(erased.status, 200, 'development deletion failed'); deleted = true; checks.push('service-identity-account-deletion');
        assert.equal((await call('list', {}, true)).status, 401); checks.push('deleted-token-denied');
        const info = await admin(adminBase + '/accounts:lookup', { localId: [uid] }); assert.equal(info.users?.length || 0, 0);
        const docs = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/adultAccounts/${uid}`;
        const copies = await admin(docs + '/adventures', null, 'GET'); assert.equal(copies.documents?.length || 0, 0); checks.push('online-copies-erased');
    } finally {
        if (created && !deleted) await admin(adminBase + '/accounts:delete', { localId: uid });
        if (created) {
            const doc = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/adultAccounts/${uid}`;
            // This run can create only one adventure; clean only that exact synthetic record.
            const payload = await admin(doc + '/adventures/' + adventureId + '/payload', null, 'GET');
            for (const row of payload.documents || []) await admin('https://firestore.googleapis.com/v1/' + row.name, null, 'DELETE');
            for (const suffix of ['/adventures/' + adventureId, '']) {
                try { await admin(doc + suffix, null, 'DELETE'); } catch (e) { if (e.status !== 404) throw e; }
            }
        }
    }
    const report = { project, service, checkedAt: new Date().toISOString(), checks, syntheticAccountRemoved: true, emailsSent: 0, productionChanged: false };
    fs.writeFileSync('.visual-review/adult-firebase/cloud-smoke.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
