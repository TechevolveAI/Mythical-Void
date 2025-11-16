/**
 * CreatureDNA - Discrete trait system for creature identity
 * Defines body archetypes, head types, personality dimensions, and rarity signatures
 * Complements CreatureGenetics by providing discrete traits for visuals and behavior
 *
 * Part of Mythical Void's creature identity system (DNA v1)
 */

/**
 * DNA Trait Definitions
 * Each trait has discrete values with specific probabilities
 */
const DNA_TRAITS = Object.freeze({
    // Physical form traits
    bodyArchetype: {
        values: ['blob', 'quadruped', 'biped', 'serpentine', 'winged'],
        weights: {
            blob: 0.25,      // Most common - simple, cute
            quadruped: 0.30, // Very common - classic pet form
            biped: 0.20,     // Common - humanoid appeal
            serpentine: 0.15,// Less common - elegant
            winged: 0.10     // Rare - majestic
        }
    },

    headArchetype: {
        values: ['feline', 'canine', 'avian', 'reptile', 'aquatic', 'simian', 'insectoid', 'rodent', 'cervine'],
        weights: {
            feline: 0.15,    // Cat-like - popular
            canine: 0.15,    // Dog-like - popular
            avian: 0.12,     // Bird-like
            reptile: 0.12,   // Dragon/lizard-like
            aquatic: 0.12,   // Fish/dolphin-like
            simian: 0.10,    // Monkey-like
            insectoid: 0.08, // Bug-like - less common
            rodent: 0.08,    // Mouse/rabbit-like
            cervine: 0.08    // Deer-like - elegant
        }
    },

    hybridTag: {
        values: ['single-species', 'dual-hybrid', 'triple-hybrid', 'glitchy'],
        weights: {
            'single-species': 0.60, // Most common - clear identity
            'dual-hybrid': 0.30,    // Common - two traits blend
            'triple-hybrid': 0.08,  // Rare - complex mix
            'glitchy': 0.02         // Very rare - special/corrupted
        }
    },

    elementalAura: {
        values: ['cosmic', 'forest', 'ember', 'tidal', 'storm', 'shadow-soft'],
        weights: {
            cosmic: 0.25,       // Space theme - primary
            forest: 0.20,       // Nature theme
            ember: 0.18,        // Fire theme
            tidal: 0.18,        // Water theme
            storm: 0.12,        // Electric theme
            'shadow-soft': 0.07 // Dark but safe theme
        }
    },

    // Personality dimension traits
    temperament: {
        values: ['gentle', 'playful', 'mischievous', 'shy', 'bold'],
        weights: {
            gentle: 0.25,     // Calm and kind
            playful: 0.25,    // Energetic and fun
            mischievous: 0.20,// Cheeky and clever
            shy: 0.15,        // Timid and cautious
            bold: 0.15        // Brave and confident
        }
    },

    energyLevel: {
        values: ['chill', 'balanced', 'hyper'],
        weights: {
            chill: 0.25,    // Low energy - relaxed
            balanced: 0.50, // Medium energy - most common
            hyper: 0.25     // High energy - active
        }
    },

    curiosity: {
        values: ['low', 'medium', 'high'],
        weights: {
            low: 0.20,    // Not very curious
            medium: 0.50, // Average curiosity
            high: 0.30    // Very curious
        }
    },

    attachmentStyle: {
        values: ['independent', 'balanced', 'clingy'],
        weights: {
            independent: 0.25, // Prefers alone time
            balanced: 0.50,    // Normal attachment
            clingy: 0.25       // Needs lots of attention
        }
    },

    favouriteCareAction: {
        values: ['feeding', 'play', 'rest', 'grooming'],
        weights: {
            feeding: 0.25, // Loves food
            play: 0.30,    // Loves games
            rest: 0.20,    // Loves relaxing
            grooming: 0.25 // Loves being cleaned/petted
        }
    },

    // Rarity signature - affects overall appearance and hybrid complexity
    raritySignature: {
        values: ['common', 'unusual', 'rare', 'epic', 'legendary', 'mythic', 'secret'],
        weights: {
            common: 0.50,    // 50% - standard creatures
            unusual: 0.25,   // 25% - slightly special
            rare: 0.15,      // 15% - notably special
            epic: 0.06,      // 6% - very special
            legendary: 0.03, // 3% - extremely special
            mythic: 0.009,   // 0.9% - ultra rare
            secret: 0.001    // 0.1% - hidden/glitched
        }
    }
});

/**
 * Rarity influences on other traits
 */
const RARITY_MODIFIERS = Object.freeze({
    common: {
        hybridBonus: 0,        // No bonus to hybrid chance
        glitchyChance: 0,      // No glitchy chance
        mutationPotential: 0.05
    },
    unusual: {
        hybridBonus: 0.1,      // +10% chance for dual-hybrid
        glitchyChance: 0,
        mutationPotential: 0.10
    },
    rare: {
        hybridBonus: 0.2,      // +20% chance for dual-hybrid
        glitchyChance: 0.01,   // 1% glitchy
        mutationPotential: 0.15
    },
    epic: {
        hybridBonus: 0.3,      // +30% chance for dual/triple-hybrid
        glitchyChance: 0.03,   // 3% glitchy
        mutationPotential: 0.25
    },
    legendary: {
        hybridBonus: 0.4,      // +40% chance for triple-hybrid
        glitchyChance: 0.05,   // 5% glitchy
        mutationPotential: 0.35
    },
    mythic: {
        hybridBonus: 0.5,      // +50% chance for triple-hybrid
        glitchyChance: 0.10,   // 10% glitchy
        mutationPotential: 0.50
    },
    secret: {
        hybridBonus: 0,        // Always glitchy
        glitchyChance: 1.0,    // 100% glitchy
        mutationPotential: 1.0
    }
});

/**
 * CreatureDNA System
 * Generates and manages discrete DNA traits for creatures
 */
class CreatureDNA {
    constructor() {
        this.initialized = false;
        this.traits = DNA_TRAITS;
        this.rarityModifiers = RARITY_MODIFIERS;
    }

    /**
     * Initialize the DNA system
     */
    initialize() {
        this.initialized = true;

        console.log('[CreatureDNA] DNA system initialized', {
            traitCategories: Object.keys(this.traits).length,
            rarityLevels: this.traits.raritySignature.values.length
        });

        // Emit initialization event
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('dna/system_initialized', {
                timestamp: Date.now(),
                systemReady: true
            });
        }
    }

    /**
     * Generate a complete DNA profile for a new creature
     * @param {Object} options - Generation options
     * @param {string} options.forcedRarity - Force a specific rarity (optional)
     * @param {string} options.seed - Random seed for deterministic generation (optional)
     * @returns {Object} Complete DNA profile
     */
    generateDNA(options = {}) {
        if (!this.initialized) {
            console.warn('[CreatureDNA] System not initialized, initializing now');
            this.initialize();
        }

        // Step 1: Roll rarity first (unless forced)
        const rarity = options.forcedRarity || this.rollTrait('raritySignature');
        const rarityMods = this.rarityModifiers[rarity];

        // Step 2: Roll physical traits
        const bodyArchetype = this.rollTrait('bodyArchetype');
        const headArchetype = this.rollTrait('headArchetype');

        // Step 3: Roll hybrid tag (influenced by rarity)
        const hybridTag = this.rollHybridTag(rarity, rarityMods);

        // Step 4: Roll elemental aura
        const elementalAura = this.rollTrait('elementalAura');

        // Step 5: Roll personality traits
        const temperament = this.rollTrait('temperament');
        const energyLevel = this.rollTrait('energyLevel');
        const curiosity = this.rollTrait('curiosity');
        const attachmentStyle = this.rollTrait('attachmentStyle');
        const favouriteCareAction = this.rollTrait('favouriteCareAction');

        // Step 6: Assemble complete DNA object
        const dna = {
            // Metadata
            id: this.generateDNAId(),
            generatedAt: Date.now(),
            version: '1.0',

            // Physical traits
            bodyArchetype,
            headArchetype,
            hybridTag,
            elementalAura,

            // Personality traits
            temperament,
            energyLevel,
            curiosity,
            attachmentStyle,
            favouriteCareAction,

            // Rarity and potential
            raritySignature: rarity,
            mutationPotential: rarityMods.mutationPotential,

            // For future features
            metadata: {
                generation: 1,
                lineage: [],
                mutations: []
            }
        };

        console.log('[CreatureDNA] Generated DNA profile:', dna);

        // Emit generation event
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('dna/generated', {
                dna,
                rarity,
                timestamp: Date.now()
            });
        }

        return dna;
    }

    /**
     * Roll a random trait based on weighted probabilities
     * @param {string} traitName - Name of the trait to roll
     * @returns {string} Selected trait value
     */
    rollTrait(traitName) {
        const trait = this.traits[traitName];
        if (!trait) {
            console.error(`[CreatureDNA] Unknown trait: ${traitName}`);
            return null;
        }

        const roll = Math.random();
        let cumulative = 0;

        for (const [value, weight] of Object.entries(trait.weights)) {
            cumulative += weight;
            if (roll <= cumulative) {
                return value;
            }
        }

        // Fallback to first value if something goes wrong
        return trait.values[0];
    }

    /**
     * Roll hybrid tag with rarity influence
     * @param {string} rarity - Creature rarity
     * @param {Object} rarityMods - Rarity modifiers
     * @returns {string} Hybrid tag
     */
    rollHybridTag(rarity, rarityMods) {
        // Secret rarity always gets glitchy
        if (rarity === 'secret') {
            return 'glitchy';
        }

        // Check for glitchy chance first
        if (Math.random() < rarityMods.glitchyChance) {
            return 'glitchy';
        }

        // Modify weights based on rarity
        const baseWeights = { ...this.traits.hybridTag.weights };

        // Transfer weight from single-species to hybrids based on rarity bonus
        const bonus = rarityMods.hybridBonus;
        if (bonus > 0) {
            const singleWeight = baseWeights['single-species'];
            const transferAmount = singleWeight * bonus;

            baseWeights['single-species'] -= transferAmount;
            baseWeights['dual-hybrid'] += transferAmount * 0.6;
            baseWeights['triple-hybrid'] += transferAmount * 0.4;
        }

        // Roll with modified weights
        const roll = Math.random();
        let cumulative = 0;

        for (const [value, weight] of Object.entries(baseWeights)) {
            cumulative += weight;
            if (roll <= cumulative) {
                return value;
            }
        }

        return 'single-species';
    }

    /**
     * Generate a unique DNA ID
     * @returns {string} Unique identifier
     */
    generateDNAId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 9);
        return `dna_${timestamp}_${random}`;
    }

    /**
     * Serialize DNA for storage in GameState
     * @param {Object} dna - DNA object
     * @returns {Object} Serialized DNA
     */
    serializeDNA(dna) {
        // DNA is already a plain object, just return it
        // Future: Add compression or encoding if needed
        return { ...dna };
    }

    /**
     * Deserialize DNA from GameState
     * @param {Object} serialized - Serialized DNA
     * @returns {Object} DNA object
     */
    deserializeDNA(serialized) {
        // DNA is stored as plain object, just return it
        // Future: Add decompression or decoding if needed
        return { ...serialized };
    }

    /**
     * Get a human-readable DNA summary
     * @param {Object} dna - DNA object
     * @returns {Object} Summary object with readable strings
     */
    getDNASummary(dna) {
        if (!dna) return null;

        return {
            physicalForm: {
                body: this.formatTraitName(dna.bodyArchetype),
                head: this.formatTraitName(dna.headArchetype),
                hybrid: this.formatTraitName(dna.hybridTag),
                aura: this.formatTraitName(dna.elementalAura)
            },
            personality: {
                temperament: this.formatTraitName(dna.temperament),
                energy: this.formatTraitName(dna.energyLevel),
                curiosity: this.formatTraitName(dna.curiosity),
                attachment: this.formatTraitName(dna.attachmentStyle),
                favorite: this.formatTraitName(dna.favouriteCareAction)
            },
            rarity: {
                signature: this.formatTraitName(dna.raritySignature),
                mutationPotential: `${Math.round(dna.mutationPotential * 100)}%`
            },
            metadata: {
                id: dna.id,
                generated: new Date(dna.generatedAt).toLocaleString(),
                version: dna.version
            }
        };
    }

    /**
     * Format trait name for display (e.g., "dual-hybrid" → "Dual-Hybrid")
     * @param {string} trait - Trait value
     * @returns {string} Formatted string
     */
    formatTraitName(trait) {
        if (!trait) return '';
        return trait
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('-');
    }

    /**
     * Validate DNA structure
     * @param {Object} dna - DNA object to validate
     * @returns {boolean} True if valid
     */
    validateDNA(dna) {
        if (!dna) return false;

        const requiredFields = [
            'id', 'bodyArchetype', 'headArchetype', 'hybridTag',
            'elementalAura', 'temperament', 'energyLevel',
            'curiosity', 'attachmentStyle', 'favouriteCareAction',
            'raritySignature', 'mutationPotential'
        ];

        for (const field of requiredFields) {
            if (!(field in dna)) {
                console.error(`[CreatureDNA] Missing required field: ${field}`);
                return false;
            }
        }

        return true;
    }
}

// Create singleton instance and export to window
const dnaSystem = new CreatureDNA();

if (typeof window !== 'undefined') {
    window.CreatureDNA = dnaSystem;
}

export default CreatureDNA;
