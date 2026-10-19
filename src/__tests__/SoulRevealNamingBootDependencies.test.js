const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { parse } = require('@babel/parser');
const { fixture } = require('./support/soulNamingFixture.cjs');
const { loadAchievementSystem: loadSystem } = require('./support/achievementDraftFixture.cjs');
const loadAchievementSystem = (state, options = {}) => loadSystem(state, { sceneWindow: window, ...options });
const projectBeacon = require('../config/project-beacon.json');
const parent = readPinnedSource('9407eab8:src/scenes/SoulRevealScene.js');
const declaration = parse(parent, { sourceType: 'module' }).program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
const method = declaration.body.body.find(node => node.key?.name === 'finalizeName');

function loadQuests(original = null) {
    const filename = path.join(__dirname, '../systems/QuestManager.js');
    const source = (original || fs.readFileSync(filename, 'utf8'))
        .replace("import projectBeacon from '../config/project-beacon.json';", '')
        .replace('export default questManager;', 'module.exports = questManager;');
    const context = { module: { exports: {} }, window, console, projectBeacon, Date, Math, Set, Map, Object, Array };
    vm.runInNewContext(source, context, { filename });
    const manager = context.module.exports; manager.init(); return manager;
}

describe('naming includes the actual pre-Sanctuary boot dependencies', () => {
    let f;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        localStorage.clear(); document.body.replaceChildren();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        for (const key of ['CloudSave', 'AchievementSystem', 'QuestManager', 'AudioManager', 'BirthEventSystem']) delete window[key];
        f = fixture();
    });
    afterEach(() => {
        f.close(); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers();
        for (const key of ['GameState', 'CloudSave', 'AchievementSystem', 'QuestManager', 'AudioManager', 'BirthEventSystem']) delete window[key];
        document.body.replaceChildren();
    });

    test('control: the parent reaches its reveal with the real boot-shaped achievement and quest managers', () => {
        window.AchievementSystem = loadAchievementSystem(f.state, { initialize: false }).system;
        loadQuests();
        const finalize = vm.runInNewContext(`({${parent.slice(method.start, method.end)}}).finalizeName`,
            { window, localStorage, console, Date, Math, devLog() {} });
        finalize.call(f.scene);
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.raw()).creature.soulData).toBeDefined();
        expect(JSON.parse(f.raw()).stats.creaturesHatched).toBe(1);
    });

    test('an achievement singleton not yet initialised by GameScene cannot block the first naming', () => {
        const { system } = loadAchievementSystem(f.state, { initialize: false });
        window.AchievementSystem = system; expect(system.initialized).toBe(false);
        f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.raw()).stats.creaturesHatched).toBe(1);
    });

    test('actual collection quest subscribers do not strand the committed creature before its reveal', () => {
        window.AchievementSystem = loadAchievementSystem(f.state).system;
        const quests = loadQuests();
        expect(quests.activeQuests.some(quest => quest.objective.type === 'collection_size')).toBe(true);
        f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.raw()).quests.active).toEqual(quests.activeQuests);
        expect(JSON.parse(f.raw()).creature.soulData).toBeDefined();
    });

    test('cold achievement readiness retains stored claimed progress and existing pending claims', () => {
        const { system } = loadAchievementSystem(f.state, { initialize: false });
        window.AchievementSystem = system;
        const id = Object.keys(system.definitions)[0], claimed = { BRONZE: { claimedAt: 77, rewards: { coins: 10 } } };
        f.state.set('achievements', { [id]: { progress: { BRONZE: { unlocked: true, unlockedAt: 17, value: 1 } }, claimed } });
        expect(f.state.save()).toBe(true);
        system.pendingClaims = [{ id: 'fictional-existing-claim', tier: 'BRONZE' }];
        f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.raw()).achievements[id].claimed).toEqual(claimed);
        expect(system.pendingClaims).toEqual(expect.arrayContaining([{ id: 'fictional-existing-claim', tier: 'BRONZE' }]));
    });

    test('failed cold readiness keeps controls and a native retry without allocating a record', () => {
        const { system } = loadAchievementSystem(f.state, { initialize: false }); window.AchievementSystem = system;
        const initialize = system.initialize.bind(system);
        jest.spyOn(system, 'initialize').mockImplementationOnce(() => { throw Error('fictional readiness failure'); })
            .mockImplementation(initialize);
        const raw = f.raw(), memory = JSON.stringify(f.state.state), random = jest.spyOn(Math, 'random');
        f.scene.finalizeName();
        expect(f.raw()).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(memory);
        expect(random).not.toHaveBeenCalled(); expect(f.scene.canProceed).toBe(true);
        document.querySelector('[data-mythical-naming-ready] button').click();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(f.state.get('creatures')).toHaveLength(1);
    });

    test('cold readiness cannot initialise a replaced achievement manager behind the original reader', () => {
        const { system } = loadAchievementSystem(f.state, { initialize: false });
        const replacement = { initialized: false, initialize: jest.fn() };
        const initialize = jest.spyOn(system, 'initialize');
        const canCommit = f.state.canCommitHatchSave.bind(f.state);
        jest.spyOn(f.state, 'canCommitHatchSave').mockImplementation(() => {
            window.AchievementSystem = replacement; return canCommit();
        });
        f.scene.finalizeName(); expect(initialize).not.toHaveBeenCalled(); expect(replacement.initialize).not.toHaveBeenCalled();
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled(); expect(f.state.get('creatures')).toHaveLength(0);
    });

    test('the real prepared quest listener is quiescent and required quest events are delivered once', () => {
        window.AchievementSystem = loadAchievementSystem(f.state).system;
        const quests = loadQuests(), events = [], emit = quests.emit.bind(quests);
        quests.emit = (event, data) => { events.push(event); return emit(event, data); };
        const save = jest.spyOn(f.state, 'save');
        const track = jest.spyOn(quests, 'trackProgress'); f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(save).not.toHaveBeenCalled();
        const packets = f.scene.namingAttempt.prepared.notifications.filter(packet => packet.kind === 'quest');
        expect(events).toEqual(packets.map(packet => packet.event));
        expect(events.filter(event => event === 'questCompleted')).toHaveLength(1);
        expect(track.mock.contexts.filter(context => context === quests)).toHaveLength(2);
        expect(quests.activeQuests).toBe(f.state.get('quests.active'));
    });

    test.each(['new game', 'load', 'epoch', 'manager'])('a %s during a live collection completion cannot continue an old quest write or rarity call', kind => {
        const quests = loadQuests();
        const collection = quests.activeQuests.find(quest => quest.objective.type === 'collection_size');
        collection.objective.target = 1;
        let next, nextRaw;
        quests.on('questCompleted', () => {
            if (next) return;
            if (kind === 'new game') expect(f.state.startFreshGame()).toBe(true);
            if (kind === 'load') expect(f.state.load()).toBe(true);
            if (kind === 'epoch') f.state.releaseSaveAdmission();
            if (kind === 'manager') { const successor = f.replaceManager(); successor.set('player.cosmicCoins', 77); expect(successor.save()).toBe(true); }
            next = JSON.stringify(window.GameState.state); nextRaw = f.raw();
        });
        f.state.set('creatures', [{ id: 'fictional-added-creature', rarity: 'rare' }]);
        const track = jest.spyOn(quests, 'trackProgress');
        f.state.emit('creatureAddedToCollection', { creature: { rarity: 'rare' } });
        expect(next).toBeDefined(); expect(JSON.stringify(window.GameState.state)).toBe(next); expect(f.raw()).toBe(nextRaw);
        expect(track.mock.calls.filter(args => args[0] === 'obtain_rarity')).toHaveLength(0);
    });

    test('a fresh naming entry can reload already-initialised quests only for its newly admitted epoch', () => {
        window.AchievementSystem = loadAchievementSystem(f.state).system; const quests = loadQuests();
        const old = quests.activeQuests;
        f.state.releaseSaveAdmission();
        const load = jest.spyOn(quests, 'loadQuestState'); f.scene.finalizeName();
        expect(load).toHaveBeenCalledTimes(1); expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(quests.loadedAdmissionEpoch).toBe(f.state.getSaveAdmission().epoch);
        expect(quests.activeQuests).not.toBe(old);
    });

    test('an epoch change does not rebase an already prepared naming retry', () => {
        window.AchievementSystem = loadAchievementSystem(f.state).system; const quests = loadQuests();
        const set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey) throw Error('fictional primary refusal'); return set.call(this, key, value);
        });
        f.scene.finalizeName(); const attempt = f.scene.namingAttempt, raw = f.raw();
        f.state.releaseSaveAdmission(); const load = jest.spyOn(quests, 'loadQuestState');
        f.scene.retryNamingSave(); expect(load).not.toHaveBeenCalled(); expect(f.scene.namingAttempt).toBe(attempt);
        expect(f.raw()).toBe(raw); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
    });

    test('ordinary collection progress suppresses only unchanged below-target refreshes', () => {
        const quests = loadQuests(), collection = quests.activeQuests.find(quest => quest.objective.type === 'collection_size');
        const events = [], emit = quests.emit.bind(quests);
        quests.emit = (event, data) => { events.push(event); return emit(event, data); };
        const save = jest.spyOn(quests, 'saveQuestState');
        quests.trackProgress('collection_size', { size: 1 }); expect(collection.progress).toBe(1); expect(save).toHaveBeenCalledTimes(1);
        const once = [...events]; quests.trackProgress('collection_size', { size: 1 });
        expect(events).toEqual(once); expect(save).toHaveBeenCalledTimes(1);
        quests.trackProgress('collection_size', { size: 0 }); expect(collection.progress).toBe(0); expect(save).toHaveBeenCalledTimes(2);
        quests.trackProgress('collection_size', { size: collection.objective.target });
        expect(collection.completed).toBe(true); expect(save).toHaveBeenCalledTimes(3);
        const completed = [...events]; quests.trackProgress('collection_size', { size: collection.objective.target });
        expect(events).toEqual(completed); expect(save).toHaveBeenCalledTimes(3);
    });

    test.each(['claimed', 'exact target', 'other completion'])('%s retains normal collection completion rules', kind => {
        const quests = loadQuests(), collection = quests.activeQuests.find(quest => quest.objective.type === 'collection_size');
        const events = [], emit = quests.emit.bind(quests); quests.emit = (event, data) => { events.push(event); return emit(event, data); };
        if (kind === 'claimed') collection.claimed = true;
        if (kind === 'exact target') collection.progress = collection.objective.target;
        let other;
        if (kind === 'other completion') {
            other = quests.activeQuests.find(quest => quest !== collection && quest.objective.target > 0);
            other.progress = other.objective.target; other.completed = false;
        }
        const save = jest.spyOn(quests, 'saveQuestState');
        quests.trackProgress('collection_size', { size: kind === 'other completion' ? 0 : collection.objective.target });
        if (kind === 'claimed') { expect(collection.progress).toBe(0); expect(collection.completed).toBe(false); expect(save).not.toHaveBeenCalled(); }
        else {
            expect(kind === 'exact target' ? collection.completed : other.completed).toBe(true);
            expect(save).toHaveBeenCalledTimes(1); expect(events).toEqual(expect.arrayContaining(['questCompleted', 'questProgressUpdated']));
        }
    });

    test('unchanged collection size does not skip the separate rarity progress call', () => {
        const quests = loadQuests(), rarity = quests.activeQuests.find(quest => quest.objective.type === 'obtain_rarity');
        const track = jest.spyOn(quests, 'trackProgress');
        f.state.emit('creatureAddedToCollection', { creature: { rarity: 'rare' } });
        expect(track.mock.calls.map(args => args[0])).toEqual(['collection_size', 'obtain_rarity']);
        expect(rarity.completed).toBe(true);
    });

    test.each(['quest manager', 'quest array', 'quest map', 'new game', 'load', 'epoch'])(
        'a %s replacement before commit cannot publish or reload an old quest attempt', kind => {
            window.AchievementSystem = loadAchievementSystem(f.state).system; const quests = loadQuests();
            let next, raw, active, completed;
            const off = f.state.on('saveBackupCreated', () => {
                off();
                if (kind === 'quest manager') window.QuestManager = {};
                if (kind === 'quest array') quests.activeQuests = [];
                if (kind === 'quest map') quests.eventListeners = new Map();
                if (kind === 'new game') expect(f.state.startFreshGame()).toBe(true);
                if (kind === 'load') expect(f.state.load()).toBe(true);
                if (kind === 'epoch') f.state.releaseSaveAdmission();
                next = JSON.stringify(f.state.state); raw = f.raw(); active = quests.activeQuests; completed = quests.completedQuests;
            });
            const load = jest.spyOn(quests, 'loadQuestState'); f.scene.finalizeName();
            expect(next).toBeDefined(); expect(JSON.stringify(f.state.state)).toBe(next); expect(f.raw()).toBe(raw);
            expect(quests.activeQuests).toBe(active); expect(quests.completedQuests).toBe(completed);
            expect(load).not.toHaveBeenCalled(); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        }
    );

    test('partial original quest publication holds the saved result without reloading or replay', () => {
        window.AchievementSystem = loadAchievementSystem(f.state).system; const quests = loadQuests(), original = quests.activeQuests;
        const off = f.state.on('saveBackupCreated', () => { off(); Object.defineProperty(quests, 'completedQuests', { writable: false }); });
        f.scene.finalizeName();
        expect(quests.activeQuests).not.toBe(original); expect(f.scene.namingAttempt.questPublication.isPublished()).toBe(false);
        expect(f.state.getSaveAdmission().status).toBe('held'); expect(JSON.parse(f.raw()).creature.soulData).toBeDefined();
        const raw = f.raw(), active = quests.activeQuests, load = jest.spyOn(quests, 'loadQuestState');
        f.scene.retryNamingSave(); expect(load).not.toHaveBeenCalled(); expect(f.raw()).toBe(raw); expect(quests.activeQuests).toBe(active);
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
    });

    test('real quest and achievement business data/event order match the immutable parent ordinary result', () => {
        const oldQuests = readPinnedSource('9407eab8:src/systems/QuestManager.js');
        const execute = old => {
            f.close(); localStorage.clear(); delete window.QuestManager; delete window.AchievementSystem; f = fixture();
            const random = jest.spyOn(Math, 'random').mockReturnValue(0.375);
            const achievements = loadAchievementSystem(f.state).system, quests = loadQuests(old ? oldQuests : null), events = [];
            achievements.events = { emit: (event, data) => { events.push(JSON.parse(JSON.stringify({ kind: 'achievement', event, data }))); } };
            const questEmit = quests.emit.bind(quests);
            quests.emit = (event, data) => {
                events.push(JSON.parse(JSON.stringify({ kind: 'quest', event, data }))); return questEmit(event, data);
            };
            const stateEmit = f.state.emit.bind(f.state);
            f.state.emit = (event, data) => {
                if (!['saved', 'saveBackupCreated'].includes(event)) events.push(JSON.parse(JSON.stringify({ kind: 'state', event, data })));
                return stateEmit(event, data);
            };
            const finalize = old ? vm.runInNewContext(`({${parent.slice(method.start, method.end)}}).finalizeName`,
                { window, localStorage, console, Date, Math, devLog() {} }) : f.scene.finalizeName;
            finalize.call(f.scene);
            expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
            const result = JSON.parse(JSON.stringify({ raw: JSON.parse(f.raw()), state: f.state.state, events,
                active: quests.activeQuests, completed: quests.completedQuests, claims: achievements.pendingClaims,
                draws: random.mock.calls.length }));
            random.mockRestore(); return result;
        };
        expect(execute(false)).toEqual(execute(true));
    });
});
