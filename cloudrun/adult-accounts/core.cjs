const { UUID, UID, POLICY, fail, sanitizeSnapshot, referencedMedia } = require('./snapshot.cjs');
function createHandler({ store, auth, verifyMediaOwner, allowedOrigins, now = () => Date.now() }) {
    const recent = new Map();
    return async event => {
        const origin = event.origin;
        const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin' };
        const reply = (status, body) => ({ status, headers, body: body === null ? '' : JSON.stringify(body) });
        if (!allowedOrigins.includes(origin)) return reply(403, { error: 'origin_denied' });
        headers['Access-Control-Allow-Origin'] = origin;
        if (event.method === 'OPTIONS') {
            Object.assign(headers, { 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Max-Age': '600' });
            return reply(204, null);
        }
        if (!['GET', 'POST'].includes(event.method)) return reply(405, { error: 'method_not_allowed' });
        try {
            const token = event.authorization?.match(/^Bearer ([^\s]{1,16384})$/)?.[1];
            if (!token) throw fail('sign_in_required', 401);
            let user;
            try { user = await auth.verifyIdToken(token, true); } catch { throw fail('sign_in_required', 401); }
            if (!UID.test(user.uid || '') || user.email_verified !== true ||
                user.firebase?.sign_in_provider !== 'password') throw fail('verified_email_required', 401);
            const time = now(), count = recent.get(user.uid);
            if (count?.until > time && count.requests >= 180) throw fail('try_again_later', 429);
            recent.set(user.uid, count?.until > time ? { ...count, requests: count.requests + 1 } : { requests: 1, until: time + 60000 });
            if (recent.size > 1000) for (const [id, value] of recent) if (value.until <= time) recent.delete(id);
            let body = event.query || {};
            if (event.method === 'POST') {
                if (typeof event.body !== 'string' || Buffer.byteLength(event.body) > 2200000) throw fail('request_too_large', 413);
                try { body = JSON.parse(event.body); } catch { throw fail('invalid_request'); }
            }
            if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('invalid_request');
            const uid = user.uid; // Never accept an account id supplied by the client.
            if (body.action === 'consent' && event.method === 'POST') {
                if (body.adultDeclared !== true || body.policyVersion !== POLICY) throw fail('adult_declaration_required', 403);
                return reply(200, await store.consent(uid));
            }
            if (body.action === 'delete-account' && event.method === 'POST') {
                if (body.confirm !== 'delete-account') throw fail('confirmation_required');
                if (!Number.isFinite(user.auth_time) || now() / 1000 - user.auth_time > 300) throw fail('recent_sign_in_required', 401);
                await store.erase(uid);
                try { await auth.deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
                return reply(200, { deleted: true });
            }
            await store.requireAccount(uid);
            if (body.action === 'list' && event.method === 'GET') return reply(200, await store.list(uid));
            if (!UUID.test(body.id || '')) throw fail('invalid_adventure');
            if (body.action === 'read' && event.method === 'GET') {
                return reply(200, { adventure: (await store.read(uid, body.id)).adventure });
            }
            if (body.action === 'authorize-media' && event.method === 'GET') {
                if (!UUID.test(body.jobId || '') || !['portrait', 'video'].includes(body.kind)) throw fail('invalid_request');
                const result = await store.read(uid, body.id);
                if (!referencedMedia(result.adventure.game_state, body.jobId, body.kind) || !result.mediaOwners.length) {
                    throw fail('account_media_unavailable', 403);
                }
                return reply(200, { mediaOwners: result.mediaOwners });
            }
            if (event.method !== 'POST' || !Number.isSafeInteger(body.revision) || body.revision < 0) throw fail('invalid_request');
            if (body.action === 'remove') return reply(200, await store.remove(uid, body.id, body.revision));
            if (body.action !== 'save' || !UUID.test(body.operationId || '')) throw fail('invalid_request');
            const state = sanitizeSnapshot(body.state);
            let ownerId = null;
            if (body.mediaOwnerToken) {
                if (typeof body.mediaOwnerToken !== 'string' || body.mediaOwnerToken.length > 16384) throw fail('invalid_media_identity');
                ownerId = await verifyMediaOwner(body.mediaOwnerToken);
                if (!UUID.test(ownerId || '')) throw fail('media_identity_not_owned', 403);
            }
            return reply(200, await store.save(uid, { id: body.id, revision: body.revision,
                operationId: body.operationId, state }, ownerId));
        } catch (error) {
            // Firebase/provider errors can contain email addresses. Never log or echo them.
            return reply(error.publicError ? error.status : 503, { error: error.publicError ? error.code : 'accounts_unavailable' });
        }
    };
}
module.exports = { createHandler };
