const GameStateManager = require('../systems/GameState.js');

describe('opening journey state contract', () => {
    let manager;

    beforeEach(() => {
        localStorage.clear();
        manager = new GameStateManager();
    });

    afterEach(() => manager.stopAutoSave());

    test('reconciles legacy booleans into one ordered checkpoint', () => {
        manager.set('session.gameStarted', true);
        manager.set('creature.hatched', true);
        manager.set('creature.named', true);
        manager.set('creature.name', 'Nova');
        manager.set('tutorial.crashStorySeen', true);
        manager.set('tutorial.controlsSeen', true);
        manager.set('tutorial.openingJourney', {
            milestone: 'creature_named',
            completedMilestones: ['hatch_started']
        });

        expect(manager.getOpeningJourney()).toEqual(expect.objectContaining({
            milestone: 'controls_completed',
            completedMilestones: [
                'hatch_started',
                'creature_hatched',
                'creature_named',
                'sanctuary_entered',
                'story_completed',
                'controls_completed'
            ]
        }));
    });

    test('never moves a completed journey backwards', () => {
        manager.recordOpeningMilestone('story_completed');
        manager.recordOpeningMilestone('creature_hatched');
        expect(manager.getOpeningJourney().milestone).toBe('story_completed');
    });

    test('keeps portrait readiness independent from playable progress', () => {
        manager.set('creature.hatched', true);
        manager.set('creature.named', true);
        manager.set('creature.name', 'Nova');
        manager.set('tutorial.livingFormPending', true);
        manager.recordOpeningPortraitStatus('pending');
        manager.recordOpeningMilestone('sanctuary_entered');

        const result = manager.getOpeningJourney();
        expect(result.milestone).toBe('sanctuary_entered');
        expect(result.portrait.status).toBe('pending');
    });

    test('resumes an interrupted named-creature handoff', () => {
        manager.set('session.gameStarted', true);
        manager.set('creature.hatched', true);
        manager.set('creature.named', true);
        manager.set('creature.name', 'Nova');
        manager.set('tutorial.livingFormPending', true);
        expect(manager.getOpeningResumeTarget()).toBe('SoulRevealScene');
    });

    test('does not downgrade a ready portrait after a retry signal', () => {
        manager.set('tutorial.livingFormSeen', true);
        manager.recordOpeningPortraitStatus('ready');
        manager.recordOpeningPortraitStatus('retry');
        expect(manager.getOpeningJourney().portrait.status).toBe('ready');
    });
});
