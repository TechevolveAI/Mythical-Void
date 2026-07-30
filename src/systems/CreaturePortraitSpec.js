/**
 * CreaturePortraitSpec
 *
 * Converts procedural creature genetics into a stable, provider-neutral visual
 * identity contract. Image and video providers receive this normalized shape
 * instead of the mutable game state tree.
 */

(function initializeCreaturePortraitSpec(globalScope) {
    const SCHEMA_VERSION = 1;
    const PROMPT_VERSION = 'living-portrait-v1';
    const VALID_STAGES = new Set(['baby', 'juvenile', 'adult', 'elder']);
    const VALID_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);

    function cleanText(value, fallback = 'unknown', maxLength = 80) {
        if (typeof value !== 'string') return fallback;
        const cleaned = value
            .replace(/[\u0000-\u001F\u007F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLength);
        return cleaned || fallback;
    }

    function clampNumber(value, fallback = 0, min = 0, max = 1) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(max, Math.max(min, parsed));
    }

    function toHexColor(value, fallback = '#9370DB') {
        if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
            return value.toUpperCase();
        }
        if (Number.isInteger(value) && value >= 0 && value <= 0xFFFFFF) {
            return `#${value.toString(16).padStart(6, '0').toUpperCase()}`;
        }
        return fallback;
    }

    function cleanStringArray(values, maxItems = 6) {
        if (!Array.isArray(values)) return [];
        return values
            .map(value => cleanText(value, '', 48))
            .filter(Boolean)
            .slice(0, maxItems);
    }

    function normalizeFeatureList(features, maxItems = 6) {
        if (!Array.isArray(features)) return [];
        return features.slice(0, maxItems).map(feature => ({
            type: cleanText(feature?.type, 'unknown', 48),
            variant: cleanText(feature?.variant, 'standard', 48),
            intensity: clampNumber(feature?.intensity, 0.5)
        }));
    }

    function stableStringify(value) {
        if (Array.isArray(value)) {
            return `[${value.map(stableStringify).join(',')}]`;
        }
        if (value && typeof value === 'object') {
            return `{${Object.keys(value)
                .sort()
                .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
                .join(',')}}`;
        }
        return JSON.stringify(value);
    }

    function hashString(value) {
        let hash = 0x811C9DC5;
        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    function create({ genes, name, stage = 'baby' } = {}) {
        if (!genes || typeof genes !== 'object') {
            throw new Error('Creature genetics are required to create a portrait identity');
        }

        const traits = genes.traits || {};
        const features = traits.features || {};
        const colors = traits.colorGenome || {};
        const markings = features.markings || {};
        const eyes = features.eyes || {};
        const wings = features.wings || {};
        const personality = genes.personality || {};
        const affinity = genes.cosmicAffinity || {};
        const normalizedStage = VALID_STAGES.has(stage) ? stage : 'baby';
        const rarity = VALID_RARITIES.has(genes.rarity) ? genes.rarity : 'common';
        const mutations = normalizeFeatureList(features.wackyMutations);
        const extraEyes = mutations.find(mutation => mutation.type === 'extra_eyes');

        const spec = {
            schemaVersion: SCHEMA_VERSION,
            promptVersion: PROMPT_VERSION,
            creatureId: cleanText(genes.id, 'unidentified-creature', 96),
            name: cleanText(name, 'Mythical Creature', 40),
            stage: normalizedStage,
            species: cleanText(genes.species, 'cosmic creature', 48),
            rarity,
            silhouette: {
                bodyType: cleanText(traits.bodyShape?.type, 'balanced', 32),
                bodyIntensity: clampNumber(traits.bodyShape?.intensity, 0.5),
                wingType: cleanText(wings.type, 'none', 32),
                wingSpan: clampNumber(wings.span, 1, 0, 2)
            },
            palette: {
                body: toHexColor(colors.primary),
                head: toHexColor(colors.head, toHexColor(colors.primary)),
                wings: toHexColor(colors.secondary, '#6C8CD5'),
                eyes: toHexColor(eyes.color, toHexColor(colors.accent, '#FFD54F')),
                feet: toHexColor(colors.feet, toHexColor(colors.secondary, '#6C8CD5')),
                markings: toHexColor(colors.markings, toHexColor(colors.accent, '#FFD54F'))
            },
            eyes: {
                size: cleanText(eyes.size, 'medium', 16),
                glow: clampNumber(eyes.glow, 0.4),
                unusualPlacement: extraEyes ? extraEyes.variant : null
            },
            markings: {
                pattern: cleanText(markings.pattern, 'none', 48),
                distribution: cleanText(markings.distribution, 'none', 32),
                intensity: clampNumber(markings.intensity, 0),
                animated: Boolean(markings.animation)
            },
            specialFeatures: normalizeFeatureList(features.specialFeatures),
            mutations,
            personality: {
                core: cleanText(personality.core, 'curious', 32),
                description: cleanText(personality.description, 'curious and kind', 120),
                quirks: cleanStringArray(personality.quirks, 3)
            },
            affinity: {
                element: cleanText(affinity.element, 'star', 32),
                description: cleanText(affinity.description, 'connected to stellar energy', 120),
                power: clampNumber(affinity.powerLevel, 0.5),
                visualEffects: cleanStringArray(affinity.visualEffects, 5)
            },
            variants: {
                shiny: Boolean(genes.isShiny),
                shinyType: genes.isShiny
                    ? cleanText(genes.shinyType, 'cosmic shimmer', 48)
                    : null,
                legendaryPrestige: Boolean(colors.isLegendaryPrestige)
            }
        };

        const identity = { ...spec };
        delete identity.name;
        spec.identityKey = `${spec.creatureId}:${spec.stage}:${hashString(stableStringify(identity))}`;
        return spec;
    }

    function isValid(spec) {
        if (!spec || typeof spec !== 'object') return false;
        return (
            spec.schemaVersion === SCHEMA_VERSION &&
            spec.promptVersion === PROMPT_VERSION &&
            typeof spec.identityKey === 'string' &&
            spec.identityKey.length <= 180 &&
            typeof spec.creatureId === 'string' &&
            VALID_STAGES.has(spec.stage) &&
            VALID_RARITIES.has(spec.rarity) &&
            typeof spec.species === 'string' &&
            /^#[0-9A-F]{6}$/.test(spec.palette?.body || '')
        );
    }

    const api = Object.freeze({
        SCHEMA_VERSION,
        PROMPT_VERSION,
        create,
        isValid,
        toHexColor
    });

    if (globalScope) {
        globalScope.CreaturePortraitSpec = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : null);
