const { createHash } = require('node:crypto');
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const POLICY = '2026-10-23';
const MAX_BYTES = 2 * 1024 * 1024;
const fail = (code, status = 400) => Object.assign(new Error(code), { code, status, publicError: true });
function sanitizeSnapshot(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        typeof input.version !== 'string' || !Number.isFinite(input.savedAt) ||
        !input.creature || typeof input.creature !== 'object') throw fail('invalid_adventure');
    const state = JSON.parse(JSON.stringify(input));
    const privateKeys = new Set(['session', 'safety', 'email', 'password', 'access_token', 'refresh_token',
        'accessToken', 'refreshToken', 'pinHash', 'lastVerified', 'auditLog', 'deletionLog', '__proto__', 'constructor']);
    function scrub(value, depth = 0) {
        if (depth > 80) throw fail('invalid_adventure');
        if (!value || typeof value !== 'object') return;
        for (const key of Object.keys(value)) {
            if (privateKeys.has(key) || (value.assetRef && ['imageUrl', 'videoUrl', 'expiresAt'].includes(key))) delete value[key];
            else scrub(value[key], depth + 1);
        }
    }
    scrub(state);
    if (Buffer.byteLength(JSON.stringify(state)) > MAX_BYTES) throw fail('adventure_too_large', 413);
    return state;
}
const digest = value => createHash('sha256').update(value).digest('hex');
function referencedMedia(state, jobId, kind) {
    const ref = (kind === 'portrait' ? 'portrait-job-v1:' : 'video-job-v1:') + jobId;
    function visit(value) {
        if (!value || typeof value !== 'object') return false;
        if (value.assetRef === ref) return true;
        return Object.values(value).some(visit);
    }
    return visit(state);
}
module.exports = { UUID, UID, POLICY, MAX_BYTES, fail, sanitizeSnapshot, digest, referencedMedia };
