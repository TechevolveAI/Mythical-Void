/**
 * Unit tests for RerollSystem
 * Tests reroll mechanics, session management, and statistics
 */

const RerollSystem = require('../systems/RerollSystem.js');

describe('RerollSystem', () => {
    let rerollSystem;

    beforeEach(() => {
        rerollSystem = new RerollSystem();
    });

    describe('Initialization', () => {
        test('should start with no current state', () => {
            expect(rerollSystem.currentRerollState).toBeNull();
        });

        test('should initialize reroll data correctly', () => {
            const data = rerollSystem.initializeRerollData();

            expect(data.freeRerollsAvailable).toBe(1);
            expect(data.totalRerolls).toBe(0);
            expect(data.successfulRerolls).toBe(0);
            expect(data.rerollHistory).toEqual([]);
            expect(data.lastRerollTime).toBeNull();
        });
    });

    describe('Hatch Session Management', () => {
        test('should start hatch session with creature', () => {
            const mockCreature = { rarity: 'common', id: 'test-1' };
            const state = rerollSystem.startHatchSession(mockCreature);

            expect(state.originalCreature).toBe(mockCreature);
            expect(state.rerollAvailable).toBe(true);
            expect(state.hasRerolled).toBe(false);
            expect(state.rerolledCreature).toBeNull();
        });

        test('should end hatch session', () => {
            const mockCreature = { rarity: 'common' };
            rerollSystem.startHatchSession(mockCreature);

            rerollSystem.endHatchSession();

            expect(rerollSystem.currentRerollState).toBeNull();
        });
    });

    describe('Reroll Availability', () => {
        test('should allow reroll in new session', () => {
            const mockCreature = { rarity: 'common' };
            rerollSystem.startHatchSession(mockCreature);

            expect(rerollSystem.canReroll()).toBe(true);
        });

        test('should not allow reroll without session', () => {
            expect(rerollSystem.canReroll()).toBe(false);
        });

        test('should not allow reroll after already rerolled', () => {
            const mockCreature = { rarity: 'common' };
            rerollSystem.startHatchSession(mockCreature);
            rerollSystem.executeReroll();

            expect(rerollSystem.canReroll()).toBe(false);
        });
    });

    describe('Reroll Execution', () => {
        test('should execute reroll successfully', () => {
            const mockCreature = { rarity: 'common' };
            rerollSystem.startHatchSession(mockCreature);

            const result = rerollSystem.executeReroll();

            expect(result).toBe(true);
            expect(rerollSystem.currentRerollState.hasRerolled).toBe(true);
            expect(rerollSystem.currentRerollState.rerollAvailable).toBe(false);
        });

        test('should fail to execute reroll without session', () => {
            const result = rerollSystem.executeReroll();
            expect(result).toBe(false);
        });

        test('should fail to execute second reroll', () => {
            const mockCreature = { rarity: 'common' };
            rerollSystem.startHatchSession(mockCreature);
            rerollSystem.executeReroll();

            const result = rerollSystem.executeReroll();
            expect(result).toBe(false);
        });
    });

    describe('Rerolled Creature', () => {
        test('should set rerolled creature', () => {
            const originalCreature = { rarity: 'common' };
            const rerolledCreature = { rarity: 'rare' };

            rerollSystem.startHatchSession(originalCreature);
            rerollSystem.executeReroll();
            rerollSystem.setRerolledCreature(rerolledCreature);

            expect(rerollSystem.currentRerollState.rerolledCreature).toBe(rerolledCreature);
        });

        test('should not set creature without session', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            rerollSystem.setRerolledCreature({ rarity: 'rare' });

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('Final Creature', () => {
        test('should return null without session', () => {
            expect(rerollSystem.getFinalCreature()).toBeNull();
        });

        test('should return original creature if not rerolled', () => {
            const originalCreature = { rarity: 'common' };
            rerollSystem.startHatchSession(originalCreature);

            expect(rerollSystem.getFinalCreature()).toBe(originalCreature);
        });

        test('should return rerolled creature after reroll', () => {
            const originalCreature = { rarity: 'common' };
            const rerolledCreature = { rarity: 'rare' };

            rerollSystem.startHatchSession(originalCreature);
            rerollSystem.executeReroll();
            rerollSystem.setRerolledCreature(rerolledCreature);

            expect(rerollSystem.getFinalCreature()).toBe(rerolledCreature);
        });
    });

    describe('Reroll Tracking', () => {
        test('should track successful reroll', () => {
            const rerollData = rerollSystem.initializeRerollData();

            rerollSystem.trackReroll('common', 'rare', rerollData);

            expect(rerollData.totalRerolls).toBe(1);
            expect(rerollData.successfulRerolls).toBe(1);
            expect(rerollData.rerollHistory.length).toBe(1);
        });

        test('should track unsuccessful reroll', () => {
            const rerollData = rerollSystem.initializeRerollData();

            rerollSystem.trackReroll('rare', 'common', rerollData);

            expect(rerollData.totalRerolls).toBe(1);
            expect(rerollData.successfulRerolls).toBe(0);
        });

        test('should calculate improvement correctly', () => {
            const rerollData = rerollSystem.initializeRerollData();

            rerollSystem.trackReroll('common', 'epic', rerollData);

            const entry = rerollData.rerollHistory[0];
            expect(entry.improvement).toBe(3); // epic(4) - common(1) = 3
            expect(entry.wasSuccessful).toBe(true);
        });

        test('should maintain last 20 entries', () => {
            const rerollData = rerollSystem.initializeRerollData();

            for (let i = 0; i < 25; i++) {
                rerollSystem.trackReroll('common', 'uncommon', rerollData);
            }

            expect(rerollData.rerollHistory.length).toBe(20);
        });

        test('should update lastRerollTime', () => {
            const rerollData = rerollSystem.initializeRerollData();

            rerollSystem.trackReroll('common', 'rare', rerollData);

            expect(rerollData.lastRerollTime).toBeDefined();
            expect(typeof rerollData.lastRerollTime).toBe('number');
        });
    });

    describe('Success Rate', () => {
        test('should return 0 for no rerolls', () => {
            const rerollData = rerollSystem.initializeRerollData();

            expect(rerollSystem.getSuccessRate(rerollData)).toBe(0);
        });

        test('should calculate correct success rate', () => {
            const rerollData = rerollSystem.initializeRerollData();
            rerollData.totalRerolls = 10;
            rerollData.successfulRerolls = 4;

            expect(rerollSystem.getSuccessRate(rerollData)).toBe('40.0');
        });

        test('should return 0 for null data', () => {
            expect(rerollSystem.getSuccessRate(null)).toBe(0);
        });
    });

    describe('Reroll Advice', () => {
        test('should recommend reroll for common', () => {
            const advice = rerollSystem.getRerollAdvice('common');

            expect(advice.recommend).toBe(true);
            expect(advice.message).toContain('75%');
        });

        test('should recommend reroll for uncommon', () => {
            const advice = rerollSystem.getRerollAdvice('uncommon');

            expect(advice.recommend).toBe(true);
        });

        test('should not recommend reroll for rare', () => {
            const advice = rerollSystem.getRerollAdvice('rare');

            expect(advice.recommend).toBe(false);
            expect(advice.message).toContain('25%');
        });

        test('should not recommend reroll for epic', () => {
            const advice = rerollSystem.getRerollAdvice('epic');

            expect(advice.recommend).toBe(false);
        });

        test('should strongly advise against rerolling legendary', () => {
            const advice = rerollSystem.getRerollAdvice('legendary');

            expect(advice.recommend).toBe(false);
            expect(advice.message).toContain('rarest variation');
        });

        test('should return common advice for unknown rarity', () => {
            const advice = rerollSystem.getRerollAdvice('unknown');

            expect(advice.recommend).toBe(true);
        });
    });

    describe('History Formatting', () => {
        test('should return message for empty history', () => {
            const rerollData = rerollSystem.initializeRerollData();

            const formatted = rerollSystem.formatRerollHistory(rerollData);

            expect(formatted).toBe('No reroll history yet.');
        });

        test('should format history with arrows', () => {
            const rerollData = rerollSystem.initializeRerollData();
            rerollData.rerollHistory = [
                { originalRarity: 'common', newRarity: 'rare', wasSuccessful: true, improvement: 2 },
                { originalRarity: 'rare', newRarity: 'common', wasSuccessful: false, improvement: -2 }
            ];

            const formatted = rerollSystem.formatRerollHistory(rerollData);

            expect(formatted).toContain('common');
            expect(formatted).toContain('rare');
        });

        test('should return message for null data', () => {
            const formatted = rerollSystem.formatRerollHistory(null);
            expect(formatted).toBe('No reroll history yet.');
        });
    });

    describe('Statistics Calculation', () => {
        test('should return empty stats for no rerolls', () => {
            const rerollData = rerollSystem.initializeRerollData();

            const stats = rerollSystem.calculateStats(rerollData);

            expect(stats.totalRerolls).toBe(0);
            expect(stats.successRate).toBe(0);
            expect(stats.averageImprovement).toBe(0);
            expect(stats.bestReroll).toBeNull();
        });

        test('should calculate correct statistics', () => {
            const rerollData = rerollSystem.initializeRerollData();
            rerollData.totalRerolls = 3;
            rerollData.successfulRerolls = 2;
            rerollData.rerollHistory = [
                { originalRarity: 'common', newRarity: 'rare', improvement: 2 },
                { originalRarity: 'common', newRarity: 'epic', improvement: 3 },
                { originalRarity: 'uncommon', newRarity: 'common', improvement: -1 }
            ];

            const stats = rerollSystem.calculateStats(rerollData);

            expect(stats.totalRerolls).toBe(3);
            expect(stats.averageImprovement).toBe('1.33');
            expect(stats.bestReroll).toBe('common → epic');
        });

        test('should return empty stats for null data', () => {
            const stats = rerollSystem.calculateStats(null);

            expect(stats.totalRerolls).toBe(0);
        });
    });
});
