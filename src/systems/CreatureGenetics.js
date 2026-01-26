/**
 * CreatureGenetics - Dynamic creature randomization system for Space-Mythic theme
 * Generates unique genetic profiles combining appearance, personality, and cosmic affinity
 * Kid-friendly design emphasizing wonder and discovery over complexity
 */

// Global rarity color anchors keep palettes consistent across generation paths
const RARITY_COLOR_FAMILIES = Object.freeze({
    common: {
        primary: [0x1B5E20, 0x2E7D32, 0x33691E, 0x388E3C, 0x43A047, 0x4CAF50, 0x558B2F],
        secondary: [0x2E7D32, 0x3D8B3D, 0x4E9A45, 0x5DAF52, 0x66BB6A, 0x7CB342],
        accent: [0x81C784, 0x9CCC65, 0xA5D6A7, 0xB9F6CA, 0xC5E1A5]
    },
    uncommon: {
        primary: [0xE65100, 0xEF6C00, 0xF57C00, 0xFB8C00, 0xFF9800, 0xFFA726],
        secondary: [0xFF7043, 0xFF8A65, 0xFFAB40, 0xFFB74D, 0xFFC107, 0xFFB74D],
        accent: [0xFFE0B2, 0xFFCC80, 0xFFD180, 0xFFD54F, 0xFFE082]
    },
    rare: {
        primary: [0xAD1457, 0xC2185B, 0xD81B60, 0xE91E63, 0xEC407A, 0xF06292],
        secondary: [0xB71C1C, 0xC62828, 0xD32F2F, 0xE53935, 0xF44336, 0xFF1744],
        accent: [0xF48FB1, 0xF8BBD0, 0xFF80AB, 0xFF8A80, 0xFFCDD2]
    },
    epic: {
        primary: [0x4A148C, 0x5E35B1, 0x6A1B9A, 0x7B1FA2, 0x8E24AA, 0x512DA8],
        secondary: [0x4527A0, 0x512DA8, 0x5C6BC0, 0x3949AB, 0x3F51B5, 0x7E57C2],
        accent: [0x9575CD, 0xB39DDB, 0xC5CAE9, 0xD1C4E9, 0x9FA8DA]
    },
    legendary: {
        primary: [0xB28704, 0xBF9B30, 0xC6A700, 0xD4AF37, 0xF9A825, 0xFBC02D, 0xFFD54F],
        secondary: [0xBFA741, 0xC8A600, 0xD1B264, 0xE0C15A, 0xFDD835, 0xFFE082],
        accent: [0xFFF59D, 0xFFF176, 0xFFE082, 0xFFD740, 0xFFECB3]
    }
});

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
                rarity: 0.20 // Adjusted from 0.40 to accommodate new species
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
                rarity: 0.20 // Adjusted from 0.35 to accommodate new species
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
                rarity: 0.15 // Adjusted from 0.25 to accommodate new species
            },

            // New species - VoidStalker
            voidStalker: {
                baseColors: {
                    body: [0x4A148C, 0x6A1B9A, 0x311B92], // Deep void purples
                    wings: [0x7B1FA2, 0x9C27B0, 0x6A1B9A], // Dark purple wings
                    eyes: [0xD500F9, 0xAA00FF, 0xE040FB]   // Glowing magenta eyes
                },
                bodyShape: { preferred: 'serpentine', variance: 0.4 },
                wingType: 'ethereal',
                personalityTendencies: ['wise', 'curious', 'gentle'],
                cosmicAffinities: ['void', 'nebula'],
                rarity: 0.15 // 15% of all creatures
            },

            // New species - CosmicGuardian
            cosmicGuardian: {
                baseColors: {
                    body: [0x1A237E, 0x283593, 0x3949AB], // Deep cosmic blues
                    wings: [0x5C6BC0, 0x7986CB, 0x9FA8DA], // Lighter blue wings
                    eyes: [0xFFD54F, 0xFFB300, 0xFFA000]   // Golden guardian eyes
                },
                bodyShape: { preferred: 'quadruped', variance: 0.25 },
                wingType: 'armored',
                personalityTendencies: ['gentle', 'wise', 'energetic'],
                cosmicAffinities: ['star', 'crystal'],
                rarity: 0.12 // 12% of all creatures
            },

            // New species - AuroraPhoenix
            auroraPhoenix: {
                baseColors: {
                    body: [0xFF6F00, 0xFF8F00, 0xFFB300], // Warm aurora oranges
                    wings: [0xE91E63, 0xF06292, 0xF48FB1], // Pink fire wings
                    eyes: [0x00BCD4, 0x00ACC1, 0x0097A7]   // Cool cyan eyes
                },
                bodyShape: { preferred: 'avian', variance: 0.35 },
                wingType: 'flaming',
                personalityTendencies: ['energetic', 'playful', 'curious'],
                cosmicAffinities: ['star', 'nebula'],
                rarity: 0.10 // 10% of all creatures
            },

            // New species - CrystalElemental
            crystalElemental: {
                baseColors: {
                    body: [0x00BFA5, 0x1DE9B6, 0x64FFDA], // Teal crystal
                    wings: [0xB2EBF2, 0xE0F7FA, 0xE1F5FE], // Icy wings
                    eyes: [0xE040FB, 0xEA80FC, 0xCE93D8]   // Purple crystal eyes
                },
                bodyShape: { preferred: 'insectoid', variance: 0.3 },
                wingType: 'crystal',
                personalityTendencies: ['gentle', 'curious', 'wise'],
                cosmicAffinities: ['crystal', 'moon'],
                rarity: 0.08 // 8% of all creatures
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
        
        // Rarity distribution - adjusted for more variety
        this.rarityWeights = {
            common: 0.45,    // Reduced from 0.70 - fewer plain creatures
            uncommon: 0.30,  // Increased from 0.20 - more enhanced features
            rare: 0.15,      // Increased from 0.07 - more special markings
            epic: 0.07,      // Increased from 0.02 - more high-tier variants
            legendary: 0.03  // Increased from 0.01 - more unique variants
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
                    specialFeatures: this.generateSpecialFeatures(rarity),
                    // Wacky mutations - inheritable through breeding
                    wackyMutations: this.generateWackyMutations(rarity)
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
            // Shiny variant data (generated below)
            isShiny: false,
            shinyType: null,
            metadata: {
                generationTime: Date.now() - startTime,
                version: '1.0.0'
            }
        };

        // 7. Check for shiny variant (10% chance for testing)
        this.applyShinyVariant(genetics);

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
            epic: 1.7,
            legendary: 2.0
        };
        
        return {
            colorIntensity: Math.min(1.0, Math.random() * rarityMultiplier[rarity]),
            featureComplexity: Math.min(1.0, Math.random() * rarityMultiplier[rarity]),
            effectStrength: Math.min(1.0, Math.random() * rarityMultiplier[rarity])
        };
    }

    /**
     * Generate a truly random color from the entire color spectrum
     * Uses HSL for better control - ensures vibrant, visible colors
     *
     * @returns {number} Random hex color
     */
    generateTrulyRandomColor() {
        // Full hue range: 0-360 degrees (any color on the wheel)
        const hue = Math.random() * 360;

        // Saturation: 40-100% (avoid washed-out grays, but allow some softer tones)
        const saturation = 0.4 + Math.random() * 0.6;

        // Lightness: 30-80% (avoid too dark or too bright/white)
        const lightness = 0.3 + Math.random() * 0.5;

        return this.hslToHex(hue, saturation, lightness);
    }

    /**
     * Convert HSL values to hex color
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-1)
     * @param {number} l - Lightness (0-1)
     * @returns {number} Hex color
     */
    hslToHex(h, s, l) {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;

        let r, g, b;

        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }

        const rInt = Math.round((r + m) * 255);
        const gInt = Math.round((g + m) * 255);
        const bInt = Math.round((b + m) * 255);

        return (rInt << 16) | (gInt << 8) | bInt;
    }

    /**
     * Generate LEGENDARY prestige colors - gold, platinum, diamond
     * These creatures should look CLASSY and instantly recognizable as special
     */
    generateLegendaryColors() {
        // Legendary color palettes - gold, platinum, rose gold, diamond
        const legendaryPalettes = [
            // Pure Gold
            {
                primary: 0xFFD700,    // Gold
                secondary: 0xFFC125,  // Golden rod
                accent: 0xFFF8DC,     // Cornsilk (creamy gold highlight)
                head: 0xFFDF00,       // Golden yellow
                feet: 0xDAA520,       // Goldenrod (darker gold)
                markings: 0xFFFFE0    // Light yellow (gold shimmer)
            },
            // Platinum
            {
                primary: 0xE5E4E2,    // Platinum
                secondary: 0xC0C0C0,  // Silver
                accent: 0xFFFFFF,     // Pure white highlights
                head: 0xD8D8D8,       // Light platinum
                feet: 0xA8A8A8,       // Darker platinum
                markings: 0xF5F5F5    // White smoke shimmer
            },
            // Rose Gold
            {
                primary: 0xB76E79,    // Rose gold
                secondary: 0xE8B4B8,  // Light rose
                accent: 0xFFC0CB,     // Pink highlights
                head: 0xC9A9A6,       // Dusty rose
                feet: 0x8B6969,       // Darker rose
                markings: 0xFFE4E1    // Misty rose shimmer
            },
            // Diamond/Crystal
            {
                primary: 0xB9F2FF,    // Diamond blue
                secondary: 0xE0FFFF,  // Light cyan
                accent: 0xFFFFFF,     // Pure white sparkle
                head: 0xAFEEEE,       // Pale turquoise
                feet: 0x87CEEB,       // Sky blue
                markings: 0xF0FFFF    // Azure shimmer
            },
            // Black Gold (rare legendary variant)
            {
                primary: 0x1C1C1C,    // Near black
                secondary: 0xFFD700,  // Gold accents
                accent: 0xFFD700,     // Gold highlights
                head: 0x2F2F2F,       // Dark gray
                feet: 0xB8860B,       // Dark goldenrod
                markings: 0xFFD700    // Gold markings
            }
        ];

        // Pick a random legendary palette
        return this.randomChoice(legendaryPalettes);
    }

    /**
     * Generate color genome with FULL RANDOM colors for TRUE uniqueness
     *
     * PHILOSOPHY:
     * - Common, Uncommon, Rare, Epic: FULL RANDOM colors. Any color, any body part.
     *   Every creature is unique. A common can be just as visually stunning.
     *
     * - LEGENDARY: Special prestige treatment. Gold, platinum, rose gold, or diamond.
     *   These are the 2% ultra-rare and should LOOK instantly special.
     *
     * Rarity affects genetics/abilities under the hood for non-legendary.
     */
    generateColorGenome(template, rarity) {
        let primaryColor, secondaryColor, accentColor, feetColor, headColor, markingsColor;

        if (rarity === 'legendary') {
            // LEGENDARY: Special prestige colors - gold, platinum, diamond, etc.
            const legendaryColors = this.generateLegendaryColors();
            primaryColor = legendaryColors.primary;
            secondaryColor = legendaryColors.secondary;
            accentColor = legendaryColors.accent;
            headColor = legendaryColors.head;
            feetColor = legendaryColors.feet;
            markingsColor = legendaryColors.markings;
        } else {
            // ALL OTHER RARITIES: Full random - any color, any body part
            primaryColor = this.generateTrulyRandomColor();   // Body
            secondaryColor = this.generateTrulyRandomColor(); // Wings
            accentColor = this.generateTrulyRandomColor();    // Eyes/markings
            feetColor = this.generateTrulyRandomColor();      // Feet
            headColor = this.generateTrulyRandomColor();      // Head
            markingsColor = this.generateTrulyRandomColor();  // Pattern markings
        }

        // Rarity affects shimmer/effects intensity
        const rarityEnhancement = this.getRarityColorEnhancement(rarity);

        return {
            // Core colors
            primary: primaryColor,
            secondary: secondaryColor,
            accent: accentColor,

            // Extended color palette for more body parts
            feet: feetColor,
            head: headColor,
            markings: markingsColor,

            // Visual effects (legendary gets max shimmer)
            gradient: this.generateColorGradient(primaryColor, secondaryColor, rarity),
            shimmerIntensity: rarity === 'legendary' ? 1.0 : rarityEnhancement.shimmer,

            // Metadata
            colorComplexity: this.calculateColorComplexity(primaryColor, secondaryColor, accentColor),
            harmonicResonance: this.calculateColorHarmony([primaryColor, secondaryColor, accentColor]),
            mixingPattern: rarity === 'legendary' ? 'legendary_shimmer' : this.determineMixingPattern(rarity),
            dominantHue: this.extractDominantHue(primaryColor),
            saturationLevel: this.calculateSaturationLevel([primaryColor, secondaryColor, accentColor]),
            mutationFlags: this.generateMutationFlags(rarity),

            // NEW: Flag for legendary prestige rendering
            isLegendaryPrestige: rarity === 'legendary'
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
            epic: 0.25,
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
    getRarityPalette(rarity) {
        return RARITY_COLOR_FAMILIES[rarity] || RARITY_COLOR_FAMILIES.common;
    }

    getRarityAnchors(rarity) {
        const palette = this.getRarityPalette(rarity);

        return {
            primary: this.randomChoice(palette.primary),
            secondary: this.randomChoice(palette.secondary || palette.primary),
            accent: this.randomChoice(palette.accent || palette.secondary || palette.primary),
            swatchPool: {
                primary: palette.primary,
                secondary: palette.secondary || palette.primary,
                accent: palette.accent || palette.secondary || palette.primary
            }
        };
    }

    getPaletteBlendRatio(rarity) {
        // Increased ratios to let species colors show through more (more color variety)
        const ratios = {
            common: 0.55,     // Was 0.35 - more species color influence
            uncommon: 0.50,   // Was 0.30 - species colors more visible
            rare: 0.45,       // Was 0.25 - nice balance of rarity + species
            epic: 0.40,       // Was 0.22 - epic creatures show species traits
            legendary: 0.35   // Was 0.18 - legendary still shows species identity
        };

        return ratios[rarity] ?? 0.45;
    }

    clampToRarityPalette(color, palette, rarity) {
        if (!palette || palette.length === 0) {
            return color;
        }

        // Slightly bias back toward palette anchor without collapsing variation
        const anchor = this.randomChoice(palette);
        const blendRatio = Math.max(0.12, this.getPaletteBlendRatio(rarity) * 0.6);
        return this.blendColors(anchor, color, blendRatio);
    }

    selectFromPalette(palette) {
        return palette[Math.floor(Math.random() * palette.length)];
    }

    selectEyeColor(template) {
        return this.selectFromPalette(template.baseColors.eyes);
    }

    selectBodyShape(template) {
        const shapes = ['slender', 'balanced', 'sturdy', 'fish', 'cyclops', 'serpentine', 'avian', 'quadruped', 'blob', 'reptilian', 'insectoid'];
        const preferred = template.bodyShape.preferred;
        const variance = template.bodyShape.variance;

        // Production mode: 50% unique shapes, 30% preferred, 20% common
        // Balanced for good variety while maintaining some patterns
        const random = Math.random();
        if (random < 0.5) {
            // Unique body types (50% chance)
            const uniqueShapes = ['fish', 'cyclops', 'serpentine', 'avian', 'quadruped', 'blob', 'reptilian', 'insectoid'];
            return this.randomChoice(uniqueShapes);
        } else if (random < 0.8) {
            // Preferred shape (30% chance)
            return preferred;
        } else {
            // Common alternative shapes (20% chance)
            const commonShapes = ['slender', 'balanced', 'sturdy'].filter(s => s !== preferred);
            return this.randomChoice(commonShapes);
        }
    }

    generateMarkings(rarity) {
        const patternsByRarity = {
            common: ['spots', 'stripes', 'simple_sparkles'],
            uncommon: ['spots', 'stripes', 'sparkles', 'swirls', 'crescents'],
            rare: ['complex_spots', 'galaxy_swirls', 'constellation_dots', 'aurora_stripes', 'crystal_facets'],
            epic: ['galaxy_swirls', 'nebula_trail', 'aurora_stripes', 'stellar_mandala', 'crystal_facets', 'twilight_rings'],
            legendary: ['stellar_mandala', 'cosmic_fractals', 'reality_rifts', 'time_spirals', 'void_portals']
        };
        
        const rarityPatternChance = {
            common: 0.6,     // 60% chance for markings
            uncommon: 0.8,   // 80% chance for markings
            rare: 0.95,      // 95% chance for markings
            epic: 1.0,       // Always has markings
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
     * Generate wacky mutations - inheritable surreal traits
     * These create unique, memorable creatures and can be passed to offspring
     * @param {string} rarity - Creature rarity tier
     * @returns {Array} Array of wacky mutation objects
     */
    generateWackyMutations(rarity) {
        // Wacky mutation types available - expanded for more variety
        const wackyMutationTypes = [
            // Original inanimate/surreal mutations
            'rock_texture',        // Craggy stone-like appearance
            'gem_body',            // Faceted, crystalline appearance
            'geometric_patterns',  // Angular impossible geometry
            'extra_eyes',          // 1-3 additional eyes in unusual positions
            'floating_parts',      // Detached elements orbiting creature
            'crystal_growths',     // Crystal formations on body
            'inanimate_markings',  // Circuits, runes, gears, glyphs
            'surreal_appendages',  // Tentacles, ribbons, flames, shadows
            'void_patches',        // Dark, starry void areas
            'prismatic_sheen',     // Rainbow/iridescent effects

            // New mechanical/steampunk mutations
            'mechanical_parts',    // Visible gears, pistons, clockwork
            'circuit_veins',       // Glowing circuit-like patterns

            // New elemental/nature mutations
            'elemental_aura',      // Fire, ice, or lightning aura effects
            'plant_growth',        // Vines, flowers, moss growing on body
            'bioluminescence',     // Glowing patches and spots

            // New cosmic/ethereal mutations
            'phantom_limbs',       // Ghostly translucent extra limbs
            'cosmic_horns',        // Unique star/crystal horn formations
            'nebula_trails',       // Trailing mist/nebula effects

            // New creature enhancement mutations
            'scale_armor',         // Visible armored scales
            'feather_mane'         // Feathered crest or mane
        ];

        // Variants for each mutation type - expanded with new types
        const mutationVariants = {
            // Original mutations
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

            // New mechanical mutations
            mechanical_parts: ['gears', 'pistons', 'clockwork', 'pipes'],
            circuit_veins: ['blue_glow', 'green_glow', 'gold_glow', 'pulsing'],

            // New elemental mutations
            elemental_aura: ['fire', 'ice', 'lightning', 'wind'],
            plant_growth: ['vines', 'flowers', 'moss', 'leaves'],
            bioluminescence: ['spots', 'stripes', 'patches', 'veins'],

            // New cosmic mutations
            phantom_limbs: ['arms', 'wings', 'tail', 'tendrils'],
            cosmic_horns: ['star_tipped', 'crystal', 'spiral', 'branching'],
            nebula_trails: ['misty', 'sparkling', 'flowing', 'swirling'],

            // New creature mutations
            scale_armor: ['dragon', 'fish', 'reptile', 'metallic'],
            feather_mane: ['mohawk', 'flowing', 'spiked', 'royal']
        };

        // Base chance increases with rarity - INCREASED for more variety
        const baseMutationChance = {
            common: 0.15,      // Was 0.05 - 3x increase for visible mutations
            uncommon: 0.25,    // Was 0.10 - 2.5x increase
            rare: 0.35,        // Was 0.18 - ~2x increase
            epic: 0.45,        // Was 0.25 - ~2x increase
            legendary: 0.55    // Was 0.35 - ~1.6x increase, guaranteed interesting
        };

        // Max mutations increases with rarity
        const maxMutations = {
            common: 1,
            uncommon: 1,
            rare: 2,
            epic: 2,
            legendary: 3
        };

        const mutations = [];
        const chance = baseMutationChance[rarity] || 0.05;
        const maxMuts = maxMutations[rarity] || 1;

        // Roll for each potential mutation
        for (let i = 0; i < maxMuts; i++) {
            // Each subsequent mutation has lower chance
            const adjustedChance = chance * Math.pow(0.6, i);

            if (Math.random() < adjustedChance) {
                // Select random mutation type not already selected
                const availableTypes = wackyMutationTypes.filter(
                    type => !mutations.some(m => m.type === type)
                );

                if (availableTypes.length > 0) {
                    const selectedType = this.randomChoice(availableTypes);
                    const variants = mutationVariants[selectedType] || ['default'];

                    mutations.push({
                        type: selectedType,
                        variant: this.randomChoice(variants),
                        intensity: 0.3 + Math.random() * 0.5, // 0.3-0.8 range
                        inherited: false, // Will be true if from parent
                        dominance: Math.random() * 0.6 + 0.3 // 0.3-0.9 dominance for breeding
                    });
                }
            }
        }

        // Log significant mutations
        if (mutations.length > 0) {
            console.log(`genetics:info [CreatureGenetics] Generated ${mutations.length} wacky mutation(s):`,
                mutations.map(m => `${m.type}:${m.variant}`).join(', ')
            );
        }

        return mutations;
    }

    /**
     * Inherit wacky mutations from parents during breeding
     * Combines parent mutations with chance of inheritance and new mutations
     * @param {Array} parent1Mutations - Mutations from first parent
     * @param {Array} parent2Mutations - Mutations from second parent
     * @param {string} offspringRarity - Rarity of the offspring
     * @returns {Array} Inherited and new mutations for offspring
     */
    inheritWackyMutations(parent1Mutations = [], parent2Mutations = [], offspringRarity = 'common') {
        const inheritedMutations = [];
        const allParentMutations = [...(parent1Mutations || []), ...(parent2Mutations || [])];

        // Remove duplicates (keep highest dominance)
        const uniqueMutations = {};
        allParentMutations.forEach(mutation => {
            if (!uniqueMutations[mutation.type] ||
                mutation.dominance > uniqueMutations[mutation.type].dominance) {
                uniqueMutations[mutation.type] = mutation;
            }
        });

        // Roll for inheritance of each unique mutation
        Object.values(uniqueMutations).forEach(mutation => {
            // Inheritance chance based on dominance
            const inheritanceChance = mutation.dominance * 0.7; // Max 63% chance

            if (Math.random() < inheritanceChance) {
                inheritedMutations.push({
                    ...mutation,
                    inherited: true,
                    // Slight variation in intensity from parent
                    intensity: Math.min(0.9, Math.max(0.2,
                        mutation.intensity + (Math.random() - 0.5) * 0.2
                    )),
                    // Dominance can shift slightly
                    dominance: Math.min(0.95, Math.max(0.2,
                        mutation.dominance + (Math.random() - 0.5) * 0.15
                    ))
                });
            }
        });

        // Chance for new mutations (lower if inherited many)
        const newMutationPenalty = inheritedMutations.length * 0.15;
        const newMutations = this.generateWackyMutations(offspringRarity);

        // Filter new mutations based on penalty and avoid duplicates
        newMutations.forEach(newMut => {
            const alreadyHas = inheritedMutations.some(m => m.type === newMut.type);
            const passedPenaltyRoll = Math.random() > newMutationPenalty;

            if (!alreadyHas && passedPenaltyRoll) {
                inheritedMutations.push(newMut);
            }
        });

        // Cap total mutations based on rarity
        const maxTotal = {
            common: 1,
            uncommon: 2,
            rare: 2,
            epic: 3,
            legendary: 4
        };

        return inheritedMutations.slice(0, maxTotal[offspringRarity] || 2);
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
            rare: 0.28,
            epic: 0.32,
            legendary: 0.45
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
                shimmer: 0.65 + Math.random() * 0.25
            },
            epic: {
                intensity: 0.25,
                shimmer: 0.75 + Math.random() * 0.2
            },
            legendary: {
                intensity: 0.32,
                shimmer: 0.85 + Math.random() * 0.15
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
            epic: ['linear', 'radial', 'spiral'],
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
            epic: ['aurora_flow', 'prismatic_wave', 'color_morph', 'stellar_burst'],
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
        
        if (rarity === 'uncommon' || rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
            if (Math.random() < 0.3) flags.push('chromatic_shift');
            if (Math.random() < 0.2) flags.push('luminance_boost');
        }
        
        if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
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

    /**
     * Apply shiny variant to creature genetics (10% chance for testing)
     * Creates visually distinct creatures with special effects
     * @param {Object} genetics - The genetics object to potentially modify
     */
    applyShinyVariant(genetics) {
        // 10% shiny chance (high for testing, reduce to 1-2% for production)
        const SHINY_CHANCE = 0.10;

        if (Math.random() > SHINY_CHANCE) {
            return; // Not shiny
        }

        // Weighted shiny type selection
        const shinyTypes = [
            { type: 'sparkle', weight: 40 },    // Sparkle particle overlay
            { type: 'chromatic', weight: 30 },  // 180deg hue shift + rainbow shimmer
            { type: 'inverted', weight: 20 },   // Inverted color palette
            { type: 'golden', weight: 10 }      // Gold overlay at 30% alpha
        ];

        const totalWeight = shinyTypes.reduce((sum, s) => sum + s.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedType = 'sparkle'; // Default

        for (const shinyType of shinyTypes) {
            if (random < shinyType.weight) {
                selectedType = shinyType.type;
                break;
            }
            random -= shinyType.weight;
        }

        // Set shiny flags
        genetics.isShiny = true;
        genetics.shinyType = selectedType;

        // Apply color modifications based on shiny type
        const colorGenome = genetics.traits.colorGenome;

        switch (selectedType) {
            case 'sparkle':
                // Sparkle: Increase shimmer, add sparkle flag
                colorGenome.shimmerIntensity = Math.min(1.0, colorGenome.shimmerIntensity + 0.4);
                colorGenome.hasSparkle = true;
                colorGenome.sparkleColor = 0xFFFFFF; // White sparkles
                colorGenome.sparkleIntensity = 0.8;
                break;

            case 'chromatic':
                // Chromatic: 180° hue shift on all colors + rainbow shimmer
                colorGenome.primary = this.shiftHue(colorGenome.primary, 180);
                colorGenome.secondary = this.shiftHue(colorGenome.secondary, 180);
                colorGenome.accent = this.shiftHue(colorGenome.accent, 180);
                colorGenome.hasRainbowShimmer = true;
                colorGenome.rainbowSpeed = 0.5 + Math.random() * 0.5; // 0.5-1.0
                colorGenome.shimmerIntensity = Math.min(1.0, colorGenome.shimmerIntensity + 0.3);
                break;

            case 'inverted':
                // Inverted: Invert all color values
                colorGenome.primary = this.invertColor(colorGenome.primary);
                colorGenome.secondary = this.invertColor(colorGenome.secondary);
                colorGenome.accent = this.invertColor(colorGenome.accent);
                colorGenome.isInverted = true;
                colorGenome.shimmerIntensity = Math.min(1.0, colorGenome.shimmerIntensity + 0.2);
                break;

            case 'golden':
                // Golden: Blend all colors toward gold with 30% alpha overlay
                const goldColor = 0xFFD700;
                colorGenome.primary = this.blendColors(colorGenome.primary, goldColor, 0.3);
                colorGenome.secondary = this.blendColors(colorGenome.secondary, goldColor, 0.3);
                colorGenome.accent = this.blendColors(colorGenome.accent, 0xFFF8DC, 0.25); // Lighter gold for accent
                colorGenome.overlay = {
                    color: goldColor,
                    alpha: 0.3,
                    type: 'golden'
                };
                colorGenome.shimmerIntensity = Math.min(1.0, colorGenome.shimmerIntensity + 0.35);
                break;
        }

        // Log shiny generation
        console.log(`genetics:info [CreatureGenetics] ✨ SHINY ${selectedType.toUpperCase()} creature generated!`, {
            species: genetics.species,
            rarity: genetics.rarity,
            shinyType: selectedType
        });

        // Emit shiny event for celebrations/achievements
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('creature/shiny_generated', {
                species: genetics.species,
                rarity: genetics.rarity,
                shinyType: selectedType,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Shift hue of a color by specified degrees
     * @param {number} color - RGB color as integer
     * @param {number} degrees - Degrees to shift (0-360)
     * @returns {number} New color with shifted hue
     */
    shiftHue(color, degrees) {
        const hsl = this.rgbToHsl(color);
        hsl.h = (hsl.h + degrees) % 360;
        if (hsl.h < 0) hsl.h += 360;
        return this.hslToRgb(hsl.h, hsl.s, hsl.l);
    }

    /**
     * Invert a color (255 - each channel)
     * @param {number} color - RGB color as integer
     * @returns {number} Inverted color
     */
    invertColor(color) {
        const r = 255 - ((color >> 16) & 0xFF);
        const g = 255 - ((color >> 8) & 0xFF);
        const b = 255 - (color & 0xFF);
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Convert HSL to RGB
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-1)
     * @param {number} l - Lightness (0-1)
     * @returns {number} RGB color as integer
     */
    hslToRgb(h, s, l) {
        h = h / 360;
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    }
}

// Create singleton instance
window.CreatureGenetics = window.CreatureGenetics || new CreatureGenetics();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreatureGenetics;
}
