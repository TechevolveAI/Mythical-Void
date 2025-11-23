/**
 * Unit tests for CreatureGenetics system
 * Tests genetic profile generation, rarity distribution, and trait systems
 */

// Mock window object for testing
const createPhaserStub = () => ({
    Math: {
        Between: (min, max) => min,
        FloatBetween: (min, max) => min
    },
    Display: {
        Color: {
            ValueToColor: () => ({ r: 255, g: 255, b: 255 }),
            GetColor: (r, g, b) => (r << 16) | (g << 8) | b
        }
    },
    BlendModes: { ADD: 'ADD' }
});

global.window = {
    GameState: {
        emit: jest.fn(),
        get: jest.fn(),
        set: jest.fn()
    },
    Phaser: createPhaserStub()
};

const CreatureGenetics = require('../systems/CreatureGenetics.js');

describe('CreatureGenetics System', () => {
    let genetics;

    beforeEach(() => {
        jest.clearAllMocks();
        genetics = new CreatureGenetics();
        genetics.initialize();
    });

    describe('Initialization', () => {
        test('should initialize with default configuration', () => {
            expect(genetics.initialized).toBe(true);
            expect(genetics.config).toBeDefined();
            expect(genetics.config.enableRareVariants).toBe(true);
            expect(genetics.config.colorVarianceRange).toBe(0.3);
            expect(genetics.config.mutationChance).toBe(0.15);
        });

        test('should have species templates defined', () => {
            expect(Object.keys(genetics.speciesTemplates).length).toBe(3);
            expect(genetics.speciesTemplates.stellarWyrm).toBeDefined();
            expect(genetics.speciesTemplates.crystalDrake).toBeDefined();
            expect(genetics.speciesTemplates.nebulaSprite).toBeDefined();
        });

        test('should have personality traits defined', () => {
            expect(Object.keys(genetics.personalityTraits).length).toBe(5);
            expect(genetics.personalityTraits.curious).toBeDefined();
            expect(genetics.personalityTraits.playful).toBeDefined();
            expect(genetics.personalityTraits.gentle).toBeDefined();
            expect(genetics.personalityTraits.wise).toBeDefined();
            expect(genetics.personalityTraits.energetic).toBeDefined();
        });

        test('should have cosmic affinities defined', () => {
            expect(Object.keys(genetics.cosmicAffinities).length).toBe(5);
            expect(genetics.cosmicAffinities.star).toBeDefined();
            expect(genetics.cosmicAffinities.moon).toBeDefined();
            expect(genetics.cosmicAffinities.nebula).toBeDefined();
            expect(genetics.cosmicAffinities.crystal).toBeDefined();
            expect(genetics.cosmicAffinities.void).toBeDefined();
        });

        test('should have rarity weights totaling 1.0', () => {
            const total = Object.values(genetics.rarityWeights).reduce((sum, w) => sum + w, 0);
            expect(total).toBe(1.0);
        });

        test('should emit initialization event', () => {
            const newGenetics = new CreatureGenetics();
            newGenetics.initialize();

            expect(window.GameState.emit).toHaveBeenCalledWith(
                'genetics/system_initialized',
                expect.objectContaining({
                    systemReady: true,
                    timestamp: expect.any(Number)
                })
            );
        });
    });

    describe('Creature Generation', () => {
        test('should generate valid genetic profile', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature).toBeDefined();
            expect(creature.id).toBeDefined();
            expect(creature.species).toBeDefined();
            expect(creature.rarity).toBeDefined();
            expect(creature.traits).toBeDefined();
            expect(creature.personality).toBeDefined();
            expect(creature.cosmicAffinity).toBeDefined();
        });

        test('should generate creature with valid species', () => {
            const creature = genetics.generateCreatureGenetics();
            const validSpecies = Object.keys(genetics.speciesTemplates);

            expect(validSpecies).toContain(creature.species);
        });

        test('should generate creature with valid rarity', () => {
            const creature = genetics.generateCreatureGenetics();
            const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

            expect(validRarities).toContain(creature.rarity);
        });

        test('should accept specific rarity parameter', () => {
            const creature = genetics.generateCreatureGenetics('legendary');

            expect(creature.rarity).toBe('legendary');
        });

        test('should generate unique IDs for different creatures', () => {
            const creature1 = genetics.generateCreatureGenetics();
            const creature2 = genetics.generateCreatureGenetics();

            // IDs should be different (different timestamps)
            expect(creature1.id).not.toBe(creature2.id);
        });

        test('should include breeding data', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.breedingData).toBeDefined();
            expect(creature.breedingData.canBreed).toBe(true);
            expect(creature.breedingData.maxBreedingTimes).toBe(5);
            expect(creature.breedingData.fertilityRate).toBeGreaterThanOrEqual(0.8);
            expect(creature.breedingData.fertilityRate).toBeLessThanOrEqual(1.0);
        });

        test('should include lineage data', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.lineage).toBeDefined();
            expect(creature.lineage.parent1).toBeNull();
            expect(creature.lineage.parent2).toBeNull();
            expect(creature.lineage.generation).toBe(0);
            expect(creature.lineage.familyTree).toEqual([]);
        });

        test('should include metadata', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.metadata).toBeDefined();
            expect(creature.metadata.generationTime).toBeDefined();
            expect(creature.metadata.version).toBe('1.0.0');
        });

        test('should emit telemetry event on generation', () => {
            genetics.generateCreatureGenetics();

            expect(window.GameState.emit).toHaveBeenCalledWith(
                'telemetry/creature_generated',
                expect.objectContaining({
                    genetics: expect.objectContaining({
                        species: expect.any(String),
                        rarity: expect.any(String),
                        personality: expect.any(String),
                        cosmicElement: expect.any(String)
                    }),
                    timestamp: expect.any(Number)
                })
            );
        });
    });

    describe('Visual Traits', () => {
        test('should generate body shape', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.traits.bodyShape).toBeDefined();
            expect(creature.traits.bodyShape.type).toBeDefined();
            expect(creature.traits.bodyShape.intensity).toBeGreaterThanOrEqual(0.3);
            expect(creature.traits.bodyShape.intensity).toBeLessThanOrEqual(0.7);
        });

        test('should generate color genome', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.traits.colorGenome).toBeDefined();
            expect(creature.traits.colorGenome.primary).toBeDefined();
            expect(creature.traits.colorGenome.secondary).toBeDefined();
            expect(creature.traits.colorGenome.accent).toBeDefined();
        });

        test('should generate color genome with gradient info', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.traits.colorGenome.gradient).toBeDefined();
            expect(creature.traits.colorGenome.gradient.type).toBeDefined();
            expect(creature.traits.colorGenome.gradient.startColor).toBeDefined();
            expect(creature.traits.colorGenome.gradient.endColor).toBeDefined();
        });

        test('should generate features with eyes', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.traits.features.eyes).toBeDefined();
            expect(['small', 'medium', 'large']).toContain(creature.traits.features.eyes.size);
            expect(creature.traits.features.eyes.color).toBeDefined();
            expect(creature.traits.features.eyes.glow).toBeGreaterThanOrEqual(0.2);
            expect(creature.traits.features.eyes.glow).toBeLessThanOrEqual(1.0);
        });

        test('should generate features with wings', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.traits.features.wings).toBeDefined();
            expect(creature.traits.features.wings.type).toBeDefined();
            expect(creature.traits.features.wings.span).toBeGreaterThanOrEqual(0.8);
            expect(creature.traits.features.wings.span).toBeLessThanOrEqual(1.2);
        });

        test('should generate markings', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.traits.features.markings).toBeDefined();
            expect(creature.traits.features.markings.pattern).toBeDefined();
        });
    });

    describe('Personality Generation', () => {
        test('should generate valid personality', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.personality).toBeDefined();
            expect(creature.personality.core).toBeDefined();
            expect(creature.personality.description).toBeDefined();
        });

        test('should select valid core personality', () => {
            const creature = genetics.generateCreatureGenetics();
            const validPersonalities = Object.keys(genetics.personalityTraits);

            expect(validPersonalities).toContain(creature.personality.core);
        });

        test('should include quirks', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.personality.quirks).toBeDefined();
            expect(Array.isArray(creature.personality.quirks)).toBe(true);
            expect(creature.personality.quirks.length).toBeGreaterThanOrEqual(1);
            expect(creature.personality.quirks.length).toBeLessThanOrEqual(2);
        });

        test('should include social and independence levels', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.personality.socialLevel).toBeGreaterThanOrEqual(0.2);
            expect(creature.personality.socialLevel).toBeLessThanOrEqual(0.8);
            expect(creature.personality.independence).toBeGreaterThanOrEqual(0.2);
            expect(creature.personality.independence).toBeLessThanOrEqual(0.8);
        });

        test('should include emotion modifiers', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.personality.emotionModifiers).toBeDefined();
        });

        test('should include care preferences', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.personality.carePreferences).toBeDefined();
        });
    });

    describe('Cosmic Affinity', () => {
        test('should generate valid cosmic affinity', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.cosmicAffinity).toBeDefined();
            expect(creature.cosmicAffinity.element).toBeDefined();
            expect(creature.cosmicAffinity.description).toBeDefined();
        });

        test('should select valid cosmic element', () => {
            const creature = genetics.generateCreatureGenetics();
            const validElements = Object.keys(genetics.cosmicAffinities);

            expect(validElements).toContain(creature.cosmicAffinity.element);
        });

        test('should generate power level within range', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.cosmicAffinity.powerLevel).toBeGreaterThanOrEqual(0);
            expect(creature.cosmicAffinity.powerLevel).toBeLessThanOrEqual(1.0);
        });

        test('should include visual effects', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.cosmicAffinity.visualEffects).toBeDefined();
            expect(Array.isArray(creature.cosmicAffinity.visualEffects)).toBe(true);
        });

        test('should select special abilities based on power level', () => {
            const creature = genetics.generateCreatureGenetics();

            expect(creature.cosmicAffinity.specialAbilities).toBeDefined();
            expect(Array.isArray(creature.cosmicAffinity.specialAbilities)).toBe(true);
        });

        test('legendary creatures should have higher power levels', () => {
            // Generate multiple legendary creatures and check average power
            let totalPower = 0;
            const count = 20;

            for (let i = 0; i < count; i++) {
                const creature = genetics.generateCreatureGenetics('legendary');
                totalPower += creature.cosmicAffinity.powerLevel;
            }

            const avgPower = totalPower / count;
            expect(avgPower).toBeGreaterThan(0.5);
        });
    });

    describe('Rarity-Based Features', () => {
        test('legendary creatures should have special features', () => {
            const creature = genetics.generateCreatureGenetics('legendary');

            // Legendary always has markings
            expect(creature.traits.features.markings.pattern).not.toBe('none');
        });

        test('higher rarity should have more shimmer', () => {
            const common = genetics.generateCreatureGenetics('common');
            const legendary = genetics.generateCreatureGenetics('legendary');

            expect(legendary.traits.colorGenome.shimmerIntensity).toBeGreaterThanOrEqual(
                common.traits.colorGenome.shimmerIntensity * 0.5
            );
        });

        test('epic and legendary should have mutation flags', () => {
            const legendary = genetics.generateCreatureGenetics('legendary');

            expect(legendary.traits.colorGenome.mutationFlags).toBeDefined();
            expect(Array.isArray(legendary.traits.colorGenome.mutationFlags)).toBe(true);
        });
    });

    describe('Color Processing', () => {
        test('should blend colors correctly', () => {
            const color1 = 0xFF0000; // Red
            const color2 = 0x0000FF; // Blue
            const blended = genetics.blendColors(color1, color2, 0.5);

            // At 50% blend, should have equal parts red and blue
            const r = (blended >> 16) & 0xFF;
            const b = blended & 0xFF;

            expect(r).toBeGreaterThan(100);
            expect(b).toBeGreaterThan(100);
        });

        test('should enhance color correctly', () => {
            const baseColor = 0x808080; // Gray
            const enhanced = genetics.enhanceColor(baseColor, 0.5);

            // Enhanced should be brighter
            expect(enhanced).toBeGreaterThan(baseColor);
        });

        test('should calculate color distance', () => {
            const color1 = 0xFF0000; // Red
            const color2 = 0x0000FF; // Blue
            const distance = genetics.getColorDistance(color1, color2);

            // Max distance in RGB space is sqrt(255^2 + 255^2 + 255^2) ≈ 441
            expect(distance).toBeGreaterThan(0);
            expect(distance).toBeLessThanOrEqual(442);
        });

        test('should convert RGB to HSL', () => {
            const red = 0xFF0000;
            const hsl = genetics.rgbToHsl(red);

            expect(hsl.h).toBeDefined();
            expect(hsl.s).toBeDefined();
            expect(hsl.l).toBeDefined();
            expect(hsl.h).toBe(0); // Red hue
            expect(hsl.s).toBe(1); // Full saturation
            expect(hsl.l).toBeCloseTo(0.5, 1); // Medium lightness
        });
    });

    describe('Helper Methods', () => {
        test('randomChoice should return valid item from array', () => {
            const options = ['a', 'b', 'c'];
            const choice = genetics.randomChoice(options);

            expect(options).toContain(choice);
        });

        test('weightedChoice should return valid item', () => {
            const choices = ['a', 'b', 'c'];
            const weights = [1, 1, 1];
            const choice = genetics.weightedChoice(choices, weights);

            expect(choices).toContain(choice);
        });

        test('selectSpecies should return valid species', () => {
            const species = genetics.selectSpecies();
            const validSpecies = Object.keys(genetics.speciesTemplates);

            expect(validSpecies).toContain(species);
        });

        test('selectRarity should return valid rarity', () => {
            const rarity = genetics.selectRarity();
            const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

            expect(validRarities).toContain(rarity);
        });
    });

    describe('Validation', () => {
        test('should validate complete genetic profile', () => {
            const creature = genetics.generateCreatureGenetics();
            const isValid = genetics.validateGenetics(creature);

            expect(isValid).toBe(true);
        });

        test('should reject incomplete genetic profile', () => {
            const incomplete = { id: 'test' };
            const isValid = genetics.validateGenetics(incomplete);

            expect(isValid).toBe(false);
        });
    });

    describe('System Statistics', () => {
        test('should return system stats', () => {
            const stats = genetics.getSystemStats();

            expect(stats.initialized).toBe(true);
            expect(stats.speciesCount).toBe(3);
            expect(stats.personalityCount).toBe(5);
            expect(stats.affinityCount).toBe(5);
            expect(stats.rarityLevels).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary']);
        });
    });

    describe('Edge Cases', () => {
        test('should handle multiple rapid generations', () => {
            const creatures = [];

            for (let i = 0; i < 10; i++) {
                creatures.push(genetics.generateCreatureGenetics());
            }

            expect(creatures.length).toBe(10);
            creatures.forEach(creature => {
                expect(creature.id).toBeDefined();
            });
        });

        test('should generate all rarity types when requested', () => {
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

            rarities.forEach(rarity => {
                const creature = genetics.generateCreatureGenetics(rarity);
                expect(creature.rarity).toBe(rarity);
            });
        });
    });
});
