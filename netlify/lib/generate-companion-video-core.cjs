/**
 * Authenticated personalized story-video gateway.
 *
 * Provider credentials, prediction IDs, source storage paths, and output
 * storage paths never leave this function. The browser receives only opaque
 * application references and short-lived signed MP4 URLs.
 */

const { createClient } = require('@supabase/supabase-js');

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_REPLICATE_VIDEO_MODEL = 'google/veo-3.1-fast';
const DEFAULT_GEMINI_VIDEO_MODEL = 'veo-3.1-generate-preview';
const SUPABASE_PROJECT_URL = 'https://mkcmdbzcihjgidjuypqe.supabase.co';
const PORTRAIT_BUCKET = 'creature-portraits';
const VIDEO_BUCKET = 'companion-videos';
const PORTRAIT_REF_PREFIX = 'portrait-job-v1:';
const VIDEO_REF_PREFIX = 'video-job-v1:';
const OUTPUT_TTL_SECONDS = 55 * 60;
const MAX_BODY_BYTES = 12000;
const MAX_PORTRAIT_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;
const DAILY_LIMIT = 2;
const SHOT_VERSION = 1;
const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MOMENT_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,63}$/;
const GEMINI_OPERATION_PATTERN = /^[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)+$/;
const ALLOWED_MOMENTS = new Set([
    'first_forest_arrival',
    'beacon_reflection'
]);
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'canceled']);

function classifyGeminiFailure(error) {
    const message = String(error?.message || '').toLowerCase();
    if (/billing|paid plan|payment/.test(message)) return 'billing_required';
    if (/quota|resource exhausted|rate limit/.test(message)) return 'quota_exceeded';
    if (/api key|credential|unauthenticated/.test(message)) return 'api_key_rejected';
    if (/permission|forbidden|access denied/.test(message)) return 'permission_denied';
    if (/model|not found|unsupported/.test(message)) return 'model_unavailable';
    if (/invalid argument|bad request/.test(message)) return 'request_rejected';
    return 'provider_rejected';
}

const defaultRuntime = Object.freeze({
    createClient,
    createGeminiClient: () => {
        const error = new Error('Video service is not configured');
        error.statusCode = 503;
        throw error;
    },
    fetch: (...args) => fetch(...args),
    now: () => Date.now()
});
let runtime = { ...defaultRuntime };

function isEnabled() {
    return process.env.ENABLE_API_FEATURES === 'true' &&
        process.env.ENABLE_AI_PORTRAITS === 'true' &&
        process.env.ENABLE_AI_VIDEOS === 'true';
}

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
    return typeof value === 'string'
        ? value.match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1] || null
        : null;
}

function parseRef(value, prefix) {
    if (typeof value !== 'string' || !value.startsWith(prefix)) return null;
    const id = value.slice(prefix.length);
    return JOB_ID_PATTERN.test(id) ? id.toLowerCase() : null;
}

function createVideoRef(id) {
    return JOB_ID_PATTERN.test(id || '')
        ? `${VIDEO_REF_PREFIX}${id.toLowerCase()}`
        : null;
}

function getAdminClient() {
    const serviceKey = process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        const error = new Error('Video service is not configured');
        error.statusCode = 503;
        throw error;
    }
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

async function authenticate(event, adminClient) {
    const token = getBearerToken(event);
    if (!token) {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        throw error;
    }
    const { data: { user } = {}, error: userError } =
        await adminClient.auth.getUser(token);
    if (userError || !user?.id) {
        const error = new Error('Authentication could not be verified');
        error.statusCode = 401;
        throw error;
    }
    return user;
}

async function assertEligible(adminClient, userId) {
    const { data, error } = await adminClient
        .from('player_privacy_profiles')
        .select('age_group, ai_media_enabled')
        .eq('user_id', userId)
        .maybeSingle();
    if (
        error ||
        !data?.ai_media_enabled ||
        !['age_16_17', 'age_18_plus'].includes(data.age_group)
    ) {
        const restricted = new Error('Personalized videos require the 16+ privacy setting');
        restricted.statusCode = 403;
        throw restricted;
    }
}

async function getOwnedPortrait(adminClient, userId, portraitJobId) {
    const { data, error } = await adminClient
        .from('creature_portrait_jobs')
        .select('id, user_id, identity_key, stage, status, storage_path')
        .eq('id', portraitJobId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        const serviceError = new Error('Living portrait could not be loaded');
        serviceError.statusCode = 503;
        throw serviceError;
    }
    if (!data || data.status !== 'succeeded' || !data.storage_path) {
        const unavailable = new Error('Living portrait is not ready for video');
        unavailable.statusCode = 409;
        throw unavailable;
    }
    return data;
}

async function getOwnedJob(adminClient, userId, jobId) {
    const { data, error } = await adminClient
        .from('companion_video_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        const serviceError = new Error('Video job could not be loaded');
        serviceError.statusCode = 503;
        throw serviceError;
    }
    if (!data) {
        const notFound = new Error('Video job was not found');
        notFound.statusCode = 404;
        throw notFound;
    }
    return data;
}

async function updateOwnedJob(adminClient, userId, jobId, values) {
    const { data, error } = await adminClient
        .from('companion_video_jobs')
        .update({
            ...values,
            updated_at: new Date(runtime.now()).toISOString()
        })
        .eq('id', jobId)
        .eq('user_id', userId)
        .select('*')
        .single();
    if (error || !data) {
        const serviceError = new Error('Video job could not be updated');
        serviceError.statusCode = 503;
        throw serviceError;
    }
    return data;
}

async function reserveJob(adminClient, userId, portraitJobId, momentId) {
    const { data, error } = await adminClient.rpc('reserve_companion_video_job', {
        p_user_id: userId,
        p_portrait_job_id: portraitJobId,
        p_moment_id: momentId,
        p_shot_version: SHOT_VERSION,
        p_daily_limit: DAILY_LIMIT
    });
    if (error || !data) {
        const serviceError = new Error('Video job could not be reserved');
        serviceError.statusCode = 503;
        throw serviceError;
    }
    if (data.allowed !== true) {
        const messages = {
            age_restricted: 'Personalized videos require the 16+ privacy setting',
            portrait_unavailable: 'Living portrait is not ready for video',
            rate_limited: 'Daily personalized video limit reached'
        };
        const denied = new Error(messages[data.reason] || 'Video generation is unavailable');
        denied.statusCode = data.reason === 'rate_limited'
            ? 429
            : data.reason === 'portrait_unavailable' ? 409 : 403;
        throw denied;
    }
    return data;
}

async function signPortraitInput(adminClient, portrait) {
    const { data, error } = await adminClient.storage
        .from(PORTRAIT_BUCKET)
        .createSignedUrl(portrait.storage_path, 15 * 60);
    if (error || !data?.signedUrl) {
        const storageError = new Error('Living portrait could not be prepared for video');
        storageError.statusCode = 503;
        throw storageError;
    }
    return data.signedUrl;
}

function isAllowedMoment(momentId) {
    return ALLOWED_MOMENTS.has(momentId) ||
        /^guardian_(?:rescue|trust|debrief)_[a-z0-9_-]{1,32}$/.test(momentId);
}

function buildPrompt(momentId, stage) {
    const momentCopy = momentId === 'first_forest_arrival'
        ? 'The companion takes two cautious steps from the edge of a damaged spacecraft into a bioluminescent forest, then looks back with trust toward its astronaut companion, Wanderer-77, who is visible only from behind at the edge of frame.'
        : momentId === 'beacon_reflection'
            ? 'The companion stands beside a quiet beacon at dusk, watching its living light move through the landscape while Wanderer-77 considers the responsibility of returning home.'
            : momentId.startsWith('guardian_rescue_')
                ? 'The companion approaches a newly opened rescue enclosure, pauses to let the freed guardian choose, then walks with it toward the warm lights of the Sanctuary.'
                : momentId.startsWith('guardian_trust_')
                    ? 'The companion shares a calm recognition with a Sanctuary resident beside living roots, with a gentle exchange of trust expressed through posture and eye contact.'
                    : 'The companion and a Sanctuary resident look over a recovering region together, communicating shared purpose through small, natural gestures.';
    return [
        'Use the input image as the exact identity reference for this creature.',
        `Preserve its face, silhouette, anatomy, colors, markings, and ${stage} life stage without redesigning it.`,
        'A single continuous cinematic wildlife shot in the Mythical Forest on the alien world called the Fend.',
        momentCopy,
        'Subtle breathing, natural weight, blinking, moving foliage, drifting Current motes, damp ground reflections, restrained wonder, emotionally warm but not childish.',
        'Slow low camera push, realistic lens behavior, premium live-action science-fantasy film, physically coherent motion.',
        'No dialogue, no subtitles, no logos, no text, no weapons, no extra creatures, no transformation, no morphing, no pixel art, no cartoon rendering.'
    ].join(' ');
}

function getReplicateModel() {
    return process.env.REPLICATE_VIDEO_MODEL || DEFAULT_REPLICATE_VIDEO_MODEL;
}

function getGeminiModel() {
    return process.env.GEMINI_VIDEO_MODEL || DEFAULT_GEMINI_VIDEO_MODEL;
}

function getProviderPreference() {
    const value = String(process.env.VIDEO_PROVIDER || 'auto').trim().toLowerCase();
    return ['auto', 'gemini', 'replicate'].includes(value) ? value : 'auto';
}

function providerLabel(value) {
    return String(value || '').toLowerCase().includes('gemini')
        ? 'Google Gemini'
        : 'Replicate';
}

async function callReplicate(path, options = {}) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        const error = new Error('Video service is not configured');
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
        const error = new Error('Video provider request failed');
        error.statusCode = response.status === 429
            ? 429
            : [401, 403].includes(response.status)
                ? 503
                : 502;
        error.providerStatus = response.status;
        throw error;
    }
    return payload;
}

async function startReplicatePrediction(portraitUrl, momentId, stage) {
    const replicateModel = getReplicateModel();
    const [owner, model] = replicateModel.split('/');
    if (!owner || !model) {
        const error = new Error('Invalid video model configuration');
        error.statusCode = 503;
        throw error;
    }
    const prediction = await callReplicate(
        `/models/${encodeURIComponent(owner)}/${encodeURIComponent(model)}/predictions`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: {
                    image: portraitUrl,
                    prompt: buildPrompt(momentId, stage),
                    duration: 4,
                    resolution: '720p',
                    aspect_ratio: '16:9',
                    generate_audio: false
                }
            })
        }
    );
    return {
        ...prediction,
        provider: 'Replicate',
        model: prediction.model || replicateModel
    };
}

function isAllowedPortraitUrl(value) {
    try {
        const url = new URL(value);
        const configuredHost = new URL(
            process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || SUPABASE_PROJECT_URL
        ).hostname;
        return url.protocol === 'https:' && url.hostname === configuredHost;
    } catch (error) {
        return false;
    }
}

async function loadPortraitBytes(portraitUrl) {
    if (!isAllowedPortraitUrl(portraitUrl)) {
        const error = new Error('Living portrait source is invalid');
        error.statusCode = 503;
        throw error;
    }
    const response = await runtime.fetch(portraitUrl, {
        method: 'GET',
        redirect: 'error',
        headers: { Accept: 'image/webp,image/png,image/jpeg' }
    });
    if (!response.ok) {
        const error = new Error('Living portrait could not be prepared for video');
        error.statusCode = 503;
        throw error;
    }
    const mimeType = String(response.headers?.get?.('content-type') || '')
        .split(';')[0].trim().toLowerCase();
    if (!['image/webp', 'image/png', 'image/jpeg'].includes(mimeType)) {
        const error = new Error('Living portrait format is unsupported');
        error.statusCode = 503;
        throw error;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_PORTRAIT_BYTES) {
        const error = new Error('Living portrait source is invalid');
        error.statusCode = 503;
        throw error;
    }
    return { bytes, mimeType };
}

function normalizeGeminiOperation(operation) {
    const name = typeof operation?.name === 'string' ? operation.name : null;
    const videoUri = operation?.response?.generatedVideos?.[0]?.video?.uri ||
        operation?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
        null;
    if (operation?.error) {
        return {
            id: name,
            status: 'failed',
            provider: 'Google Gemini',
            model: getGeminiModel()
        };
    }
    return {
        id: name,
        status: operation?.done ? (videoUri ? 'succeeded' : 'failed') : 'processing',
        provider: 'Google Gemini',
        model: getGeminiModel(),
        output: videoUri
    };
}

async function startGeminiPrediction(portraitUrl, momentId, stage) {
    const { bytes, mimeType } = await loadPortraitBytes(portraitUrl);
    let operation;
    try {
        const ai = runtime.createGeminiClient();
        operation = await ai.models.generateVideos({
            model: getGeminiModel(),
            source: {
                prompt: buildPrompt(momentId, stage),
                image: {
                    imageBytes: bytes.toString('base64'),
                    mimeType
                }
            },
            config: {
                numberOfVideos: 1,
                durationSeconds: 8,
                aspectRatio: '16:9',
                resolution: '720p',
                personGeneration: 'allow_adult'
            }
        });
    } catch (providerError) {
        const providerStatus = Number(
            providerError?.status || providerError?.statusCode || providerError?.code
        );
        const failureReason = classifyGeminiFailure(providerError);
        const logProviderFailure = [
            'api_key_rejected',
            'billing_required',
            'permission_denied',
            'model_unavailable',
            'quota_exceeded'
        ].includes(failureReason) ? console.warn : console.error;
        logProviderFailure(`[CompanionVideo] Gemini request failed ${JSON.stringify({
            providerStatus: Number.isFinite(providerStatus) ? providerStatus : null,
            reason: failureReason,
            model: getGeminiModel()
        })}`);
        const error = new Error('Video provider request failed');
        error.statusCode = providerStatus === 429
            ? 429
            : [401, 403].includes(providerStatus) || [
                'api_key_rejected',
                'billing_required',
                'permission_denied',
                'model_unavailable'
            ].includes(failureReason)
                ? 503
                : 502;
        error.providerStatus = Number.isFinite(providerStatus)
            ? providerStatus
            : undefined;
        throw error;
    }
    const prediction = normalizeGeminiOperation(operation);
    if (!prediction.id) {
        const error = new Error('Video provider returned an invalid job');
        error.statusCode = 502;
        throw error;
    }
    return prediction;
}

async function startPrediction(portraitUrl, momentId, stage) {
    const preference = getProviderPreference();
    if (preference === 'replicate') {
        return startReplicatePrediction(portraitUrl, momentId, stage);
    }
    try {
        return await startGeminiPrediction(portraitUrl, momentId, stage);
    } catch (geminiError) {
        if (preference === 'gemini' || !process.env.REPLICATE_API_TOKEN) {
            throw geminiError;
        }
        console.warn('[CompanionVideo] Gemini start unavailable; trying Replicate', {
            providerStatus: geminiError.providerStatus || null
        });
        return startReplicatePrediction(portraitUrl, momentId, stage);
    }
}

function getOutputUrl(output) {
    if (typeof output === 'string') return output;
    if (Array.isArray(output)) return output.find(value => typeof value === 'string') || null;
    if (output && typeof output === 'object') {
        if (typeof output.url === 'string') return output.url;
        if (typeof output.video === 'string') return output.video;
    }
    return null;
}

function isAllowedProviderUrl(value, provider) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return false;
        if (providerLabel(provider) === 'Google Gemini') {
            return [
                'generativelanguage.googleapis.com',
                'storage.googleapis.com'
            ].includes(url.hostname);
        }
        return url.hostname === 'replicate.delivery' ||
            url.hostname.endsWith('.replicate.delivery');
    } catch (error) {
        return false;
    }
}

async function signStoredVideo(adminClient, job) {
    if (!job.storage_path) {
        const error = new Error('Video storage record is incomplete');
        error.statusCode = 503;
        throw error;
    }
    const { data, error } = await adminClient.storage
        .from(VIDEO_BUCKET)
        .createSignedUrl(job.storage_path, OUTPUT_TTL_SECONDS);
    if (error || !data?.signedUrl) {
        const storageError = new Error('Personalized video could not be opened');
        storageError.statusCode = 503;
        throw storageError;
    }
    return {
        success: true,
        status: 'succeeded',
        jobId: job.id,
        assetRef: createVideoRef(job.id),
        momentId: job.moment_id,
        identityKey: job.identity_key,
        stage: job.stage,
        videoUrl: data.signedUrl,
        provider: providerLabel(job.provider),
        model: job.model || (
            providerLabel(job.provider) === 'Google Gemini'
                ? getGeminiModel()
                : getReplicateModel()
        ),
        shotVersion: job.shot_version || SHOT_VERSION,
        expiresAt: runtime.now() + OUTPUT_TTL_SECONDS * 1000,
        storage: 'supabase-private'
    };
}

async function persistOutput(adminClient, userId, job, prediction) {
    const outputUrl = getOutputUrl(prediction.output);
    const provider = providerLabel(prediction.provider || job.provider);
    if (!outputUrl || !isAllowedProviderUrl(outputUrl, provider)) {
        const error = new Error('The video provider returned an invalid file');
        error.statusCode = 502;
        throw error;
    }
    const response = await runtime.fetch(outputUrl, {
        method: 'GET',
        redirect: provider === 'Google Gemini' ? 'follow' : 'error',
        headers: {
            Accept: 'video/mp4',
            ...(provider === 'Google Gemini'
                ? { 'x-goog-api-key': process.env.GEMINI_API_KEY || '' }
                : {})
        }
    });
    if (!response.ok) {
        const error = new Error('The generated video could not be secured');
        error.statusCode = 502;
        throw error;
    }
    const contentType = String(response.headers?.get?.('content-type') || '')
        .split(';')[0].trim().toLowerCase();
    const bytes = Buffer.from(await response.arrayBuffer());
    const hasMp4Signature = bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp';
    if (
        contentType !== 'video/mp4' ||
        !hasMp4Signature ||
        bytes.length === 0 ||
        bytes.length > MAX_OUTPUT_BYTES
    ) {
        const error = new Error('The video provider returned an unsupported file');
        error.statusCode = 502;
        throw error;
    }
    const storagePath = `${userId}/${job.id}.mp4`;
    const { error: uploadError } = await adminClient.storage
        .from(VIDEO_BUCKET)
        .upload(storagePath, bytes, {
            contentType: 'video/mp4',
            cacheControl: '31536000',
            upsert: true
        });
    if (uploadError) {
        const error = new Error('The generated video could not be stored');
        error.statusCode = 503;
        throw error;
    }
    const stored = await updateOwnedJob(adminClient, userId, job.id, {
        status: 'succeeded',
        provider,
        model: prediction.model || job.model || (
            provider === 'Google Gemini' ? getGeminiModel() : getReplicateModel()
        ),
        storage_path: storagePath,
        error_code: null,
        completed_at: new Date(runtime.now()).toISOString()
    });
    return signStoredVideo(adminClient, stored);
}

async function pollGeminiPrediction(operationName) {
    if (!GEMINI_OPERATION_PATTERN.test(operationName || '')) {
        const error = new Error('Video provider returned an invalid job');
        error.statusCode = 502;
        throw error;
    }
    try {
        const operationPath = operationName
            .split('/')
            .map(segment => encodeURIComponent(segment))
            .join('/');
        const response = await runtime.fetch(`${GEMINI_API_BASE}/${operationPath}`, {
            method: 'GET',
            redirect: 'error',
            headers: {
                Accept: 'application/json',
                'x-goog-api-key': process.env.GEMINI_API_KEY || ''
            }
        });
        const operation = await response.json().catch(() => ({}));
        if (!response.ok) {
            const providerError = new Error('Gemini operation request failed');
            providerError.status = response.status;
            throw providerError;
        }
        return normalizeGeminiOperation(operation);
    } catch (providerError) {
        const error = new Error('Video provider request failed');
        const providerStatus = Number(
            providerError?.status || providerError?.statusCode || providerError?.code
        );
        error.statusCode = providerStatus === 429
            ? 429
            : [401, 403].includes(providerStatus)
                ? 503
                : 502;
        error.providerStatus = Number.isFinite(providerStatus)
            ? providerStatus
            : undefined;
        throw error;
    }
}

async function pollPrediction(job) {
    if (providerLabel(job.provider) === 'Google Gemini') {
        return pollGeminiPrediction(job.provider_prediction_id);
    }
    const prediction = await callReplicate(
        `/predictions/${encodeURIComponent(job.provider_prediction_id)}`
    );
    return {
        ...prediction,
        provider: 'Replicate',
        model: prediction.model || job.model || getReplicateModel()
    };
}

async function resultForJob(adminClient, userId, job) {
    if (job.status === 'succeeded') return signStoredVideo(adminClient, job);
    if (job.status === 'failed' || job.status === 'canceled') {
        return {
            success: false,
            status: job.status,
            jobId: job.id,
            assetRef: createVideoRef(job.id),
            error: 'Personalized video generation failed'
        };
    }
    if (!job.provider_prediction_id) {
        return {
            success: true,
            status: job.status || 'starting',
            jobId: job.id,
            assetRef: createVideoRef(job.id)
        };
    }
    const prediction = await pollPrediction(job);
    if (prediction.status === 'succeeded') {
        return persistOutput(adminClient, userId, job, prediction);
    }
    if (TERMINAL_STATUSES.has(prediction.status)) {
        await updateOwnedJob(adminClient, userId, job.id, {
            status: prediction.status,
            error_code: 'provider_failed',
            completed_at: new Date(runtime.now()).toISOString()
        });
        return {
            success: false,
            status: prediction.status,
            jobId: job.id,
            assetRef: createVideoRef(job.id),
            error: 'Personalized video generation failed'
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
        jobId: job.id,
        assetRef: createVideoRef(job.id)
    };
}

exports.handler = async event => {
    if (!isEnabled()) {
        return json(404, { success: false, error: 'Personalized video generation is not enabled' });
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
            const assetRef = event.queryStringParameters?.assetRef;
            const jobId = assetRef
                ? parseRef(assetRef, VIDEO_REF_PREFIX)
                : event.queryStringParameters?.jobId;
            if (!JOB_ID_PATTERN.test(jobId || '')) {
                return json(400, { success: false, error: 'Invalid video reference' });
            }
            await assertEligible(adminClient, user.id);
            const job = await getOwnedJob(adminClient, user.id, jobId);
            const result = await resultForJob(adminClient, user.id, job);
            return json(result.status === 'succeeded' ? 200 : 202, result);
        }

        if (event.httpMethod !== 'POST') {
            return json(405, { success: false, error: 'Method not allowed' });
        }
        if (!event.body || Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
            return json(413, { success: false, error: 'Video request is too large' });
        }
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (error) {
            return json(400, { success: false, error: 'Invalid JSON request' });
        }
        const momentId = typeof body.momentId === 'string' ? body.momentId : '';
        if (!MOMENT_ID_PATTERN.test(momentId) || !isAllowedMoment(momentId)) {
            return json(400, { success: false, error: 'Unsupported story moment' });
        }
        const portraitJobId = parseRef(body.portraitAssetRef, PORTRAIT_REF_PREFIX);
        if (!portraitJobId) {
            return json(400, { success: false, error: 'Invalid living portrait reference' });
        }
        await assertEligible(adminClient, user.id);
        const portrait = await getOwnedPortrait(adminClient, user.id, portraitJobId);
        const reservation = await reserveJob(
            adminClient,
            user.id,
            portraitJobId,
            momentId
        );
        activeJobId = reservation.job_id;
        ownsActiveJob = reservation.reused !== true;
        const job = await getOwnedJob(adminClient, user.id, activeJobId);
        if (reservation.reused === true) {
            const reused = await resultForJob(adminClient, user.id, job);
            return json(reused.status === 'succeeded' ? 200 : 202, reused);
        }

        const portraitUrl = await signPortraitInput(adminClient, portrait);
        const prediction = await startPrediction(portraitUrl, momentId, portrait.stage);
        if (!prediction?.id) {
            const error = new Error('Video provider returned an invalid job');
            error.statusCode = 502;
            throw error;
        }
        if (prediction.status === 'succeeded') {
            const result = await persistOutput(adminClient, user.id, job, prediction);
            return json(200, result);
        }
        await updateOwnedJob(adminClient, user.id, job.id, {
            status: prediction.status === 'processing' ? 'processing' : 'starting',
            provider: providerLabel(prediction.provider),
            model: prediction.model || (
                providerLabel(prediction.provider) === 'Google Gemini'
                    ? getGeminiModel()
                    : getReplicateModel()
            ),
            provider_prediction_id: prediction.id
        });
        return json(202, {
            success: true,
            status: prediction.status || 'starting',
            jobId: job.id,
            assetRef: createVideoRef(job.id)
        });
    } catch (error) {
        if (adminClient && user?.id && activeJobId && ownsActiveJob) {
            await updateOwnedJob(adminClient, user.id, activeJobId, {
                status: 'failed',
                error_code: 'request_failed',
                completed_at: new Date(runtime.now()).toISOString()
            }).catch(() => {});
        }
        if (error.statusCode >= 500 || error.statusCode === 429) {
            const logFailure = [429, 503].includes(error.statusCode)
                ? console.warn
                : console.error;
            logFailure('[CompanionVideo] Request failed', {
                message: error.message,
                statusCode: error.statusCode,
                providerStatus: error.providerStatus,
                provider: getProviderPreference(),
                model: getProviderPreference() === 'replicate'
                    ? getReplicateModel()
                    : getGeminiModel()
            });
        }
        return json(error.statusCode || 500, {
            success: false,
            error: error.statusCode ? error.message : 'Video generation failed'
        });
    }
};

exports._internal = {
    buildPrompt,
    createVideoRef,
    getProviderPreference,
    normalizeGeminiOperation,
    parseRef,
    setRuntime(overrides) {
        runtime = { ...runtime, ...overrides };
    },
    resetRuntime() {
        runtime = { ...defaultRuntime };
    }
};
