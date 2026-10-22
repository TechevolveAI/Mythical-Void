/**
 * Authenticated living portrait gateway.
 *
 * The browser receives only an application job ID and a short-lived signed
 * image URL. Provider credentials, prediction IDs, and storage authority stay
 * inside this function.
 */

const { createClient } = require('@supabase/supabase-js');
const { projectPortraitPromptTraits } = require('./portrait-prompt-traits.cjs');

const REPLICATE_MODEL = process.env.REPLICATE_IMAGE_MODEL || 'openai/gpt-image-2';
const REPLICATE_API_BASE = 'https://api.replicate.com/v1';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
const SUPABASE_PROJECT_URL = 'https://mkcmdbzcihjgidjuypqe.supabase.co';
const PORTRAIT_BUCKET = 'creature-portraits';
// Art wording is versioned separately from the saved identity/cache contract.
const CREATURE_ART_DIRECTION = 'living-interpretation-v1';
const MAX_BODY_BYTES = 400000;
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;
const OUTPUT_TTL_SECONDS = 55 * 60;
const DAILY_GENERATION_LIMIT = (() => {
    const configured = Number(process.env.PORTRAIT_DAILY_IDENTITY_LIMIT);
    if (!Number.isInteger(configured)) return 10;
    return Math.min(20, Math.max(1, configured));
})();
const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PORTRAIT_ASSET_REF_PREFIX = 'portrait-job-v1:';
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
        'photoreal cinematic creature encounter',
        'feature-film visual effects realism',
        'physically based organic and mineral materials',
        'anatomically coherent alien biology',
        'documentary wildlife photography detail',
        'natural lens behavior and atmospheric depth'
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
const SPECIES_BIOLOGY = Object.freeze({
    stellarWyrm: [
        'supple overlapping micro-scales with warm photophores beneath the skin',
        'fine keratin scales interrupted by translucent sensory membranes and star-like chromatophores',
        'soft mineralized scales with subtle vein-like light channels under a living dermis'
    ],
    crystalDrake: [
        'living crystal plates growing through flexible hide, with moisture held in the seams',
        'semi-translucent mineral scutes over dense organic tissue and naturally chipped edges',
        'prismatic dermal armor supported by visible elastic membranes at every joint'
    ],
    nebulaSprite: [
        'velvety translucent skin with drifting chromatophore clouds below the surface',
        'fine iridescent filaments over soft living tissue with faint internal bioluminescence',
        'thin opalescent membranes layered over a warm, breathing organic core'
    ],
    voidStalker: [
        'light-absorbing velvet skin broken by tiny star-field iridescence and natural scars',
        'matte charcoal micro-scales with oil-slick color at their moving edges',
        'dense dark dermal fibers that reveal restrained cosmic speckling only in rim light'
    ],
    cosmicGuardian: [
        'weight-bearing biological armor over powerful elastic muscle and weathered joint tissue',
        'dense interlocking scutes with worn edges, soft underlayers, and restrained golden photophores',
        'thick mineral-keratin plating shaped by movement rather than decorative costume'
    ],
    auroraPhoenix: [
        'heat-dispersing feather filaments with realistic barbs, soot traces, and luminous tips',
        'layered living plumage whose translucent edges refract aurora color without becoming flame effects',
        'fine thermal feathers over warm skin, with singed imperfections and subtle internal glow'
    ],
    crystalElemental: [
        'a silicate-organic lattice joined by moist translucent membranes and living mineral seams',
        'porous crystal tissue with internal fluid channels, weathered facets, and flexible connective matter',
        'grown mineral plates carrying visible organic capillaries and soft bioluminescent tissue'
    ]
});
const BODY_MECHANICS = Object.freeze({
    blob: 'Its weight settles and redistributes through a soft hydrostatic body; show compression where it meets the ground.',
    quadruped: 'Its four-point stance carries believable weight through shoulders, hips, feet, and the terrain beneath them.',
    biped: 'Its upright balance uses a low alien center of gravity, flexed joints, and a grounded, non-human stance.',
    serpentine: 'Its long body supports itself through muscular curves with convincing compression and ground contact.',
    winged: 'Its body is balanced around the visible wings, with believable chest structure and folded membrane or feather weight.'
});
const HEAD_BIOLOGY = Object.freeze({
    feline: 'Interpret the compact attention region, paired lateral points and fine sensory filaments visible in the reference as integrated alien sensory tissue. Let the points become curved listening membranes and the central facial mark become a subtle sensing organ, not mandatory triangular ears or a cat muzzle.',
    canine: 'Interpret the rounded attention region, longer lateral features and central contrasting facial mark visible in the reference as connected living folds and scent-sensitive tissue. Preserve their recognisable arrangement without requiring a projecting snout, dark nose or Earth-dog anatomy.',
    avian: 'Interpret the directional facial feature, paired eyes and layered crown visible in the reference as a coherent alien attention system. Develop flexible sensory ridges and fine filament structures; a pointed graphic is not an instruction to attach a rigid triangular beak or reproduce an Earth bird.',
    reptile: 'Interpret the tapered attention region, paired crown accents and narrow eyes visible in the reference through flexible dermal ridges and living protective tissue. Keep the directional character while allowing curved transitions instead of a geometrically angular skull or decorative spikes.',
    aquatic: 'Interpret the broad attention region, lateral fins and paired eyes visible in the reference through thin pleated sensory membranes and fluid-supported tissue. Preserve the broad silhouette while replacing flat oval masses with supple, continuously connected anatomy.',
    simian: 'Interpret the forward attention, lighter central facial region and paired lateral accents visible in the reference as alien sensing surfaces integrated into the body. The lighter patch may be translucent tissue rather than an oval mask; do not require a human-like nose, circular ears or an Earth-primate face.',
    insectoid: 'Interpret the compact attention region, compound-eye cues and paired tipped antennae visible in the reference as living sensory organs. Realise the antennae with flexible tissue and the eyes with coherent optical microstructure, not an oval helmet with attached toy parts.',
    rodent: 'Interpret the tall paired sensory structures, fine filaments and compact attention region visible in the reference as delicate membrane-and-tissue adaptations. Keep their long-range sensing character without imposing a small dark nose, rabbit ears or familiar Earth-animal anatomy.',
    cervine: 'Interpret the narrow attention region and paired branching crown structures visible in the reference as connected living sensory growths. Preserve the main branching arrangement while developing organic junctions and flexible tissue, not a deer muzzle or geometric antlers.'
});
const COMPLEMENTARY_HEAD_TYPES = Object.freeze({
    feline: 'avian',
    canine: 'reptile',
    avian: 'feline',
    reptile: 'canine',
    aquatic: 'insectoid',
    simian: 'rodent',
    insectoid: 'aquatic',
    rodent: 'cervine',
    cervine: 'simian'
});
const AFFINITY_ECOLOGY = Object.freeze({
    star: [
        'Nearby Current motes warm and brighten as its photophores respond.',
        'A restrained amber glow catches moisture on the ground immediately around it.'
    ],
    moon: [
        'Cool reflected light reveals crescent details only where the skin turns toward the sky.',
        'Its silver bioluminescence pulses softly against damp stone and low plants.'
    ],
    nebula: [
        'A fine colored vapor follows its breathing and curls around nearby vegetation.',
        'Its chromatophores shift slowly as airborne Current motes pass across its body.'
    ],
    crystal: [
        'Local crystal growths answer with faint refractions rather than explosive magic.',
        'Minute harmonic vibrations disturb dust and dew close to its feet.'
    ],
    void: [
        'Rim light bends subtly at the edge of its body while the surrounding terrain remains physically real.',
        'A shallow dimensional shadow pools beneath it without hiding anatomy or contact with the ground.'
    ]
});
const NATURAL_IMPERFECTIONS = Object.freeze([
    'Include slight left-right asymmetry, uneven growth, and a few healed surface marks.',
    'Include tiny chips, dirt, moisture, and age-appropriate wear where this body touches its environment.',
    'Include individual variation in pattern spacing, surface texture, and one subtly imperfect edge.',
    'Include breathing tension, compressed tissue at joints, and naturally irregular color boundaries.'
]);
const ASTRONOMICAL_BACKDROPS = Object.freeze([
    'Beyond the Sanctuary, a vast hydrogen-emission cloud contains dark molecular pillars and a narrow newborn-star jet, with scale and color behaving like a scientifically observed deep-space phenomenon.',
    'The upper sky holds a distant galaxy cluster with one restrained gravitational-lensing arc and sparse foreground stars; it must feel physically plausible rather than like a fantasy wallpaper.',
    'A broad star-forming dust lane crosses a faint edge-on spiral galaxy, with cold dark structure, small hot stellar nurseries, and realistic atmospheric scattering near the horizon.',
    'A magnetically driven auroral curtain folds above the crystal horizon while a dense Milky-Way-like star field remains sharp only away from the damp ground haze.',
    'A sculpted molecular cloud is backlit by several young blue stars, revealing deep cavities, dusty knots, and one subtle jet of ionized material rather than a generic colorful nebula.'
]);
const DISCOVERY_EASTER_EGGS = Object.freeze([
    'Hide a tiny natural 23 motif in the terrain: two close amber Current motes beside three more distant white motes. It must reward a second look, never read as text or UI.',
    'On the far crashed Wanderer-77 hull, include two separated clusters of seven dim practical beacon lamps. Keep them tiny, weathered, and subordinate to the creature.',
    'Place one narrow mineral seam containing restrained red, charcoal-black, chalk-white, and living green bands together. It must look geological, not like a flag or logo.'
]);

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
const STAGE_SCALE = Object.freeze({
    baby: 'approximately 45 centimeters along its longest body axis',
    juvenile: 'approximately 85 centimeters along its longest body axis',
    adult: 'approximately 1.6 meters along its longest body axis',
    elder: 'approximately 2.3 meters along its longest body axis'
});

const defaultRuntime = Object.freeze({
    createClient,
    createGeminiClient: () => {
        const error = new Error('Portrait service is not configured');
        error.statusCode = 503;
        throw error;
    },
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

function getRetryMetadata(retryAt) {
    const parsedRetryAt = Date.parse(retryAt || '');
    const retryAfterSeconds = Number.isFinite(parsedRetryAt)
        ? Math.max(1, Math.ceil((parsedRetryAt - runtime.now()) / 1000))
        : 3600;
    return {
        retryAt: Number.isFinite(parsedRetryAt)
            ? new Date(parsedRetryAt).toISOString()
            : new Date(runtime.now() + (retryAfterSeconds * 1000)).toISOString(),
        retryAfterSeconds
    };
}

function statusCodeForJobResult(result) {
    if (result.status === 'succeeded') return 200;
    if (result.status === 'failed' || result.status === 'canceled') return 409;
    return 202;
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

function getReservationClient(event) {
    const accessToken = getBearerToken(event);
    const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY;
    if (!accessToken || !publicKey) {
        const error = new Error('Portrait ownership service is not configured');
        error.statusCode = 503;
        throw error;
    }
    return runtime.createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || SUPABASE_PROJECT_URL,
        publicKey,
        {
            global: {
                headers: { Authorization: `Bearer ${accessToken}` }
            },
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
    if (
        spec.schemaVersion !== 1 ||
        spec.promptVersion !== 'living-portrait-v6-alien-field-atlas'
    ) return false;
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
        spec.morphology?.bodyArchetype,
        spec.morphology?.headArchetype,
        spec.morphology?.hybridType,
        spec.morphology?.elementalAura,
        spec.silhouette?.bodyType,
        spec.silhouette?.geneticBodyType,
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

function formatPromptIdentifier(value, fallback) {
    return safeIdentifier(value, fallback)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .toLowerCase();
}

function promptHash(value) {
    let hash = 0x811C9DC5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function stablePromptChoice(values, identityKey, salt) {
    if (!Array.isArray(values) || values.length === 0) return '';
    const index = promptHash(`${identityKey}:${salt}`) % values.length;
    return values[index];
}

function buildHybridMechanics(primaryHead, hybridType) {
    const primary = safeIdentifier(primaryHead, 'feline');
    const secondary = COMPLEMENTARY_HEAD_TYPES[primary] || 'feline';
    const primaryLabel = formatPromptIdentifier(primary, 'feline');
    const secondaryLabel = formatPromptIdentifier(secondary, 'feline');

    if (hybridType === 'dual-hybrid' || hybridType === 'triple-hybrid') {
        const complexity = hybridType === 'triple-hybrid'
            ? 'complex composite'
            : 'subtle composite';
        return {
            secondaryHeadArchetype: secondary,
            description: `Interpret the ${complexity} identity as one coherent ${primaryLabel} cranial plan visibly fused with smaller, slightly offset ${secondaryLabel} traits. Blend their sensory functions through organically connected tissue rather than assembling literal sprite shapes. Preserve the reference's defining arrangement; do not create a second head, a second face, a collage, or extra eyes and appendages.`
        };
    }

    if (hybridType === 'glitchy') {
        return {
            secondaryHeadArchetype: null,
            description: `Preserve the offset cyan-magenta echoes around the ${primaryLabel} head as asymmetric iridescent sensory tissue and chromatic biological refraction. Do not depict pixels, a digital glitch, duplicated faces, or duplicated body parts.`
        };
    }

    return {
        secondaryHeadArchetype: null,
        description: `Interpret one coherent ${primaryLabel} cranial plan, retaining the count and defining arrangement of its visible sensory structures while creatively resolving their contours and tissue. Do not treat the internal archetype label as an instruction to copy an Earth species, add new appendages or blend in another head archetype.`
    };
}

function buildCreatureRealization(spec) {
    const identityKey = safeIdentifier(
        String(spec.identityKey || '').split(':').pop(),
        'identity'
    );
    const speciesBiology = SPECIES_BIOLOGY[spec.species]
        || SPECIES_BIOLOGY.stellarWyrm;
    const bodyType = safeIdentifier(
        spec.morphology?.bodyArchetype,
        'blob'
    );
    const affinity = safeIdentifier(spec.affinity?.element, 'star');
    const headType = safeIdentifier(spec.morphology?.headArchetype, 'feline');
    const hybridType = safeIdentifier(
        spec.morphology?.hybridType,
        'single-species'
    );
    const hybridMechanics = buildHybridMechanics(headType, hybridType);

    return Object.freeze({
        surfaceBiology: stablePromptChoice(
            speciesBiology,
            identityKey,
            'surface'
        ),
        bodyMechanics: BODY_MECHANICS[bodyType] || BODY_MECHANICS.blob,
        headBiology: HEAD_BIOLOGY[headType] || HEAD_BIOLOGY.feline,
        hybridMechanics: hybridMechanics.description,
        secondaryHeadArchetype: hybridMechanics.secondaryHeadArchetype,
        physicalScale: STAGE_SCALE[spec.stage] || STAGE_SCALE.baby,
        ecologyResponse: stablePromptChoice(
            AFFINITY_ECOLOGY[affinity] || AFFINITY_ECOLOGY.star,
            identityKey,
            'ecology'
        ),
        imperfection: stablePromptChoice(
            NATURAL_IMPERFECTIONS,
            identityKey,
            'imperfection'
        ),
        astronomicalBackdrop: stablePromptChoice(
            ASTRONOMICAL_BACKDROPS,
            identityKey,
            'astronomical-backdrop'
        ),
        discoveryEasterEgg: stablePromptChoice(
            DISCOVERY_EASTER_EGGS,
            identityKey,
            'discovery-easter-egg'
        )
    });
}

function buildCreaturePrompt(spec, style, {
    hasReferenceImage = false
} = {}) {
    spec = projectPortraitPromptTraits(spec);
    const palette = spec.palette;
    const silhouette = spec.silhouette || {};
    const eyes = spec.eyes || {};
    const markings = spec.markings || {};
    const personality = spec.personality || {};
    const affinity = spec.affinity || {};
    const variants = spec.variants || {};
    const morphology = spec.morphology || {};
    const paintedStyle = style === 'storybook' || style === 'watercolor';
    const isHatchling = spec.stage === 'baby';
    const abilities = Array.isArray(affinity.abilities)
        ? affinity.abilities.filter(value => safeIdentifier(value, '')).slice(0, 5)
        : [];
    const realization = buildCreatureRealization(spec);

    const referenceContract = hasReferenceImage
        ? [
            'IMAGE 1 IS THE AUTHORITATIVE IDENTITY REFERENCE, NOT A LITERAL ANATOMICAL BLUEPRINT.',
            'Depict the same individual through recognisable identity anchors: overall body mass and proportions, life stage, relative scale, palette, main sensory-feature arrangement, actual limb and wing count, signature markings and recorded mutations.',
            'The pixels are an identity map, not the requested visual style. Creatively resolve low-resolution ambiguity into plausible alien anatomy, musculature, skin, scales, feathers, crystal, translucency, or bioluminescence.',
            'Creatively reinterpret contours, facial forms, tissue connections and environmental adaptations, not just surface texture, while keeping the creature recognisable as this individual.',
            'Identity fidelity does not require exact polygon outlines, a literal triangular nose, circular head or oval torso. A simple sprite is visual shorthand for a living being, not a model to extrude.',
            'Translate simple masses into coherent living anatomy: a triangular accent may suggest folded sensory tissue, side points may become attached membranes, and oval markings may suggest structures beneath the skin. Use these as examples only when the actual traits support them; do not give every creature those features.',
            'Distinguish anatomy from effects. Ignore freestanding aura discs, selection rings, floating particles, labels and interface decoration; do not turn them into body parts. Interpret only attached biological features supported by the reference and bounded traits, never human clothing or a spacesuit.',
            'Ignore transparent pixels and any plain reference-sheet background.'
        ].join(' ')
        : 'Use the bounded genetics below as a fixed character model sheet for identity, not literal geometric construction. Creatively interpret those traits as coherent living alien biology without inventing a different species or unsupported appendages.';
    const identityReference = hasReferenceImage
        ? 'IMAGE 1'
        : 'the fixed character model sheet';

    return [
        'TASK // LIVING FORM REVEAL',
        `ART DIRECTION // ${CREATURE_ART_DIRECTION}`,
        paintedStyle
            ? 'Create one emotionally appealing, non-human mythical creature in a full-body painted field portrait.'
            : 'Create one emotionally appealing, non-human mythical creature in a full-body cinematic field portrait.',
        referenceContract,
        '',
        'IDENTITY LOCK',
        `A ${formatPromptIdentifier(spec.stage, 'baby')} ${formatPromptIdentifier(spec.species, 'cosmic creature')}.`,
        `Visible identity cues: ${formatPromptIdentifier(morphology.bodyArchetype, silhouette.bodyType || 'balanced')} body, ${formatPromptIdentifier(morphology.headArchetype, 'unknown')} head, ${formatPromptIdentifier(morphology.hybridType, 'single species')} hybrid structure, and ${formatPromptIdentifier(morphology.elementalAura, 'cosmic')} aura. Preserve this individual's overall plan and affinity; these internal labels are not literal geometric instructions or permission to copy Earth-animal anatomy. Express affinity through living material and restrained light, not an enclosing ring.`,
        `Latent genetic body: ${formatPromptIdentifier(silhouette.geneticBodyType, silhouette.bodyType || 'balanced')}. Only imply latent traits already visible in ${identityReference}; do not invent future-stage structures or abilities.`,
        `Wing gene: ${formatPromptIdentifier(silhouette.wingType, 'none')}; relative span ${Number(silhouette.wingSpan || 1).toFixed(2)}. Preserve only the wing structures visibly present in ${identityReference} at this life stage.`,
        `Palette anchors with minimal hue drift: body ${palette.body}; head ${palette.head}; wings ${palette.wings}; eyes ${palette.eyes}; feet ${palette.feet}; markings ${palette.markings}.`,
        `Eyes: ${formatPromptIdentifier(eyes.size, 'medium')}, softly glowing; unusual placement ${formatPromptIdentifier(eyes.unusualPlacement, 'none')}.`,
        `Markings: ${formatPromptIdentifier(markings.pattern, 'none')}; ${formatPromptIdentifier(markings.distribution, 'none')} distribution.`,
        `Distinctive features: ${describeFeatures(spec.specialFeatures)}.`,
        `Genetic mutations that must remain recognizable: ${describeFeatures(spec.mutations)}.`,
        `Temperament visible in posture and expression: ${formatPromptIdentifier(personality.core, 'curious')}; ${PERSONALITY_DESCRIPTIONS[personality.core]}.`,
        `Cosmic affinity: ${formatPromptIdentifier(affinity.element, 'star')}; ${AFFINITY_DESCRIPTIONS[affinity.element]}.`,
        `Innate abilities expressed through believable anatomy or restrained environmental effects: ${abilities.length ? abilities.map(value => formatPromptIdentifier(value, 'unknown')).join(', ') : 'none recorded yet'}.`,
        variants.shiny
            ? `Shiny variant: preserve the ${variants.shinyType} treatment.`
            : 'Use restrained magical effects so the creature remains readable.',
        '',
        'CREATIVE BIOLOGICAL REALIZATION // THIS INDIVIDUAL',
        `Surface biology: ${realization.surfaceBiology}.`,
        `Body mechanics: ${realization.bodyMechanics}`,
        `Head biology: ${realization.headBiology}`,
        `Hybrid anatomy: ${realization.hybridMechanics}`,
        `Physical scale: ${realization.physicalScale}; make terrain, plants, depth, and lens perspective prove that scale.`,
        `Ecological response: ${realization.ecologyResponse}`,
        realization.imperfection,
        'RECOGNISABLE, NOT LITERAL // Preserve identity anchors while allowing organic anatomical interpretation. Do not copy primitive geometry, replace the individual, add unsupported functional appendages or erase its distinctive mutations and colour pattern.',
        'Life-stage continuity: preserve the recorded stage and recognisable lineage. A baby must not become an adult, and fused traits must resolve into one coherent individual rather than unrelated pieces.',
        'Push the realization beyond a polished sprite: invent credible micro-anatomy, material transitions, weight, breathing, and ecosystem contact that could only belong to this individual.',
        '',
        'STYLE SEPARATION // MANDATORY',
        paintedStyle
            ? 'Interpret living tissue through the selected painting medium, with expressive contours, dimensional form and tactile materials. Do not simply paint over or trace the game sprite.'
            : 'The output must look captured by a physical camera in a real alien ecosystem, not rendered from a game asset.',
        paintedStyle
            ? 'Suggest fine scales, translucent membranes, feather filaments, mineral growth, moisture and natural imperfections through purposeful brushwork appropriate to this individual.'
            : 'Show continuous high-frequency biological texture: pores, fine scales, translucent membranes, feather filaments, mineral growth, moisture, subsurface scattering, and natural imperfections as appropriate to this individual.',
        'Use complex curved anatomy and realistic depth. Never trace the sprite outline, preserve square pixels, reproduce flat circles or rectangles, or retain low-resolution stair-stepping.',
        'At normal viewing size there must be no visible pixel grid, block edge, sprite softness, artificial upscaling, or game-render appearance anywhere in the creature or terrain.',
        '',
        ...(paintedStyle ? [
            'PAINTED MATERIAL AND DEPTH // MANDATORY',
            'Use the requested illustration medium consistently for both creature and habitat. Build depth through overlapping forms, coherent lighting, contact shadows and atmospheric perspective, not camera artifacts or photographic surface noise.',
            'Keep the recorded eye size and recognisable arrangement, expressing living attention through painted depth and scene-derived highlights rather than glossy toy eyes.',
            'Let brushwork describe organic transitions and irregular growth. Retain weight, compression and contact with the world without turning the subject into a flat icon, a toy or disconnected geometric pieces.'
        ] : [
            'OPTICAL REALISM GATE // MANDATORY',
            'The frame must plausibly look photographed on location with a living organism, not presented as character design, concept art, or a polished animation render.',
            'Preserve the recorded eye size and placement, but construct real corneal depth, wet tear lines, eyelid margins or nictitating membranes, naturally imperfect pupils, and scene-derived catchlights. Never use glossy toy or animation-character eyes.',
            'Use physically coherent light sources, contact occlusion, subtle lens aberration, restrained sensor grain, imperfect focus falloff, and atmospheric scattering consistent with one real camera exposure.',
            'Every surface needs irregular pore-scale microgeometry, uneven moisture, fine debris, and organic transitions between skin, scale, feather, membrane, crystal, or filament. Avoid smooth digital surfaces, airbrushing, and pristine bilateral symmetry.'
        ]),
        'APPEAL AND PERSONALITY // ALIVE, ALIEN AND APPROACHABLE',
        'Make this an individual the viewer wants to meet: do not sacrifice warmth or readable expression to make it stranger. Show a clear emotional presence through posture, attentive sensory tissue and a small, believable response to its surroundings.',
        'Preserve the recorded eye size and placement, body plan and palette. Approachability comes from this individual\'s expression and living behaviour, not a shared mascot body or colour scheme.',
        isHatchling
            ? 'Let a hatchling look young and endearing, with softness and tentative curiosity where its anatomy supports them. Do not age it up to avoid cuteness or exaggerate its head and eyes into unrelated proportions.'
            : 'Retain approachable personality at the recorded life stage, without making an older creature look newly hatched. Let maturity show through its existing proportions, stance and materials.',
        'Use the selected medium for believable depth, tissue and ground contact, not a plastic collectible finish. Distinctive alien biology and immediate emotional appeal should reinforce one another.',
        '',
        isHatchling ? 'SETTING // THE FEND, FIRST CONTACT' : 'SETTING // THE FEND, SANCTUARY ENCOUNTER',
        `Place the creature on real terrain in the alien Sanctuary clearing ${isHatchling ? 'shortly after hatching' : 'at its recorded life stage'}: damp dark ground, cyan and green bioluminescent plants, drifting Current motes interacting with the air, distant crystal formations, an indigo-violet nebula sky, and the crashed Wanderer-77 far behind it.`,
        `Deep-sky field atlas: ${realization.astronomicalBackdrop}`,
        `Quiet discovery detail: ${realization.discoveryEasterEgg}`,
        'The astronomy must be scientifically grounded but original: do not reproduce a specific observatory photograph and do not include NASA names, insignia, mission marks, spacecraft, interface graphics, or implied endorsement.',
        'Render the ecosystem with convincing scale, weathering, moisture, airborne particles, depth, and contact shadows. It is warm, wondrous, habitable, and mysterious rather than empty outer space.',
        '',
        'COMPOSITION',
        `Eye-level three-quarter wildlife encounter, full body and contact with the terrain visible, creature occupying about two thirds of the frame, ${paintedStyle ? 'eyes clearly readable, environmental context subordinate, carefully layered foreground and distance' : 'eyes in critical focus, environmental context readable, restrained cinematic depth of field'}.`,
        STYLE_MODIFIERS[style],
        paintedStyle
            ? 'Aim for a richly imagined encounter with a living alien in the selected painting medium. Preserve the emotional charm of the pixel identity without turning it into a generic Earth animal.'
            : 'Aim for a startling first-contact photograph from a premium live-action science-fantasy film. Preserve the emotional charm of the pixel identity without turning it into a generic Earth animal.',
        'Do not merely upscale, smooth, repaint, or extrude the pixel sprite. This is a creative biological realization of that exact individual.',
        '',
        'EXCLUSIONS',
        `No pixel art, no game sprite, no voxel art, no mascot render, no stylized animation character, no obvious CGI character render, no concept-art beauty render, no chibi or kawaii proportions, no plush toy, no plastic figurine, ${paintedStyle ? '' : 'no flat illustration, '}no generic Earth pet or familiar animal, no humans, no astronaut, no human clothing, no spacesuit, no text, no logo, no watermark, no frame, no UI, no extra creatures, no duplicate body parts, no unrecorded eyes, wings, horns, or limbs, no horror, no weapons.`
    ].join('\n');
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

function createPortraitAssetRef(jobId) {
    return JOB_ID_PATTERN.test(jobId || '')
        ? `${PORTRAIT_ASSET_REF_PREFIX}${jobId.toLowerCase()}`
        : null;
}

function parsePortraitAssetRef(value) {
    if (
        typeof value !== 'string' ||
        !value.startsWith(PORTRAIT_ASSET_REF_PREFIX)
    ) {
        return null;
    }
    const jobId = value.slice(PORTRAIT_ASSET_REF_PREFIX.length);
    return JOB_ID_PATTERN.test(jobId) ? jobId.toLowerCase() : null;
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
        prompt: buildCreaturePrompt(spec, style, {
            hasReferenceImage: Boolean(referenceImage)
        }),
        aspect_ratio: '1:1',
        quality: referenceImage ? 'high' : 'medium',
        number_of_images: 1,
        output_format: 'webp',
        output_compression: 92,
        background: 'opaque',
        moderation: 'auto'
    };
    if (referenceImage) {
        input.input_images = [referenceImage];
    }

    const [owner, model] = REPLICATE_MODEL.split('/');
    if (!owner || !model) throw new Error('Invalid portrait model configuration');

    const preferGemini = (
        process.env.PORTRAIT_IMAGE_PROVIDER || 'gemini'
    ).toLowerCase() !== 'replicate';
    let primaryGeminiError = null;
    if (preferGemini) {
        try {
            return await startGeminiGeneration(spec, style, referenceImage);
        } catch (gatewayError) {
            primaryGeminiError = gatewayError;
            if (!process.env.REPLICATE_API_TOKEN) throw gatewayError;
            console.warn('[LivingPortrait] Managed image gateway unavailable; trying Replicate', {
                providerStatus: gatewayError.providerStatus
            });
        }
    }

    if (!process.env.REPLICATE_API_TOKEN) {
        return startGeminiGeneration(spec, style, referenceImage);
    }

    try {
        return await callReplicate(`/models/${encodeURIComponent(owner)}/${encodeURIComponent(model)}/predictions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Prefer: 'wait=10'
            },
            body: JSON.stringify({ input })
        });
    } catch (error) {
        const canFailOver = (
            [401, 402, 403, 404].includes(error.providerStatus) ||
            error.providerStatus >= 500
        );
        if (!canFailOver) throw error;
        console.warn('[LivingPortrait] Replicate unavailable; using managed image gateway', {
            providerStatus: error.providerStatus
        });
        if (primaryGeminiError) {
            throw primaryGeminiError;
        }
        return startGeminiGeneration(spec, style, referenceImage);
    }
}

async function startGeminiGeneration(spec, style, referenceImage) {
    const parts = [{
        text: buildCreaturePrompt(spec, style, {
            hasReferenceImage: Boolean(referenceImage)
        })
    }];
    if (referenceImage) {
        parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: referenceImage.slice('data:image/png;base64,'.length)
            }
        });
    }

    let payload;
    try {
        const ai = runtime.createGeminiClient();
        payload = await ai.models.generateContent({
            model: GEMINI_IMAGE_MODEL,
            contents: parts,
            config: {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio: '1:1',
                    imageSize: '1K'
                }
            }
        });
    } catch (providerError) {
        const providerStatus = Number(
            providerError?.status ||
            providerError?.statusCode ||
            providerError?.code
        );
        const managedGatewayConfigured = Boolean(
            process.env.GEMINI_API_KEY &&
            process.env.GOOGLE_GEMINI_BASE_URL
        );
        const directGeminiConfigured = Boolean(
            process.env.GEMINI_API_KEY &&
            !process.env.GOOGLE_GEMINI_BASE_URL
        );
        const configurationFailure = (
            (!directGeminiConfigured && !managedGatewayConfigured) ||
            /api key|credential|configured/i.test(providerError?.message || '')
        );
        console.error(`[LivingPortrait] Gemini request failed ${JSON.stringify({
            providerStatus: Number.isFinite(providerStatus) ? providerStatus : null,
            reason: classifyGeminiFailure(providerError),
            directGeminiConfigured,
            gatewayConfigured: managedGatewayConfigured,
            universalGatewayConfigured: Boolean(
                process.env.NETLIFY_AI_GATEWAY_KEY &&
                process.env.NETLIFY_AI_GATEWAY_BASE_URL
            )
        })}`);
        const error = new Error(
            configurationFailure
                ? 'Portrait service is not configured'
                : 'Portrait fallback provider request failed'
        );
        error.statusCode = configurationFailure
            ? 503
            : (providerStatus === 429 ? 429 : 502);
        error.providerStatus = Number.isFinite(providerStatus)
            ? providerStatus
            : undefined;
        throw error;
    }

    const outputPart = payload.candidates?.[0]?.content?.parts?.find(part => {
        const inline = part?.inlineData || part?.inline_data;
        const mimeType = inline?.mimeType || inline?.mime_type;
        return !part?.thought && mimeType?.startsWith('image/') && inline?.data;
    });
    const inline = outputPart?.inlineData || outputPart?.inline_data;
    const mimeType = inline?.mimeType || inline?.mime_type;
    if (!inline?.data || !/^image\/(png|webp|jpeg)$/.test(mimeType || '')) {
        const error = new Error('Portrait fallback provider returned no image');
        error.statusCode = 502;
        throw error;
    }

    return {
        id: `netlify-gateway-${runtime.now()}`,
        status: 'succeeded',
        provider: process.env.GOOGLE_GEMINI_BASE_URL
            ? 'Netlify AI Gateway'
            : 'Google Gemini',
        model: GEMINI_IMAGE_MODEL,
        output: {
            inlineImage: {
                mimeType,
                data: inline.data
            }
        }
    };
}

async function getPrediction(predictionId) {
    return callReplicate(`/predictions/${encodeURIComponent(predictionId)}`);
}

async function reserveJob(reservationClient, spec, style) {
    const { data, error } = await reservationClient.rpc('reserve_creature_portrait_job', {
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
                : 'Creature media is temporarily unavailable'
        );
        limited.statusCode = data.reason === 'rate_limited' ? 429 : 403;
        if (data.reason === 'rate_limited') {
            Object.assign(limited, getRetryMetadata(data.retry_at));
            limited.code = 'new_identity_quota';
            limited.retryable = true;
        }
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
        assetRef: createPortraitAssetRef(job.id),
        imageUrl: data.signedUrl,
        provider: job.provider || 'Replicate',
        model: job.model || REPLICATE_MODEL,
        style: job.style,
        expiresAt: runtime.now() + (OUTPUT_TTL_SECONDS * 1000),
        storage: 'supabase-private'
    };
}

async function persistPredictionOutput(adminClient, userId, job, prediction) {
    const inlineImage = prediction.output?.inlineImage;
    let contentType;
    let bytes;
    if (inlineImage?.data) {
        contentType = String(inlineImage.mimeType || '').toLowerCase();
        bytes = Buffer.from(inlineImage.data, 'base64');
    } else {
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

        contentType = String(response.headers?.get?.('content-type') || '')
            .split(';')[0]
            .trim()
            .toLowerCase();
        bytes = Buffer.from(await response.arrayBuffer());
    }
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
        provider: prediction.provider || 'Replicate',
        model: prediction.model || REPLICATE_MODEL,
        storage_path: storagePath,
        error_code: null,
        completed_at: completedAt
    });
    return signStoredPortrait(adminClient, storedJob);
}

async function resultForJob(adminClient, userId, job) {
    if (job.status === 'succeeded') {
        try {
            return await signStoredPortrait(adminClient, job);
        } catch (error) {
            await updateOwnedJob(adminClient, userId, job.id, {
                status: 'failed',
                error_code: 'storage_unavailable',
                counts_toward_daily_limit: false,
                completed_at: new Date(runtime.now()).toISOString()
            });
            error.code = 'generation_failed';
            error.retryable = true;
            throw error;
        }
    }
    if (job.status === 'failed' || job.status === 'canceled') {
        return {
            success: false,
            status: job.status,
            jobId: job.id,
            assetRef: createPortraitAssetRef(job.id),
            error: 'Portrait generation failed',
            code: 'generation_failed',
            retryable: true
        };
    }
    if (!job.provider_prediction_id) {
        return {
            success: true,
            status: job.status || 'starting',
            jobId: job.id,
            assetRef: createPortraitAssetRef(job.id)
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
            counts_toward_daily_limit: false,
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
        jobId: job.id,
        assetRef: createPortraitAssetRef(job.id)
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
            const assetRef = event.queryStringParameters?.assetRef;
            const jobId = assetRef
                ? parsePortraitAssetRef(assetRef)
                : event.queryStringParameters?.jobId;
            if (!JOB_ID_PATTERN.test(jobId || '')) {
                return json(400, {
                    success: false,
                    error: assetRef
                        ? 'Invalid portrait asset reference'
                        : 'Invalid portrait job ID'
                });
            }
            const job = await getOwnedJob(adminClient, user.id, jobId);
            const result = await resultForJob(adminClient, user.id, job);
            return json(statusCodeForJobResult(result), result);
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

        const reservationClient = getReservationClient(event);
        const reservation = await reserveJob(
            reservationClient,
            body.portraitSpec,
            style
        );
        activeJobId = reservation.job_id;
        ownsActiveJob = reservation.reused !== true;
        const job = await getOwnedJob(adminClient, user.id, activeJobId);
        if (reservation.reused === true) {
            const reusedResult = await resultForJob(adminClient, user.id, job);
            return json(statusCodeForJobResult(reusedResult), {
                ...reusedResult,
                identityCacheHit: true,
                quotaConsumed: false
            });
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
            return json(200, {
                ...result,
                identityCacheHit: false,
                quotaConsumed: reservation.counts_toward_daily_limit !== false
            });
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
            jobId: job.id,
            assetRef: createPortraitAssetRef(job.id),
            identityCacheHit: false,
            quotaConsumed: reservation.counts_toward_daily_limit !== false
        });
    } catch (error) {
        if (adminClient && user?.id && activeJobId && ownsActiveJob) {
            try {
                await updateOwnedJob(adminClient, user.id, activeJobId, {
                    status: 'failed',
                    error_code: 'request_failed',
                    counts_toward_daily_limit: false,
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
        const retryable = error.retryable === true ||
            [429, 502, 503].includes(error.statusCode);
        const headers = error.statusCode === 429
            ? { 'Retry-After': String(error.retryAfterSeconds || 3600) }
            : {};
        return json(error.statusCode || 500, {
            success: false,
            status: error.statusCode === 429 ? 'deferred' : 'failed',
            error: error.message || 'Portrait generation failed',
            code: error.code || 'portrait_generation_failed',
            retryable,
            retryAt: error.retryAt || undefined,
            retryAfterSeconds: error.retryAfterSeconds || undefined
        }, headers);
    }
};

exports._internal = {
    ALLOWED_STYLES,
    CREATURE_ART_DIRECTION,
    buildCreatureRealization,
    buildCreaturePrompt,
    createPortraitAssetRef,
    getBearerToken,
    getOutputUrl,
    getRetryMetadata,
    isAllowedProviderImageUrl,
    isFeatureEnabled,
    isSameOrigin,
    parsePortraitAssetRef,
    parseReferenceImage,
    statusCodeForJobResult,
    resetRuntime() {
        runtime = { ...defaultRuntime };
    },
    setRuntime(overrides = {}) {
        runtime = { ...runtime, ...overrides };
    },
    validatePortraitSpec
};
