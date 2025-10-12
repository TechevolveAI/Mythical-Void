/**
 * CreatureGenetics - Dynamic creature randomization system for Space-Mythic theme
 * Generates unique genetic profiles combining appearance, personality, and cosmic affinity
 * Kid-friendly design emphasizing wonder and discovery over complexity
 */

class CreatureGenetics {
    constructor() {
        this.initialized = false;
        this.config = null;
        
        // Space-Mythic species templates
        this.speciesTemplates = {
            stellarWyrm: {
                baseColors: {
                    body: [0xFFD54F, 0xF5F5F5, 0x80CBC4], // Star Gold, Stellar White, Aurora Teal
                    wings: [0x64B5F6, 0xB39DDB, 0xFFD54F], // Comet Blue, Crystal Lilac, Star Gold
                    eyes: [0xFFD54F, 0x80CBC4, 0x64B5F6]   // Star Gold, Aurora Teal, Comet Blue
                },
                bodyShape: { preferred: 'balanced', variance: 0.3 },
                wingType: 'feathered',
                personalityTendencies: ['curious', 'wise', 'gentle'],
                cosmicAffinities: ['star', 'nebula'],
                rarity: 0.4 // 40% of all creatures
            },
            
            crystalDrake: {
                baseColors: {
                    body: [0xB39DDB, 0x81C784, 0x80CBC4], // Crystal Lilac, Cosmic Green, Aurora Teal  
                    wings: [0xB39DDB, 0xFFD54F, 0x64B5F6], // Crystal Lilac, Star Gold, Comet Blue
                    eyes: [0x81C784, 0xFFD54F, 0xF48FB1]   // Cosmic Green, Star Gold, Nebula Pink
                },
                bodyShape: { preferred: 'sturdy', variance: 0.2 },
                wingType: 'crystal',
                personalityTendencies: ['gentle', 'wise', 'playful'],
                cosmicAffinities: ['crystal', 'moon'],
                rarity: 0.35 // 35% of all creatures
            },
            
            nebulaSprite: {
                baseColors: {
                    body: [0xF48FB1, 0x64B5F6, 0xB39DDB], // Nebula Pink, Comet Blue, Crystal Lilac
                    wings: [0xF48FB1, 0x80CBC4, 0xFFD54F], // Nebula Pink, Aurora Teal, Star Gold
                    eyes: [0xFFD54F, 0xF48FB1, 0x64B5F6]   // Star Gold, Nebula Pink, Comet Blue
                },
                bodyShape: { preferred: 'slender', variance: 0.4 },
                wingType: 'ethereal',
                personalityTendencies: ['playful', 'energetic', 'curious'],
                cosmicAffinities: ['nebula', 'void'],
                rarity: 0.25 // 25% of all creatures
            }
        };
        
        // Personality trait definitions
        this.personalityTraits = {
            curious: {
                description: 'Loves to explore and discover new things',
                emotionModifiers: { bored: -0.3, excited: 0.2 },
                carePreferences: { photo: 1.2, play: 1.1, rest: 0.8 },
                quirks: ['head_tilter', 'star_gazer', 'crystal_investigator']
            },
            playful: {
                description: 'Full of energy and loves games',
                emotionModifiers: { happy: 0.2, bored: -0.2 },
                carePreferences: { play: 1.3, feed: 1.0, rest: 0.7 },
                quirks: ['bounce_dancer', 'chase_lights', 'giggle_singer']
            },
            gentle: {
                description: 'Calm and affectionate, loves quiet moments',
                emotionModifiers: { stressed: -0.3, content: 0.2 },
                carePreferences: { pet: 1.3, clean: 1.1, play: 0.8 },
                quirks: ['soft_hummer', 'gentle_nuzzler', 'peace_bringer']
            },
            wise: {
                description: 'Thoughtful and perceptive',
                emotionModifiers: { confused: -0.2, contemplative: 0.3 },
                carePreferences: { rest: 1.2, pet: 1.1, play: 0.9 },
                quirks: ['constellation_reader', 'ancient_singer', 'wisdom_sharer']
            },
            energetic: {
                description: 'Always active and enthusiastic',
                emotionModifiers: { excited: 0.3, sleepy: -0.2 },
                carePreferences: { play: 1.4, feed: 1.1, rest: 0.6 },
                quirks: ['rainbow_flutter', 'sparkle_dancer', 'energy_burst']
            }
        };
        
        // Cosmic affinity effects
        this.cosmicAffinities = {
            star: {
                description: 'Connected to stellar energy',
                visualEffects: ['golden_shimmer', 'star_sparkles'],
                powerLevel: { min: 0.4, max: 0.9 },
                specialAbilities: ['light_generation', 'warmth_sharing']
            },
            moon: {
                description: 'Attuned to lunar cycles',
                visualEffects: ['silver_glow', 'crescent_markings'],
                powerLevel: { min: 0.3, max: 0.8 },
                specialAbilities: ['dream_weaving', 'night_vision']
            },
            nebula: {
                description: 'Flowing with cosmic mists',
                visualEffects: ['color_shifting', 'mist_trail'],
                powerLevel: { min: 0.5, max: 1.0 },
                specialAbilities: ['emotion_sensing', 'color_changing']
            },
            crystal: {
                description: 'Resonates with crystalline structures',
                visualEffects: ['crystal_growth', 'harmonic_vibration'],
                powerLevel: { min: 0.4, max: 0.8 },
                specialAbilities: ['healing_resonance', 'memory_storing']
            },
            void: {
                description: 'Touched by the deep cosmos',
                visualEffects: ['shadow_dance', 'star_field'],
                powerLevel: { min: 0.6, max: 1.0 },
                specialAbilities: ['space_sensing', 'portal_creation']
            }
        };
        
        // Rarity distribution
        this.rarityWeights = {
            common: 0.70,    // Standard variations
            uncommon: 0.20,  // Enhanced features
            rare: 0.08,      // Special markings  
            legendary: 0.02  // Unique variants
        };
    }

    /**
     * Initialize the genetics system
     */
    initialize(config = null) {
        this.config = config || this.getDefaultConfig();
        this.initialized = true;
        
        console.log('genetics:info [CreatureGenetics] Space-Mythic genetics system initialized', {
            species: Object.keys(this.speciesTemplates).length,
            personalities: Object.keys(this.personalityTraits).length,
            affinities: Object.keys(this.cosmicAffinities).length
        });
        
        // Emit initialization event
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('genetics/system_initialized', {
                timestamp: Date.now(),
                systemReady: true
            });
        }
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            enableRareVariants: true,
            colorVarianceRange: 0.3,
            personalityStrength: 0.8,
            cosmicPowerRange: { min: 0.3, max: 1.0 },
            mutationChance: 0.15,
            legendaryChance: 0.02
        };
    }

    /**
     * Generate a complete genetic profile for a new creature
     * @param {string|null} seed - Optional seed for deterministic generation
     * @returns {Object} Complete genetic profile
     */
    generateCreatureGenetics(rarityOrSeed = null) {
        // Check if first parameter is a rarity tier (string) or a seed (number/other)
        let rarity = null;
        let seed = null;

        if (typeof rarityOrSeed === 'string' && ['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(rarityOrSeed)) {
            rarity = rarityOrSeed; // Use provided rarity
            console.log(`genetics:info [CreatureGenetics] Using provided rarity: ${rarity}`);
        } else if (rarityOrSeed !== null) {
            seed = rarityOrSeed; // Use as seed
            Math.seedrandom(seed); // Would need seedrandom library, fallback to Math.random
        }

        const startTime = Date.now();

        // 1. Determine species
        const species = this.selectSpecies();
        const template = this.speciesTemplates[species];

        // 2. Determine rarity level (use provided or generate)
        if (!rarity) {
            rarity = this.selectRarity();
        }
        
        // 3. Generate visual traits
        const visualTraits = this.generateVisualTraits(template, rarity);
        
        // 4. Generate personality
        const personality = this.generatePersonality(template);
        
        // 5. Generate cosmic affinity
        const cosmicAffinity = this.generateCosmicAffinity(template, rarity);
        
        // 6. Create unique identifier
        const geneticId = this.generateGeneticId(species, visualTraits, personality);
        
        const genetics = {
            id: geneticId,
            species: species,
            rarity: rarity,
            generatedAt: Date.now(),
            traits: {
                // Visual DNA
                bodyShape: {
                    type: this.selectBodyShape(template),
                    intensity: 0.3 + Math.random() * 0.4 // 0.3-0.7 range
                },
                colorGenome: this.generateColorGenome(template, rarity),
                features: {
                    eyes: {
                        size: this.weightedChoice(['small', 'medium', 'large'], [0.2, 0.6, 0.2]),
                        color: this.selectEyeColor(template),
                        glow: Math.random() * 0.8 + 0.2 // 0.2-1.0 range
                    },
                    wings: {
                        type: template.wingType,
                        span: 0.8 + Math.random() * 0.4, // 0.8-1.2 range
                        shimmer: rarity === 'common' ? Math.random() * 0.5 : Math.random() * 0.8 + 0.2
                    },
                    markings: this.generateMarkings(rarity),
                    specialFeatures: this.generateSpecialFeatures(rarity)
                }
            },
            personality: personality,
            cosmicAffinity: cosmicAffinity,
            // Breeding foundation (for future implementation)
            breedingData: {
                canBreed: true,
                breedingCooldown: 0,
                timesBreeded: 0,
                maxBreedingTimes: 5,
                compatibleSpecies: [species], // Can breed within same species
                fertilityRate: 0.8 + (Math.random() * 0.2) // 0.8-1.0
            },
            lineage: {
                parent1: null,
                parent2: null,
                generation: 0,
                familyTree: []
            },
            metadata: {
                generationTime: Date.now() - startTime,
                version: '1.0.0'
            }
        };
        
        // Log genetics creation
        this.logGeneticsCreation(genetics);
        
        return genetics;
    }

    /**
     * Select species based on rarity weights
     */
    selectSpecies() {
        const random = Math.random();
        let accumulator = 0;
        
        for (const [species, template] of Object.entries(this.speciesTemplates)) {
            accumulator += template.rarity;
            if (random <= accumulator) {
                return species;
            }
        }
        
        // Fallback to first species
        return Object.keys(this.speciesTemplates)[0];
    }

    /**
     * Select rarity level
     */
    selectRarity() {
        const random = Math.random();
        let accumulator = 0;
        
        for (const [rarity, weight] of Object.entries(this.rarityWeights)) {
            accumulator += weight;
            if (random <= accumulator) {
                return rarity;
            }
        }
        
        return 'common';
    }

    /**
     * Generate visual traits based on species template and rarity
     */
    generateVisualTraits(template, rarity) {
        const rarityMultiplier = {
            common: 1.0,
            uncommon: 1.2,
            rare: 1.5,
            legendary: 2.0
        };
        
        return {
            colorIntensity: Math.min(1.0, Math.random() * rarityMultiplier[rarity]),
            featureComplexity: Math.min(1.0, Math.random() * rarityMultiplier[rarity]),
            effectStrength: Math.min(1.0, Math.random() * rarityMultiplier[rarity])
        };
    }

    /**
     * Generate color genome with Space-Mythic palette and advanced mixing
     */
    generateColorGenome(template, rarity) {
        const baseBodyColor = this.selectFromPalette(template.baseColors.body);
        const baseWingColor = this.selectFromPalette(template.baseColors.wings);
        const baseEyeColor = this.selectFromPalette(template.baseColors.eyes);
        
        // Advanced color mixing based on genetics
        const colorMixingStrength = Math.random() * 0.4 + 0.1; // 0.1-0.5 range
        const mutationChance = this.config?.mutationChance || 0.15;
        
        // Body color with potential secondary mixing
        let primaryColor = baseBodyColor;
        if (Math.random() < colorMixingStrength) {
            const secondaryBodyColor = this.selectFromPalette(template.baseColors.body);
            primaryColor = this.blendColors(baseBodyColor, secondaryBodyColor, 0.3);
        }
        
        // Wing color with potential complementary mixing
        let secondaryColor = baseWingColor;
        if (Math.random() < colorMixingStrength) {
            const complementaryColor = this.selectFromPalette(template.baseColors.wings);
            secondaryColor = this.blendColors(baseWingColor, complementaryColor, 0.4);
        }
        
        // Eye color with cosmic influence
        let accentColor = baseEyeColor;
        if (Math.random() < 0.3) { // 30% chance for cosmic eye influence
            const cosmicColors = this.getCosmicColorPalette(template.cosmicAffinities);
            if (cosmicColors.length > 0) {
                const cosmicColor = this.randomChoice(cosmicColors);
                accentColor = this.blendColors(baseEyeColor, cosmicColor, 0.25);
            }
        }
        
        // Color mutations for rarity
        if (Math.random() < mutationChance) {
            primaryColor = this.applyColorMutation(primaryColor, rarity);
        }
        if (Math.random() < mutationChance * 0.7) {
            secondaryColor = this.applyColorMutation(secondaryColor, rarity);
        }
        
        // Rarity-based enhancements
        const rarityEnhancement = this.getRarityColorEnhancement(rarity);
        
        return {
            primary: this.enhanceColor(primaryColor, rarityEnhancement.intensity),
            secondary: this.enhanceColor(secondaryColor, rarityEnhancement.intensity),
            accent: this.enhanceColor(accentColor, rarityEnhancement.intensity),
            
            // Advanced color properties
            gradient: this.generateColorGradient(primaryColor, secondaryColor, rarity),
            shimmerIntensity: rarityEnhancement.shimmer,
            colorComplexity: this.calculateColorComplexity(primaryColor, secondaryColor, accentColor),
            harmonicResonance: this.calculateColorHarmony([primaryColor, secondaryColor, accentColor]),
            
            // Genetic color metadata
            mixingPattern: this.determineMixingPattern(rarity),
            dominantHue: this.extractDominantHue(primaryColor),
            saturationLevel: this.calculateSaturationLevel([primaryColor, secondaryColor, accentColor]),
            mutationFlags: this.generateMutationFlags(rarity)
        };
    }

    /**
     * Generate personality based on species tendencies
     */
    generatePersonality(template) {
        // Weighted selection based on species tendencies
        const corePersonality = this.weightedChoice(
            template.personalityTendencies,
            template.personalityTendencies.map(() => 1) // Equal weight for now
        );
        
        const traitData = this.personalityTraits[corePersonality];
        
        // Select quirks
        const selectedQuirks = [];
        const numQuirks = Math.random() < 0.3 ? 2 : 1; // 30% chance for 2 quirks
        
        for (let i = 0; i < numQuirks; i++) {
            const availableQuirks = traitData.quirks.filter(q => !selectedQuirks.includes(q));
            if (availableQuirks.length > 0) {
                selectedQuirks.push(this.randomChoice(availableQuirks));
            }
        }
        
        return {
            core: corePersonality,
            description: traitData.description,
            quirks: selectedQuirks,
            socialLevel: Math.random() * 0.6 + 0.2, // 0.2-0.8 range
            independence: Math.random() * 0.6 + 0.2, // 0.2-0.8 range
            emotionModifiers: traitData.emotionModifiers,
            carePreferences: traitData.carePreferences
        };
    }

    /**
     * Generate cosmic affinity
     */
    generateCosmicAffinity(template, rarity) {
        const element = this.randomChoice(template.cosmicAffinities);
        const affinityData = this.cosmicAffinities[element];
        
        // Rarity affects power level
        const basePowerLevel = affinityData.powerLevel.min + 
            (Math.random() * (affinityData.powerLevel.max - affinityData.powerLevel.min));
        
        const rarityBonus = {
            common: 0,
            uncommon: 0.1,
            rare: 0.2,
            legendary: 0.3
        };
        
        const finalPowerLevel = Math.min(1.0, basePowerLevel + rarityBonus[rarity]);
        
        return {
            element: element,
            description: affinityData.description,
            powerLevel: finalPowerLevel,
            visualEffects: affinityData.visualEffects,
            specialAbilities: this.selectSpecialAbilities(affinityData.specialAbilities, finalPowerLevel)
        };
    }

    /**
     * Generate unique genetic identifier
     */
    generateGeneticId(species, visualTraits, personality) {
        const components = [
            species.substring(0, 3).toUpperCase(),
            personality.core.substring(0, 3).toUpperCase(),
            Math.floor(visualTraits.colorIntensity * 100).toString(16),
            Date.now().toString(36).slice(-4)
        ];
        
        return components.join('-');
    }

    /**
     * Helper methods
     */
    selectFromPalette(palette) {
        return palette[Math.floor(Math.random() * palette.length)];
    }

    selectEyeColor(template) {
        return this.selectFromPalette(template.baseColors.eyes);
    }

    selectBodyShape(template) {
        const shapes = ['slender', 'balanced', 'sturdy', 'fish', 'cyclops', 'serpentine'];
        const preferred = template.bodyShape.preferred;
        const variance = template.bodyShape.variance;
        
        // 60% chance for preferred shape, 30% for other common shapes, 10% for unique shapes
        const random = Math.random();
        if (random < 0.6) {
            return preferred;
        } else if (random < 0.9) {
            // Common alternative shapes
            const commonShapes = ['slender', 'balanced', 'sturdy'].filter(s => s !== preferred);
            return this.randomChoice(commonShapes);
        } else {
            // Unique body types (10% chance)
            const uniqueShapes = ['fish', 'cyclops', 'serpentine'];
            return this.randomChoice(uniqueShapes);
        }
    }

    generateMarkings(rarity) {
        const patternsByRarity = {
            common: ['spots', 'stripes', 'simple_sparkles'],
            uncommon: ['spots', 'stripes', 'sparkles', 'swirls', 'crescents'],
            rare: ['complex_spots', 'galaxy_swirls', 'constellation_dots', 'aurora_stripes', 'crystal_facets'],
            legendary: ['stellar_mandala', 'cosmic_fractals', 'reality_rifts', 'time_spirals', 'void_portals']
        };
        
        const rarityPatternChance = {
            common: 0.4,     // 40% chance for markings
            uncommon: 0.7,   // 70% chance for markings
            rare: 0.9,       // 90% chance for markings
            legendary: 1.0   // Always has markings
        };
        
        if (Math.random() > rarityPatternChance[rarity]) {
            return { 
                pattern: 'none', 
                intensity: 0,
                distribution: 'none',
                colorVariant: 'none'
            };
        }
        
        const availablePatterns = patternsByRarity[rarity] || patternsByRarity.common;
        const selectedPattern = this.randomChoice(availablePatterns);
        
        // Generate pattern distribution
        const distributions = ['scattered', 'clustered', 'symmetrical', 'flowing'];
        const distribution = this.randomChoice(distributions);
        
        // Generate color variant for markings
        const colorVariants = ['darker', 'lighter', 'complementary', 'cosmic'];
        const colorVariant = this.randomChoice(colorVariants);
        
        return {
            pattern: selectedPattern,
            intensity: Math.random() * 0.6 + 0.3, // 0.3-0.9 range
            distribution: distribution,
            colorVariant: colorVariant,
            scale: Math.random() * 0.8 + 0.2, // 0.2-1.0 scale
            opacity: Math.random() * 0.4 + 0.4, // 0.4-0.8 opacity
            animation: rarity === 'legendary' || (rarity === 'rare' && Math.random() < 0.5) 
                ? this.generateMarkingAnimation() : null
        };
    }

    generateSpecialFeatures(rarity) {
        const featuresByRarity = {
            uncommon: {
                features: ['soft_glow', 'gentle_shimmer', 'color_shift_wings', 'twinkling_eyes'],
                probability: 0.3
            },
            rare: {
                features: [
                    'crystal_growth', 'bioluminescent_spots', 'shimmer_wings', 
                    'aurora_wing_tips', 'constellation_eyes', 'prismatic_scales'
                ],
                probability: 0.8
            },
            legendary: {
                features: [
                    'aurora_aura', 'constellation_markings', 'nebula_trail', 'star_dust_emanation',
                    'reality_distortion', 'cosmic_resonance', 'stellar_core', 'void_wings',
                    'time_ripples', 'dimensional_shadows'
                ],
                probability: 1.0
            }
        };
        
        const rarityData = featuresByRarity[rarity];
        if (!rarityData || Math.random() > rarityData.probability) {
            return [];
        }
        
        const numFeatures = rarity === 'legendary' ? 
            Math.floor(Math.random() * 3) + 1 : // 1-3 features for legendary
            rarity === 'rare' ?
                Math.floor(Math.random() * 2) + 1 : // 1-2 features for rare
                1; // 1 feature for uncommon
        
        const selectedFeatures = [];
        const availableFeatures = [...rarityData.features];
        
        for (let i = 0; i < numFeatures && availableFeatures.length > 0; i++) {
            const featureIndex = Math.floor(Math.random() * availableFeatures.length);
            const feature = availableFeatures.splice(featureIndex, 1)[0];
            
            selectedFeatures.push({
                type: feature,
                intensity: Math.random() * 0.8 + 0.2, // 0.2-1.0 intensity
                variant: this.generateFeatureVariant(feature),
                animation: this.shouldAnimateFeature(feature, rarity) ? 
                    this.generateFeatureAnimation(feature) : null
            });
        }
        
        return selectedFeatures;
    }

    /**
     * Generate marking animation properties
     */
    generateMarkingAnimation() {
        const animationTypes = [
            'pulse', 'sparkle', 'flow', 'shimmer', 'rotation', 'wave'
        ];
        
        return {
            type: this.randomChoice(animationTypes),
            speed: Math.random() * 0.5 + 0.3, // 0.3-0.8 speed
            intensity: Math.random() * 0.6 + 0.2, // 0.2-0.8 intensity
            pattern: Math.random() < 0.5 ? 'synchronized' : 'cascading'
        };
    }

    /**
     * Generate feature variant
     */
    generateFeatureVariant(featureType) {
        const variants = {
            crystal_growth: ['small_clusters', 'large_formations', 'spiral_patterns', 'geometric'],
            bioluminescent_spots: ['steady_glow', 'pulsing', 'breathing', 'twinkling'],
            aurora_aura: ['flowing', 'static', 'rippling', 'cascading'],
            nebula_trail: ['wispy', 'dense', 'colorful', 'ethereal'],
            stellar_core: ['bright', 'pulsing', 'rotating', 'expanding'],
            void_wings: ['translucent', 'shadow', 'rippling', 'portal-like']
        };
        
        const featureVariants = variants[featureType] || ['standard', 'enhanced', 'unique'];
        return this.randomChoice(featureVariants);
    }

    /**
     * Determine if feature should animate
     */
    shouldAnimateFeature(featureType, rarity) {
        const animationProbability = {
            uncommon: 0.3,
            rare: 0.6,
            legendary: 0.9
        };
        
        const dynamicFeatures = [
            'aurora_aura', 'nebula_trail', 'stellar_core', 'reality_distortion',
            'time_ripples', 'dimensional_shadows', 'bioluminescent_spots'
        ];
        
        if (dynamicFeatures.includes(featureType)) {
            return Math.random() < (animationProbability[rarity] || 0.3);
        }
        
        return Math.random() < (animationProbability[rarity] || 0.1) * 0.5;
    }

    /**
     * Generate feature animation
     */
    generateFeatureAnimation(featureType) {
        const animationsByFeature = {
            aurora_aura: ['flow', 'pulse', 'wave', 'shimmer'],
            nebula_trail: ['drift', 'swirl', 'fade', 'expand'],
            stellar_core: ['pulse', 'rotate', 'flicker', 'bloom'],
            bioluminescent_spots: ['pulse', 'twinkle', 'breathe', 'cascade'],
            reality_distortion: ['warp', 'ripple', 'phase', 'twist'],
            time_ripples: ['expand', 'contract', 'flow', 'spiral']
        };
        
        const animations = animationsByFeature[featureType] || ['pulse', 'glow', 'fade'];
        
        return {
            type: this.randomChoice(animations),
            duration: Math.random() * 2000 + 1000, // 1-3 seconds
            easing: this.randomChoice(['linear', 'ease-in-out', 'bounce', 'elastic']),
            loop: Math.random() < 0.8 // 80% chance to loop
        };
    }

    selectSpecialAbilities(abilities, powerLevel) {
        const numAbilities = powerLevel > 0.8 ? 2 : (powerLevel > 0.5 ? 1 : 0);
        const selected = [];
        
        for (let i = 0; i < numAbilities && i < abilities.length; i++) {
            const ability = this.randomChoice(abilities.filter(a => !selected.includes(a)));
            if (ability) selected.push(ability);
        }
        
        return selected;
    }

    enhanceColor(baseColor, enhancement) {
        if (enhancement === 0) return baseColor;
        
        // Extract RGB components
        const r = (baseColor >> 16) & 0xFF;
        const g = (baseColor >> 8) & 0xFF;
        const b = baseColor & 0xFF;
        
        // Enhance brightness slightly
        const enhancedR = Math.min(255, r + (enhancement * 50));
        const enhancedG = Math.min(255, g + (enhancement * 50));
        const enhancedB = Math.min(255, b + (enhancement * 50));
        
        return (enhancedR << 16) | (enhancedG << 8) | enhancedB;
    }

    /**
     * Advanced Color Genome Methods
     */
    
    /**
     * Blend two colors with specified ratio
     */
    blendColors(color1, color2, ratio) {
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;
        
        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;
        
        const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
        const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
        const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
        
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Get cosmic color palette based on affinities
     */
    getCosmicColorPalette(affinities) {
        const cosmicColors = {
            star: [0xFFD54F, 0xFFF176, 0xFFE082], // Star golds and yellows
            moon: [0xE1F5FE, 0xB3E5FC, 0x81D4FA], // Lunar blues and whites
            nebula: [0xF48FB1, 0xE1BEE7, 0xCE93D8], // Nebula pinks and purples
            crystal: [0xB39DDB, 0xD1C4E9, 0xE8EAF6], // Crystal purples and lavenders
            void: [0x4A148C, 0x6A1B99, 0x8E24AA]     // Deep void purples
        };
        
        let allColors = [];
        affinities.forEach(affinity => {
            if (cosmicColors[affinity]) {
                allColors = allColors.concat(cosmicColors[affinity]);
            }
        });
        
        return allColors;
    }

    /**
     * Apply color mutation based on rarity
     */
    applyColorMutation(color, rarity) {
        const mutationStrength = {
            common: 0.1,
            uncommon: 0.2,
            rare: 0.3,
            legendary: 0.5
        };
        
        const strength = mutationStrength[rarity] || 0.1;
        
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        
        // Apply random variation
        const variation = (Math.random() - 0.5) * strength * 255;
        
        const mutatedR = Math.max(0, Math.min(255, r + variation));
        const mutatedG = Math.max(0, Math.min(255, g + variation));
        const mutatedB = Math.max(0, Math.min(255, b + variation));
        
        return (Math.round(mutatedR) << 16) | (Math.round(mutatedG) << 8) | Math.round(mutatedB);
    }

    /**
     * Get rarity-based color enhancement values
     */
    getRarityColorEnhancement(rarity) {
        const enhancements = {
            common: {
                intensity: 0,
                shimmer: 0.3 + Math.random() * 0.3
            },
            uncommon: {
                intensity: 0.1,
                shimmer: 0.5 + Math.random() * 0.3
            },
            rare: {
                intensity: 0.2,
                shimmer: 0.7 + Math.random() * 0.3
            },
            legendary: {
                intensity: 0.3,
                shimmer: 0.8 + Math.random() * 0.2
            }
        };
        
        return enhancements[rarity] || enhancements.common;
    }

    /**
     * Generate color gradient information
     */
    generateColorGradient(color1, color2, rarity) {
        const gradientTypes = ['linear', 'radial', 'spiral'];
        const complexityByRarity = {
            common: ['linear'],
            uncommon: ['linear', 'radial'],
            rare: ['linear', 'radial', 'spiral'],
            legendary: ['radial', 'spiral']
        };
        
        return {
            type: this.randomChoice(complexityByRarity[rarity] || ['linear']),
            startColor: color1,
            endColor: color2,
            intensity: Math.random() * 0.6 + 0.2,
            angle: Math.random() * 360
        };
    }

    /**
     * Calculate color complexity score
     */
    calculateColorComplexity(primary, secondary, accent) {
        // Calculate color distance in RGB space
        const distance1 = this.getColorDistance(primary, secondary);
        const distance2 = this.getColorDistance(primary, accent);
        const distance3 = this.getColorDistance(secondary, accent);
        
        return Math.min(1.0, (distance1 + distance2 + distance3) / (255 * 3 * 3));
    }

    /**
     * Calculate color harmony score
     */
    calculateColorHarmony(colors) {
        if (colors.length < 2) return 0;
        
        // Convert to HSL and check harmony rules
        let harmonyScore = 0;
        const hslColors = colors.map(color => this.rgbToHsl(color));
        
        // Check for complementary, triadic, or analogous harmonies
        for (let i = 0; i < hslColors.length; i++) {
            for (let j = i + 1; j < hslColors.length; j++) {
                const hueDiff = Math.abs(hslColors[i].h - hslColors[j].h);
                
                // Complementary (180°)
                if (Math.abs(hueDiff - 180) < 30) {
                    harmonyScore += 0.4;
                }
                // Triadic (120°)
                else if (Math.abs(hueDiff - 120) < 20) {
                    harmonyScore += 0.3;
                }
                // Analogous (30°)
                else if (hueDiff < 60) {
                    harmonyScore += 0.2;
                }
            }
        }
        
        return Math.min(1.0, harmonyScore);
    }

    /**
     * Determine mixing pattern based on rarity
     */
    determineMixingPattern(rarity) {
        const patterns = {
            common: ['solid', 'subtle_blend'],
            uncommon: ['gradient', 'color_shift', 'subtle_blend'],
            rare: ['complex_gradient', 'color_morph', 'harmonic_blend'],
            legendary: ['aurora_flow', 'cosmic_weave', 'stellar_burst']
        };
        
        return this.randomChoice(patterns[rarity] || patterns.common);
    }

    /**
     * Extract dominant hue from color
     */
    extractDominantHue(color) {
        const hsl = this.rgbToHsl(color);
        return Math.round(hsl.h);
    }

    /**
     * Calculate overall saturation level
     */
    calculateSaturationLevel(colors) {
        const saturations = colors.map(color => this.rgbToHsl(color).s);
        const avgSaturation = saturations.reduce((sum, sat) => sum + sat, 0) / saturations.length;
        return avgSaturation;
    }

    /**
     * Generate mutation flags for tracking genetic changes
     */
    generateMutationFlags(rarity) {
        const flags = [];
        
        if (rarity === 'uncommon' || rarity === 'rare' || rarity === 'legendary') {
            if (Math.random() < 0.3) flags.push('chromatic_shift');
            if (Math.random() < 0.2) flags.push('luminance_boost');
        }
        
        if (rarity === 'rare' || rarity === 'legendary') {
            if (Math.random() < 0.4) flags.push('prismatic_effect');
            if (Math.random() < 0.3) flags.push('cosmic_resonance');
        }
        
        if (rarity === 'legendary') {
            if (Math.random() < 0.5) flags.push('stellar_core');
            if (Math.random() < 0.3) flags.push('reality_flux');
        }
        
        return flags;
    }

    /**
     * Helper method to get color distance in RGB space
     */
    getColorDistance(color1, color2) {
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;
        
        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;
        
        return Math.sqrt(Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2));
    }

    /**
     * Convert RGB to HSL
     */
    rgbToHsl(color) {
        const r = ((color >> 16) & 0xFF) / 255;
        const g = ((color >> 8) & 0xFF) / 255;
        const b = (color & 0xFF) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        const sum = max + min;
        const l = sum / 2;

        let h = 0;
        let s = 0;

        if (diff !== 0) {
            s = l < 0.5 ? diff / sum : diff / (2 - sum);

            switch (max) {
                case r:
                    h = ((g - b) / diff) + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / diff + 2;
                    break;
                case b:
                    h = (r - g) / diff + 4;
                    break;
            }
            h /= 6;
        }

        return {
            h: h * 360,
            s: s,
            l: l
        };
    }

    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    weightedChoice(choices, weights) {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < choices.length; i++) {
            if (random < weights[i]) {
                return choices[i];
            }
            random -= weights[i];
        }
        
        return choices[0];
    }

    /**
     * Log genetics creation for telemetry
     */
    logGeneticsCreation(genetics) {
        console.log(`genetics:debug [CreatureGenetics] Generated ${genetics.rarity} ${genetics.species}:`, {
            id: genetics.id,
            personality: genetics.personality.core,
            cosmicElement: genetics.cosmicAffinity.element,
            powerLevel: genetics.cosmicAffinity.powerLevel.toFixed(2),
            specialFeatures: genetics.traits.features.specialFeatures,
            generationTime: genetics.metadata.generationTime
        });
        
        // Emit telemetry event
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('telemetry/creature_generated', {
                genetics: {
                    species: genetics.species,
                    rarity: genetics.rarity,
                    personality: genetics.personality.core,
                    cosmicElement: genetics.cosmicAffinity.element
                },
                timestamp: genetics.generatedAt
            });
        }
    }

    /**
     * Get genetics system statistics
     */
    getSystemStats() {
        return {
            initialized: this.initialized,
            speciesCount: Object.keys(this.speciesTemplates).length,
            personalityCount: Object.keys(this.personalityTraits).length,
            affinityCount: Object.keys(this.cosmicAffinities).length,
            rarityLevels: Object.keys(this.rarityWeights)
        };
    }

    /**
     * Validate genetic profile
     */
    validateGenetics(genetics) {
        const required = ['id', 'species', 'rarity', 'traits', 'personality', 'cosmicAffinity'];
        return required.every(field => genetics.hasOwnProperty(field));
    }
}

// Create singleton instance
window.CreatureGenetics = window.CreatureGenetics || new CreatureGenetics();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreatureGenetics;
}