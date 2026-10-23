const { createHandler } = require('../../cloudrun/adult-accounts/core.cjs');
const { fail } = require('../../cloudrun/adult-accounts/snapshot.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = n => ({ id: id(n), email: `adult-${n}@example.test`, isAnonymous: false, emailVerified: true });
class Storage {
    constructor() { this.map = new Map(); }
    get length() { return this.map.size; }
    key(i) { return [...this.map.keys()][i] ?? null; }
    getItem(k) { return this.map.get(k) ?? null; }
    setItem(k, v) { this.map.set(k, String(v)); }
    removeItem(k) { this.map.delete(k); }
}
function server() {
    const rows = new Map(), admitted = new Set([id(1), id(2)]), tokens = new Map([
        ['adult-token-1', user(1)], ['adult-token-2', user(2)],
        ['anonymous-token', { id: id(3), isAnonymous: true }]
    ]);
    const store = {
        async consent(uid) { admitted.add(uid); return { accepted: true }; },
        async requireAccount(uid) { if (!admitted.has(uid)) throw fail('adult_declaration_required', 403); },
        async list(uid) { return { adventures: [...rows.values()].filter(r => r.account_id === uid && !r.removed_at)
            .map(r => ({ id: r.id, revision: r.revision, display_name: r.display_name, updated_at: r.updated_at })) }; },
        async read(uid, key) {
            const r = rows.get(`${uid}/${key}`);
            if (!r) throw fail('adventure_not_found', 404);
            if (r.removed_at) throw fail('adventure_removed', 410);
            return { adventure: r, mediaOwners: r.mediaOwners || [] };
        },
        async save(uid, p, owner) {
            const key = `${uid}/${p.id}`, row = rows.get(key);
            if (row?.removed_at) throw fail('adventure_removed', 410);
            if (row?.operation_id === p.operationId) return { id: p.id, revision: row.revision, operationId: p.operationId };
            if ((row?.revision || 0) !== p.revision) throw fail('adventure_changed', 409);
            const next = { account_id: uid, id: p.id, revision: p.revision + 1, operation_id: p.operationId,
                game_state: p.state, display_name: p.state.creature.name, updated_at: new Date().toISOString(),
                removed_at: null, mediaOwners: [...new Set([...(row?.mediaOwners || []), ...(owner ? [owner] : [])])] };
            rows.set(key, next); return { id: p.id, revision: next.revision, operationId: p.operationId };
        },
        async remove(uid, key, revision) {
            const row = rows.get(`${uid}/${key}`);
            if (!row || row.revision !== revision) throw fail('adventure_changed', 409);
            Object.assign(row, { game_state: null, removed_at: Date.now(), revision: row.revision + 1 });
            return { removed: true };
        },
        async erase(uid) { for (const [key, row] of rows) if (row.account_id === uid) rows.delete(key); admitted.delete(uid); }
    };
    const auth = { verifyIdToken: jest.fn(async token => {
        const u = tokens.get(token); if (!u) throw Error('revoked');
        return { uid: u.id, email_verified: u.emailVerified === true, auth_time: Date.now() / 1000,
            firebase: { sign_in_provider: u.isAnonymous ? 'anonymous' : 'password' } };
    }), deleteUser: jest.fn(async uid => { for (const [token, u] of tokens) if (u.id === uid) tokens.delete(token); }) };
    const handle = createHandler({ store, auth, allowedOrigins: ['https://game.example.test'],
        verifyMediaOwner: async token => tokens.get(token)?.isAnonymous ? tokens.get(token).id : null });
    const fetcher = jest.fn(async (url, options) => {
        const u = new URL(url, 'https://game.example.test');
        const result = await handle({ method: options.method, origin: 'https://game.example.test',
            authorization: options.headers.Authorization, query: Object.fromEntries(u.searchParams), body: options.body });
        return { ok: result.status < 400, status: result.status, json: async () => JSON.parse(result.body) };
    });
    return { fetcher, rows, admitted, tokens, store, auth };
}
function authClient(account = 1, signedIn = true) {
    let session = signedIn ? { access_token: `adult-token-${account}`, user: user(account) } : null;
    const listeners = new Set();
    const publish = event => listeners.forEach(fn => fn(event, session));
    const auth = {
        onAuthStateChange: fn => { listeners.add(fn); return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }; },
        hasPendingLink: jest.fn(() => false), pendingEmail: jest.fn(() => ''),
        getSession: jest.fn(async () => ({ data: { session } })),
        requestEmailLink: jest.fn(async () => ({})),
        completeEmailLink: jest.fn(async () => {
            session = { access_token: `adult-token-${account}`, user: user(account) }; publish('SIGNED_IN');
            return { data: { session, user: session.user } };
        }),
        signOut: jest.fn(async () => { session = null; publish('SIGNED_OUT'); return {}; }),
        stopAutoRefresh: jest.fn()
    };
    return { auth, switchUser(next) { session = next ? { access_token: `adult-token-${next}`, user: user(next) } : null; publish('SIGNED_IN'); } };
}
module.exports = { id, user, Storage, server, authClient };
