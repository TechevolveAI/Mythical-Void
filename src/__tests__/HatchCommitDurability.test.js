const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');
const GameStateManager = require('../systems/GameState.js');
const CloudSaveManager = require('../systems/CloudSaveManager.js');

const source = fs.readFileSync(path.join(__dirname, '../scenes/HatchingScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
function attach(scene, name, state) {
    const node = declaration.body.body.find(item => item.key?.name === name);
    if (!node) return;
    scene[name] = vm.runInNewContext(`({${source.slice(node.start, node.end)}}).${name}`, {
        getGameState: () => window.GameState, window, document, console, localStorage,
        cloneConfig: data => JSON.parse(JSON.stringify(data)),
        URLSearchParams,
        SceneTransitionHelper: { stopScenes: jest.fn(), bringToTop: jest.fn() },
        Phaser: { Scenes: { Events: { RESUME: 'resume', SHUTDOWN: 'shutdown' } } }
    }).bind(scene);
}

function fixture(mode = 'opening') {
    const state = new GameStateManager();
    state.set('session.gameStarted', true);
    if (mode === 'inventory') {
        state.set('creature.hatched', true);
        state.set('creature.name', 'Fictional Earlier Creature');
        state.set('creature.named', true);
        state.set('creature.genes', { id: 'fictional-earlier-genes' });
        state.set('creature.experience', 250);
        state.set('creature.lifecycle.stage', 'adult');
        state.set('creatures', [{ id: 'fictional-earlier-creature', genes: { id: 'fictional-earlier-genes' },
            lifecycle: { stage: 'adult' }, experience: 250 }]);
        state.set('creature.hatchTransaction', { schemaVersion: 1, status: 'reserved',
            eggType: 'stellar', eggItemId: 'fictional-egg', inventorySlot: 0,
            spawnPosition: { x: 0, y: 240 }, reservedAt: Date.now() - 100 });
    }
    state.state = state.prepareSaveCandidate(state.createSaveSnapshot()).state;
    expect(state.save()).toBe(true);
    window.GameState = state;
    const profile = { id: 'fictional-new-genes', species: 'nebulaSprite', rarity: 'rare',
        personality: { core: 'curious' }, cosmicAffinity: { element: 'nebula' },
        traits: { bodyShape: { type: 'slender' }, features: {}, colorGenome: { primary: 0x8357b5, secondary: 0xe5cb54 } } };
    const dna = { id: 'fictional-new-dna', bodyArchetype: 'luminous', raritySignature: 'rare' };
    const tweens = [];
    const graphic = { fillStyle() { return this; }, fillRect() { return this; }, destroy: jest.fn() };
    const scene = { creatureGenetics: profile, creatureDNA: dna,
        creaturePersonalityState: { curiosity: 4 }, hatchPityData: { hatchesSinceEpic: 1 },
        isEggHatch: mode === 'inventory', spawnPosition: { x: 0, y: 240 },
        creature: { active: true, texture: { key: 'fictional-new-texture' } },
        scale: { width: 390, height: 844, on: jest.fn(), off: jest.fn() },
        resizeHatchingLayout: jest.fn(), add: { graphics: () => graphic },
        tweens: { add: jest.fn(config => { tweens.push(config); }) },
        scene: { start: jest.fn() }, showCriticalError: jest.fn(),
        generateCreatureName: () => 'Nebula Explorer Sprite',
        cleanupRerollUI: jest.fn(), finishCreatureDisplayLoading: jest.fn(),
        removeEggHatchFallback: jest.fn(), removeHomeStartFallback: jest.fn(),
        stopThemeMusic: jest.fn(), events: { off: jest.fn(), once: jest.fn(), on: jest.fn() }, time: { removeAllEvents: jest.fn() }
    };
    for (const name of ['captureHatchSaveOwner', 'canCommitHatch', 'saveCreatureGenetics', 'retryHatchCommit',
        'showHatchSaveRecovery', 'clearHatchSaveRecovery', 'transitionToPersonality']) attach(scene, name, state);
    if (scene.captureHatchSaveOwner) scene.captureHatchSaveOwner();
    return { state, scene, profile, dna, tweens };
}

describe('existing-format hatch completion is durable before it is announced', () => {
    let f;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        localStorage.clear(); document.body.replaceChildren(); f = fixture();
    });
    afterEach(() => {
        f.scene.clearHatchSaveRecovery?.(); f.state.stopAutoSave();
        jest.restoreAllMocks(); jest.useRealTimers();
        delete window.GameState; delete window.CloudSave; delete window.CreatureGenetics;
        delete window.CreatureDNA; delete window.PersonalitySystem; delete window.raritySystem;
        delete window.ErrorHandler;
        document.body.replaceChildren();
    });
    const primary = () => localStorage.getItem(f.state.saveKey);
    const reload = () => { const next = new GameStateManager(); expect(next.load()).toBe(true); return next; };

    test.each(['opening', 'inventory'])('%s hatch stores the same identity, lifecycle and reservation clear before continuation', mode => {
        if (mode === 'inventory') f = fixture(mode);
        const roster = JSON.parse(JSON.stringify(f.state.get('creatures')));
        const done = jest.fn(() => {
            const durable = JSON.parse(primary());
            expect(durable.creature).toMatchObject({ hatched: true, genes: f.profile, genetics: f.profile,
                dna: f.dna, experience: 50, hatchTransaction: null, lifecycle: { stage: 'baby' } });
        });
        expect(f.scene.saveCreatureGenetics(done)).toBe(true);
        expect(done).toHaveBeenCalledTimes(1);
        expect(reload().get('creatures')).toEqual(roster);
        expect(reload().get('creature.genes')).toEqual(f.profile);
        expect(reload().get('creature.dna')).toEqual(f.dna);
    });

    test.each(['QuotaExceededError', 'Error'])('%s leaves the prior state/reservation intact and retries the same generated creature', errorName => {
        f = fixture('inventory');
        const before = primary(), memory = JSON.stringify(f.state.get());
        const write = Storage.prototype.setItem;
        let refuse = true;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (refuse && key === f.state.saveKey) { const error = Error('fictional primary refusal'); error.name = errorName; throw error; }
            return write.call(this, key, value);
        });
        const done = jest.fn();
        const result = f.scene.saveCreatureGenetics(done);
        expect(primary()).toBe(before);
        expect(JSON.stringify(f.state.get())).toBe(memory);
        expect(result).toBe(false);
        expect(done).not.toHaveBeenCalled();
        f.scene.transitionToPersonality();
        expect(f.tweens).toHaveLength(0);
        const retry = document.querySelector('[data-mythical-hatch-save] button');
        expect(retry?.textContent).toBe('Try saving again');
        refuse = false;
        retry.click(); retry.click();
        expect(done).toHaveBeenCalledTimes(1);
        expect(f.scene.creatureGenetics).toBe(f.profile);
        expect(reload().get('creature.experience')).toBe(50);
        expect(reload().get('creature.genes')).toEqual(f.profile);
        expect(reload().get('creature.hatchTransaction')).toBeNull();
        expect(document.querySelector('[data-mythical-hatch-save]')).toBeNull();
    });

    test('an incidental autosave listener cannot publish an intermediate identity or lifecycle', () => {
        const seen = [];
        f.state.on('stateChanged', () => {
            expect(f.state.save()).toBe(true);
            seen.push(JSON.parse(primary()).creature);
        });
        expect(f.scene.saveCreatureGenetics(jest.fn())).toBe(true);
        expect(seen.length).toBeGreaterThan(0);
        for (const creature of seen) expect(creature).toMatchObject({ genes: f.profile, hatched: true,
            experience: 50, hatchTransaction: null, lifecycle: { stage: 'baby' } });
    });

    test.each(['held', 'live-cloud', 'damaged-cloud'])('%s cannot modify identity or start completion', mode => {
        if (mode === 'held') f.state.holdSaveAdmission({ code: 'version_mismatch' }, 'fictional');
        else {
            f.state.beginCloudWrite('mutation', f.state.createSaveSnapshot(), () => true);
            if (mode === 'damaged-cloud') localStorage.setItem(f.state.saveBackupIndexKey, '{broken');
        }
        const before = { ...localStorage }, memory = JSON.stringify(f.state.get());
        const done = jest.fn();
        expect(f.scene.saveCreatureGenetics(done)).toBe(false);
        expect({ ...localStorage }).toEqual(before);
        expect(JSON.stringify(f.state.get())).toBe(memory);
        expect(done).not.toHaveBeenCalled();
    });

    test('a backup listener changing progress prevents the old staged hatch from replacing it', () => {
        const off = f.state.on('saveBackupCreated', () => {
            off(); f.state.set('player.cosmicCoins', 77); f.state.save();
        });
        const done = jest.fn();
        expect(f.scene.saveCreatureGenetics(done)).toBe(false);
        expect(f.state.get('player.cosmicCoins')).toBe(77);
        expect(reload().get('player.cosmicCoins')).toBe(77);
        expect(f.state.get('creature.hatched')).toBe(false);
        expect(done).not.toHaveBeenCalled();
    });

    test('New Game from the first completion notification cannot be followed by more old hatch writes', () => {
        const off = f.state.on('stateChanged', () => { off(); f.state.startFreshGame(); });
        const done = jest.fn();
        expect(f.scene.saveCreatureGenetics(done)).toBe(false);
        expect(f.state.get('creature.hatched')).toBe(false);
        expect(f.state.get('creature.genes')).toBeNull();
        expect(reload().get('creature.genes')).toBeNull();
        expect(done).not.toHaveBeenCalled();
    });

    test('a primary write that commits then throws does not duplicate hatch XP or its continuation', () => {
        const write = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            write.call(this, key, value);
            if (key === f.state.saveKey) throw Error('fictional lost acknowledgement');
        });
        const done = jest.fn();
        expect(f.scene.saveCreatureGenetics(done)).toBe(true);
        expect(f.scene.saveCreatureGenetics(done)).toBe(true);
        expect(done).toHaveBeenCalledTimes(1);
        jest.restoreAllMocks();
        expect(reload().get('creature.experience')).toBe(50);
    });

    test('a throwing completion listener cannot trigger a second hatch or lose the durable child', () => {
        f.state.on('stateChanged', () => { throw Error('fictional listener fault'); });
        const done = jest.fn();
        expect(f.scene.saveCreatureGenetics(done)).toBe(true);
        expect(f.scene.saveCreatureGenetics(done)).toBe(true);
        expect(done).toHaveBeenCalledTimes(1);
        expect(reload().get('creature.genes')).toEqual(f.profile);
        expect(reload().get('creature.experience')).toBe(50);
    });

    test('a failed presentation continuation can retry without repeating the stored hatch or its XP', () => {
        const done = jest.fn().mockImplementationOnce(() => { throw Error('fictional presentation failure'); });
        expect(f.scene.saveCreatureGenetics(done)).toBe(false);
        const before = primary();
        const save = jest.spyOn(f.state, 'commitCreatureHatch');
        document.querySelector('[data-mythical-hatch-save] button').click();
        expect(save).not.toHaveBeenCalled();
        expect(done).toHaveBeenCalledTimes(2);
        expect(primary()).toBe(before);
        expect(reload().get('creature.experience')).toBe(50);
    });

    test('the actual inventory init/create branch keeps the named earlier creature until final commit', () => {
        f = fixture('inventory');
        const before = primary(), creature = JSON.stringify(f.state.get('creature'));
        attach(f.scene, 'init', f.state); attach(f.scene, 'create', f.state); attach(f.scene, 'continueHatchEntry', f.state);
        f.scene.showHatchingScreen = jest.fn();
        f.scene.init({}); f.scene.create();
        expect(f.scene.isEggHatch).toBe(true);
        expect(f.scene.showHatchingScreen).toHaveBeenCalledTimes(1);
        expect(primary()).toBe(before);
        expect(JSON.stringify(f.state.get('creature'))).toBe(creature);
    });

    test('generation keeps DNA, personality and pity local even if an autosave occurs', () => {
        const before = primary(), memory = JSON.stringify(f.state.get());
        window.CreatureGenetics = { generateCreatureGenetics: jest.fn(() => f.profile) };
        window.CreatureDNA = { generateDNA: jest.fn(() => f.dna) };
        window.PersonalitySystem = { initializePersonalityState: jest.fn(() => ({ curiosity: 4 })) };
        window.raritySystem = { initializePitySystem: () => ({ hatchesSinceEpic: 0 }),
            rollRarity: data => { data.hatchesSinceEpic += 1; return { rarity: 'rare', pityData: data }; },
            getRarityInfo: () => ({ name: 'Rare' }) };
        f.scene.attachMendelianGenome = jest.fn();
        attach(f.scene, 'generateCreatureGenetics', f.state);
        expect(f.scene.generateCreatureGenetics()).toBe(true);
        expect(JSON.stringify(f.state.get())).toBe(memory);
        expect(f.state.save()).toBe(true);
        expect(primary()).toBe(before);
        expect(f.scene.creatureDNA).toBe(f.dna);
        expect(f.scene.creaturePersonalityState).toEqual({ curiosity: 4 });
    });

    test.each(['held', 'memory', 'live-cloud', 'damaged-cloud'])('%s refuses generation before any genetic/DNA provider or pity allocation', mode => {
        window.CreatureGenetics = { generateCreatureGenetics: jest.fn() };
        window.CreatureDNA = { generateDNA: jest.fn() };
        if (mode === 'held') f.state.holdSaveAdmission({ code: 'version_mismatch' }, 'fictional');
        if (mode === 'memory') f.state.storageMode = 'memory';
        if (mode.includes('cloud')) {
            f.state.beginCloudWrite('mutation', f.state.createSaveSnapshot(), () => true);
            if (mode === 'damaged-cloud') localStorage.setItem(f.state.saveBackupIndexKey, '{broken');
        }
        attach(f.scene, 'generateCreatureGenetics', f.state);
        expect(f.scene.generateCreatureGenetics()).toBe(false);
        expect(window.CreatureGenetics.generateCreatureGenetics).not.toHaveBeenCalled();
        expect(window.CreatureDNA.generateDNA).not.toHaveBeenCalled();
    });

    test('changing the active creature retires generation before any allocation', () => {
        window.CreatureGenetics = { generateCreatureGenetics: jest.fn() };
        f.state.set('creature.genes', { id: 'fictional-switched-creature' });
        attach(f.scene, 'generateCreatureGenetics', f.state);
        expect(f.scene.generateCreatureGenetics()).toBe(false);
        expect(window.CreatureGenetics.generateCreatureGenetics).not.toHaveBeenCalled();
    });

    test('a failed hatch retry cannot replace another creature selected in the meantime', () => {
        const write = Storage.prototype.setItem;
        let refuse = true;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (refuse && key === f.state.saveKey) throw Error('fictional refusal');
            return write.call(this, key, value);
        });
        expect(f.scene.saveCreatureGenetics(jest.fn())).toBe(false);
        refuse = false;
        f.state.set('creature.genes', { id: 'fictional-switched-creature' });
        expect(f.state.save()).toBe(true);
        const before = primary();
        document.querySelector('[data-mythical-hatch-save] button').click();
        expect(primary()).toBe(before);
        expect(f.state.get('creature.genes.id')).toBe('fictional-switched-creature');
    });

    test('a draft setter failure cannot reach the live error service or persist partial state', () => {
        window.ErrorHandler = { handleError: jest.fn() };
        const before = primary(), memory = JSON.stringify(f.state.get());
        const save = jest.spyOn(f.state, 'save');
        jest.spyOn(GameStateManager.prototype, 'initializeCareSystem').mockImplementation(function () {
            Object.freeze(this.state.creature.stats);
            this.set('creature.stats.health', 5);
        });
        expect(f.scene.saveCreatureGenetics(jest.fn())).toBe(false);
        expect(save).not.toHaveBeenCalled();
        expect(window.ErrorHandler.handleError).not.toHaveBeenCalled();
        expect(primary()).toBe(before);
        expect(JSON.stringify(f.state.get())).toBe(memory);
        delete window.ErrorHandler;
    });

    test('a draft cannot acquire an inherited live save method', () => {
        const before = primary();
        const save = jest.spyOn(f.state, 'save');
        jest.spyOn(GameStateManager.prototype, 'completeHatching').mockImplementation(function () { return this.save(); });
        expect(f.scene.saveCreatureGenetics(jest.fn())).toBe(false);
        expect(save).not.toHaveBeenCalled();
        expect(primary()).toBe(before);
    });

    test('the real save caller preserves an absent legacy DNA field when no DNA was generated', () => {
        f.scene.creatureDNA = null;
        f.scene.creaturePersonalityState = undefined;
        expect(Object.hasOwn(f.state.get('creature'), 'dna')).toBe(false);
        expect(f.scene.saveCreatureGenetics(jest.fn())).toBe(true);
        expect(Object.hasOwn(JSON.parse(primary()).creature, 'dna')).toBe(false);
    });

    test('a local renderer fallback does not discard the exact already-generated DNA', () => {
        f.scene.generatedHatchDNA = f.dna;
        f.scene.creatureDNA = null;
        expect(f.scene.saveCreatureGenetics(jest.fn())).toBe(true);
        expect(reload().get('creature.dna')).toEqual(f.dna);
    });

    test('a healthy owned upload after hatch commit does not block the read-only Keep transition', () => {
        const cloud = new CloudSaveManager({ client: null, gameState: f.state, storage: localStorage, lockManager: null });
        window.CloudSave = cloud;
        f.scene.captureHatchSaveOwner();
        try {
            expect(f.scene.saveCreatureGenetics(jest.fn())).toBe(true);
            const lease = f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), cloud.captureCampaignGuard());
            cloud.activeCloudWrite = lease;
            expect(f.state.canCommitHatchSave()).toBe(false);
            f.scene.transitionToPersonality();
            expect(f.tweens).toHaveLength(1);
            f.tweens[0].onComplete();
            expect(f.scene.scene.start).toHaveBeenCalledWith('SoulRevealScene');
        } finally { cloud.destroy(); }
    });

    test.each(['pending', 'damaged', 'uncertain'])('a no-lease %s recovery state cannot use the saved hatch continuation', mode => {
        expect(window.CloudSave).toBeUndefined();
        expect(f.scene.saveCreatureGenetics(jest.fn())).toBe(true);
        const continuation = f.scene.hatchCommitAttempt.isCurrent;
        if (mode === 'pending') {
            expect(f.state.createLocalSaveBackup(f.state.createSaveSnapshot(), 'cloud_write_pending_upload')).not.toBeNull();
        }
        if (mode === 'damaged') localStorage.setItem(f.state.saveBackupIndexKey, '{broken');
        if (mode === 'uncertain') f.state.cloudRecoveryRequired = true;
        expect(f.state.cloudWriteLease).toBeNull();
        const before = { ...localStorage };
        expect(continuation()).toBe(false);
        f.scene.transitionToPersonality();
        expect(f.tweens).toHaveLength(0);
        expect(f.scene.scene.start).not.toHaveBeenCalled();
        expect({ ...localStorage }).toEqual(before);
    });

    test.each(['pending', 'damaged', 'uncertain'])('the direct default GameState capability refuses no-lease %s evidence without a scene/cloud guard', mode => {
        expect(window.CloudSave).toBeUndefined();
        const result = f.state.commitCreatureHatch({ genetics: f.profile, dna: f.dna,
            descriptiveName: 'Nebula Explorer Sprite', textureName: 'fictional-new-texture' });
        expect(result.success).toBe(true);
        if (mode === 'pending') {
            expect(f.state.createLocalSaveBackup(f.state.createSaveSnapshot(), 'cloud_write_pending_upload')).not.toBeNull();
        }
        if (mode === 'damaged') localStorage.setItem(f.state.saveBackupIndexKey, '{broken');
        if (mode === 'uncertain') f.state.cloudRecoveryRequired = true;
        expect(f.state.cloudWriteLease).toBeNull();
        const before = { ...localStorage };
        expect(result.isCurrent()).toBe(false);
        expect({ ...localStorage }).toEqual(before);
    });

    test('a final save waiting on a healthy upload retains a same-creature Retry rather than a dead end', () => {
        const cloud = new CloudSaveManager({ client: null, gameState: f.state, storage: localStorage, lockManager: null });
        window.CloudSave = cloud; f.scene.captureHatchSaveOwner();
        try {
            const lease = f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), cloud.captureCampaignGuard());
            cloud.activeCloudWrite = lease;
            const done = jest.fn();
            expect(f.scene.saveCreatureGenetics(done)).toBe(false);
            const retry = document.querySelector('[data-mythical-hatch-save] button');
            expect(retry?.textContent).toBe('Try saving again');
            expect(done).not.toHaveBeenCalled();
            f.state.finishCloudWrite(lease); cloud.activeCloudWrite = null;
            retry.click();
            expect(done).toHaveBeenCalledTimes(1);
            expect(reload().get('creature.genes')).toEqual(f.profile);
            expect(reload().get('creature.experience')).toBe(50);
        } finally { cloud.destroy(); }
    });

    test('an inventory entry waiting on an upload resumes without duplicate scene hooks or resetting the previous creature', () => {
        f = fixture('inventory');
        const cloud = new CloudSaveManager({ client: null, gameState: f.state, storage: localStorage, lockManager: null });
        window.CloudSave = cloud;
        for (const name of ['init', 'create', 'continueHatchEntry']) attach(f.scene, name, f.state);
        f.scene.showHatchingScreen = jest.fn();
        try {
            f.scene.init({});
            const before = primary();
            const lease = f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), cloud.captureCampaignGuard());
            cloud.activeCloudWrite = lease;
            f.scene.create();
            expect(f.scene.showHatchingScreen).not.toHaveBeenCalled();
            const retry = document.querySelector('[data-mythical-hatch-save] button');
            expect(retry?.textContent).toBe('Try again');
            f.state.finishCloudWrite(lease); cloud.activeCloudWrite = null;
            retry.click();
            expect(f.scene.showHatchingScreen).toHaveBeenCalledTimes(1);
            expect(f.scene.events.once).toHaveBeenCalledTimes(1);
            expect(f.scene.scale.on).toHaveBeenCalledTimes(1);
            expect(f.scene.scale.on).toHaveBeenCalledWith('resize', f.scene.resizeHatchingLayout, f.scene);
            expect(primary()).toBe(before);
            expect(f.state.get('creature.genes.id')).toBe('fictional-earlier-genes');
        } finally { cloud.destroy(); }
    });

    test.each(['mutation', 'foreign-manager', 'reconstructed', 'damaged', 'wrong-snapshot', 'retired-epoch'])(
        '%s cannot borrow the post-success upload read permission', mode => {
            const cloud = new CloudSaveManager({ client: null, gameState: f.state, storage: localStorage, lockManager: null });
            window.CloudSave = cloud; f.scene.captureHatchSaveOwner();
            try {
                expect(f.scene.saveCreatureGenetics(jest.fn())).toBe(true);
                const snapshot = f.state.createSaveSnapshot();
                if (mode === 'wrong-snapshot') snapshot.creature.genes.id = 'fictional-other-identity';
                const lease = f.state.beginCloudWrite(mode === 'mutation' ? 'mutation' : 'upload', snapshot, cloud.captureCampaignGuard());
                if (mode !== 'foreign-manager') cloud.activeCloudWrite = lease;
                if (mode === 'reconstructed') f.state.cloudWriteLease = null;
                if (mode === 'damaged') localStorage.setItem(f.state.saveBackupIndexKey, '{broken');
                if (mode === 'retired-epoch') f.state.releaseSaveAdmission();
                const before = { ...localStorage };
                f.scene.transitionToPersonality();
                expect(f.tweens).toHaveLength(0);
                expect(f.scene.scene.start).not.toHaveBeenCalled();
                expect({ ...localStorage }).toEqual(before);
            } finally { cloud.destroy(); }
        });

    test('a delayed transition cannot start after New Game retires its saved hatch', () => {
        expect(f.scene.saveCreatureGenetics(jest.fn())).toBe(true);
        f.scene.transitionToPersonality();
        f.state.startFreshGame();
        f.tweens[0].onComplete();
        expect(f.scene.scene.start).not.toHaveBeenCalled();
        expect(reload().get('creature.genes')).toBeNull();
    });

    test('retrying presentation never restarts an already requested optional portrait', () => {
        window.LivingPortraitService = { prewarm: jest.fn(() => new Promise(() => {})) };
        attach(f.scene, 'beginLivingPortraitPrewarm', f.state);
        let first = true;
        const done = () => {
            f.scene.beginLivingPortraitPrewarm();
            if (first) { first = false; throw Error('fictional later presentation fault'); }
        };
        expect(f.scene.saveCreatureGenetics(done)).toBe(false);
        document.querySelector('[data-mythical-hatch-save] button').click();
        expect(window.LivingPortraitService.prewarm).toHaveBeenCalledTimes(1);
        expect(reload().get('creature.experience')).toBe(50);
        delete window.LivingPortraitService;
    });
});
