/**
 * Living portrait generation gateway.
 *
 * The function accepts only a normalized creature identity contract and builds
 * the provider prompt server-side. Generation is asynchronous: POST starts a
 * prediction and GET polls its status.
 */

const REPLICATE_MODEL = process.env.REPLICATE_IMAGE_MODEL || 'openai/gpt-image-2';
const REPLICATE_API_BASE = 'https://api.replicate.com/v1';
const MAX_BODY_BYTES = 400000;
const OUTPUT_TTL_MS = 55 * 60 * 1000;
const PREDICTION_ID_PATTERN = /^[a-z0-9]{8,64}$/i;
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

function json(statusCode, body) {
    return {
        statusCode,
        headers: responseHeaders(),
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

function cleanText(value, fallback, maxLength = 120) {
    if (typeof value !== 'string') return fallback;
    const cleaned = value
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
    return cleaned || fallback;
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

function safeIdentifier(value, fallback) {
    return (
        typeof value === 'string' &&
        value.length <= 48 &&
        /^[a-z0-9_-]+$/i.test(value)
    ) ? value : fallback;
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
        throw new Error('Invalid creature reference image');
    }
    return value;
}

function getOutputUrl(output) {
    if (typeof output === 'string') return output;
    if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
    return null;
}

function predictionPayload(prediction) {
    const status = prediction?.status || 'starting';
    const imageUrl = status === 'succeeded' ? getOutputUrl(prediction.output) : null;
    if (status === 'succeeded' && !imageUrl) {
        return {
            success: false,
            status: 'failed',
            error: 'The portrait provider returned no image'
        };
    }

    return {
        success: status !== 'failed' && status !== 'canceled',
        status,
        predictionId: prediction?.id || null,
        imageUrl,
        provider: 'Replicate',
        model: prediction?.model || REPLICATE_MODEL,
        expiresAt: imageUrl ? Date.now() + OUTPUT_TTL_MS : null,
        storage: imageUrl ? 'provider-temporary' : null,
        error: status === 'failed' ? 'Portrait generation failed' : undefined
    };
}

async function callReplicate(path, options = {}) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        const error = new Error('Portrait service is not configured');
        error.statusCode = 503;
        throw error;
    }

    const response = await fetch(`${REPLICATE_API_BASE}${path}`, {
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

exports.handler = async event => {
    if (!isFeatureEnabled()) {
        return json(404, { success: false, error: 'Portrait generation is not enabled' });
    }
    if (!isSameOrigin(event)) {
        return json(403, { success: false, error: 'Cross-origin requests are not allowed' });
    }

    try {
        if (event.httpMethod === 'GET') {
            const predictionId = event.queryStringParameters?.predictionId;
            if (!PREDICTION_ID_PATTERN.test(predictionId || '')) {
                return json(400, { success: false, error: 'Invalid prediction ID' });
            }
            const prediction = await getPrediction(predictionId);
            const result = predictionPayload(prediction);
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
        const prediction = await startPrediction(body.portraitSpec, style, referenceImage);
        const result = predictionPayload(prediction);
        return json(result.status === 'succeeded' ? 200 : 202, result);
    } catch (error) {
        console.error('[LivingPortrait] Request failed', {
            message: error.message,
            statusCode: error.statusCode,
            providerStatus: error.providerStatus
        });
        return json(error.statusCode || 500, {
            success: false,
            error: error.message || 'Portrait generation failed'
        });
    }
};

exports._internal = {
    ALLOWED_STYLES,
    buildCreaturePrompt,
    getOutputUrl,
    isFeatureEnabled,
    isSameOrigin,
    parseReferenceImage,
    predictionPayload,
    validatePortraitSpec
};
