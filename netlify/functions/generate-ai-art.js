/**
 * Authenticated living portrait gateway.
 *
 * The browser receives only an application job ID and a short-lived signed
 * image URL. Provider credentials, prediction IDs, and storage authority stay
 * inside this function.
 */

const { createClient } = require('@supabase/supabase-js');

const REPLICATE_MODEL = process.env.REPLICATE_IMAGE_MODEL || 'openai/gpt-image-2';
const REPLICATE_API_BASE = 'https://api.replicate.com/v1';
const SUPABASE_PROJECT_URL = 'https://mkcmdbzcihjgidjuypqe.supabase.co';
const PORTRAIT_BUCKET = 'creature-portraits';
const MAX_BODY_BYTES = 400000;
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;
const OUTPUT_TTL_SECONDS = 55 * 60;
const DAILY_GENERATION_LIMIT = 3;
const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_AGE_GROUPS = new Set(['age_16_17', 'age_18_plus']);
const ALLOWED_STYLES = new Set(['cinematic', 'storybook', 'cosmic', 'watercolor']);
const ALLOWED_SPECIES = new Set([
    'stellarWyrm',
    'crystalDrake',
    'nebulaSprite',
    'voidStalker',
    'cosmicGuardian',
    'auroraPhoenix',
    'crystalElemental'
]);
const PERSONALITY_DESCRIPTIONS = Object.freeze({
    curious: 'intelligent, inquisitive, and eager to discover',
    playful: 'joyful, energetic, and gently mischievous',
    gentle: 'kind, calm, caring, and peaceful',
    wise: 'thoughtful, perceptive, and quietly ancient',
    energetic: 'active, enthusiastic, and full of bright life'
});
const AFFINITY_DESCRIPTIONS = Object.freeze({
    star: 'golden shimmer and restrained star sparkles',
    moon: 'soft silver light and crescent details',
    nebula: 'subtle color shifting and a fine mist trail',
    crystal: 'prismatic refractions and crystalline resonance',
    void: 'a deep star field and soft dimensional shadows'
});
const STYLE_MODIFIERS = Object.freeze({
    cinematic: [
        'cinematic creature portrait',
        'believable anatomy and materials',
        'warm expressive eyes',
        'soft natural key light',
        'high-detail family adventure film concept art'
    ].join(', '),
    storybook: [
        'warm hand-painted storybook illustration',
        'tactile brushwork',
        'gentle wonder',
        'emotionally expressive',
        'timeless all-ages fantasy'
    ].join(', '),
    cosmic: [
        'luminous science-fantasy creature portrait',
        'subtle nebula light',
        'bioluminescent detail',
        'deep-space naturalism',
        'cinematic but welcoming'
    ].join(', '),
    watercolor: [
        'traditional watercolor and gouache creature portrait',
        'visible paper texture',
        'controlled color blooms',
        'delicate linework',
        'warm all-ages illustration'
    ].join(', ')
});

const defaultRuntime = Object.freeze({
    createClient,
    fetch: (...args) => fetch(...args),
    now: () => Date.now()
});
let runtime = { ...defaultRuntime };

function isFeatureEnabled() {
    return (
        process.env.ENABLE_API_FEATURES === 'true' &&
        process.env.ENABLE_AI_PORTRAITS === 'true'
    );
}

function responseHeaders() {
    return {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    };
}

function json(statusCode, body, headers = {}) {
    return {
        statusCode,
        headers: { ...responseHeaders(), ...headers },
        body: JSON.stringify(body)
    };
}

function isSameOrigin(event) {
    const origin = event.headers?.origin || event.headers?.Origin;
    if (!origin) return true;
    const host = event.headers?.['x-forwarded-host'] || event.headers?.host;
    if (!host) return false;

    try {
        return new URL(origin).host === String(host).split(',')[0].trim();
    } catch (error) {
        return false;
    }
}

function getBearerToken(event) {
    const value = event.headers?.authorization || event.headers?.Authorization;
    const match = typeof value === 'string'
        ? value.match(/^Bearer ([A-Za-z0-9._~-]+)$/)
        : null;
    return match?.[1] || null;
}

function getAdminClient() {
    const supabaseUrl = process.env.SUPABASE_URL
        || process.env.VITE_SUPABASE_URL
        || SUPABASE_PROJECT_URL;
    const serviceKey = process.env.SUPABASE_SECRET_KEY
        || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        const error = new Error('Portrait service is not configured');
        error.statusCode = 503;
        throw error;
    }

    return runtime.createClient(supabaseUrl, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
}

async function authenticate(event, adminClient) {
    const token = getBearerToken(event);
    if (!token) {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        throw error;
    }

    const {
        data: { user } = {},
        error: userError
    } = await adminClient.auth.getUser(token);
    if (userError || !user?.id) {
        const error = new Error('Authentication could not be verified');
        error.statusCode = 401;
        throw error;
    }
    return user;
}

function cleanText(value, fallback, maxLength = 120) {
    if (typeof value !== 'string') return fallback;
    const cleaned = value
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
    return cleaned || fallback;
}

function safeIdentifier(value, fallback) {
    return (
        typeof value === 'string' &&
        value.length <= 48 &&
        /^[a-z0-9_-]+$/i.test(value)
    ) ? value : fallback;
}

function describeFeatures(features) {
    if (!Array.isArray(features) || features.length === 0) return 'none';
    return features
        .slice(0, 6)
        .map(feature => {
            const type = safeIdentifier(feature?.type, 'unknown_feature').replace(/_/g, ' ');
            const variant = safeIdentifier(feature?.variant, 'standard').replace(/_/g, ' ');
            return `${variant} ${type}`;
        })
        .join(', ');
}

function validatePortraitSpec(spec) {
    const validStages = new Set(['baby', 'juvenile', 'adult', 'elder']);
    const validRarities = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);
    if (!spec || typeof spec !== 'object') return false;
    if (spec.schemaVersion !== 1 || spec.promptVersion !== 'living-portrait-v1') return false;
    if (
        typeof spec.identityKey !== 'string' ||
        spec.identityKey.length === 0 ||
        spec.identityKey.length > 180
    ) return false;
    if (typeof spec.creatureId !== 'string' || spec.creatureId.length > 96) return false;
    if (!validStages.has(spec.stage) || !validRarities.has(spec.rarity)) return false;
    if (!ALLOWED_SPECIES.has(spec.species)) return false;
    if (!Object.prototype.hasOwnProperty.call(PERSONALITY_DESCRIPTIONS, spec.personality?.core)) {
        return false;
    }
    if (!Object.prototype.hasOwnProperty.call(AFFINITY_DESCRIPTIONS, spec.affinity?.element)) {
        return false;
    }
    const identityLabels = [
        spec.silhouette?.bodyType,
        spec.silhouette?.wingType,
        spec.eyes?.size,
        spec.markings?.pattern,
        spec.markings?.distribution
    ];
    if (identityLabels.some(label => safeIdentifier(label, '') === '')) return false;
    const featureLists = [spec.specialFeatures, spec.mutations];
    if (featureLists.some(list => (
        !Array.isArray(list) ||
        list.length > 6 ||
        list.some(feature => (
            safeIdentifier(feature?.type, '') === '' ||
            safeIdentifier(feature?.variant, '') === ''
        ))
    ))) return false;
    return ['body', 'head', 'wings', 'eyes', 'feet', 'markings'].every(
        key => /^#[0-9A-F]{6}$/.test(spec.palette?.[key] || '')
    );
}

function buildCreaturePrompt(spec, style) {
    const palette = spec.palette;
    const silhouette = spec.silhouette || {};
    const eyes = spec.eyes || {};
    const markings = spec.markings || {};
    const personality = spec.personality || {};
    const affinity = spec.affinity || {};
    const variants = spec.variants || {};

    return [
        'Create one original, non-human mythical creature as a full-body character portrait.',
        'Use the supplied pixel creature as the same subject and preserve its silhouette, color placement, eyes, wings, markings, and unusual traits.',
        `Identity: a ${spec.stage} ${spec.species} with a ${safeIdentifier(silhouette.bodyType, 'balanced')} body.`,
        `Wing structure: ${safeIdentifier(silhouette.wingType, 'none')}; relative span ${Number(silhouette.wingSpan || 1).toFixed(2)}.`,
        `Exact palette anchors: body ${palette.body}, head ${palette.head}, wings ${palette.wings}, eyes ${palette.eyes}, feet ${palette.feet}, markings ${palette.markings}.`,
        `Eyes: ${safeIdentifier(eyes.size, 'medium')}, softly glowing; unusual placement ${safeIdentifier(eyes.unusualPlacement, 'none')}.`,
        `Markings: ${safeIdentifier(markings.pattern, 'none').replace(/_/g, ' ')}, ${safeIdentifier(markings.distribution, 'none')} distribution.`,
        `Distinctive features: ${describeFeatures(spec.specialFeatures)}.`,
        `Genetic mutations that must remain recognizable: ${describeFeatures(spec.mutations)}.`,
        `Temperament: ${personality.core}; ${PERSONALITY_DESCRIPTIONS[personality.core]}.`,
        `Cosmic affinity: ${affinity.element}; ${AFFINITY_DESCRIPTIONS[affinity.element]}.`,
        variants.shiny
            ? `Shiny variant: preserve the ${cleanText(variants.shinyType, 'cosmic shimmer', 48)} treatment.`
            : 'Use restrained magical effects so the creature remains readable.',
        STYLE_MODIFIERS[style],
        'Warm, emotionally appealing, safe for all ages, centered subject, simple atmospheric background.',
        'No humans, no text, no logo, no watermark, no extra creatures, no horror, no weapons.'
    ].join(' ');
}

function parseReferenceImage(value) {
    if (value === null || value === undefined || value === '') return null;
    if (
        typeof value !== 'string' ||
        value.length > 350000 ||
        !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)
    ) {
        const error = new Error('Invalid creature reference image');
        error.statusCode = 400;
        throw error;
    }
    return value;
}

function getOutputUrl(output) {
    if (typeof output === 'string') return output;
    if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
    return null;
}

function isAllowedProviderImageUrl(value) {
    try {
        const url = new URL(value);
        return (
            url.protocol === 'https:' &&
            (url.hostname === 'replicate.delivery' || url.hostname.endsWith('.replicate.delivery'))
        );
    } catch (error) {
        return false;
    }
}

async function callReplicate(path, options = {}) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        const error = new Error('Portrait service is not configured');
        error.statusCode = 503;
        throw error;
    }

    const response = await runtime.fetch(`${REPLICATE_API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(options.headers || {})
        }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error('Portrait provider request failed');
        error.statusCode = response.status === 429 ? 429 : 502;
        error.providerStatus = response.status;
        throw error;
    }
    return payload;
}

async function startPrediction(spec, style, referenceImage) {
    const input = {
        prompt: buildCreaturePrompt(spec, style),
        aspect_ratio: '1:1',
        quality: 'medium',
        number_of_images: 1,
        output_format: 'webp',
        background: 'opaque',
        moderation: 'auto'
    };
    if (referenceImage) {
        input.input_images = [referenceImage];
    }

    const [owner, model] = REPLICATE_MODEL.split('/');
    if (!owner || !model) throw new Error('Invalid portrait model configuration');

    return callReplicate(`/models/${encodeURIComponent(owner)}/${encodeURIComponent(model)}/predictions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Prefer: 'wait=10'
        },
        body: JSON.stringify({ input })
    });
}

async function getPrediction(predictionId) {
    return callReplicate(`/predictions/${encodeURIComponent(predictionId)}`);
}

async function upsertAgeAssertion(adminClient, userId, ageGroup) {
    if (!ALLOWED_AGE_GROUPS.has(ageGroup)) {
        const error = new Error('Living Portraits require the 16+ privacy setting');
        error.statusCode = 403;
        throw error;
    }

    const timestamp = new Date(runtime.now()).toISOString();
    const { error } = await adminClient
        .from('player_privacy_profiles')
        .upsert({
            user_id: userId,
            age_group: ageGroup,
            ai_media_enabled: true,
            assertion_version: 1,
            asserted_at: timestamp,
            updated_at: timestamp
        }, { onConflict: 'user_id' });
    if (error) {
        const serviceError = new Error('Portrait authorization could not be saved');
        serviceError.statusCode = 503;
        throw serviceError;
    }
}

async function assertEligibleProfile(adminClient, userId) {
    const { data, error } = await adminClient
        .from('player_privacy_profiles')
        .select('age_group, ai_media_enabled')
        .eq('user_id', userId)
        .maybeSingle();
    if (
        error ||
        !data?.ai_media_enabled ||
        !ALLOWED_AGE_GROUPS.has(data.age_group)
    ) {
        const restricted = new Error('Living Portraits require the 16+ privacy setting');
        restricted.statusCode = 403;
        throw restricted;
    }
}

async function reserveJob(adminClient, userId, spec, style) {
    const { data, error } = await adminClient.rpc('reserve_creature_portrait_job', {
        p_user_id: userId,
        p_identity_key: spec.identityKey,
        p_stage: spec.stage,
        p_style: style,
        p_daily_limit: DAILY_GENERATION_LIMIT
    });
    if (error || !data) {
        const serviceError = new Error('Portrait job could not be reserved');
        serviceError.statusCode = 503;
        throw serviceError;
    }
    if (data.allowed !== true) {
        const limited = new Error(
            data.reason === 'rate_limited'
                ? 'Daily Living Portrait limit reached'
                : 'Living Portraits require the 16+ privacy setting'
        );
        limited.statusCode = data.reason === 'rate_limited' ? 429 : 403;
        limited.retryAt = data.retry_at || null;
        throw limited;
    }
    return data;
}

async function getOwnedJob(adminClient, userId, jobId) {
    const { data, error } = await adminClient
        .from('creature_portrait_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        const serviceError = new Error('Portrait job could not be loaded');
        serviceError.statusCode = 503;
        throw serviceError;
    }
    if (!data) {
        const notFound = new Error('Portrait job was not found');
        notFound.statusCode = 404;
        throw notFound;
    }
    return data;
}

async function updateOwnedJob(adminClient, userId, jobId, values) {
    const { data, error } = await adminClient
        .from('creature_portrait_jobs')
        .update({
            ...values,
            updated_at: new Date(runtime.now()).toISOString()
        })
        .eq('id', jobId)
        .eq('user_id', userId)
        .select('*')
        .single();
    if (error || !data) {
        const serviceError = new Error('Portrait job could not be updated');
        serviceError.statusCode = 503;
        throw serviceError;
    }
    return data;
}

async function signStoredPortrait(adminClient, job) {
    if (!job.storage_path) {
        const error = new Error('Portrait storage record is incomplete');
        error.statusCode = 503;
        throw error;
    }
    const { data, error } = await adminClient.storage
        .from(PORTRAIT_BUCKET)
        .createSignedUrl(job.storage_path, OUTPUT_TTL_SECONDS);
    if (error || !data?.signedUrl) {
        const storageError = new Error('Portrait could not be opened');
        storageError.statusCode = 503;
        throw storageError;
    }

    return {
        success: true,
        status: 'succeeded',
        jobId: job.id,
        imageUrl: data.signedUrl,
        provider: job.provider || 'Replicate',
        model: job.model || REPLICATE_MODEL,
        expiresAt: runtime.now() + (OUTPUT_TTL_SECONDS * 1000),
        storage: 'supabase-private'
    };
}

async function persistPredictionOutput(adminClient, userId, job, prediction) {
    const outputUrl = getOutputUrl(prediction.output);
    if (!outputUrl || !isAllowedProviderImageUrl(outputUrl)) {
        const error = new Error('The portrait provider returned an invalid image');
        error.statusCode = 502;
        throw error;
    }

    const response = await runtime.fetch(outputUrl, {
        method: 'GET',
        redirect: 'error',
        headers: { Accept: 'image/webp,image/png,image/jpeg' }
    });
    if (!response.ok) {
        const error = new Error('The generated portrait could not be secured');
        error.statusCode = 502;
        throw error;
    }

    const contentType = String(response.headers?.get?.('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
    const extensions = {
        'image/webp': 'webp',
        'image/png': 'png',
        'image/jpeg': 'jpg'
    };
    const extension = extensions[contentType];
    if (!extension) {
        const error = new Error('The portrait provider returned an unsupported image');
        error.statusCode = 502;
        throw error;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_OUTPUT_BYTES) {
        const error = new Error('The generated portrait has an invalid size');
        error.statusCode = 502;
        throw error;
    }

    const storagePath = `${userId}/${job.id}.${extension}`;
    const { error: uploadError } = await adminClient.storage
        .from(PORTRAIT_BUCKET)
        .upload(storagePath, bytes, {
            contentType,
            cacheControl: '31536000',
            upsert: true
        });
    if (uploadError) {
        const error = new Error('The generated portrait could not be stored');
        error.statusCode = 503;
        throw error;
    }

    const completedAt = new Date(runtime.now()).toISOString();
    const storedJob = await updateOwnedJob(adminClient, userId, job.id, {
        status: 'succeeded',
        provider: 'Replicate',
        model: prediction.model || REPLICATE_MODEL,
        storage_path: storagePath,
        error_code: null,
        completed_at: completedAt
    });
    return signStoredPortrait(adminClient, storedJob);
}

async function resultForJob(adminClient, userId, job) {
    if (job.status === 'succeeded') {
        return signStoredPortrait(adminClient, job);
    }
    if (job.status === 'failed' || job.status === 'canceled') {
        return {
            success: false,
            status: job.status,
            jobId: job.id,
            error: 'Portrait generation failed'
        };
    }
    if (!job.provider_prediction_id) {
        return {
            success: true,
            status: job.status || 'starting',
            jobId: job.id
        };
    }

    const prediction = await getPrediction(job.provider_prediction_id);
    if (prediction.status === 'succeeded') {
        return persistPredictionOutput(adminClient, userId, job, prediction);
    }
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
        await updateOwnedJob(adminClient, userId, job.id, {
            status: prediction.status,
            error_code: 'provider_failed',
            completed_at: new Date(runtime.now()).toISOString()
        });
        return {
            success: false,
            status: prediction.status,
            jobId: job.id,
            error: 'Portrait generation failed'
        };
    }

    if (job.status !== prediction.status) {
        await updateOwnedJob(adminClient, userId, job.id, {
            status: prediction.status === 'starting' ? 'starting' : 'processing'
        });
    }
    return {
        success: true,
        status: prediction.status || 'processing',
        jobId: job.id
    };
}

exports.handler = async event => {
    if (!isFeatureEnabled()) {
        return json(404, { success: false, error: 'Portrait generation is not enabled' });
    }
    if (!isSameOrigin(event)) {
        return json(403, { success: false, error: 'Cross-origin requests are not allowed' });
    }

    let adminClient;
    let user;
    let activeJobId = null;
    let ownsActiveJob = false;
    try {
        adminClient = getAdminClient();
        user = await authenticate(event, adminClient);

        if (event.httpMethod === 'GET') {
            const jobId = event.queryStringParameters?.jobId;
            if (!JOB_ID_PATTERN.test(jobId || '')) {
                return json(400, { success: false, error: 'Invalid portrait job ID' });
            }
            await assertEligibleProfile(adminClient, user.id);
            const job = await getOwnedJob(adminClient, user.id, jobId);
            const result = await resultForJob(adminClient, user.id, job);
            return json(result.status === 'succeeded' ? 200 : 202, result);
        }

        if (event.httpMethod !== 'POST') {
            return json(405, { success: false, error: 'Method not allowed' });
        }
        if (!event.body || Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
            return json(413, { success: false, error: 'Portrait request is too large' });
        }

        let body;
        try {
            body = JSON.parse(event.body);
        } catch (error) {
            return json(400, { success: false, error: 'Invalid JSON request' });
        }

        const style = ALLOWED_STYLES.has(body.style) ? body.style : 'cinematic';
        if (!validatePortraitSpec(body.portraitSpec)) {
            return json(400, { success: false, error: 'Invalid creature identity' });
        }
        const referenceImage = parseReferenceImage(body.referenceImage);
        await upsertAgeAssertion(adminClient, user.id, body.ageGroup);

        const reservation = await reserveJob(
            adminClient,
            user.id,
            body.portraitSpec,
            style
        );
        activeJobId = reservation.job_id;
        ownsActiveJob = reservation.reused !== true;
        const job = await getOwnedJob(adminClient, user.id, activeJobId);
        if (reservation.reused === true) {
            const reusedResult = await resultForJob(adminClient, user.id, job);
            return json(reusedResult.status === 'succeeded' ? 200 : 202, reusedResult);
        }

        const prediction = await startPrediction(
            body.portraitSpec,
            style,
            referenceImage
        );
        if (!prediction?.id) {
            const error = new Error('Portrait provider returned an invalid job');
            error.statusCode = 502;
            throw error;
        }
        if (prediction.status === 'succeeded') {
            const result = await persistPredictionOutput(
                adminClient,
                user.id,
                job,
                prediction
            );
            return json(200, result);
        }

        await updateOwnedJob(adminClient, user.id, job.id, {
            status: prediction.status === 'starting' ? 'starting' : 'processing',
            provider: 'Replicate',
            model: prediction.model || REPLICATE_MODEL,
            provider_prediction_id: prediction.id
        });
        return json(202, {
            success: true,
            status: prediction.status === 'starting' ? 'starting' : 'processing',
            jobId: job.id
        });
    } catch (error) {
        if (adminClient && user?.id && activeJobId && ownsActiveJob) {
            try {
                await updateOwnedJob(adminClient, user.id, activeJobId, {
                    status: 'failed',
                    error_code: 'request_failed',
                    completed_at: new Date(runtime.now()).toISOString()
                });
            } catch (updateError) {
                console.error('[LivingPortrait] Failed to close portrait job', {
                    message: updateError.message
                });
            }
        }

        console.error('[LivingPortrait] Request failed', {
            message: error.message,
            statusCode: error.statusCode,
            providerStatus: error.providerStatus
        });
        const headers = error.statusCode === 429
            ? { 'Retry-After': '3600' }
            : {};
        return json(error.statusCode || 500, {
            success: false,
            error: error.message || 'Portrait generation failed',
            retryAt: error.retryAt || undefined
        }, headers);
    }
};

exports._internal = {
    ALLOWED_STYLES,
    buildCreaturePrompt,
    getBearerToken,
    getOutputUrl,
    isAllowedProviderImageUrl,
    isFeatureEnabled,
    isSameOrigin,
    parseReferenceImage,
    resetRuntime() {
        runtime = { ...defaultRuntime };
    },
    setRuntime(overrides = {}) {
        runtime = { ...runtime, ...overrides };
    },
    validatePortraitSpec
};
