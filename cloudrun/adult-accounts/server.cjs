const http = require('node:http');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { FirestoreAdultStore } = require('./store.cjs');
const { createHandler } = require('./core.cjs');
const { fail } = require('./snapshot.cjs');
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
if (!['mythical-void-dev-eu', 'mythical-void-prod', 'demo-mythical-adult'].includes(projectId)) throw Error('Explicit Mythical Void project required');
if (process.env.NODE_ENV === 'production' && (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)) throw Error('Emulators are forbidden in production');
const allowedOrigins = (process.env.ADULT_ACCOUNT_ALLOWED_ORIGINS || '').split(',').filter(Boolean);
if (!allowedOrigins.length || allowedOrigins.some(x => !/^https:\/\//.test(x) && !(projectId.startsWith('demo-') && /^http:\/\/127\.0\.0\.1:\d+$/.test(x)))) throw Error('Explicit HTTPS origins required');
const app = initializeApp({ projectId });
const auth = getAuth(app), db = getFirestore(app);
const handle = createHandler({ auth, store: new FirestoreAdultStore(db), allowedOrigins,
    verifyMediaOwner: async token => {
        const url = process.env.LEGACY_MEDIA_AUTH_URL, key = process.env.LEGACY_MEDIA_PUBLISHABLE_KEY;
        if (url !== 'https://mkcmdbzcihjgidjuypqe.supabase.co' || !key) throw fail('media_identity_unavailable', 503);
        // Only the adventure's existing anonymous media token goes to its existing provider.
        // Firebase email identities/tokens are never sent to that provider.
        const response = await fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: `Bearer ${token}` },
            redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw fail('media_identity_not_owned', 403);
        const user = await response.json();
        return user.is_anonymous === true ? user.id : null;
    }
});
const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://service.internal');
    if (url.pathname === '/healthz') { response.writeHead(200, { 'Cache-Control': 'no-store' }); response.end('ok'); return; }
    if (url.pathname !== '/v1/adventures' || process.env.ENABLE_ADULT_ACCOUNTS !== 'true') { response.writeHead(404); response.end(); return; }
    let bytes = 0; const chunks = [];
    try {
        for await (const chunk of request) {
            bytes += chunk.length;
            if (bytes > 2200000) { response.writeHead(413); response.end(); return; }
            chunks.push(chunk);
        }
        const result = await handle({ method: request.method, origin: request.headers.origin,
            authorization: request.headers.authorization, query: Object.fromEntries(url.searchParams), body: Buffer.concat(chunks).toString() });
        response.writeHead(result.status, result.headers); response.end(result.body);
    } catch { response.writeHead(503, { 'Cache-Control': 'no-store' }); response.end('{"error":"accounts_unavailable"}'); }
});
server.listen(Number(process.env.PORT || 8080), process.env.K_SERVICE ? '0.0.0.0' : '127.0.0.1', () => console.log('Mythical Void adult account service ready'));
for (const event of ['SIGTERM', 'SIGINT']) process.once(event, () => server.close(() => process.exit(0)));
