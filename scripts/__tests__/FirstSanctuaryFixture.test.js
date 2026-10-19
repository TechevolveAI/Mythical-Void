const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const GameStateManager = require('../../src/systems/GameState.js');
const { attach, fixture } = require('../../src/__tests__/support/soulNamingFixture.cjs');
const { loadAchievementSystem } = require('../../src/__tests__/support/achievementDraftFixture.cjs');
const { stageFirstSanctuaryHatchFixture } = require('../lib/first-sanctuary-fixture.cjs');

function loadQuests() {
    const filename = path.join(__dirname, '../../src/systems/QuestManager.js');
    const source = fs.readFileSync(filename, 'utf8')
        .replace("import projectBeacon from '../config/project-beacon.json';", '')
        .replace('export default questManager;', 'module.exports = questManager;');
    const context = { module: { exports: {} }, window, console, Date, Math, Set, Map, Object, Array,
        projectBeacon: require('../../src/config/project-beacon.json') };
    vm.runInNewContext(source, context, { filename });
    context.module.exports.init();
    return context.module.exports;
}

describe('first-Sanctuary browser fixture represents a committed hatch', () => {
    let state;
    beforeEach(() => {
        localStorage.clear();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        state = new GameStateManager();
        window.GameState = state;
        delete window.CloudSave;
        delete window.QuestManager;
        delete window.AchievementSystem;
        state.set('creature.genes', { id: 'synthetic-first-genes', species: 'nebulaSprite', rarity: 'rare' });
        expect(state.save()).toBe(true);
    });
    afterEach(() => {
        state.stopAutoSave();
        delete window.GameState;
        delete window.QuestManager;
        delete window.AchievementSystem;
        document.body.replaceChildren();
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
    test('staging a direct preview rebinds the real loaded quest arrays without changing progress', () => {
        const quests = loadQuests();
        const progress = JSON.stringify(state.get('quests'));
        expect(stageFirstSanctuaryHatchFixture(state, quests)).toBe(true);
        expect(quests.activeQuests).toBe(state.get('quests.active'));
        expect(quests.completedQuests).toBe(state.get('quests.completed'));
        expect(JSON.stringify(state.get('quests'))).toBe(progress);
        expect(quests.captureNamingProgressPublication(state).isCurrent()).toBe(true);
    });
    test('the staged preview can name its creature with the real quest and achievement services', () => {
        const f = fixture();
        try {
            const quests = loadQuests();
            const { system } = loadAchievementSystem(f.state, { sceneWindow: window });
            window.AchievementSystem = system;
            expect(stageFirstSanctuaryHatchFixture(f.state, quests)).toBe(true);
            f.scene.finalizeName();
            expect(f.state.get('creature.named')).toBe(true);
            expect(f.scene.namingSaveRecovery).toBeFalsy();
            expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
            expect(f.state.get('creatures')).toHaveLength(1);
        } finally { f.close(); window.GameState = state; }
    });
    test('an unrelated or unloaded quest source is not silently repaired by the fixture', () => {
        const quests = loadQuests();
        quests.loadedGameState = {};
        const before = JSON.stringify(state.state), raw = localStorage.getItem(state.saveKey);
        expect(stageFirstSanctuaryHatchFixture(state, quests)).toBe(false);
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
