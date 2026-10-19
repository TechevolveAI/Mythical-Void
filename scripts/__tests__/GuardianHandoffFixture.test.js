const { fixture, factsFor } = require('../../src/__tests__/support/levelCompletionFixture.cjs');
const { stageGuardianHandoffThoughtFixture } = require('../lib/guardian-handoff-fixture.cjs');

describe('direct Guardian fixture uses the real Sanctuary thought initialisation', () => {
    let f, scene;
    beforeEach(() => {
        document.body.replaceChildren();
        f = fixture({ controlledTimers: true });
        f.context.document = document;
        Object.assign(f.selected, { innerWidth: 390, innerHeight: 844,
            addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window) });
        f.selected.AudioManager.playLevelUp = () => {};
        f.selected.ThoughtBubbleSystem.isInitialized = false;
    });
    afterEach(() => {
        scene?.events.emit('shutdown'); scene?.regionalVictoryPanel?.destroy();
        scene = null; f.close(); document.body.replaceChildren();
    });
    test('control: skipping that service refuses rewards without changing saved progress', () => {
        const raw = f.storage.getItem(f.state.saveKey);
        scene = new f.api.NativeForest(factsFor(0), f.effects);
        expect(scene.showBossVictory()).toBe(false);
        expect(scene.forestCompletionAttempt.phase).toBe('protected');
        expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        expect(f.state.get('levels.mythicalForest.completed')).toBe(false);
    });
    test('the normal initialiser loads provenance without saving and the real completion succeeds', () => {
        const raw = f.storage.getItem(f.state.saveKey), before = JSON.stringify(f.state.state);
        expect(stageGuardianHandoffThoughtFixture(f.state, f.selected.ThoughtBubbleSystem)).toBe(true);
        expect(JSON.stringify(f.state.state)).toBe(before);
        expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        expect(f.persistenceEvents).toEqual([]);
        scene = new f.api.NativeForest(factsFor(0), f.effects);
        expect(scene.showBossVictory()).toBe(true);
        expect(scene.forestCompletionAttempt.phase).toBe('presented');
        expect(f.state.get('levels.mythicalForest.completed')).toBe(true);
        expect(document.querySelector('[data-testid="expedition-debrief"]')).not.toBeNull();
    });
    test('fixture preparation cannot bypass a held save', () => {
        f.state.holdSaveAdmission({ code: 'synthetic_hold' });
        const raw = f.storage.getItem(f.state.saveKey), before = JSON.stringify(f.state.state);
        expect(stageGuardianHandoffThoughtFixture(f.state, f.selected.ThoughtBubbleSystem)).toBe(false);
        expect(f.selected.ThoughtBubbleSystem.isInitialized).toBe(false);
        expect(JSON.stringify(f.state.state)).toBe(before);
        expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
    });
});
