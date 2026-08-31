const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_PROJECT_URL = 'https://mkcmdbzcihjgidjuypqe.supabase.co';
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_SECONDS = 90;
const MAX_BODY_BYTES = 200;

const defaultRuntime = Object.freeze({ createClient });
let runtime = { ...defaultRuntime };

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
            'X-Content-Type-Options': 'nosniff'
        },
        body: JSON.stringify(body)
    };
}

function requestHost(event) {
    return String(
        event.headers?.['x-forwarded-host'] || event.headers?.host || ''
    ).split(',')[0].trim().toLowerCase();
}

function isSameOrigin(event) {
    const origin = event.headers?.origin || event.headers?.Origin;
    const host = requestHost(event);
    if (!origin || !host) return false;
    try {
        return new URL(origin).host.toLowerCase() === host;
    } catch (error) {
        return false;
    }
}

function parseHeartbeat(event) {
    if (
        typeof event.body !== 'string' ||
        Buffer.byteLength(event.body) > MAX_BODY_BYTES
    ) {
        return null;
    }
    try {
        const body = JSON.parse(event.body);
        if (
            !body ||
            typeof body !== 'object' ||
            Array.isArray(body) ||
            Object.keys(body).length !== 1 ||
            !SESSION_ID_PATTERN.test(body.sessionId || '')
        ) {
            return null;
        }
        return body.sessionId.toLowerCase();
    } catch (error) {
        return null;
    }
}

function hashSessionId(sessionId) {
    return crypto.createHash('sha256').update(sessionId).digest('hex');
}

function bucketForCount(value) {
    const count = Number.isFinite(Number(value))
        ? Math.max(0, Math.floor(Number(value)))
        : 0;
    if (count === 0) return { key: 'quiet', label: null };
    if (count === 1) return { key: 'one', label: '1' };
    if (count <= 3) return { key: 'two_to_three', label: '2–3' };
    if (count <= 6) return { key: 'four_to_six', label: '4–6' };
    if (count <= 10) return { key: 'seven_to_ten', label: '7–10' };
    return { key: 'more_than_ten', label: '10+' };
}

function getAdminClient() {
    const serviceKey = process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('Live presence storage is not configured');

    return runtime.createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || SUPABASE_PROJECT_URL,
        serviceKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    );
}

async function readPresence(sessionHash = null) {
    const client = getAdminClient();
    const { data, error } = await client.rpc('touch_live_game_presence', {
        p_session_hash: sessionHash,
        p_active_seconds: ACTIVE_SECONDS
    });
    if (error) throw error;
    return bucketForCount(data);
}

async function handler(event) {
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }

    let sessionHash = null;
    if (event.httpMethod === 'POST') {
        if (!isSameOrigin(event)) {
            return json(403, { error: 'Forbidden' });
        }
        const sessionId = parseHeartbeat(event);
        if (!sessionId) {
            return json(400, { error: 'Invalid heartbeat' });
        }
        sessionHash = hashSessionId(sessionId);
    }

    try {
        const bucket = await readPresence(sessionHash);
        return json(200, {
            status: bucket.key,
            range: bucket.label,
            activeWindowSeconds: ACTIVE_SECONDS,
            approximate: true
        });
    } catch (error) {
        console.error('[Live presence] Storage unavailable', error?.code || 'unknown');
        return json(503, { error: 'Live presence unavailable' });
    }
}

module.exports = {
    handler,
    _internal: {
        ACTIVE_SECONDS,
        bucketForCount,
        hashSessionId,
        isSameOrigin,
        parseHeartbeat,
        setRuntime(overrides = {}) {
            runtime = { ...runtime, ...overrides };
        },
        resetRuntime() {
            runtime = { ...defaultRuntime };
        }
    }
};
