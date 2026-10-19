const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { namingRosterFixture } = require('./support/namingRosterFixture.cjs');
const { livingHandoffFixture } = require('./support/livingHandoffFixture.cjs');
const { loadAchievementSystem } = require('./support/achievementDraftFixture.cjs');

function loadQuests() {
    const filename = path.join(__dirname, '../systems/QuestManager.js');
    const source = fs.readFileSync(filename, 'utf8')
        .replace("import projectBeacon from '../config/project-beacon.json';", '')
        .replace('export default questManager;', 'module.exports = questManager;');
    const context = { module: { exports: {} }, window, console, Date, Math, Set, Map, Object, Array,
        projectBeacon: require('../config/project-beacon.json') };
    vm.runInNewContext(source, context, { filename });
    const quests = context.module.exports; quests.init(); return quests;
}

describe('actual opening hatch, boot services, naming and Continue chain', () => {
    let f;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        localStorage.clear(); document.body.replaceChildren();
        for (const key of ['CloudSave', 'AchievementSystem', 'QuestManager', 'AudioManager', 'BirthEventSystem']) delete window[key];
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
    });
    afterEach(() => {
        f?.close(); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers();
        for (const key of ['GameState', 'CloudSave', 'AchievementSystem', 'QuestManager', 'AudioManager', 'BirthEventSystem']) delete window[key];
        document.body.replaceChildren();
    });
    function journey(inventory, bootBeforeHatch) {
        let quests, achievements;
        const boot = current => {
            achievements = loadAchievementSystem(current.state, { initialize: false, sceneWindow: window }).system;
            window.AchievementSystem = achievements;
            quests = loadQuests();
        };
        const base = namingRosterFixture(() => {}, { inventory, beforeHatch: bootBeforeHatch ? boot : () => {} });
        if (!bootBeforeHatch) boot(base);
        f = livingHandoffFixture({ sourceFixture: base, finalize: false });
        const identity = f.state.get('creature.genes.id'), previous = JSON.parse(JSON.stringify(f.state.get('creatures')));
        expect(achievements.initialized).toBe(false);
        if (bootBeforeHatch) {
            expect(JSON.stringify(quests.activeQuests)).toBe(JSON.stringify(f.state.get('quests.active')));
            expect(quests.loadedAdmissionEpoch).toBe(f.state.getSaveAdmission().epoch);
        }
        f.scene.finalizeName();
        const handoff = f.scene.livingFormHandoff;
        expect(handoff).not.toBeNull(); expect(handoff).toBeDefined();
        expect(handoff.isVisible).toBe(true);
        handoff.mobileContinueButton.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
        jest.advanceTimersByTime(360);
        expect(f.scene.scene.start).toHaveBeenCalledWith('GameScene', { fromSoulReveal: true });
        expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
        expect(f.state.get('creature.genes.id')).toBe(identity);
        expect(f.state.get('creatures').slice(0, previous.length)).toEqual(previous);
        expect(f.state.get('stats.creaturesHatched')).toBe(1);
        expect(quests.activeQuests).toBe(f.state.get('quests.active'));
        expect(quests.completedQuests).toBe(f.state.get('quests.completed'));
        const restored = new f.state.constructor(); f.states.push(restored); window.GameState = restored;
        expect(restored.load()).toBe(true);
        expect(restored.get('creature.genes.id')).toBe(identity);
        expect(restored.get('creatures').length).toBe(previous.length + 1);
        expect(restored.get('tutorial.livingFormPending')).toBe(false);
        expect(restored.get('tutorial.openingJourney.milestone')).toBe('sanctuary_entered');
    }

    test.each([false, true])('control: services started after hatch, inventory=%s', inventory => journey(inventory, false));
    test.each([false, true])('actual boot: services started before hatch, inventory=%s', inventory => journey(inventory, true));
});
