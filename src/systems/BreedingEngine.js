/**
 * BreedingEngine - Mendelian genetics system for creature breeding and trait inheritance
 * Features: 7 core traits, dominant/recessive inheritance, visual trait representation
 *
 * NOTE: This is separate from CreatureGenetics.js which handles procedural creature generation.
 * - CreatureGenetics.js: Generates unique creatures from scratch (hatching, Space-Mythic theme)
 * - BreedingEngine.js: Combines two creatures to produce offspring (Mendelian inheritance)
 */

class BreedingEngine {
    constructor() {
        this.traitDefinitions = {
            bodyShape: {
                name: 'Body Shape',
                variations: {
                    slender: { name: 'Slender', dominant: false, visualImpact: 'body' },
                    normal: { name: 'Normal', dominant: true, visualImpact: 'body' },
                    stocky: { name: 'Stocky', dominant: false, visualImpact: 'body' }
                }
            },
            eyeColor: {
                name: 'Eye Color',
                variations: {
                    blue: { name: 'Blue', dominant: false, visualImpact: 'eyes', color: 0x4169E1 },
                    green: { name: 'Green', dominant: false, visualImpact: 'eyes', color: 0x228B22 },
                    amber: { name: 'Amber', dominant: true, visualImpact: 'eyes', color: 0xFF8C00 },
                    violet: { name: 'Violet', dominant: true, visualImpact: 'eyes', color: 0x8A2BE2 }
                }
            },
            pattern: {
                name: 'Pattern',
                variations: {
                    solid: { name: 'Solid', dominant: true, visualImpact: 'body' },
                    spotted: { name: 'Spotted', dominant: false, visualImpact: 'body' },
                    striped: { name: 'Striped', dominant: false, visualImpact: 'body' }
                }
            },
            horns: {
                name: 'Horns',
                variations: {
                    none: { name: 'None', dominant: false, visualImpact: 'head' },
                    small: { name: 'Small', dominant: true, visualImpact: 'head' },
                    large: { name: 'Large', dominant: true, visualImpact: 'head' }
                }
            },
            tail: {
                name: 'Tail',
                variations: {
                    short: { name: 'Short', dominant: false, visualImpact: 'body' },
                    medium: { name: 'Medium', dominant: true, visualImpact: 'body' },
                    long: { name: 'Long', dominant: false, visualImpact: 'body' }
                }
            },
            earShape: {
                name: 'Ear Shape',
                variations: {
                    rounded: { name: 'Rounded', dominant: true, visualImpact: 'head' },
                    pointed: { name: 'Pointed', dominant: false, visualImpact: 'head' }
                }
            },
            maneLength: {
                name: 'Mane Length',
                variations: {
                    short: { name: 'Short', dominant: false, visualImpact: 'head' },
                    medium: { name: 'Medium', dominant: true, visualImpact: 'head' },
                    long: { name: 'Long', dominant: false, visualImpact: 'head' }
                }
            }
        };

        this.totalVariations = this.calculateTotalVariations();
    }

    /**
     * Calculate total number of possible trait variations
     */
    calculateTotalVariations() {
        let total = 1;
        Object.values(this.traitDefinitions).forEach(trait => {
            total *= Object.keys(trait.variations).length;
        });
        return total;
    }

    /**
     * Generate random genes for a new creature
     */
    generateRandomGenes() {
        const genes = {};

        Object.keys(this.traitDefinitions).forEach(traitKey => {
            const variations = Object.keys(this.traitDefinitions[traitKey].variations);
            // Each trait has two alleles (one from each parent)
            const allele1 = variations[Math.floor(Math.random() * variations.length)];
            const allele2 = variations[Math.floor(Math.random() * variations.length)];
            genes[traitKey] = [allele1, allele2];
        });

        return genes;
    }

    /**
     * Generate genes for first creature (ensures viable traits)
     */
    generateInitialGenes() {
        const genes = {};

        Object.keys(this.traitDefinitions).forEach(traitKey => {
            const variations = Object.keys(this.traitDefinitions[traitKey].variations);
            // For initial creature, give it some dominant traits for better appearance
            const allele1 = variations[Math.floor(Math.random() * variations.length)];
            let allele2 = variations[Math.floor(Math.random() * variations.length)];

            // 70% chance to have at least one dominant trait for each trait type
            const traitDef = this.traitDefinitions[traitKey];
            const dominantVariations = variations.filter(v => traitDef.variations[v].dominant);

            if (dominantVariations.length > 0 && Math.random() < 0.7) {
                if (!traitDef.variations[allele1].dominant && !traitDef.variations[allele2].dominant) {
                    allele2 = dominantVariations[Math.floor(Math.random() * dominantVariations.length)];
                }
            }

            genes[traitKey] = [allele1, allele2].sort(); // Sort for consistency
        });

        return genes;
    }

    /**
     * Get expressed phenotype from genotype
     * Handles missing/malformed genes gracefully
     */
    getPhenotype(genes) {
        const phenotype = {};

        // Handle null/undefined genes
        if (!genes || typeof genes !== 'object') {
            console.warn('[BreedingEngine] getPhenotype called with invalid genes, using defaults');
            const defaultGenes = this.generateInitialGenes();
            return this.getPhenotype(defaultGenes);
        }

        Object.keys(this.traitDefinitions).forEach(traitKey => {
            const traitDef = this.traitDefinitions[traitKey];
            const variations = Object.keys(traitDef.variations);
            const defaultVariation = variations[0];

            // Safely get alleles, using defaults if missing
            const alleles = genes[traitKey];
            if (!Array.isArray(alleles) || alleles.length < 2) {
                phenotype[traitKey] = defaultVariation;
                return;
            }

            const [allele1, allele2] = alleles;

            // Validate alleles exist in trait definition
            const validAllele1 = variations.includes(allele1) ? allele1 : defaultVariation;
            const validAllele2 = variations.includes(allele2) ? allele2 : defaultVariation;

            // Determine which allele is expressed based on dominance
            let expressedAllele;

            const allele1Info = traitDef.variations[validAllele1];
            const allele2Info = traitDef.variations[validAllele2];

            if (allele1Info?.dominant && allele2Info?.dominant) {
                // Both dominant - could be either, but we'll take the first one
                expressedAllele = validAllele1;
            } else if (allele1Info?.dominant) {
                expressedAllele = validAllele1;
            } else if (allele2Info?.dominant) {
                expressedAllele = validAllele2;
            } else {
                // Both recessive - take the first one
                expressedAllele = validAllele1;
            }

            phenotype[traitKey] = expressedAllele;
        });

        return phenotype;
    }

    /**
     * Breed two creatures and return offspring genes
     * Now handles missing/null genes gracefully by generating defaults
     */
    breedCreatures(parent1Genes, parent2Genes) {
        const offspringGenes = {};

        // Ensure we have valid gene objects - generate defaults if needed
        const safeParent1Genes = parent1Genes && typeof parent1Genes === 'object'
            ? parent1Genes
            : this.generateInitialGenes();
        const safeParent2Genes = parent2Genes && typeof parent2Genes === 'object'
            ? parent2Genes
            : this.generateInitialGenes();

        Object.keys(this.traitDefinitions).forEach(traitKey => {
            // Get alleles from each parent, using generated defaults if missing
            const variations = Object.keys(this.traitDefinitions[traitKey].variations);

            // Safely get parent alleles - generate random if missing for this trait
            let parent1Alleles = safeParent1Genes[traitKey];
            if (!Array.isArray(parent1Alleles) || parent1Alleles.length < 2) {
                const a1 = variations[Math.floor(Math.random() * variations.length)];
                const a2 = variations[Math.floor(Math.random() * variations.length)];
                parent1Alleles = [a1, a2];
            }

            let parent2Alleles = safeParent2Genes[traitKey];
            if (!Array.isArray(parent2Alleles) || parent2Alleles.length < 2) {
                const a1 = variations[Math.floor(Math.random() * variations.length)];
                const a2 = variations[Math.floor(Math.random() * variations.length)];
                parent2Alleles = [a1, a2];
            }

            // Each parent contributes one allele randomly
            const alleleFromParent1 = parent1Alleles[Math.floor(Math.random() * parent1Alleles.length)];
            const alleleFromParent2 = parent2Alleles[Math.floor(Math.random() * parent2Alleles.length)];

            // Validate alleles are valid variations, fallback to first variation if not
            const validAllele1 = variations.includes(alleleFromParent1) ? alleleFromParent1 : variations[0];
            const validAllele2 = variations.includes(alleleFromParent2) ? alleleFromParent2 : variations[0];

            offspringGenes[traitKey] = [validAllele1, validAllele2].sort();
        });

        return offspringGenes;
    }

    /**
     * Get visual trait data for rendering
     * Handles missing traits gracefully
     */
    getVisualTraits(phenotype) {
        const visualData = {
            bodyMods: {},
            headMods: {},
            eyeColor: null,
            pattern: null
        };

        // Handle null/undefined phenotype
        if (!phenotype || typeof phenotype !== 'object') {
            return visualData;
        }

        Object.entries(phenotype).forEach(([traitKey, variation]) => {
            const traitDef = this.traitDefinitions[traitKey];
            if (!traitDef) return; // Skip unknown traits

            const variationDef = traitDef.variations[variation];
            if (!variationDef) return; // Skip unknown variations

            switch (traitKey) {
                case 'bodyShape':
                    visualData.bodyMods.shape = variation;
                    break;
                case 'eyeColor':
                    visualData.eyeColor = variationDef.color || 0x4169E1;
                    break;
                case 'pattern':
                    visualData.pattern = variation;
                    break;
                case 'horns':
                    visualData.headMods.horns = variation;
                    break;
                case 'tail':
                    visualData.bodyMods.tail = variation;
                    break;
                case 'earShape':
                    visualData.headMods.ears = variation;
                    break;
                case 'maneLength':
                    visualData.headMods.mane = variation;
                    break;
            }
        });

        return visualData;
    }

    /**
     * Get trait description for UI
     * Handles missing/invalid traits gracefully
     */
    getTraitDescription(traitKey, variation) {
        const traitDef = this.traitDefinitions[traitKey];
        if (!traitDef) {
            return {
                trait: traitKey || 'Unknown',
                variation: variation || 'Unknown',
                dominant: false,
                visualImpact: 'body'
            };
        }

        const variationDef = traitDef.variations[variation];
        if (!variationDef) {
            return {
                trait: traitDef.name,
                variation: variation || 'Unknown',
                dominant: false,
                visualImpact: 'body'
            };
        }

        return {
            trait: traitDef.name,
            variation: variationDef.name,
            dominant: variationDef.dominant,
            visualImpact: variationDef.visualImpact
        };
    }

    /**
     * Get all trait information for a creature
     */
    getCreatureTraits(genes) {
        const phenotype = this.getPhenotype(genes);
        const visualData = this.getVisualTraits(phenotype);

        const traits = {};
        Object.entries(phenotype).forEach(([traitKey, variation]) => {
            traits[traitKey] = this.getTraitDescription(traitKey, variation);
        });

        return {
            genes,
            phenotype,
            traits,
            visualData
        };
    }

    /**
     * Check if breeding shrine should be unlocked
     */
    shouldUnlockBreedingShrine(creatureLevel) {
        return creatureLevel >= 5;
    }

    /**
     * Get breeding compatibility between two creatures
     */
    getBreedingCompatibility(creature1Genes, creature2Genes) {
        let compatibility = 0;
        let maxCompatibility = 0;

        Object.keys(this.traitDefinitions).forEach(traitKey => {
            const alleles1 = new Set(creature1Genes[traitKey]);
            const alleles2 = new Set(creature2Genes[traitKey]);

            // Check for genetic diversity
            const uniqueAlleles = new Set([...alleles1, ...alleles2]);
            const diversityBonus = uniqueAlleles.size > 1 ? 1 : 0;

            // Check for dominant traits
            const traitDef = this.traitDefinitions[traitKey];
            const hasDominant1 = creature1Genes[traitKey].some(allele => traitDef.variations[allele].dominant);
            const hasDominant2 = creature2Genes[traitKey].some(allele => traitDef.variations[allele].dominant);

            const dominantBonus = (hasDominant1 && hasDominant2) ? 2 : (hasDominant1 || hasDominant2) ? 1 : 0;

            compatibility += diversityBonus + dominantBonus;
            maxCompatibility += 3; // Max per trait
        });

        return {
            score: compatibility,
            maxScore: maxCompatibility,
            percentage: Math.round((compatibility / maxCompatibility) * 100)
        };
    }

    /**
     * Get breeding shrine data
     */
    getBreedingShrineData() {
        return {
            name: 'Breeding Shrine',
            description: 'A sacred place where creatures can produce offspring with inherited traits',
            requirements: {
                level: 5,
                description: 'Reach level 5 to unlock breeding'
            },
            mechanics: {
                inheritance: '100% accurate trait inheritance',
                variations: `${this.totalVariations} possible combinations`,
                cooldown: '24 hours between breeding attempts'
            }
        };
    }

    /**
     * Convert Mendelian phenotype to visual configuration for GraphicsEngine
     * This connects breeding outcomes to creature appearance
     * @param {Object} phenotype - Phenotype from getPhenotype()
     * @param {Object} parentGenetics - Parent genetics for mutation inheritance
     * @returns {Object} Visual configuration for GraphicsEngine
     */
    getVisualConfigFromPhenotype(phenotype, parentGenetics = null) {
        // Handle null/undefined phenotype
        const safePhenotype = phenotype || {};

        return {
            headMods: {
                horns: this.mapHornsTrait(safePhenotype.horns),
                ears: this.mapEarsTrait(safePhenotype.earShape),
                mane: this.mapManeTrait(safePhenotype.maneLength)
            },
            bodyMods: {
                shape: this.mapBodyShape(safePhenotype.bodyShape),
                tail: this.mapTailTrait(safePhenotype.tail),
                pattern: this.mapPatternTrait(safePhenotype.pattern)
            },
            eyeColor: this.traitDefinitions.eyeColor?.variations[safePhenotype.eyeColor]?.color || 0x4169E1,
            inheritedMutations: this.inheritMutationsFromParents(parentGenetics)
        };
    }

    /**
     * Map horns phenotype to visual configuration
     */
    mapHornsTrait(hornVariation) {
        const hornStyles = {
            none: { type: 'none', size: 0 },
            small: { type: 'curved', size: 0.5 },
            large: { type: 'spiral', size: 1.0 }
        };
        return hornStyles[hornVariation] || hornStyles.none;
    }

    /**
     * Map ear shape phenotype to visual configuration
     */
    mapEarsTrait(earVariation) {
        const earStyles = {
            rounded: { type: 'rounded', size: 1.0 },
            pointed: { type: 'pointed', size: 1.0 }
        };
        return earStyles[earVariation] || earStyles.rounded;
    }

    /**
     * Map mane length phenotype to visual configuration
     */
    mapManeTrait(maneVariation) {
        const maneStyles = {
            short: { type: 'short', length: 0.3 },
            medium: { type: 'medium', length: 0.6 },
            long: { type: 'flowing', length: 1.0 }
        };
        return maneStyles[maneVariation] || maneStyles.medium;
    }

    /**
     * Map body shape phenotype to visual configuration
     */
    mapBodyShape(bodyVariation) {
        const bodyScales = {
            slender: { scaleX: 0.8, scaleY: 1.1, type: 'slender' },
            normal: { scaleX: 1.0, scaleY: 1.0, type: 'balanced' },
            stocky: { scaleX: 1.2, scaleY: 0.9, type: 'sturdy' }
        };
        return bodyScales[bodyVariation] || bodyScales.normal;
    }

    /**
     * Map tail phenotype to visual configuration
     */
    mapTailTrait(tailVariation) {
        const tailStyles = {
            short: { type: 'short', length: 0.4 },
            medium: { type: 'medium', length: 0.7 },
            long: { type: 'flowing', length: 1.0 }
        };
        return tailStyles[tailVariation] || tailStyles.medium;
    }

    /**
     * Map pattern phenotype to visual configuration
     */
    mapPatternTrait(patternVariation) {
        const patternTypes = {
            solid: { type: 'solid', intensity: 0 },
            spotted: { type: 'spots', intensity: 0.7 },
            striped: { type: 'stripes', intensity: 0.7 }
        };
        return patternTypes[patternVariation] || patternTypes.solid;
    }

    /**
     * Inherit mutations from parent genetics
     * @param {Object} parentGenetics - Object containing parent1 and parent2 genetics
     * @returns {Array} Inherited mutations for offspring
     */
    inheritMutationsFromParents(parentGenetics) {
        if (!parentGenetics) return [];

        const parent1Mutations = parentGenetics.parent1?.traits?.features?.wackyMutations || [];
        const parent2Mutations = parentGenetics.parent2?.traits?.features?.wackyMutations || [];

        // Use CreatureGenetics inheritance if available
        if (window.CreatureGenetics?.inheritWackyMutations) {
            return window.CreatureGenetics.inheritWackyMutations(
                parent1Mutations,
                parent2Mutations,
                'common' // Default rarity, can be overridden
            );
        }

        // Fallback: simple inheritance - 50% chance to inherit each mutation
        const inheritedMutations = [];
        const allParentMutations = [...parent1Mutations, ...parent2Mutations];

        allParentMutations.forEach(mutation => {
            if (Math.random() < 0.5 && !inheritedMutations.some(m => m.type === mutation.type)) {
                inheritedMutations.push({
                    ...mutation,
                    inherited: true
                });
            }
        });

        return inheritedMutations;
    }
}

// Export for use in other modules
window.BreedingEngine = new BreedingEngine();