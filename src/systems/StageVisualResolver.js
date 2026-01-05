/**
 * StageVisualResolver - Translates genetic destiny into stage-appropriate visual traits
 *
 * The creature's DNA stores its "destiny" (adult form), but what actually renders
 * depends on the current lifecycle stage. This system creates dramatic visual
 * transformation from baby blob to fully-expressed adult to transcendent elder.
 *
 * Stage Progression:
 * - Baby: Adorable blob, huge eyes, no features, pastel colors
 * - Juvenile: Transitional form, feature buds emerging, colors developing
 * - Adult: Full genetic expression, all features, peak vibrancy
 * - Elder: Transcendent form, crystalline accents, cosmic aura, wisdom marks
 */

class StageVisualResolver {
    constructor() {
        // Stage configuration defaults
        this.stageConfig = {
            baby: {
                bodyOverride: 'baby_blob',
                bodyTransition: 0.0,
                featureEmergence: 0.0,
                markingComplexity: 'simple_only',
                colorMode: 'pastel',
                colorSaturation: 0.7,
                eyeSizeMultiplier: 2.5,
                headSizeMultiplier: 1.8,
                bodyRoundness: 2.0,
                destinyHints: true,
                wackyMutationChance: 0.05
            },
            juvenile: {
                bodyOverride: null, // Use transitional
                bodyTransition: 0.4,
                featureEmergence: 0.3,
                markingComplexity: 'basic',
                colorMode: 'developing',
                colorSaturation: 0.85,
                eyeSizeMultiplier: 1.5,
                headSizeMultiplier: 1.3,
                bodyRoundness: 1.4,
                showFeatureBuds: true,
                wackyMutationChance: 0.08
            },
            adult: {
                bodyOverride: null, // Use genetic type
                bodyTransition: 1.0,
                featureEmergence: 1.0,
                markingComplexity: 'full',
                colorMode: 'vibrant',
                colorSaturation: 1.0,
                eyeSizeMultiplier: 1.0,
                headSizeMultiplier: 1.0,
                bodyRoundness: 1.0,
                wackyMutationChance: 0.12
            },
            elder: {
                bodyOverride: null, // Use genetic type + enhancements
                bodyTransition: 1.0,
                featureEmergence: 1.2, // Enhanced features
                markingComplexity: 'transcendent',
                colorMode: 'ethereal',
                colorSaturation: 0.95,
                eyeSizeMultiplier: 1.0,
                headSizeMultiplier: 1.0,
                bodyRoundness: 1.0,
                cosmicOverlay: true,
                crystallineAccents: true,
                wisdomMarks: true,
                auraLayers: 3,
                wackyMutationChance: 0.15
            }
        };

        // Wacky mutation types
        this.wackyMutationTypes = [
            'rock_texture',
            'gem_body',
            'geometric_patterns',
            'extra_eyes',
            'floating_parts',
            'crystal_growths',
            'inanimate_markings',
            'surreal_appendages',
            'void_patches',
            'prismatic_sheen'
        ];

        // Rarity bonus for wacky mutations
        this.rarityMutationBonus = {
            common: 0,
            uncommon: 0.02,
            rare: 0.05,
            epic: 0.08,
            legendary: 0.12
        };
    }

    /**
     * Main entry point - resolve all traits for a given stage
     * @param {Object} genetics - The creature's genetic data (destiny)
     * @param {string} stage - Current lifecycle stage
     * @returns {Object} Stage-appropriate visual traits
     */
    resolveTraitsForStage(genetics, stage) {
        if (!genetics || !genetics.traits) {
            console.warn('[StageVisualResolver] Invalid genetics provided');
            return this.getDefaultTraits(stage);
        }

        const config = this.stageConfig[stage] || this.stageConfig.adult;

        return {
            bodyType: this.resolveBodyType(genetics, stage, config),
            bodyTransition: config.bodyTransition,
            features: this.resolveFeatures(genetics, stage, config),
            markings: this.resolveMarkings(genetics, stage, config),
            colors: this.resolveColors(genetics, stage, config),
            specialEffects: this.resolveSpecialEffects(genetics, stage, config),
            wackyMutations: this.resolveWackyMutations(genetics, stage, config),
            stageConfig: config,
            destinyBodyType: genetics.traits.bodyShape?.type || 'balanced'
        };
    }

    /**
     * Resolve body type based on stage
     * Baby = blob, Juvenile = transitional, Adult = genetic, Elder = enhanced genetic
     */
    resolveBodyType(genetics, stage, config) {
        const destinyType = genetics.traits.bodyShape?.type || 'balanced';

        if (config.bodyOverride) {
            return config.bodyOverride;
        }

        switch (stage) {
            case 'baby':
                return 'baby_blob';

            case 'juvenile':
                // Return transitional marker - renderer will blend
                return `transitional_${destinyType}`;

            case 'adult':
                return destinyType;

            case 'elder':
                // Elder uses genetic type but with transcendent modifier
                return `elder_${destinyType}`;

            default:
                return destinyType;
        }
    }

    /**
     * Resolve features based on stage emergence
     * Baby has none, juvenile has buds, adult has full, elder has enhanced
     */
    resolveFeatures(genetics, stage, config) {
        const destinyFeatures = genetics.traits.features || {};
        const emergence = config.featureEmergence;

        // Baby: No complex features, just cuteness
        if (stage === 'baby') {
            return {
                wings: null,
                horns: null,
                tail: null,
                antennae: null,
                specialFeatures: [],
                // Baby-specific cute features
                sparkles: true,
                bigEyes: true,
                cheekBlush: true,
                destinyHints: config.destinyHints ? this.getDestinyHints(destinyFeatures) : null
            };
        }

        // Juvenile: Feature buds emerging
        if (stage === 'juvenile') {
            return {
                wings: destinyFeatures.wings ? { type: 'bud', destinyType: destinyFeatures.wings.type } : null,
                horns: this.hasHorns(genetics) ? { type: 'nub' } : null,
                tail: this.hasTail(genetics) ? { type: 'bud' } : null,
                antennae: this.hasAntennae(genetics) ? { type: 'nub' } : null,
                specialFeatures: this.getEmergingFeatures(destinyFeatures.specialFeatures, emergence),
                sparkles: false,
                bigEyes: false,
                cheekBlush: false,
                showFeatureBuds: true
            };
        }

        // Adult: Full genetic expression
        if (stage === 'adult') {
            return {
                wings: destinyFeatures.wings || null,
                horns: this.hasHorns(genetics) ? { type: 'full' } : null,
                tail: this.hasTail(genetics) ? { type: 'full' } : null,
                antennae: this.hasAntennae(genetics) ? { type: 'full' } : null,
                specialFeatures: destinyFeatures.specialFeatures || [],
                sparkles: false,
                bigEyes: false,
                cheekBlush: false
            };
        }

        // Elder: Enhanced + transcendent features
        if (stage === 'elder') {
            return {
                wings: destinyFeatures.wings ? {
                    ...destinyFeatures.wings,
                    enhanced: true,
                    ethereal: true
                } : null,
                horns: this.hasHorns(genetics) ? { type: 'crystalline' } : null,
                tail: this.hasTail(genetics) ? { type: 'ethereal' } : null,
                antennae: this.hasAntennae(genetics) ? { type: 'luminous' } : null,
                specialFeatures: this.getEnhancedFeatures(destinyFeatures.specialFeatures, emergence),
                crystallineAccents: config.crystallineAccents,
                wisdomMarks: config.wisdomMarks,
                cosmicAura: true,
                auraLayers: config.auraLayers
            };
        }

        return destinyFeatures;
    }

    /**
     * Resolve markings based on complexity level
     */
    resolveMarkings(genetics, stage, config) {
        const destinyMarkings = genetics.traits.features?.markings || {};
        const complexity = config.markingComplexity;

        // Baby: Simple spots only
        if (complexity === 'simple_only') {
            return {
                pattern: 'simple_spots',
                intensity: 0.3,
                opacity: 0.3,
                scale: 0.5,
                distribution: 'scattered',
                colorVariant: 'lighter'
            };
        }

        // Juvenile: Basic patterns emerging
        if (complexity === 'basic') {
            const basicPatterns = ['spots', 'stripes', 'simple_sparkles'];
            const pattern = basicPatterns.includes(destinyMarkings.pattern)
                ? destinyMarkings.pattern
                : 'spots';

            return {
                pattern,
                intensity: (destinyMarkings.intensity || 0.5) * 0.6,
                opacity: 0.6,
                scale: destinyMarkings.scale || 0.7,
                distribution: destinyMarkings.distribution || 'scattered',
                colorVariant: destinyMarkings.colorVariant || 'darker'
            };
        }

        // Adult: Full pattern
        if (complexity === 'full') {
            return {
                ...destinyMarkings,
                opacity: 1.0
            };
        }

        // Elder: Transcendent overlay
        if (complexity === 'transcendent') {
            return {
                ...destinyMarkings,
                opacity: 1.0,
                cosmicOverlay: true,
                wisdomGlow: true,
                overlayPattern: 'constellation_dots',
                overlayOpacity: 0.4
            };
        }

        return destinyMarkings;
    }

    /**
     * Resolve colors based on stage color mode
     */
    resolveColors(genetics, stage, config) {
        const colorGenome = genetics.traits.colorGenome || {};
        const mode = config.colorMode;
        const saturation = config.colorSaturation;

        const baseColors = {
            primary: colorGenome.primary || 0x9370DB,
            secondary: colorGenome.secondary || 0x87CEEB,
            accent: colorGenome.accent || 0xFFD700
        };

        // Apply saturation adjustment
        const adjustedColors = {
            body: this.adjustSaturation(baseColors.primary, saturation),
            wings: this.adjustSaturation(baseColors.secondary, saturation),
            head: this.blendColors(baseColors.primary, baseColors.secondary, 0.3),
            accent: this.adjustSaturation(baseColors.accent, saturation)
        };

        // Apply mode-specific modifications
        switch (mode) {
            case 'pastel':
                // Lighten and desaturate for baby softness
                adjustedColors.body = this.makePastel(adjustedColors.body);
                adjustedColors.wings = this.makePastel(adjustedColors.wings);
                adjustedColors.head = this.makePastel(adjustedColors.head);
                break;

            case 'developing':
                // Slightly muted, colors strengthening
                // No additional modification needed, saturation handles it
                break;

            case 'vibrant':
                // Full vibrancy - no modification
                break;

            case 'ethereal':
                // Add cosmic undertones for elder
                adjustedColors.body = this.addCosmicTint(adjustedColors.body);
                adjustedColors.wings = this.addCosmicTint(adjustedColors.wings);
                adjustedColors.auraColor = 0xE6E6FA; // Lavender cosmic aura
                break;
        }

        return {
            ...adjustedColors,
            colorGenome,
            saturation,
            mode
        };
    }

    /**
     * Resolve special effects based on stage
     */
    resolveSpecialEffects(genetics, stage, config) {
        const effects = [];
        const cosmicAffinity = genetics.cosmicAffinity || {};
        const rarity = genetics.rarity || 'common';

        // Baby: Cute effects only
        if (stage === 'baby') {
            effects.push({ type: 'cute_sparkle', intensity: 0.8 });
            effects.push({ type: 'soft_glow', intensity: 0.3 });
            return effects;
        }

        // Juvenile: Subtle shimmer
        if (stage === 'juvenile') {
            effects.push({ type: 'subtle_sparkle', intensity: 0.5 });
            if (cosmicAffinity.element) {
                effects.push({
                    type: 'elemental_hint',
                    element: cosmicAffinity.element,
                    intensity: 0.3
                });
            }
            return effects;
        }

        // Adult: Full rarity-based effects
        if (stage === 'adult') {
            if (rarity !== 'common') {
                effects.push({ type: 'cosmic_aura', intensity: this.getRarityIntensity(rarity) });
            }
            if (cosmicAffinity.element) {
                effects.push({
                    type: 'elemental_aura',
                    element: cosmicAffinity.element,
                    intensity: cosmicAffinity.powerLevel || 0.5
                });
            }
            // Add genetic special features
            const geneticFeatures = genetics.traits.features?.specialFeatures || [];
            geneticFeatures.forEach(f => effects.push(f));
            return effects;
        }

        // Elder: Maximum transcendence
        if (stage === 'elder') {
            effects.push({ type: 'ethereal_aura', intensity: 1.0, layers: config.auraLayers });
            effects.push({ type: 'wisdom_glow', intensity: 0.8 });
            if (cosmicAffinity.element) {
                effects.push({
                    type: 'transcendent_elemental',
                    element: cosmicAffinity.element,
                    intensity: 1.0
                });
            }
            // Enhanced genetic features
            const geneticFeatures = genetics.traits.features?.specialFeatures || [];
            geneticFeatures.forEach(f => {
                effects.push({ ...f, enhanced: true, intensity: (f.intensity || 0.5) * 1.3 });
            });
            return effects;
        }

        return effects;
    }

    /**
     * Resolve wacky mutations - uses genetics-stored mutations if available
     * Falls back to chance-based generation for legacy genetics
     */
    resolveWackyMutations(genetics, stage, config) {
        // PRIORITY: Use genetics-stored mutations if available (from CreatureGenetics)
        // These are inheritable through breeding
        const geneticMutations = genetics.traits?.features?.wackyMutations;

        if (geneticMutations && Array.isArray(geneticMutations) && geneticMutations.length > 0) {
            // Scale mutation intensity based on stage
            const stageIntensityScale = {
                baby: 0.3,      // Subtle hints of future mutations
                juvenile: 0.6,  // Mutations emerging
                adult: 1.0,     // Full expression
                elder: 1.2      // Enhanced mutations
            };

            const intensityScale = stageIntensityScale[stage] || 1.0;

            // Baby stage: show mutations at very low intensity as "destiny hints"
            if (stage === 'baby') {
                // Only show mutations if they have high dominance (very visible genes)
                return geneticMutations
                    .filter(m => m.dominance > 0.7)
                    .map(m => ({
                        ...m,
                        intensity: m.intensity * intensityScale * 0.5 // Very subtle
                    }));
            }

            return geneticMutations.map(m => ({
                ...m,
                intensity: m.intensity * intensityScale
            }));
        }

        // FALLBACK: Legacy chance-based mutation resolution
        // Used for creatures without genetics-stored mutations
        const mutations = [];
        const baseChance = config.wackyMutationChance || 0;
        const rarityBonus = this.rarityMutationBonus[genetics.rarity] || 0;
        const finalChance = baseChance + rarityBonus;

        // Use genetics ID as seed for consistency
        const seed = this.hashString(genetics.id || 'default');
        const roll = this.seededRandom(seed + stage);

        if (roll < finalChance) {
            // Select 1-2 mutations based on rarity
            const numMutations = genetics.rarity === 'legendary' ? 2 : 1;

            for (let i = 0; i < numMutations; i++) {
                const mutationIndex = Math.floor(this.seededRandom(seed + stage + i) * this.wackyMutationTypes.length);
                const mutationType = this.wackyMutationTypes[mutationIndex];

                // Ensure no duplicates
                if (!mutations.find(m => m.type === mutationType)) {
                    mutations.push({
                        type: mutationType,
                        intensity: 0.3 + this.seededRandom(seed + mutationType) * 0.5,
                        variant: this.selectMutationVariant(mutationType, seed)
                    });
                }
            }
        }

        return mutations;
    }

    // ============ Helper Methods ============

    /**
     * Get destiny hints - tiny visual nubs showing what the creature will become
     */
    getDestinyHints(destinyFeatures) {
        const hints = [];

        if (destinyFeatures.wings) {
            hints.push({ type: 'wing_bump', position: 'shoulders' });
        }
        if (destinyFeatures.specialFeatures?.some(f => f.type?.includes('horn'))) {
            hints.push({ type: 'horn_bump', position: 'head' });
        }

        return hints.length > 0 ? hints : null;
    }

    /**
     * Check if genetics indicate horns
     */
    hasHorns(genetics) {
        const bodyType = genetics.traits.bodyShape?.type;
        const features = genetics.traits.features?.specialFeatures || [];

        return features.some(f => f.type?.includes('horn')) ||
               ['reptilian', 'guardian', 'crystal'].includes(bodyType);
    }

    /**
     * Check if genetics indicate tail
     */
    hasTail(genetics) {
        const bodyType = genetics.traits.bodyShape?.type;
        return ['fish', 'serpentine', 'reptilian', 'quadruped', 'avian'].includes(bodyType);
    }

    /**
     * Check if genetics indicate antennae
     */
    hasAntennae(genetics) {
        const bodyType = genetics.traits.bodyShape?.type;
        return bodyType === 'insectoid';
    }

    /**
     * Get emerging features scaled by emergence level
     */
    getEmergingFeatures(specialFeatures, emergence) {
        if (!specialFeatures || emergence <= 0) return [];

        return specialFeatures
            .filter(() => Math.random() < emergence)
            .map(f => ({
                ...f,
                intensity: (f.intensity || 0.5) * emergence,
                emerging: true
            }));
    }

    /**
     * Get enhanced features for elder stage
     */
    getEnhancedFeatures(specialFeatures, emergence) {
        if (!specialFeatures) return [];

        return specialFeatures.map(f => ({
            ...f,
            intensity: Math.min(1.0, (f.intensity || 0.5) * emergence),
            enhanced: true,
            transcendent: true
        }));
    }

    /**
     * Get default traits when genetics are invalid
     */
    getDefaultTraits(stage) {
        return {
            bodyType: stage === 'baby' ? 'baby_blob' : 'balanced',
            bodyTransition: stage === 'baby' ? 0 : 1,
            features: {},
            markings: { pattern: 'spots', opacity: 0.5 },
            colors: {
                body: 0x9370DB,
                wings: 0x87CEEB,
                head: 0x8A6BBE,
                accent: 0xFFD700
            },
            specialEffects: [],
            wackyMutations: [],
            stageConfig: this.stageConfig[stage] || this.stageConfig.adult
        };
    }

    /**
     * Adjust color saturation
     */
    adjustSaturation(color, saturation) {
        if (saturation === 1.0) return color;

        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;

        const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);

        const newR = Math.round(gray + (r - gray) * saturation);
        const newG = Math.round(gray + (g - gray) * saturation);
        const newB = Math.round(gray + (b - gray) * saturation);

        return (newR << 16) | (newG << 8) | newB;
    }

    /**
     * Make color pastel (lighter + less saturated)
     */
    makePastel(color) {
        const r = Math.min(255, ((color >> 16) & 0xFF) + 60);
        const g = Math.min(255, ((color >> 8) & 0xFF) + 60);
        const b = Math.min(255, (color & 0xFF) + 60);

        return this.adjustSaturation((r << 16) | (g << 8) | b, 0.6);
    }

    /**
     * Add cosmic tint to color
     */
    addCosmicTint(color) {
        const cosmicPurple = 0xE6E6FA;
        return this.blendColors(color, cosmicPurple, 0.15);
    }

    /**
     * Blend two colors
     */
    blendColors(color1, color2, ratio) {
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;

        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;

        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);

        return (r << 16) | (g << 8) | b;
    }

    /**
     * Get rarity intensity for effects
     */
    getRarityIntensity(rarity) {
        const intensities = {
            common: 0,
            uncommon: 0.2,
            rare: 0.4,
            epic: 0.6,
            legendary: 0.8
        };
        return intensities[rarity] || 0;
    }

    /**
     * Hash string to number for seeded randomness
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    /**
     * Seeded random number generator (0-1)
     */
    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    /**
     * Select mutation variant based on seed
     */
    selectMutationVariant(mutationType, seed) {
        const variants = {
            rock_texture: ['rough', 'smooth', 'crystalline', 'volcanic'],
            gem_body: ['ruby', 'sapphire', 'emerald', 'amethyst', 'diamond'],
            geometric_patterns: ['triangles', 'hexagons', 'fractals', 'spirals'],
            extra_eyes: ['forehead', 'sides', 'back', 'floating'],
            floating_parts: ['orbs', 'fragments', 'rings', 'crystals'],
            crystal_growths: ['clusters', 'spires', 'embedded', 'crown'],
            inanimate_markings: ['circuits', 'runes', 'gears', 'glyphs'],
            surreal_appendages: ['tentacles', 'ribbons', 'flames', 'shadows'],
            void_patches: ['small', 'medium', 'swirling', 'crackling'],
            prismatic_sheen: ['rainbow', 'opalescent', 'oil_slick', 'aurora']
        };

        const typeVariants = variants[mutationType] || ['default'];
        const index = Math.floor(this.seededRandom(seed + mutationType) * typeVariants.length);
        return typeVariants[index];
    }
}

// Export for module systems
export default StageVisualResolver;

// Expose globally for Phaser
if (typeof window !== 'undefined') {
    window.StageVisualResolver = StageVisualResolver;
}
