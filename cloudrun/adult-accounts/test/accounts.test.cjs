const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { FirestoreAdultStore } = require('../store.cjs');
const { createHandler } = require('../core.cjs');
const { sanitizeSnapshot, fail } = require('../snapshot.cjs');
const project = 'demo-mythical-adult';
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST.startsWith('127.0.0.1:') ||
    !process.env.FIRESTORE_EMULATOR_HOST.startsWith('127.0.0.1:')) throw Error('Isolated local emulators are required');
const origin = 'http://127.0.0.1:8145';
let app, auth, db, store, handle, adults;
const anonymousOwner = '00000000-0000-4000-8000-000000000099';
const snapshot = (name = 'Test Fern') => ({ version: '1.0', savedAt: Date.now(), creature: { name, hatched: true } });
async function identity(method, body) {
    const r = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=emulator-only`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await r.json(); if (!r.ok) throw Error('Emulated auth request failed: ' + method); return data;
}
async function emailSignIn(email) {
    await identity('sendOobCode', { requestType: 'EMAIL_SIGNIN', email, continueUrl: origin + '/play/', canHandleCodeInApp: true });
    const codes = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${project}/oobCodes`)).json();
    const code = codes.oobCodes.filter(c => c.email === email).at(-1);
    assert(code?.oobCode);
    return identity('signInWithEmailLink', { email, oobCode: code.oobCode });
}
async function call(user, action, values = {}, method = 'POST', handler = handle) {
    const r = await handler({ method, origin, authorization: `Bearer ${user.idToken}`, query: { action, ...values }, body: JSON.stringify({ action, ...values }) });
    return { status: r.status, data: r.body ? JSON.parse(r.body) : null, headers: r.headers };
}
async function save(user, values = {}) {
    return call(user, 'save', { id: randomUUID(), revision: 0, operationId: randomUUID(), state: snapshot(), ...values });
}
before(async () => {
    app = initializeApp({ projectId: project }, 'account-emulator-tests'); auth = getAuth(app); db = getFirestore(app);
    store = new FirestoreAdultStore(db);
    handle = createHandler({ store, auth, allowedOrigins: [origin], verifyMediaOwner: async token => {
        if (token !== 'synthetic-anonymous-proof') throw fail('media_identity_not_owned', 403);
        return anonymousOwner;
    } });
    adults = await Promise.all(['adult-one@example.test', 'adult-two@example.test'].map(emailSignIn));
});
after(async () => { await db.terminate(); await deleteApp(app); });

test('real email-link sign-in verifies ownership and still requires an adult declaration', async () => {
    const decoded = await auth.verifyIdToken(adults[0].idToken, true);
    assert.equal(decoded.email_verified, true); assert.equal(decoded.firebase.sign_in_provider, 'password');
    assert.equal((await call(adults[0], 'list', {}, 'GET')).status, 403);
    assert.equal((await call(adults[0], 'consent', { adultDeclared: false, policyVersion: '2026-10-23' })).status, 403);
    for (const adult of adults) assert.equal((await call(adult, 'consent', { adultDeclared: true, policyVersion: '2026-10-23' })).status, 200);
    assert.deepEqual(Object.keys((await store.account(decoded.uid).get()).data()).sort(), ['activeCount', 'adultDeclared', 'declaredAt', 'policyVersion']);
});
test('anonymous and unverified identities cannot create account saves', async () => {
    const anonymous = await identity('signUp', { returnSecureToken: true });
    const unverified = await identity('signUp', { email: 'unverified@example.test', password: 'synthetic-test-password-only', returnSecureToken: true });
    for (const user of [anonymous, unverified, { idToken: 'forged' }]) assert.equal((await save(user)).status, 401);
});
test('another device can read a selected adventure; another account cannot', async () => {
    const created = await save(adults[0]); assert.equal(created.status, 200);
    const id = created.data.id;
    const secondDevice = await emailSignIn('adult-one@example.test');
    const read = await call(secondDevice, 'read', { id }, 'GET');
    assert.equal(read.status, 200); assert.equal(read.data.adventure.game_state.creature.name, 'Test Fern');
    assert.equal((await call(adults[1], 'read', { id, accountId: adults[0].localId }, 'GET')).status, 404);
    assert.equal((await call(adults[1], 'remove', { id, revision: 1, accountId: adults[0].localId })).status, 409);
    const list = await call(adults[0], 'list', {}, 'GET');
    assert(!('game_state' in list.data.adventures[0])); assert(!('mediaOwners' in read.data));
});
test('concurrent device saves cannot overwrite the same revision', async () => {
    const created = await save(adults[0]); const id = created.data.id;
    const results = await Promise.all(['Test Moss', 'Test Comet'].map(name => save(adults[0], { id, revision: 1, state: snapshot(name) })));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const read = await store.read(adults[0].localId, id); assert.equal(read.adventure.revision, 2);
});
test('lost responses are idempotent and changed retry payloads are rejected', async () => {
    const values = { id: randomUUID(), operationId: randomUUID(), state: snapshot() };
    const first = await save(adults[0], values), retry = await save(adults[0], values);
    assert.deepEqual(retry, first);
    const changed = await save(adults[0], { ...values, state: snapshot('Test Different') }); assert.equal(changed.status, 409);
});
test('large Unicode snapshots round-trip across Firestore document chunks', async () => {
    const state = snapshot(); state.history = '🌿'.repeat(300000);
    const created = await save(adults[0], { state }); assert.equal(created.status, 200);
    const read = await store.read(adults[0].localId, created.data.id);
    assert.equal(read.adventure.game_state.history, state.history);
    const row = (await store.adventure(adults[0].localId, created.data.id).get()).data(); assert(row.chunks > 1);
    state.history = 'x'.repeat(2097153);
    assert.equal((await save(adults[0], { state })).status, 413);
});
test('server strips private player fields and temporary media URLs', async () => {
    const state = { ...snapshot(), session: { access_token: 'synthetic-token' }, safety: { pinHash: 'synthetic-pin' },
        creature: { name: 'Test Fern', email: 'synthetic@example.test', media: { assetRef: 'portrait-job-v1:' + randomUUID(), imageUrl: 'https://example.test/temporary', expiresAt: 3 } } };
    const created = await save(adults[0], { state }); assert.equal(created.status, 200);
    const read = (await store.read(adults[0].localId, created.data.id)).adventure.game_state;
    assert.equal(read.session, undefined); assert.equal(read.safety, undefined); assert.equal(read.creature.email, undefined);
    assert.equal(read.creature.media.imageUrl, undefined); assert(read.creature.media.assetRef);
    assert.throws(() => sanitizeSnapshot({ ...snapshot(), nested: JSON.parse('{"__proto__":{"email":"synthetic@example.test"}}'), creature: null }));
});
test('media access requires a verified anonymous proof and an exact saved reference', async () => {
    const jobId = randomUUID(), state = snapshot(); state.creature.portrait = { assetRef: 'portrait-job-v1:' + jobId };
    assert.equal((await save(adults[0], { state, mediaOwnerToken: 'forged-proof' })).status, 403);
    const created = await save(adults[0], { state, mediaOwnerToken: 'synthetic-anonymous-proof' });
    const allowed = await call(adults[0], 'authorize-media', { id: created.data.id, jobId, kind: 'portrait' }, 'GET');
    assert.deepEqual(allowed.data, { mediaOwners: [anonymousOwner] });
    assert.equal((await call(adults[0], 'authorize-media', { id: created.data.id, jobId: randomUUID(), kind: 'portrait' }, 'GET')).status, 403);
    assert.equal((await call(adults[1], 'authorize-media', { id: created.data.id, jobId, kind: 'portrait' }, 'GET')).status, 404);
});
test('removed copies cannot be resurrected by stale devices and no payload remains', async () => {
    const created = await save(adults[0]), id = created.data.id;
    assert.equal((await call(adults[0], 'remove', { id, revision: 1 })).status, 200);
    assert.equal((await save(adults[0], { id, revision: 1 })).status, 410);
    assert.equal((await save(adults[0], { id, revision: 0 })).status, 410);
    assert.equal((await store.adventure(adults[0].localId, id).collection('payload').get()).size, 0);
});
test('untrusted origins are denied and provider errors are never returned', async () => {
    const denied = await handle({ method: 'POST', origin: 'https://untrusted.example.test' }); assert.equal(denied.status, 403);
    const broken = createHandler({ store: { requireAccount: async () => { throw Error('synthetic@example.test private detail'); } }, auth, allowedOrigins: [origin] });
    const result = await call(adults[0], 'list', {}, 'GET', broken);
    assert.equal(result.status, 503); assert.deepEqual(result.data, { error: 'accounts_unavailable' });
});
test('direct browser Firestore writes are denied even with a verified adult token', async () => {
    const r = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents/adultAccounts/${adults[0].localId}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${adults[0].idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { adultDeclared: { booleanValue: true } } })
    });
    assert.equal(r.status, 403);
});
test('deletion requires a recent sign-in, erases copies and revokes the email identity', async () => {
    const adult = await emailSignIn('deletion@example.test');
    await call(adult, 'consent', { adultDeclared: true, policyVersion: '2026-10-23' }); await save(adult);
    const older = createHandler({ store, auth, allowedOrigins: [origin], now: () => Date.now() + 301000 });
    assert.equal((await call(adult, 'delete-account', { confirm: 'delete-account' }, 'POST', older)).status, 401);
    assert.equal((await call(adult, 'delete-account', { confirm: 'delete-account' })).status, 200);
    assert.equal((await store.account(adult.localId).collection('adventures').get()).size, 0);
    await assert.rejects(auth.getUser(adult.localId), { code: 'auth/user-not-found' });
    assert.equal((await save(adult)).status, 401);
});

test('library limits are atomic and removing one copy makes room without reviving it', async () => {
    const adult = await emailSignIn('library-limit@example.test');
    await call(adult, 'consent', { adultDeclared: true, policyVersion: '2026-10-23' });
    let first;
    for (let i = 0; i < 50; i++) { const r = await save(adult); assert.equal(r.status, 200); first ||= r.data.id; }
    assert.equal((await save(adult)).data.error, 'library_full');
    assert.equal((await call(adult, 'list', {}, 'GET')).data.adventures.length, 50);
    await call(adult, 'remove', { id: first, revision: 1 });
    assert.equal((await save(adult)).status, 200);
    assert.equal((await save(adult, { id: first })).status, 410);
});
test('a failed identity deletion stays fenced and can safely finish on retry', async () => {
    const adult = await emailSignIn('delete-retry@example.test');
    await call(adult, 'consent', { adultDeclared: true, policyVersion: '2026-10-23' }); await save(adult);
    const flaky = createHandler({ store, auth: { verifyIdToken: (...args) => auth.verifyIdToken(...args),
        deleteUser: async () => { throw Error('synthetic provider outage'); } }, allowedOrigins: [origin] });
    assert.equal((await call(adult, 'delete-account', { confirm: 'delete-account' }, 'POST', flaky)).status, 503);
    assert.equal((await call(adult, 'consent', { adultDeclared: true, policyVersion: '2026-10-23' })).status, 401);
    assert.equal((await save(adult)).status, 401);
    assert.equal((await call(adult, 'delete-account', { confirm: 'delete-account' })).status, 200);
    await assert.rejects(auth.getUser(adult.localId), { code: 'auth/user-not-found' });
});
test('shrinking a chunked adventure removes the unused payload documents', async () => {
    const big = { ...snapshot(), history: 'x'.repeat(900000) };
    const made = await save(adults[1], { state: big }); assert.equal(made.status, 200);
    const smaller = await save(adults[1], { id: made.data.id, revision: 1 }); assert.equal(smaller.status, 200);
    assert.equal((await store.adventure(adults[1].localId, made.data.id).collection('payload').get()).size, 1);
    assert.equal((await store.read(adults[1].localId, made.data.id)).adventure.game_state.history, undefined);
});
