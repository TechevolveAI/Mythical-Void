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
     */
    getPhenotype(genes) {
        const phenotype = {};

        Object.keys(genes).forEach(traitKey => {
            const [allele1, allele2] = genes[traitKey];
            const traitDef = this.traitDefinitions[traitKey];

            // Determine which allele is expressed based on dominance
            let expressedAllele;

            if (traitDef.variations[allele1].dominant && traitDef.variations[allele2].dominant) {
                // Both dominant - could be either, but we'll take the first one
                expressedAllele = allele1;
            } else if (traitDef.variations[allele1].dominant) {
                expressedAllele = allele1;
            } else if (traitDef.variations[allele2].dominant) {
                expressedAllele = allele2;
            } else {
                // Both recessive - take the first one
                expressedAllele = allele1;
            }

            phenotype[traitKey] = expressedAllele;
        });

        return phenotype;
    }

    /**
     * Breed two creatures and return offspring genes
     */
    breedCreatures(parent1Genes, parent2Genes) {
        const offspringGenes = {};

        Object.keys(this.traitDefinitions).forEach(traitKey => {
            const parent1Alleles = [...parent1Genes[traitKey]];
            const parent2Alleles = [...parent2Genes[traitKey]];

            // Each parent contributes one allele randomly
            const alleleFromParent1 = parent1Alleles[Math.floor(Math.random() * parent1Alleles.length)];
            const alleleFromParent2 = parent2Alleles[Math.floor(Math.random() * parent2Alleles.length)];

            offspringGenes[traitKey] = [alleleFromParent1, alleleFromParent2].sort();
        });

        return offspringGenes;
    }

    /**
     * Get visual trait data for rendering
     */
    getVisualTraits(phenotype) {
        const visualData = {
            bodyMods: {},
            headMods: {},
            eyeColor: null,
            pattern: null
        };

        Object.entries(phenotype).forEach(([traitKey, variation]) => {
            const traitDef = this.traitDefinitions[traitKey];
            const variationDef = traitDef.variations[variation];

            switch (traitKey) {
                case 'bodyShape':
                    visualData.bodyMods.shape = variation;
                    break;
                case 'eyeColor':
                    visualData.eyeColor = variationDef.color;
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
     */
    getTraitDescription(traitKey, variation) {
        const traitDef = this.traitDefinitions[traitKey];
        const variationDef = traitDef.variations[variation];

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
}

// Export for use in other modules
window.BreedingEngine = new BreedingEngine();