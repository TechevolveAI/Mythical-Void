/**
 * Unit tests for RaritySystem
 * Tests rarity rolling, pity system, and color generation
 */

const RaritySystem = require('../systems/RaritySystem.js');

describe('RaritySystem', () => {
    let raritySystem;

    beforeEach(() => {
        raritySystem = new RaritySystem();
    });

    describe('Initialization', () => {
        test('should have all rarity tiers defined', () => {
            expect(raritySystem.rarities.common).toBeDefined();
            expect(raritySystem.rarities.uncommon).toBeDefined();
            expect(raritySystem.rarities.rare).toBeDefined();
            expect(raritySystem.rarities.epic).toBeDefined();
            expect(raritySystem.rarities.legendary).toBeDefined();
        });

        test('should have probabilities totaling 100', () => {
            const total = Object.values(raritySystem.rarities)
                .reduce((sum, r) => sum + r.probability, 0);
            expect(total).toBe(100);
        });

        test('should have pity threshold set to 10', () => {
            expect(raritySystem.PITY_THRESHOLD).toBe(10);
        });

        test('each rarity should have required properties', () => {
            Object.values(raritySystem.rarities).forEach(rarity => {
                expect(rarity.name).toBeDefined();
                expect(rarity.probability).toBeDefined();
                expect(rarity.colorRange).toBeDefined();
                expect(rarity.emoji).toBeDefined();
                expect(rarity.displayColor).toBeDefined();
            });
        });
    });

    describe('Pity System', () => {
        test('should initialize pity data correctly', () => {
            const pityData = raritySystem.initializePitySystem();

            expect(pityData.hatchesSinceEpic).toBe(0);
            expect(pityData.guaranteedEpicNext).toBe(false);
            expect(pityData.totalHatches).toBe(0);
            expect(pityData.pitiesTriggered).toBe(0);
            expect(pityData.lastHatchTime).toBeNull();
            expect(pityData.history).toEqual([]);
        });

        test('should increment hatches since epic on non-epic roll', () => {
            const pityData = raritySystem.initializePitySystem();

            // Mock random to return common
            const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);

            raritySystem.rollRarity(pityData);

            expect(pityData.hatchesSinceEpic).toBe(1);

            mockRandom.mockRestore();
        });

        test('should reset hatches since epic on epic roll', () => {
            const pityData = raritySystem.initializePitySystem();
            pityData.hatchesSinceEpic = 5;

            // Mock random to return epic (90-98 range = 0.95)
            const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.95);

            raritySystem.rollRarity(pityData);

            expect(pityData.hatchesSinceEpic).toBe(0);

            mockRandom.mockRestore();
        });

        test('should trigger pity at threshold', () => {
            const pityData = raritySystem.initializePitySystem();
            pityData.hatchesSinceEpic = 10;

            const { rarity } = raritySystem.rollRarity(pityData);

            // Should be epic or legendary
            expect(['epic', 'legendary']).toContain(rarity);
            expect(pityData.hatchesSinceEpic).toBe(0);
        });

        test('should increment pitiesTriggered when pity activates', () => {
            const pityData = raritySystem.initializePitySystem();
            pityData.hatchesSinceEpic = 10;

            raritySystem.rollRarity(pityData);

            expect(pityData.pitiesTriggered).toBe(1);
        });

        test('should track total hatches', () => {
            const pityData = raritySystem.initializePitySystem();

            raritySystem.rollRarity(pityData);
            raritySystem.rollRarity(pityData);
            raritySystem.rollRarity(pityData);

            expect(pityData.totalHatches).toBe(3);
        });

        test('should maintain history of last 20 hatches', () => {
            const pityData = raritySystem.initializePitySystem();

            for (let i = 0; i < 25; i++) {
                raritySystem.rollRarity(pityData);
            }

            expect(pityData.history.length).toBe(20);
        });

        test('should set lastHatchTime on roll', () => {
            const pityData = raritySystem.initializePitySystem();

            raritySystem.rollRarity(pityData);

            expect(pityData.lastHatchTime).toBeDefined();
            expect(typeof pityData.lastHatchTime).toBe('number');
        });
    });

    describe('Rarity Rolling', () => {
        test('should return valid rarity from standard roll', () => {
            const rarity = raritySystem.rollStandardRarity();
            const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

            expect(validRarities).toContain(rarity);
        });

        test('should return epic or legendary from pity roll', () => {
            const rarity = raritySystem.rollPityRarity();

            expect(['epic', 'legendary']).toContain(rarity);
        });

        test('rollRarity should create default pity data if none provided', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const result = raritySystem.rollRarity(null);

            expect(result.rarity).toBeDefined();
            expect(result.pityData).toBeDefined();

            consoleSpy.mockRestore();
        });

        test('should return rarity and updated pityData', () => {
            const pityData = raritySystem.initializePitySystem();
            const result = raritySystem.rollRarity(pityData);

            expect(result.rarity).toBeDefined();
            expect(result.pityData).toBeDefined();
        });
    });

    describe('Rarity Info', () => {
        test('should return correct rarity info', () => {
            const epicInfo = raritySystem.getRarityInfo('epic');

            expect(epicInfo.name).toBe('Epic');
            expect(epicInfo.probability).toBe(8);
            expect(epicInfo.emoji).toBe('🟣');
        });

        test('should return common info for invalid rarity', () => {
            const info = raritySystem.getRarityInfo('invalid');

            expect(info.name).toBe('Common');
        });
    });

    describe('Color Generation', () => {
        test('should generate color for each rarity', () => {
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

            rarities.forEach(rarity => {
                const color = raritySystem.generateColorForRarity(rarity);
                expect(color).toBeDefined();
                expect(typeof color).toBe('number');
            });
        });

        test('should return default color for invalid rarity', () => {
            const color = raritySystem.generateColorForRarity('invalid');
            expect(color).toBe(0x9370DB);
        });

        test('hslToHex should convert correctly', () => {
            // Pure red: H=0, S=100, L=50
            const red = raritySystem.hslToHex(0, 100, 50);
            expect(red).toBeDefined();
            expect(typeof red).toBe('number');
        });

        test('shiftHue should modify color', () => {
            const baseColor = 0xFF0000; // Red
            const shifted = raritySystem.shiftHue(baseColor, 120); // Shift to green

            expect(shifted).not.toBe(baseColor);
        });
    });

    describe('Pity Progress', () => {
        test('should show ready message when pity is active', () => {
            const pityData = raritySystem.initializePitySystem();
            pityData.guaranteedEpicNext = true;

            const text = raritySystem.getPityProgressText(pityData);

            expect(text).toContain('PITY READY');
        });

        test('should show warning when close to pity', () => {
            const pityData = raritySystem.initializePitySystem();
            pityData.hatchesSinceEpic = 8;

            const text = raritySystem.getPityProgressText(pityData);

            expect(text).toContain('2 hatches');
        });

        test('should show normal progress', () => {
            const pityData = raritySystem.initializePitySystem();
            pityData.hatchesSinceEpic = 3;

            const text = raritySystem.getPityProgressText(pityData);

            expect(text).toContain('7/10');
        });

        test('should return 0 progress for null pity data', () => {
            const progress = raritySystem.getPityProgress(null);
            expect(progress).toBe(0);
        });

        test('should calculate correct pity percentage', () => {
            const pityData = raritySystem.initializePitySystem();
            pityData.hatchesSinceEpic = 5;

            const progress = raritySystem.getPityProgress(pityData);

            expect(progress).toBe(50);
        });
    });

    describe('Statistics', () => {
        test('should return empty stats for null data', () => {
            const stats = raritySystem.calculateStats(null);

            expect(stats.totalHatches).toBe(0);
            expect(stats.commonRate).toBe(0);
        });

        test('should calculate rates from history', () => {
            const pityData = raritySystem.initializePitySystem();
            pityData.history = [
                { rarity: 'common', wasPity: false },
                { rarity: 'common', wasPity: false },
                { rarity: 'uncommon', wasPity: false },
                { rarity: 'rare', wasPity: false },
                { rarity: 'epic', wasPity: true }
            ];

            const stats = raritySystem.calculateStats(pityData);

            expect(stats.totalHatches).toBe(5);
            expect(stats.commonRate).toBe('40.0');
            expect(stats.uncommonRate).toBe('20.0');
            expect(stats.rareRate).toBe('20.0');
            expect(stats.epicRate).toBe('20.0');
            expect(stats.pityRate).toBe('20.0');
        });
    });

    describe('Helper Methods', () => {
        test('randomInRange should return value in range', () => {
            for (let i = 0; i < 10; i++) {
                const value = raritySystem.randomInRange(10, 20);
                expect(value).toBeGreaterThanOrEqual(10);
                expect(value).toBeLessThanOrEqual(20);
            }
        });
    });
});
