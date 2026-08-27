const { createClient } = require('@supabase/supabase-js');

const SUPABASE_PROJECT_URL = 'https://mkcmdbzcihjgidjuypqe.supabase.co';
const MAX_BODY_BYTES = 1200;
const RELEASE_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const EXPECTED_KEYS_V1 = new Set([
    'schemaVersion',
    'adultConfirmed',
    'audienceRole',
    'journey',
    'overall',
    'bestPart',
    'nextImprovement',
    'recommendation'
]);
const EXPECTED_KEYS_V2 = new Set([
    ...EXPECTED_KEYS_V1,
    'discoverySource',
    'tryReason'
]);
const ALLOWED = Object.freeze({
    audienceRole: new Set(['adult_player', 'parent_guardian', 'educator', 'other_adult']),
    journey: new Set(['not_started', 'started', 'hatched', 'explored', 'restored']),
    overall: new Set(['loved_it', 'promising', 'confusing', 'could_not_start']),
    bestPart: new Set(['creature', 'world_story', 'exploration_action', 'building_choices', 'nasa_stem', 'not_sure']),
    nextImprovement: new Set(['creature_visibility', 'instructions', 'controls', 'phone_layout', 'performance', 'story_clarity', 'more_content', 'nothing_yet']),
    recommendation: new Set(['yes', 'maybe', 'no'])
});
const DISCOVERY_SOURCES = new Set([
    'friend_family', 'search', 'social_video', 'school_library_club',
    'website_creator', 'knew_founder_studio', 'not_sure'
]);
const TRY_REASONS = new Set([
    'creature_hatch', 'world_story', 'missions_action', 'nasa_stem',
    'free_easy_start', 'father_son_story', 'hatch_invitation', 'not_sure'
]);

const defaultRuntime = Object.freeze({ createClient });
let runtime = { ...defaultRuntime };

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        },
        body: JSON.stringify(body)
    };
}

function isSameOrigin(event) {
    const origin = event.headers?.origin || event.headers?.Origin;
    const host = event.headers?.['x-forwarded-host'] || event.headers?.host;
    if (!origin || !host) return false;
    try {
        return new URL(origin).host === String(host).split(',')[0].trim();
    } catch (error) {
        return false;
    }
}

function parseBody(event) {
    if (typeof event.body !== 'string' || Buffer.byteLength(event.body) > MAX_BODY_BYTES) return null;
    try {
        return JSON.parse(event.body);
    } catch (error) {
        return null;
    }
}

function validateFeedback(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const keys = Object.keys(value);
    const expectedKeys = value.schemaVersion === 1
        ? EXPECTED_KEYS_V1
        : value.schemaVersion === 2
            ? EXPECTED_KEYS_V2
            : null;
    if (!expectedKeys || keys.length !== expectedKeys.size || !keys.every(key => expectedKeys.has(key))) return null;
    if (value.adultConfirmed !== true) return null;
    for (const [field, choices] of Object.entries(ALLOWED)) {
        if (!choices.has(value[field])) return null;
    }
    if (value.schemaVersion === 2 && (
        !DISCOVERY_SOURCES.has(value.discoverySource) ||
        !TRY_REASONS.has(value.tryReason)
    )) return null;
    return {
        audience_role: value.audienceRole,
        discovery_source: value.schemaVersion === 2 ? value.discoverySource : 'not_asked',
        try_reason: value.schemaVersion === 2 ? value.tryReason : 'not_asked',
        journey: value.journey,
        overall: value.overall,
        best_part: value.bestPart,
        next_improvement: value.nextImprovement,
        recommendation: value.recommendation,
        release_id: getReleaseId()
    };
}

function getReleaseId() {
    const value = process.env.DEPLOY_ID || process.env.COMMIT_REF || 'unknown';
    return RELEASE_PATTERN.test(value) ? value : 'unknown';
}

function getAdminClient() {
    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('Adult feedback storage is not configured');
    return runtime.createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || SUPABASE_PROJECT_URL,
        serviceKey,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
}

async function handler(event) {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!isSameOrigin(event)) return json(403, { error: 'Forbidden' });

    const row = validateFeedback(parseBody(event));
    if (!row) return json(400, { error: 'Invalid adult feedback' });

    try {
        const adminClient = getAdminClient();
        const { error } = await adminClient.from('adult_feedback_pulses').insert(row);
        if (error) throw error;
        return json(201, { accepted: true });
    } catch (error) {
        console.error('[AdultFeedback] Storage unavailable', error?.code || 'unknown');
        return json(503, { error: 'Adult feedback storage unavailable' });
    }
}

module.exports = {
    handler,
    _internal: {
        validateFeedback,
        isSameOrigin,
        setRuntime(overrides = {}) { runtime = { ...runtime, ...overrides }; },
        resetRuntime() { runtime = { ...defaultRuntime }; }
    }
};
