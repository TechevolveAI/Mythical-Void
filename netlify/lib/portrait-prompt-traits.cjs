// This vocabulary describes fictional biology, not saved identity. Keep unknown
// browser text out of provider prompts without rewriting a genome or cache key.
const POLICY_VERSION = 'portrait-provider-traits-v1';
const BODIES = ['blob', 'quadruped', 'biped', 'serpentine', 'winged', 'slender',
    'balanced', 'sturdy', 'fish', 'cyclops', 'avian', 'reptilian', 'insectoid'];
const HEADS = ['feline', 'canine', 'avian', 'reptile', 'aquatic', 'simian',
    'insectoid', 'rodent', 'cervine', 'unknown'];
const HYBRIDS = ['single-species', 'dual-hybrid', 'triple-hybrid', 'glitchy'];
const AURAS = ['cosmic', 'forest', 'ember', 'tidal', 'storm', 'shadow-soft',
    'star', 'moon', 'nebula', 'crystal', 'void'];
const WINGS = ['none', 'feathered', 'crystal', 'ethereal', 'armored', 'flaming'];
const PATTERNS = ['none', 'spots', 'stripes', 'simple_sparkles', 'sparkles', 'swirls',
    'crescents', 'complex_spots', 'galaxy_swirls', 'constellation_dots', 'aurora_stripes',
    'crystal_facets', 'nebula_trail', 'stellar_mandala', 'twilight_rings',
    'cosmic_fractals', 'reality_rifts', 'time_spirals', 'void_portals'];
const DISTRIBUTIONS = ['none', 'scattered', 'clustered', 'symmetrical', 'flowing', 'central'];
const ABILITIES = ['light_generation', 'warmth_sharing', 'dream_weaving', 'night_vision',
    'emotion_sensing', 'color_changing', 'healing_resonance', 'memory_storing',
    'space_sensing', 'portal_creation', 'stellar_burst', 'constellation_sense'];
// aurora is retained by the existing portrait-spec compatibility fixture.
const SHINY_TYPES = ['sparkle', 'chromatic', 'inverted', 'golden', 'aurora', 'cosmic shimmer'];
const STANDARD_VARIANTS = ['standard', 'enhanced', 'unique'];
const FEATURES = Object.freeze({
    soft_glow: STANDARD_VARIANTS,
    gentle_shimmer: STANDARD_VARIANTS,
    color_shift_wings: STANDARD_VARIANTS,
    twinkling_eyes: STANDARD_VARIANTS,
    crystal_growth: ['small_clusters', 'large_formations', 'spiral_patterns', 'geometric'],
    bioluminescent_spots: ['steady_glow', 'pulsing', 'breathing', 'twinkling'],
    shimmer_wings: STANDARD_VARIANTS,
    aurora_wing_tips: STANDARD_VARIANTS,
    constellation_eyes: STANDARD_VARIANTS,
    prismatic_scales: STANDARD_VARIANTS,
    aurora_aura: ['flowing', 'static', 'rippling', 'cascading'],
    constellation_markings: STANDARD_VARIANTS,
    nebula_trail: ['wispy', 'dense', 'colorful', 'ethereal'],
    star_dust_emanation: STANDARD_VARIANTS,
    reality_distortion: STANDARD_VARIANTS,
    cosmic_resonance: STANDARD_VARIANTS,
    stellar_core: ['bright', 'pulsing', 'rotating', 'expanding'],
    void_wings: ['translucent', 'shadow', 'rippling', 'portal-like'],
    time_ripples: STANDARD_VARIANTS,
    dimensional_shadows: STANDARD_VARIANTS
});
const MUTATIONS = Object.freeze({
    rock_texture: ['rough', 'smooth', 'crystalline', 'volcanic'],
    gem_body: ['ruby', 'sapphire', 'emerald', 'amethyst', 'diamond'],
    geometric_patterns: ['triangles', 'hexagons', 'fractals', 'spirals'],
    extra_eyes: ['forehead', 'sides', 'back', 'floating'],
    floating_parts: ['orbs', 'fragments', 'rings', 'crystals'],
    crystal_growths: ['clusters', 'spires', 'embedded', 'crown'],
    inanimate_markings: ['circuits', 'runes', 'gears', 'glyphs'],
    surreal_appendages: ['tentacles', 'ribbons', 'flames', 'shadows'],
    void_patches: ['small', 'medium', 'swirling', 'crackling'],
    prismatic_sheen: ['rainbow', 'opalescent', 'oil_slick', 'aurora'],
    mechanical_parts: ['gears', 'pistons', 'clockwork', 'pipes'],
    circuit_veins: ['blue_glow', 'green_glow', 'gold_glow', 'pulsing'],
    elemental_aura: ['fire', 'ice', 'lightning', 'wind'],
    plant_growth: ['vines', 'flowers', 'moss', 'leaves'],
    bioluminescence: ['spots', 'stripes', 'patches', 'veins'],
    phantom_limbs: ['arms', 'wings', 'tail', 'tendrils'],
    cosmic_horns: ['star_tipped', 'crystal', 'spiral', 'branching'],
    nebula_trails: ['misty', 'sparkling', 'flowing', 'swirling'],
    scale_armor: ['dragon', 'fish', 'reptile', 'metallic'],
    feather_mane: ['mohawk', 'flowing', 'spiked', 'royal']
});

function choice(value, vocabulary, fallback) {
    return typeof value === 'string' && vocabulary.includes(value) ? value : fallback;
}

function featureList(values, vocabulary) {
    if (!Array.isArray(values)) return [];
    return values.slice(0, 6).flatMap(value => (
        typeof value?.type === 'string' && Object.hasOwn(vocabulary, value.type) &&
        vocabulary[value.type].includes(value.variant)
            ? [{ type: value.type, variant: value.variant }]
            : []
    ));
}

function projectPortraitPromptTraits(spec) {
    const body = choice(spec.morphology?.bodyArchetype, BODIES, 'balanced');
    const finiteSpan = typeof spec.silhouette?.wingSpan === 'number' &&
        Number.isFinite(spec.silhouette.wingSpan) ? spec.silhouette.wingSpan : 1;
    const palette = Object.fromEntries(['body', 'head', 'wings', 'eyes', 'feet', 'markings']
        .map(key => [key, /^#[0-9A-F]{6}$/.test(spec.palette?.[key] || '')
            ? spec.palette[key] : '#9370DB']));
    return {
        // Used only for deterministic, local selection of authored descriptions.
        identityKey: typeof spec.identityKey === 'string' ? spec.identityKey : '',
        stage: choice(spec.stage, ['baby', 'juvenile', 'adult', 'elder'], 'baby'),
        species: choice(spec.species, ['stellarWyrm', 'crystalDrake', 'nebulaSprite',
            'voidStalker', 'cosmicGuardian', 'auroraPhoenix', 'crystalElemental'], 'stellarWyrm'),
        morphology: {
            bodyArchetype: body,
            headArchetype: choice(spec.morphology?.headArchetype, HEADS, 'unknown'),
            hybridType: choice(spec.morphology?.hybridType, HYBRIDS, 'single-species'),
            elementalAura: choice(spec.morphology?.elementalAura, AURAS, 'cosmic')
        },
        silhouette: {
            bodyType: choice(spec.silhouette?.bodyType, BODIES, body),
            geneticBodyType: choice(spec.silhouette?.geneticBodyType, BODIES, body),
            wingType: choice(spec.silhouette?.wingType, WINGS, 'none'),
            wingSpan: Math.min(2, Math.max(0, finiteSpan))
        },
        palette,
        eyes: {
            size: choice(spec.eyes?.size, ['small', 'medium', 'large'], 'medium'),
            unusualPlacement: choice(spec.eyes?.unusualPlacement, MUTATIONS.extra_eyes, null)
        },
        markings: {
            pattern: choice(spec.markings?.pattern, PATTERNS, 'none'),
            distribution: choice(spec.markings?.distribution, DISTRIBUTIONS, 'none')
        },
        specialFeatures: featureList(spec.specialFeatures, FEATURES),
        mutations: featureList(spec.mutations, MUTATIONS),
        personality: {
            core: choice(spec.personality?.core,
                ['curious', 'playful', 'gentle', 'wise', 'energetic'], 'curious')
        },
        affinity: {
            element: choice(spec.affinity?.element, ['star', 'moon', 'nebula', 'crystal', 'void'], 'star'),
            abilities: Array.isArray(spec.affinity?.abilities)
                ? spec.affinity.abilities.filter(value => ABILITIES.includes(value)).slice(0, 5) : []
        },
        variants: {
            shiny: spec.variants?.shiny === true,
            shinyType: choice(spec.variants?.shinyType, SHINY_TYPES, 'cosmic shimmer')
        }
    };
}

module.exports = { POLICY_VERSION, projectPortraitPromptTraits };
