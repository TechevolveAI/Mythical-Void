const { readPinnedSource } = require('./pinnedSourceFixture.cjs');
const fs = require('node:fs'), vm = require('node:vm');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const Clock = require('phaser/src/time/Clock');
const GameObject = require('phaser/src/gameobjects/GameObject');
const Rectangle = require('phaser/src/geom/rectangle/Rectangle');
const Contains = require('phaser/src/geom/rectangle/Contains');
const { compiledTestEntrySource, compiledModuleSource } = require('./compiledInventorySource.cjs');
const CloudRecoveryJournal = require('../../systems/CloudRecoveryJournal.js');
const epoch = 1700000000777, clone = value => JSON.parse(JSON.stringify(value));
const baseline = readPinnedSource('dfc31af7:src/scenes/PlatformerLevelScene.js');
const nodes = parse(baseline, { sourceType: 'module' }).program.body, cls = nodes.find(node => node.type === 'ClassDeclaration');
const constants = ['BOSS_REWARD_KEY_BY_LEVEL', 'EXPEDITION_CHECKPOINT_PATH'], functions = ['calculateVictoryCoins', 'getBossPowerupReward'];
const declarations = nodes.filter(node => node.type === 'VariableDeclaration' && constants.includes(node.declarations[0]?.id?.name) ||
    node.type === 'FunctionDeclaration' && functions.includes(node.id?.name)).map(node => baseline.slice(node.start, node.end)).join('\n');
const methods = ['recordLevelSuccess', 'clearPersistedExpeditionCheckpoint', 'completeLevelProgression'].map(name => {
    const node = cls.body.body.find(node => node.key?.name === name); return baseline.slice(node.start, node.end);
}).join('\n');
const currentMethod = (file, name) => {
    const source = fs.readFileSync(file, 'utf8'), cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
    const method = cls.body.body.find(node => node.key?.name === name); return source.slice(method.start, method.end);
};
const forestMethod = currentMethod('src/scenes/levels/MythicalForestLevel.js', 'showBossVictory');
const actualPresentation = ['showRegionalVictorySummary', 'presentLevelCompletion', 'returnToHub']
    .map(name => currentMethod('src/scenes/PlatformerLevelScene.js', name)).join('\n');
const entry = compiledTestEntrySource(`
    import GameStateManager from './src/systems/GameState.js';
    import economy from './src/systems/EconomyManager.js';
    import inventory from './src/systems/InventoryManager.js';
    import achievements from './src/systems/AchievementSystem.js';
    import quests from './src/systems/QuestManager.js';
    import * as outcomes from './src/systems/GuardianOutcomes.js';
    import * as guardians from './src/systems/GuardianResidents.js';
    import * as residents from './src/systems/RescuedResidents.js';
    import * as kit from './src/systems/ProjectBeaconFieldKit.js';
    import { queueProjectBeaconDebrief, unlockProjectBeaconMilestone } from './src/systems/ProjectBeaconStory.js';
    import { recordCurrentRegionRestoration, getCurrentEcologySnapshot } from './src/systems/CurrentEcology.js';
    import { captureCompletionAchievementSource, calculateCompletionAchievementDraft, continueCompletionGuardianDraft,
        calculateCompletionGuardianPrefix, continueCompletionLevelDraft } from './src/dev/CompletionAchievementDraft.js';
    import { calculateLevelCompletionDraft, getCompletionRewardData } from './src/dev/LevelCompletionDraft.js';
    import { prepareCompletionPublicationDraft } from './src/dev/CompletionPublicationDraft.js';
    import { captureCompletionPacketGuard } from './src/dev/CompletionPacketGuard.js';
    import { createForestCompletionHandler } from './src/scenes/controllers/ForestCompletionTransaction.js';
    import { createPeaksCompletionHandler } from './src/scenes/controllers/PeaksCompletionTransaction.js';
    import { createCrystalCompletionHandler } from './src/scenes/controllers/CrystalCompletionTransaction.js';
    import CrystalVictorySequence from './src/scenes/controllers/CrystalVictorySequence.js';
    import ReefVictorySequence from './src/scenes/controllers/ReefVictorySequence.js';
    import { createReefCompletionHandler } from './src/scenes/controllers/ReefCompletionTransaction.js';
    import AuroraVictorySequence from './src/scenes/controllers/AuroraVictorySequence.js';
    import { createAuroraCompletionHandler } from './src/scenes/controllers/AuroraCompletionTransaction.js';
    import ExpeditionDebriefPanel from './src/ui/ExpeditionDebriefPanel.js';
    import { getRegionalVictorySummary } from './src/systems/RegionalVictorySummary.js';
    import { getProjectBeaconDebrief, acknowledgeProjectBeaconDebrief } from './src/systems/ProjectBeaconStory.js';
    import { shareGuardianRestoration } from './src/utils/GuardianRestorationShare.js';
    import bossConfigs from './src/config/bosses.json';
    ${declarations}
    class Completion {
        constructor(facts, effects) { this.levelId = facts.sceneLevelId; this.levelStartTime = facts.now - facts.time;
            this.damageTaken = facts.noDamage ? 0 : 1; this.guardianInterventions = facts.guardianInterventions;
            this.rescuedResidentSupport = { victoryCoinBonus: facts.residentCoinBonus };
            this.villageSupport = { victoryCoinBonus: facts.villageCoinBonus }; this.effects = effects; }
        enterLevelCompletionState() { this.levelCompletionActive = true; }
        refreshCurrentEcologyNode() { this.effects.push({ kind: 'scene', name: 'refreshCurrentEcologyNode' }); }
        presentLevelCompletion() { throw Error('LIVE_PRESENTATION_FORBIDDEN'); }
        ${methods}
    }
    class NativeForest extends Completion {
        constructor(facts, effects) {
            super(facts, effects);
            this.forestCompletionLifetime = {}; this.levelCompletionActive = true; this.bossDefeated = true; this.bossFightActive = false;
            this.forestVictoryShown = false; this._levelProgressionRecorded = false; this.levelCompletionResult = null;
            this.starFragmentsCollected = facts.rewardBonusCount; this.active = true; this.transitions = [];
            this.events = new Phaser.Events.EventEmitter(); this.time = { now: facts.now };
            this.physics = { world: { isPaused: true, gravity: { y: 800 } } }; this.input = { keyboard: {}, enabled: true };
            this.cameras = { main: { width: 390, height: 844 } }; this.scene = { start: (name, data) => {
                this.transitions.push({ name, data }); this.events.emit('shutdown'); this.active = false;
            } };
            this.sys = { scene: this, events: this.events, settings: { key: 'MythicalForestLevel' }, isActive: () => this.active,
                game: { scene: { getScene: key => key === 'MythicalForestLevel' && this.active ? this : null } } };
            this.player = { active: true, scene: this };
            this.player.body = { world: this.physics.world, gameObject: this.player };
            this.guardianEncounter = { id: 'elder_treant', active: true, startedAt: facts.now - 1000 };
        }
        syncCampaignObjectiveDisplay() {}
        destroyGeneratedVideoReadyNotice() {}
        getVillageCompletionCopy() { return ''; }
        showRescuedResidentReleaseMoment() { return false; }
        showCompanionGuardianRescueTableau() {}
        replayForestBirthdayMessage() { return false; }
        resumeFailureRecoveryClock() {}
        ${forestMethod}
        ${actualPresentation}
    }
    const finishForestCompletion = createForestCompletionHandler(Object.freeze({ prototype: NativeForest.prototype,
        methods: Object.freeze(Object.fromEntries(['showBossVictory', 'showRegionalVictorySummary', 'syncCampaignObjectiveDisplay',
            'refreshCurrentEcologyNode', 'returnToHub'].map(name => [name, NativeForest.prototype[name]]))) }));
    class NativePeaks extends NativeForest {
        constructor(facts, effects) {
            super(facts, effects); this.completionSaveLifetime = {}; this.guardianTransitionGuards = new Map();
            this.bossDefeated = false; this.bossFightActive = true; this.levelCompletionActive = false;
            this.physics.world.isPaused = false; this.guardianEncounter = { id: 'cosmic_titan', active: true, startedAt: facts.now - 1000 };
            this.sys.settings.key = 'VoidPeaksLevel';
            this.sys.game.scene.getScene = key => key === 'VoidPeaksLevel' && this.active ? this : null;
        }
        clearTitanEntrance() {} clearTitanControlTimers() {} clearTitanWindup() {}
        clearBossEncounterTimers() {} clearBossEncounterEffects() {}
        endInvincibility() {} clearVirtualJumpInput() {} hidePlatformerMobileControls() {}
        showFloatingText() { this.effects.push({ kind: 'scene', name: 'showFloatingText' }); }
        ${['enterLevelCompletionState', 'scheduleGuardianTransition', 'cancelGuardianTransition', 'cancelGuardianTransitions']
            .map(name => currentMethod('src/scenes/PlatformerLevelScene.js', name)).join('\n')}
        ${['defeatBoss', 'startSavedPeakVictory', 'showBossVictory', 'showLevelComplete']
            .map(name => currentMethod('src/scenes/levels/VoidPeaksLevel.js', name)).join('\n')}
    }
    const finishPeaksCompletion = createPeaksCompletionHandler(Object.freeze({ prototype: NativePeaks.prototype,
        methods: Object.freeze(Object.fromEntries(['defeatBoss', 'startSavedPeakVictory', 'showBossVictory', 'showLevelComplete',
            'showRegionalVictorySummary', 'syncCampaignObjectiveDisplay', 'refreshCurrentEcologyNode', 'scheduleGuardianTransition', 'returnToHub']
            .map(name => [name, NativePeaks.prototype[name]]))) }));
    class NativeCrystal extends NativePeaks {
        constructor(facts, effects) {
            super(facts, effects); this.guardianEncounter = { id: 'crystal_golem', active: true, startedAt: facts.now - 1000 };
            this.sys.settings.key = 'CrystalCavesLevel';
            this.sys.game.scene.getScene = key => key === 'CrystalCavesLevel' && this.active ? this : null;
            this.crystalVictory = null; this.completionGuardianAt = null; this.bossTargetScale = 1;
        }
        clearCrystalPillarWork() {} clearCrystalBossPacing() {}
        ${['onBossDefeated', 'showBossVictory', 'onLevelComplete', 'startSavedCrystalCompletion', 'showCompletionScreen']
            .map(name => currentMethod('src/scenes/levels/CrystalCavesLevel.js', name)).join('\n')}
    }
    const finishCrystalCompletion = createCrystalCompletionHandler(Object.freeze({ prototype: NativeCrystal.prototype,
        methods: Object.freeze(Object.fromEntries(['onBossDefeated', 'showBossVictory', 'onLevelComplete', 'startSavedCrystalCompletion',
            'showCompletionScreen', 'showRegionalVictorySummary', 'syncCampaignObjectiveDisplay', 'refreshCurrentEcologyNode',
            'scheduleGuardianTransition', 'returnToHub'].map(name => [name, NativeCrystal.prototype[name]]))) }));
    const REEF_GUARDIAN_ARENA = { bossX: 500 };
    class NativeReef extends NativePeaks {
        constructor(facts, effects) {
            super(facts, effects); this.guardianEncounter = { id: 'nyxvoral', active: true, startedAt: facts.now - 1000 };
            this.sys.settings.key = 'ReefLevel';
            this.sys.game.scene.getScene = key => key === 'ReefLevel' && this.active ? this : null;
            this.reefVictory = null; this.completionGuardianAt = null; this.bossTargetScale = 1; this.bossMinions = [];
        }
        clearReefBossSummons() {} clearReefBossLunge() {} clearReefBossTears() {}
        ${['defeatBoss', 'showVictoryScreen', 'startSavedReefCompletion']
            .map(name => currentMethod('src/scenes/levels/ReefLevel.js', name)).join('\n')}
    }
    const finishReefCompletion = createReefCompletionHandler(Object.freeze({ prototype: NativeReef.prototype,
        methods: Object.freeze(Object.fromEntries(['defeatBoss', 'showVictoryScreen', 'startSavedReefCompletion',
            'showRegionalVictorySummary', 'syncCampaignObjectiveDisplay', 'refreshCurrentEcologyNode',
            'scheduleGuardianTransition', 'returnToHub'].map(name => [name, NativeReef.prototype[name]]))) }));
    class NativeAurora extends NativePeaks {
        constructor(facts, effects) {
            super(facts, effects); this.guardianEncounter = { id: 'shadow_phoenix', active: true, startedAt: facts.now - 1000 };
            this.sys.settings.key = 'AuroraDepthsLevel';
            this.sys.game.scene.getScene = key => key === 'AuroraDepthsLevel' && this.active ? this : null;
            this.auroraVictory = null; this.auroraReactorFound = false;
        }
        getLevelModalLayout() { return { width: this.cameras.main.width, contentWidth: this.cameras.main.width - 50,
            y: value => value, font: (desktop, phone) => this.cameras.main.width <= 480 ? phone : desktop }; }
        ${['onBossDefeated', 'showBossVictory', 'startSavedAuroraCompletion', 'showLevelComplete']
            .map(name => currentMethod('src/scenes/levels/AuroraDepthsLevel.js', name)).join('\n')}
    }
    const finishAuroraCompletion = createAuroraCompletionHandler(Object.freeze({ prototype: NativeAurora.prototype,
        methods: Object.freeze(Object.fromEntries(['onBossDefeated', 'showBossVictory', 'startSavedAuroraCompletion', 'showLevelComplete',
            'getLevelModalLayout', 'showRegionalVictorySummary', 'syncCampaignObjectiveDisplay', 'refreshCurrentEcologyNode',
            'scheduleGuardianTransition', 'returnToHub'].map(name => [name, NativeAurora.prototype[name]]))) }));
    const getGameState = () => window.GameState;
    const loadInventoryForEntry = ({ ${currentMethod('src/scenes/GameScene.js', 'loadInventoryForEntry')} }).loadInventoryForEntry;
    const createDecorativeFlag = scene => scene.add.graphics();
    const companionMediaService = { createCinematicStill: () => null, prepareGeneratedVideo: () => Promise.resolve(null) };
    const nativeRelease = ({ ${currentMethod('src/scenes/PlatformerLevelScene.js', 'showRescuedResidentReleaseMoment')} }).showRescuedResidentReleaseMoment;
    const bindLevelCompletionReturn = ({ ${currentMethod('src/scenes/PlatformerLevelScene.js', 'bindLevelCompletionReturn')} }).bindLevelCompletionReturn;
    export { GameStateManager, economy, inventory, achievements, quests, outcomes, guardians, residents, kit,
        calculateLevelCompletionDraft, getCompletionRewardData, captureCompletionAchievementSource, calculateCompletionAchievementDraft, continueCompletionGuardianDraft,
        calculateCompletionGuardianPrefix, continueCompletionLevelDraft,
        Completion, NativeForest, NativePeaks, NativeCrystal, NativeReef, NativeAurora, ExpeditionDebriefPanel, loadInventoryForEntry, nativeRelease, bindLevelCompletionReturn, bossConfigs, calculateVictoryCoins, getBossPowerupReward, getCurrentEcologySnapshot, prepareCompletionPublicationDraft, captureCompletionPacketGuard };
`);
const thought = compiledModuleSource('systems/ThoughtBubbleSystem.js');
const levels = [
    ['mythicalForest', 'mythical_forest_1', 'forest_core', null],
    ['crystalCaves', 'crystal_caves_1', 'crystal_core', 'crystal_edge'],
    ['cosmicReef', 'reef_1', 'dimensional_drive', null],
    ['voidPeaks', 'void_peaks_1', 'hull_plating', null],
    ['auroraDepths', 'aurora_depths_1', 'aurora_reactor', 'aurora_guard'],
    ['finalVoid', 'final_void_1', 'command_module', null]
];
const factsFor = (index, overrides = {}) => ({ levelId: levels[index][0], sceneLevelId: levels[index][1], shipPartId: levels[index][2],
    katanaUpgradeId: levels[index][3], now: epoch, time: 1000, noDamage: true, speedrunThreshold: [240000, 180000, 240000, 180000, 300000, 360000][index],
    bondExperience: 10, rewardBonusCount: index < 2 ? 2 : 0, residentCoinBonus: 0, villageCoinBonus: 0, guardianInterventions: 0, ...overrides });

function fixture({ level = 0, mode = 'installed', seed = () => {}, beforeServices = () => {}, prefix = true, initialiseEconomy = true, controlledTimers = false } = {}) {
    const map = new Map(), calls = [], notifications = [], persistenceEvents = [], effects = [];
    const denied = name => () => { calls.push({ forbidden: name }); throw Error('COMPLETION_FIXTURE_FORBIDDEN:' + name); };
    let wallNow = epoch;
    class SyntheticDate extends Date { constructor(...args) { super(...(args.length ? args : [wallNow])); } static now() { return wallNow; } }
    const storage = { get length() { return map.size; }, key: index => [...map.keys()][index] ?? null,
        getItem: key => map.get(String(key)) ?? null, setItem: (key, value) => map.set(String(key), String(value)),
        removeItem: key => map.delete(String(key)), clear: () => map.clear() };
    const intervals = new Map(); let nextInterval = 0;
    const context = vm.createContext({ module: { exports: {} }, Date: SyntheticDate, Math,
        console: { log() {}, warn() {}, error() {} }, Phaser: { Events: { EventEmitter } }, localStorage: storage,
        setTimeout: denied('setTimeout'), setInterval: controlledTimers ? callback => { const id = ++nextInterval; intervals.set(id, callback); return id; } : denied('setInterval'),
        clearTimeout() {}, clearInterval: id => intervals.delete(id),
        fetch: denied('fetch'), Audio: denied('Audio'), XMLHttpRequest: denied('XMLHttpRequest'), WebSocket: denied('WebSocket') });
    vm.runInContext(entry, context); const api = context.module.exports, state = new api.GameStateManager();
    const selected = { GameState: state, CloudRecoveryJournal }; context.window = selected;
    state.state.creature.genes = { id: 'synthetic-genes', rarity: 'rare', species: 'nebulaSprite', traits: {
        colorGenome: { primary: 0xB672E8, secondary: 0xEDCE4C, accent: 0x89E3D7 }, features: { specialFeatures: [] } } };
    state.state.creature.id = 'synthetic-creature'; state.state.creature.hatched = true;
    state.state.creatures = [{ id: 'synthetic-creature', genes: clone(state.state.creature.genes), lifecycle: { stage: 'adult' },
        parentIds: ['synthetic-parent-a', 'synthetic-parent-b'], media: { assetRef: '/synthetic/portrait.png' } }];
    state.state.activeCreatureIndex = 0;
    state.state.quests = { active: [{ id: 'synthetic-existing-quest', objective: { type: 'care_action', action: 'feed', target: 3 }, progress: 1 }],
        completed: ['synthetic-previous-quest'] };
    beforeServices({ state, selected, api });
    if (mode !== 'fallbacks') {
        Object.assign(selected, { EconomyManager: api.economy, InventoryManager: api.inventory, AchievementSystem: api.achievements,
            GuardianOutcomes: api.outcomes, GuardianResidents: api.guardians, RescuedResidents: api.residents, ProjectBeaconFieldKit: api.kit, QuestManager: api.quests });
        if (initialiseEconomy) api.economy.initialize(); api.inventory.initialize(); api.achievements.initialize();
        api.quests.loadQuestState(); api.quests.initialized = true; api.quests.setupEventListeners();
        vm.runInContext(`(function(module) { ${thought} })({ exports: {} }); window.ThoughtBubbleSystem.initialize();`, context);
        api.kit.recoverProjectBeaconFieldKit(state, { save: false, recoveredAt: new SyntheticDate().toISOString() });
    }
    selected.AudioManager = { playCoinCollect: () => effects.push({ kind: 'audio', name: 'playCoinCollect' }),
        playAchievement: () => effects.push({ kind: 'audio', name: 'playAchievement' }) };
    const complete = facts => {
        const scene = new api.Completion(facts, effects);
        return scene.completeLevelProgression({ achievementLevelId: facts.levelId, shipPartId: facts.shipPartId,
            katanaUpgradeId: facts.katanaUpgradeId, speedrunThreshold: facts.speedrunThreshold, bondExperience: facts.bondExperience,
            rewardBonusCount: facts.rewardBonusCount, deferPresentation: true });
    };
    if (prefix) for (let index = 0; index < level; index++) complete(factsFor(index));
    selected.ThoughtBubbleSystem?.setBiome(levels[level][1]);
    seed({ state, selected, api, complete });
    expect(state.save()).toBe(true);
    const emit = state.emit.bind(state), save = state.save.bind(state);
    state.emit = (event, data) => {
        const packet = clone({ kind: 'state', event, ...(data === undefined ? {} : { data }) });
        if (['saved', 'saveBackupCreated'].includes(event)) persistenceEvents.push(packet);
        else notifications.push(packet);
        return emit(event, data);
    };
    state.save = (...args) => { calls.push({ save: true }); return save(...args); };
    if (mode !== 'fallbacks') for (const [service, kind, names] of [[api.economy, 'economy', ['coins:added']],
        [api.inventory, 'inventory', ['shipPartCollected', 'itemAdded', 'inventoryFull', 'bossRewardQueued']],
        [api.achievements, 'achievement', ['achievement:unlocked']]]) {
        for (const event of names) service.events.on(event, data => notifications.push(clone({ kind, event, ...(data === undefined ? {} : { data }) })));
    }
    calls.length = 0; effects.length = 0;
    const reader = state.captureSaveAdmissionOwner({ raw: storage.getItem(state.saveKey) });
    const participants = { isCurrent: () => reader.isCurrent(),
        inventory: mode === 'fallbacks' ? null : selected.InventoryManager.captureRewardCalculationSource({ reader }),
        achievements: mode === 'fallbacks' ? null : api.captureCompletionAchievementSource(api.achievements, state, reader),
        thought: mode === 'fallbacks' ? null : selected.ThoughtBubbleSystem.captureCompletionContextSource({ reader }),
        economyMode: mode === 'fallbacks' ? 'unavailable' : initialiseEconomy ? 'initialised' : 'uninitialised', audioAvailable: true,
        domains: { outcomes: mode !== 'fallbacks', guardianResidents: mode !== 'fallbacks', rescuedResidents: mode !== 'fallbacks', fieldKit: mode !== 'fallbacks' },
        stateMethods: { getCampaignGateAccess: state.getCampaignGateAccess, syncCanonicalCampaignGates: state.syncCanonicalCampaignGates } };
    return { api, state, selected, context, storage, calls, notifications, persistenceEvents, effects, participants, complete,
        advanceClock: ms => { wallNow += ms; },
        fireIntervals: () => [...intervals.values()].forEach(callback => callback()),
        calculate: facts => api.calculateLevelCompletionDraft(state.state, facts, participants),
        snapshot: () => clone(state.state), close: () => state.stopAutoSave() };
}
function installNativeRelease(f, scene) {
    scene.sys.queueDepthSort = () => {}; scene.sys.input = { clear() {} };
    const objects = [];
    const object = text => {
        const item = new GameObject(scene, 'SyntheticReleaseObject'); item.text = text;
        Object.assign(item, { x: 0, y: 0, alpha: 1, scaleX: 1, scaleY: 1 });
        for (const name of ['fillStyle', 'fillRect', 'fillCircle', 'setScrollFactor', 'setDepth', 'setOrigin', 'lineStyle', 'lineBetween']) item[name] = () => item;
        item.setAlpha = alpha => { item.alpha = alpha; return item; };
        item.setScale = value => { item.scaleX = item.scaleY = value; return item; };
        item.setPosition = (x, y) => { item.x = x; item.y = y; return item; };
        item.setText = text => { item.text = text; return item; };
        item.setInteractive = () => { item.input = { enabled: true }; return item; };
        item.disableInteractive = () => { if (item.input) item.input.enabled = false; return item; };
        objects.push(item); return item;
    };
    scene.add = { graphics: () => object(), text: (_x, _y, text) => object(text) };
    scene.tweens = { add() {} }; scene.textures = { exists: () => false };
    const clock = scene.time = new Clock(scene);
    f.context.Phaser.Geom = { Rectangle: Object.assign(Rectangle, { Contains }) };
    scene.showRescuedResidentReleaseMoment = f.api.nativeRelease;
    scene.bindLevelCompletionReturn = f.api.bindLevelCompletionReturn;
    return { objects, object, clock, advance(delta) { clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate(); },
        close() { scene.residentReleasePresentation?.retire(); clock.destroy(); objects.forEach(item => item.destroy()); } };
}
module.exports = { fixture, factsFor, levels, clone, epoch, installNativeRelease };
