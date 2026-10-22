const CreaturePortraitSpec = require('../../systems/CreaturePortraitSpec.js');
const KINDS = ['ordinary', 'shiny-mutated', 'legacy-no-dna'];
const STAGES = ['baby', 'juvenile', 'adult', 'elder'];
const STYLES = ['cinematic', 'storybook', 'cosmic', 'watercolor'];

function createPromptSpec(kind = 'ordinary', stage = 'baby') {
    const genes = {
        id: 'synthetic-prompt-identity-' + kind, species: 'stellarWyrm', rarity: 'rare',
        traits: {
            bodyShape: { type: 'balanced' },
            colorGenome: { primary: 0x336677, secondary: 0xCCAA44, accent: 0x99CCBB },
            features: { eyes: { size: 'medium' }, wings: { type: 'feathered', span: 1.25 },
                markings: { pattern: 'constellation_dots', distribution: 'symmetrical' },
                specialFeatures: [], wackyMutations: [] }
        },
        personality: { core: 'curious' },
        cosmicAffinity: { element: 'star', specialAbilities: ['light_generation', 'warmth_sharing'] }
    };
    if (kind === 'shiny-mutated') {
        genes.species = 'crystalDrake'; genes.rarity = 'legendary';
        genes.isShiny = true; genes.shinyType = 'golden';
        genes.traits.features.specialFeatures = [
            { type: 'crystal_growth', variant: 'spiral_patterns' },
            { type: 'bioluminescent_spots', variant: 'twinkling' },
            { type: 'void_wings', variant: 'portal-like' }
        ];
        genes.traits.features.wackyMutations = [
            { type: 'extra_eyes', variant: 'forehead' },
            { type: 'cosmic_horns', variant: 'star_tipped' },
            { type: 'mechanical_parts', variant: 'clockwork' }
        ];
    }
    if (kind === 'legacy-no-dna') {
        genes.species = 'nebulaSprite'; genes.isShiny = true; genes.shinyType = 'aurora';
        genes.cosmicAffinity.element = 'moon'; genes.cosmicAffinity.specialAbilities = ['dream_weaving'];
    }
    return CreaturePortraitSpec.create({ genes, stage, name: 'SYNTHETIC_NAME_NOT_FOR_PROVIDER',
        dna: kind === 'legacy-no-dna' ? null : { id: 'synthetic-private-dna',
            bodyArchetype: 'winged', headArchetype: 'insectoid',
            hybridTag: 'dual-hybrid', elementalAura: 'storm' } });
}
module.exports = { KINDS, STAGES, STYLES, createPromptSpec };
