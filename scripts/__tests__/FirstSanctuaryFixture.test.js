const fs = require('node:fs');
const path = require('node:path');
const GameStateManager = require('../../src/systems/GameState.js');
const { attach } = require('../../src/__tests__/support/soulNamingFixture.cjs');
const { stageFirstSanctuaryHatchFixture } = require('../lib/first-sanctuary-fixture.cjs');

describe('first-Sanctuary browser fixture represents a committed hatch', () => {
    let state;
    beforeEach(() => {
        localStorage.clear();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        state = new GameStateManager();
        window.GameState = state;
        delete window.CloudSave;
        state.set('creature.genes', { id: 'synthetic-first-genes', species: 'nebulaSprite', rarity: 'rare' });
        expect(state.save()).toBe(true);
    });
    afterEach(() => {
        state.stopAutoSave();
        delete window.GameState;
        jest.restoreAllMocks();
        localStorage.clear();
    });
    function captureOwner() {
        const scene = { namingLifetime: {}, livingFormHandoff: null,
            scene: {}, time: {}, cameras: { main: {} } };
        attach(scene, 'captureLivingFormHandoffOwner');
        return scene.captureLivingFormHandoffOwner(null);
    }
    test('control: the old genes-only fixture cannot own a living-form handoff', () => {
        state.set('creature.named', true);
        expect(captureOwner()).toBeNull();
    });
    test('the fixture persists the hatch and permits the unchanged handoff owner after naming', () => {
        expect(stageFirstSanctuaryHatchFixture(state)).toBe(true);
        const saved = JSON.parse(localStorage.getItem(state.saveKey));
        expect(saved.session.gameStarted).toBe(true);
        expect(saved.creature.hatched).toBe(true);
        expect(saved.creature.named).toBe(false);
        expect(saved.creature.id).toBeTruthy();
        expect(saved.creature.genes.id).toBe('synthetic-first-genes');
        state.set('creature.named', true);
        expect(captureOwner()?.isCurrent()).toBe(true);
    });
    test('a held save is not bypassed or changed by fixture preparation', () => {
        state.holdSaveAdmission({ code: 'synthetic_hold' });
        const before = JSON.stringify(state.state), raw = localStorage.getItem(state.saveKey);
        expect(stageFirstSanctuaryHatchFixture(state)).toBe(false);
        expect(JSON.stringify(state.state)).toBe(before);
        expect(localStorage.getItem(state.saveKey)).toBe(raw);
    });
    test('a refused primary write cannot publish the fixture as a completed hatch', () => {
        const before = JSON.stringify(state.state), raw = localStorage.getItem(state.saveKey);
        const set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === state.saveKey) throw Error('Synthetic primary refusal');
            return set.call(this, key, value);
        });
        expect(stageFirstSanctuaryHatchFixture(state)).toBe(false);
        expect(JSON.stringify(state.state)).toBe(before);
        expect(localStorage.getItem(state.saveKey)).toBe(raw);
    });
    test('the browser journey stages the hatch after scene setup and before naming', () => {
        const source = fs.readFileSync(path.join(__dirname, '../smoke-secondary-journeys.js'), 'utf8');
        const start = source.indexOf('async function smokeFirstSanctuaryOnboarding');
        const fixture = source.indexOf('stageFirstSanctuaryHatchFixture.toString()', start);
        const naming = source.indexOf('const naming = await waitFor(', start);
        expect(fixture).toBeGreaterThan(start);
        expect(fixture).toBeLessThan(naming);
    });
});
