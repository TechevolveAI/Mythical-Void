const { createClient } = require('@supabase/supabase-js');

const SUPABASE_PROJECT_URL = 'https://mkcmdbzcihjgidjuypqe.supabase.co';
const MAX_BODY_BYTES = 6000;
const MAX_BATCH_SIZE = 10;
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const CATEGORIES = new Set([
    'runtime',
    'scene_transition',
    'persistence',
    'network',
    'stuck_flow'
]);
const CODES = new Set([
    'runtime_uncaught',
    'promise_unhandled',
    'phaser_error',
    'scene_error',
    'scene_loading_timeout',
    'scene_no_active',
    'local_save_failed',
    'local_load_failed',
    'cloud_save_failed',
    'cloud_load_failed',
    'cloud_sync_failed',
    'cloud_sync_stalled',
    'cloud_save_conflict',
    'network_request_failed',
    'game_boot_failed',
    'unknown_critical'
]);
const SEVERITIES = new Set(['warning', 'error']);
const SCENES = new Set([
    'HatchingScene',
    'PersonalityScene',
    'NamingScene',
    'SoulRevealScene',
    'GameScene',
    'ShopScene',
    'InventoryScene',
    'FusionPodScene',
    'BreedingHatchScene',
    'HubWorldScene',
    'CreatureProfileScene',
    'WelcomeBackScene',
    'VoidMiniGameScene',
    'AchievementMenuScene',
    'AbilitySelectionScene',
    'PlatformerLevel',
    'PlatformerLevelScene',
    'MythicalForestLevel',
    'CrystalCavesLevel',
    'ReefLevel',
    'VoidPeaksLevel',
    'AuroraDepthsLevel',
    'FinalVoidLevel',
    'VictoryScene',
    'unknown'
]);
const PHASES = new Set([
    'boot',
    'runtime',
    'start',
    'create',
    'transition',
    'save',
    'load',
    'sync',
    'unknown'
]);
const RECOVERIES = new Set([
    'continued',
    'local_fallback',
    'retry_scheduled',
    'reload_offered',
    'manual_retry',
    'none',
    'unknown'
]);
const CONNECTIVITY = new Set(['online', 'offline', 'unknown']);
const VIEWPORT_CLASSES = new Set(['compact', 'medium', 'wide', 'unknown']);
const EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const EVENT_KEYS = new Set([
    'schema_version',
    'event_id',
    'occurred_at',
    'category',
    'code',
    'severity',
    'scene',
    'phase',
    'recovery',
    'connectivity',
    'viewport_class',
    'user_visible',
    'deployment_id'
]);
const LEGACY_EVENT_KEYS = new Set(
    [...EVENT_KEYS].filter(key => key !== 'deployment_id')
);

const defaultRuntime = Object.freeze({
    createClient,
    now: () => Date.now()
});
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

function getAdminClient() {
    const serviceKey = process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('Observability storage is not configured');

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

function parseBody(event) {
    if (typeof event.body !== 'string' || Buffer.byteLength(event.body) > MAX_BODY_BYTES) {
        return null;
    }
    try {
        return JSON.parse(event.body);
    } catch (error) {
        return null;
    }
}

function isTimestampAllowed(value) {
    if (typeof value !== 'string' || value.length > 30) return false;
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return false;
    const age = runtime.now() - timestamp;
    return age <= MAX_EVENT_AGE_MS && age >= -MAX_CLOCK_SKEW_MS;
}

function validateEvent(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
    const keys = Object.keys(event);
    const currentKeys = keys.length === EVENT_KEYS.size &&
        keys.every(key => EVENT_KEYS.has(key));
    const legacyKeys = keys.length === LEGACY_EVENT_KEYS.size &&
        keys.every(key => LEGACY_EVENT_KEYS.has(key));
    if (!currentKeys && !legacyKeys) {
        return null;
    }
    if (
        event.schema_version !== 1 ||
        !EVENT_ID_PATTERN.test(event.event_id || '') ||
        !isTimestampAllowed(event.occurred_at) ||
        !CATEGORIES.has(event.category) ||
        !CODES.has(event.code) ||
        !SEVERITIES.has(event.severity) ||
        !SCENES.has(event.scene) ||
        !PHASES.has(event.phase) ||
        !RECOVERIES.has(event.recovery) ||
        !CONNECTIVITY.has(event.connectivity) ||
        !VIEWPORT_CLASSES.has(event.viewport_class) ||
        (
            event.deployment_id !== undefined &&
            !DEPLOYMENT_ID_PATTERN.test(event.deployment_id)
        ) ||
        typeof event.user_visible !== 'boolean'
    ) {
        return null;
    }

    return {
        id: event.event_id.toLowerCase(),
        occurred_at: new Date(event.occurred_at).toISOString(),
        category: event.category,
        code: event.code,
        severity: event.severity,
        scene: event.scene,
        phase: event.phase,
        recovery: event.recovery,
        connectivity: event.connectivity,
        viewport_class: event.viewport_class,
        user_visible: event.user_visible,
        deployment_id: event.deployment_id || getDeploymentId()
    };
}

function getDeploymentId() {
    const value = process.env.DEPLOY_ID || process.env.COMMIT_REF || 'unknown';
    return DEPLOYMENT_ID_PATTERN.test(value) ? value : 'unknown';
}

async function handler(event) {
    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }
    if (!isSameOrigin(event)) {
        return json(403, { error: 'Forbidden' });
    }

    const body = parseBody(event);
    if (
        !body ||
        Object.keys(body).length !== 1 ||
        !Array.isArray(body.events) ||
        body.events.length < 1 ||
        body.events.length > MAX_BATCH_SIZE
    ) {
        return json(400, { error: 'Invalid event batch' });
    }

    const rows = body.events.map(validateEvent);
    if (rows.some(row => row === null)) {
        return json(400, { error: 'Invalid event schema' });
    }

    try {
        const adminClient = getAdminClient();
        const { error } = await adminClient
            .from('game_observability_events')
            .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw error;
        return json(202, { accepted: rows.length });
    } catch (error) {
        // Do not log request bodies or error messages that may echo input.
        console.error('[Observability] Storage unavailable', error?.code || 'unknown');
        return json(503, { error: 'Observability storage unavailable' });
    }
}

module.exports = {
    handler,
    _internal: {
        validateEvent,
        isSameOrigin,
        setRuntime(overrides = {}) {
            runtime = { ...runtime, ...overrides };
        },
        resetRuntime() {
            runtime = { ...defaultRuntime };
        }
    }
};
