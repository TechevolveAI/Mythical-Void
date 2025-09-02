/**
 * Unit tests for KidMode system
 * Basic validation of emotion-to-action mapping and core functionality
 */

// Mock window object for testing
global.window = {
    GameState: {
        emit: jest.fn(),
        set: jest.fn()
    }
};

// Import KidMode (would need proper module setup for real tests)
const KidModeManager = require('../systems/KidMode.js');

describe('KidMode System', () => {
    let kidMode;

    beforeEach(() => {
        kidMode = new KidModeManager();
        kidMode.initialize();
    });

    describe('Core Functionality', () => {
        test('should initialize with default configuration', () => {
            expect(kidMode.enabled).toBe(false);
            expect(kidMode.config).toBeDefined();
            expect(kidMode.config.fontScale).toBe(1.2);
            expect(kidMode.config.hitboxMin).toBe(64);
        });

        test('should enable and disable Kid Mode', () => {
            expect(kidMode.isKidMode()).toBe(false);
            
            kidMode.enableKidMode();
            expect(kidMode.isKidMode()).toBe(true);
            
            kidMode.disableKidMode();
            expect(kidMode.isKidMode()).toBe(false);
        });
    });

    describe('Emotion-to-Action Mapping', () => {
        test('should return correct action for hungry emotion', () => {
            const action = kidMode.getNextBestAction('hungry');
            
            expect(action).toBeDefined();
            expect(action.action).toBe('feed');
            expect(action.icon).toBe('🍎');
            expect(action.text).toBe('FEED');
            expect(action.message).toContain('rumbling');
        });

        test('should return correct action for sleepy emotion', () => {
            const action = kidMode.getNextBestAction('sleepy');
            
            expect(action).toBeDefined();
            expect(action.action).toBe('rest');
            expect(action.icon).toBe('🌙');
            expect(action.text).toBe('NAP TIME');
            expect(action.message).toContain('nap');
        });

        test('should return correct action for bored emotion', () => {
            const action = kidMode.getNextBestAction('bored');
            
            expect(action).toBeDefined();
            expect(action.action).toBe('play');
            expect(action.icon).toBe('🎈');
            expect(action.text).toBe('PLAY!');
            expect(action.message).toContain('fun');
        });

        test('should return correct action for excited emotion', () => {
            const action = kidMode.getNextBestAction('excited');
            
            expect(action).toBeDefined();
            expect(action.action).toBe('photo');
            expect(action.icon).toBe('📸');
            expect(action.text).toBe('PHOTO TIME!');
            expect(action.message).toContain('moment');
        });

        test('should return default action for unknown emotion', () => {
            const action = kidMode.getNextBestAction('unknown_emotion');
            
            expect(action).toBeDefined();
            expect(action.action).toBe('pet');
            expect(action.icon).toBe('🤗');
            expect(action.text).toBe('PET');
            expect(action.message).toContain('love');
        });

        test('should return default action for null/undefined emotion', () => {
            const nullAction = kidMode.getNextBestAction(null);
            const undefinedAction = kidMode.getNextBestAction(undefined);
            
            expect(nullAction.action).toBe('pet');
            expect(undefinedAction.action).toBe('pet');
        });
    });

    describe('Secondary Actions', () => {
        test('should return valid secondary actions excluding primary', () => {
            const secondaryActions = kidMode.getSecondaryActions('feed');
            
            expect(Array.isArray(secondaryActions)).toBe(true);
            expect(secondaryActions.length).toBeLessThanOrEqual(3);
            
            // Should not include 'feed' action
            const feedAction = secondaryActions.find(action => action.action === 'feed');
            expect(feedAction).toBeUndefined();
            
            // Should have required properties
            secondaryActions.forEach(action => {
                expect(action).toHaveProperty('action');
                expect(action).toHaveProperty('icon');
                expect(action).toHaveProperty('text');
                expect(action).toHaveProperty('emotion');
            });
        });

        test('should return different secondary actions for different primaries', () => {
            const feedSecondaries = kidMode.getSecondaryActions('feed');
            const playSecondaries = kidMode.getSecondaryActions('play');
            
            expect(feedSecondaries).not.toEqual(playSecondaries);
        });
    });

    describe('Configuration Management', () => {
        test('should accept custom configuration', () => {
            const customConfig = {
                fontScale: 1.5,
                hitboxMin: 80,
                emojiFallbacks: false
            };
            
            kidMode.initialize(customConfig);
            
            expect(kidMode.config.fontScale).toBe(1.5);
            expect(kidMode.config.hitboxMin).toBe(80);
            expect(kidMode.config.emojiFallbacks).toBe(false);
        });

        test('should update configuration partially', () => {
            const originalFontScale = kidMode.config.fontScale;
            
            kidMode.updateConfig({ fontScale: 2.0 });
            
            expect(kidMode.config.fontScale).toBe(2.0);
            expect(kidMode.config.hitboxMin).toBe(64); // Should remain unchanged
        });
    });

    describe('Action Data Validation', () => {
        const emotions = ['hungry', 'sleepy', 'bored', 'excited', 'dirty', 'default'];
        
        emotions.forEach(emotion => {
            test(`should return valid action data for ${emotion}`, () => {
                const action = kidMode.getNextBestAction(emotion);
                
                expect(action).toBeDefined();
                expect(typeof action.action).toBe('string');
                expect(typeof action.icon).toBe('string');
                expect(typeof action.text).toBe('string');
                expect(typeof action.message).toBe('string');
                expect(typeof action.emotion).toBe('string');
                
                // Validate required fields are not empty
                expect(action.action.length).toBeGreaterThan(0);
                expect(action.icon.length).toBeGreaterThan(0);
                expect(action.text.length).toBeGreaterThan(0);
                expect(action.message.length).toBeGreaterThan(0);
            });
        });
    });
});