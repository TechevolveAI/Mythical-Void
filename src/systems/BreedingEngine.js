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
     * Return a complete, valid Mendelian genome for any creature record.
     *
     * Older hatch-born creatures predate the Mendelian fields used by Fusion.
     * Their genes must be derived from immutable identity and visible traits,
     * never regenerated from Math.random when the Pod opens.
     */
    resolveCreatureGenes(creatureOrGenes) {
        const creature = creatureOrGenes && typeof creatureOrGenes === 'object'
            ? creatureOrGenes
            : {};
        const genetics = creature.genes || creature.genetics || creature.dna || creature;
        const directMendelianGenes = Object.keys(this.traitDefinitions).some(
            traitKey => Array.isArray(creature?.[traitKey])
        ) ? creature : null;
        const storedGenes = genetics?.mendelianGenes ||
            creature.mendelianGenes || directMendelianGenes;
        const derivedGenes = this.deriveMendelianGenes(creature, genetics);

        return Object.fromEntries(
            Object.keys(this.traitDefinitions).map(traitKey => {
                const validVariations = Object.keys(
                    this.traitDefinitions[traitKey].variations
                );
                const storedAlleles = Array.isArray(storedGenes?.[traitKey])
                    ? storedGenes[traitKey].filter(allele => (
                        validVariations.includes(allele)
                    )).slice(0, 2)
                    : [];
                const alleles = [...storedAlleles];
                for (const allele of derivedGenes[traitKey]) {
                    if (alleles.length >= 2) break;
                    alleles.push(allele);
                }
                while (alleles.length < 2) {
                    alleles.push(validVariations[0]);
                }
                return [traitKey, alleles.sort()];
            })
        );
    }

    deriveMendelianGenes(creature, genetics) {
        const stableIdentity = {
            creatureId: creature?.id || null,
            geneticId: genetics?.id || null,
            dnaId: creature?.dna?.id || null,
            species: genetics?.species || null,
            rarity: genetics?.rarity || creature?.rarity || null,
            bodyShape: genetics?.traits?.bodyShape?.type || null,
            eyeColor: genetics?.traits?.features?.eyes?.color || null,
            markings: genetics?.traits?.features?.markings || null,
            colorGenome: genetics?.traits?.colorGenome || null,
            cosmicAffinity: genetics?.cosmicAffinity?.element ||
                genetics?.cosmicAffinity || creature?.cosmicAffinity || null,
            personality: genetics?.personality?.core || creature?.personality || null
        };
        const seed = this.stableStringify(stableIdentity);

        return Object.fromEntries(
            Object.keys(this.traitDefinitions).map(traitKey => {
                const variations = Object.keys(
                    this.traitDefinitions[traitKey].variations
                );
                const visibleAllele = this.getVisibleAllele(
                    traitKey,
                    genetics,
                    variations
                );
                const first = visibleAllele || variations[
                    this.deterministicIndex(`${seed}:${traitKey}:expressed`, variations.length)
                ];
                const second = variations[
                    this.deterministicIndex(`${seed}:${traitKey}:carrier`, variations.length)
                ];
                return [traitKey, [first, second].sort()];
            })
        );
    }

    getVisibleAllele(traitKey, genetics, variations) {
        const traits = genetics?.traits || {};
        const breedingVisuals = traits.breedingVisuals || {};
        const mutations = traits.features?.wackyMutations || [];
        const mutationTypes = new Set(
            mutations.map(mutation => mutation?.type).filter(Boolean)
        );

        if (traitKey === 'bodyShape') {
            const bodyType = String(
                breedingVisuals.bodyMods?.shape?.type ||
                traits.bodyShape?.type || ''
            ).toLowerCase();
            if (/slender|serpentine|avian/.test(bodyType)) return 'slender';
            if (/stocky|sturdy|quadruped/.test(bodyType)) return 'stocky';
            return 'normal';
        }
        if (traitKey === 'eyeColor') {
            const color = breedingVisuals.eyeColor || traits.features?.eyes?.color;
            if (Number.isFinite(Number(color))) {
                return this.closestEyeColor(Number(color));
            }
        }
        if (traitKey === 'pattern') {
            const pattern = String(
                breedingVisuals.bodyMods?.pattern?.type ||
                traits.features?.markings?.pattern || ''
            ).toLowerCase();
            if (/spot|speck|dot/.test(pattern)) return 'spotted';
            if (/stripe|band|line/.test(pattern)) return 'striped';
            return 'solid';
        }
        if (traitKey === 'horns') {
            if (mutationTypes.has('cosmic_horns')) return 'large';
            return 'none';
        }
        if (traitKey === 'tail') {
            const bodyType = String(traits.bodyShape?.type || '').toLowerCase();
            if (/serpentine|fish|reptil/.test(bodyType)) return 'long';
            return mutationTypes.has('phantom_limbs') ? 'medium' : 'short';
        }
        if (traitKey === 'maneLength' && mutationTypes.has('feather_mane')) {
            return 'long';
        }

        return variations.includes(breedingVisuals?.[traitKey])
            ? breedingVisuals[traitKey]
            : null;
    }

    closestEyeColor(color) {
        const channels = value => [
            (value >> 16) & 0xFF,
            (value >> 8) & 0xFF,
            value & 0xFF
        ];
        const target = channels(color);
        return Object.entries(this.traitDefinitions.eyeColor.variations)
            .map(([name, definition]) => {
                const candidate = channels(definition.color || 0);
                const distance = candidate.reduce((total, channel, index) => (
                    total + ((channel - target[index]) ** 2)
                ), 0);
                return { name, distance };
            })
            .sort((left, right) => (
                left.distance - right.distance || left.name.localeCompare(right.name)
            ))[0].name;
    }

    stableStringify(value) {
        if (value === null || typeof value !== 'object') {
            return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map(item => this.stableStringify(item)).join(',')}]`;
        }
        return `{${Object.keys(value)
            .filter(key => value[key] !== undefined)
            .sort()
            .map(key => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`)
            .join(',')}}`;
    }

    deterministicIndex(seed, length) {
        let hash = 0x811c9dc5;
        for (let index = 0; index < seed.length; index += 1) {
            hash ^= seed.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return length > 0 ? (hash >>> 0) % length : 0;
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
        return this.breedCreaturesWithLineage(parent1Genes, parent2Genes).genes;
    }

    breedCreaturesWithLineage(parent1Genes, parent2Genes) {
        const offspringGenes = {};
        const inheritance = {};
        const safeParent1Genes = this.resolveCreatureGenes(parent1Genes);
        const safeParent2Genes = this.resolveCreatureGenes(parent2Genes);

        Object.keys(this.traitDefinitions).forEach(traitKey => {
            // Get alleles from each parent, using generated defaults if missing
            const variations = Object.keys(this.traitDefinitions[traitKey].variations);

            const parent1Alleles = safeParent1Genes[traitKey];
            const parent2Alleles = safeParent2Genes[traitKey];

            // Each parent contributes one allele randomly
            const alleleFromParent1 = parent1Alleles[Math.floor(Math.random() * parent1Alleles.length)];
            const alleleFromParent2 = parent2Alleles[Math.floor(Math.random() * parent2Alleles.length)];

            // Validate alleles are valid variations, fallback to first variation if not
            const validAllele1 = variations.includes(alleleFromParent1) ? alleleFromParent1 : variations[0];
            const validAllele2 = variations.includes(alleleFromParent2) ? alleleFromParent2 : variations[0];

            const childAlleles = [validAllele1, validAllele2].sort();
            offspringGenes[traitKey] = childAlleles;
            const expressedAllele = this.getPhenotype({
                [traitKey]: childAlleles
            })[traitKey];
            inheritance[traitKey] = {
                trait: this.traitDefinitions[traitKey].name,
                parent1Allele: validAllele1,
                parent2Allele: validAllele2,
                expressedAllele,
                expressedFrom: validAllele1 === validAllele2
                    ? 'both'
                    : expressedAllele === validAllele1
                        ? 'parent1'
                        : 'parent2'
            };
        });

        return { genes: offspringGenes, inheritance };
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
    getVisualConfigFromPhenotype(
        phenotype,
        parentGenetics = null,
        offspringRarity = 'common'
    ) {
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
            inheritedMutations: this.inheritMutationsFromParents(
                parentGenetics,
                offspringRarity
            )
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
    inheritMutationsFromParents(parentGenetics, offspringRarity = 'common') {
        if (!parentGenetics) return [];

        const parent1Mutations = parentGenetics.parent1?.traits?.features?.wackyMutations || [];
        const parent2Mutations = parentGenetics.parent2?.traits?.features?.wackyMutations || [];

        // Use CreatureGenetics inheritance if available
        if (window.CreatureGenetics?.inheritWackyMutations) {
            return window.CreatureGenetics.inheritWackyMutations(
                parent1Mutations,
                parent2Mutations,
                offspringRarity
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
const breedingEngine = new BreedingEngine();
if (typeof window !== 'undefined') {
    window.BreedingEngine = breedingEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BreedingEngine, breedingEngine };
}
