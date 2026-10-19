const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');

function method(file, name, dependencies = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const declaration = parse(source, { sourceType: 'module' }).program.body
        .map(node => node.type === 'ExportDefaultDeclaration' ? node.declaration : node)
        .find(node => node.type === 'ClassDeclaration');
    const node = declaration.body.body.find(item => item.key?.name === name);
    return vm.runInNewContext(`({${source.slice(node.start, node.end)}}).${name}`, {
        window, console: { log() {}, warn() {}, error() {} }, Promise,
        evolutionConfig: require('../config/evolution.json'), ...dependencies
    });
}

function fixture() {
    const source = fs.readFileSync(path.join(__dirname, '../systems/UXEnhancements.js'), 'utf8');
    const ux = new Function(`${source}\nreturn window.UXEnhancements;`)();
    const delayed = [], tweens = [];
    const image = () => {
        const sprite = { active: true, destroy: jest.fn(function () { this.active = false; }) };
        for (const key of ['setScale', 'setAlpha', 'setDepth']) sprite[key] = jest.fn(() => sprite);
        return sprite;
    };
    const state = { creature: { genes: { id: 'synthetic-hatch', rarity: 'rare' }, dna: { id: 'synthetic-dna' } } };
    const scene = {
        hatchSaveOwner: { isCurrent: () => true },
        creatureAppeared: false, creatureGenetics: state.creature.genes, creatureDNA: state.creature.dna,
        portraitPromise: null, portraitError: null,
        scale: { width: 390, height: 844 },
        textures: { exists: jest.fn(() => true) },
        add: { image: jest.fn(image) },
        time: { delayedCall: jest.fn((delay, callback) => {
            const timer = { delay, callback, remove: jest.fn() }; delayed.push(timer); return timer;
        }), removeAllEvents: jest.fn() },
        tweens: { add: jest.fn(config => { tweens.push(config); }), killAll: jest.fn(), killTweensOf: jest.fn() },
        getFirstContactLayout: jest.fn(() => ({ creatureY: 320, creatureScale: 1 })),
        applyFirstContactCreaturePresentation: jest.fn(),
        createUniqueCreature: jest.fn(() => ({ textureName: 'synthetic-baby' })),
        generateCreatureGenetics: jest.fn(),
        showCriticalError: jest.fn(), showAdultVision: jest.fn(),
        createSparkles: jest.fn(), addGeneticEffects: jest.fn(),
        createBirthCelebration: jest.fn(), addCuteIdleAnimations: jest.fn(), hasSeenTutorial: () => true,
        saveCreatureGenetics: jest.fn(callback => { scene.hatchCommitAttempt = { complete: true }; callback?.(); return true; }),
        exportLocalPortraitQASpecimen: jest.fn(),
        showRarityReveal: jest.fn(), showRerollOptions: jest.fn(),
        stopThemeMusic: jest.fn(), events: { off: jest.fn() },
        removeEggHatchFallback: jest.fn(), removeHomeStartFallback: jest.fn(), cleanupRerollUI: jest.fn()
    };
    for (const name of ['showCreature', 'finishCreatureDisplayLoading', 'completeCreatureDisplay', 'finishHatchReveal', 'beginLivingPortraitPrewarm', 'clearHatchSaveRecovery']) {
        scene[name] = method('scenes/HatchingScene.js', name).bind(scene);
    }
    scene.shutdown = method('scenes/HatchingScene.js', 'shutdown', {
        Phaser: { Scenes: { Events: { RESUME: 'resume' } } }
    }).bind(scene);
    return { scene, delayed, tweens, ux, state };
}

describe('hatch presentation cannot depend on optional media or outlive its scene', () => {
    let f;
    beforeEach(() => { document.body.innerHTML = ''; f = fixture(); });
    afterEach(() => {
        f.ux.destroy(); delete window.UXEnhancements; delete window.LivingPortraitService;
        delete window.GameState; delete window.rerollSystem;
        delete window.AudioManager;
    });
    const reveal = () => { f.scene.showCreature(); f.delayed[0].callback(); };

    test('shows the local baby and classification without a media service or a new identity', () => {
        const original = JSON.stringify(f.state);
        reveal();
        f.delayed.find(timer => timer.delay === 650).callback();
        expect(f.scene.createUniqueCreature).toHaveBeenCalledWith('baby');
        expect(f.scene.generateCreatureGenetics).not.toHaveBeenCalled();
        expect(f.scene.saveCreatureGenetics).toHaveBeenCalledTimes(1);
        expect(f.scene.showRarityReveal).toHaveBeenCalledTimes(1);
        expect(f.scene.showRerollOptions).toHaveBeenCalledTimes(1);
        expect(f.scene.showCriticalError).not.toHaveBeenCalled();
        expect(document.getElementById('loading-overlay').classList.contains('hidden')).toBe(true);
        expect(JSON.stringify(f.state)).toBe(original);
    });

    test('a synchronous portrait failure cannot prevent the local hatch path', () => {
        const error = Error('synthetic optional-media setup failure');
        window.LivingPortraitService = { prewarm: jest.fn(() => { throw error; }) };
        expect(reveal).not.toThrow();
        expect(f.scene.saveCreatureGenetics).toHaveBeenCalledTimes(1);
        expect(f.scene.showCriticalError).not.toHaveBeenCalled();
        expect(f.scene.portraitError).toBe(error);
        expect(f.scene.generateCreatureGenetics).not.toHaveBeenCalled();
    });

    test('a rejected portrait is observed without turning into a hatch error', async () => {
        const error = Error('synthetic portrait unavailable');
        window.LivingPortraitService = { prewarm: jest.fn(() => Promise.reject(error)) };
        reveal();
        await Promise.resolve();
        expect(f.scene.portraitError).toBe(error);
        expect(f.scene.saveCreatureGenetics).toHaveBeenCalledTimes(1);
        expect(f.scene.showCriticalError).not.toHaveBeenCalled();
    });

    test('an unresolved portrait never holds the baby or classification screen', () => {
        window.LivingPortraitService = { prewarm: jest.fn(() => new Promise(() => {})) };
        reveal();
        f.delayed.find(timer => timer.delay === 650).callback();
        expect(f.scene.add.image).toHaveBeenCalledWith(195, 320, 'synthetic-baby');
        expect(f.scene.showRarityReveal).toHaveBeenCalledTimes(1);
        expect(f.scene.saveCreatureGenetics).toHaveBeenCalledTimes(1);
        expect(document.getElementById('loading-overlay').classList.contains('hidden')).toBe(true);
    });

    test('a refused identity commit shows no Keep/Reroll controls and starts no optional portrait', () => {
        f.scene.saveCreatureGenetics.mockImplementation(() => false);
        window.LivingPortraitService = { prewarm: jest.fn() };
        reveal();
        expect(f.scene.saveCreatureGenetics).toHaveBeenCalledTimes(1);
        expect(f.delayed.some(timer => timer.delay === 650)).toBe(false);
        expect(f.scene.showRarityReveal).not.toHaveBeenCalled();
        expect(f.scene.showRerollOptions).not.toHaveBeenCalled();
        expect(window.LivingPortraitService.prewarm).not.toHaveBeenCalled();
    });

    test('the real reroll caller also withholds its Keep controls and reroll publication on false persistence', () => {
        const state = {};
        f.scene.hatchSaveOwner = { state };
        f.scene.canCommitHatch = () => true;
        f.scene.saveCreatureGenetics.mockImplementation(() => false);
        f.scene.showFinalKeepButton = jest.fn();
        window.AudioManager = { playLevelUp: jest.fn() };
        window.rerollSystem = { trackReroll: jest.fn((_old, _next, data) => data), setRerolledCreature: jest.fn() };
        const perform = method('scenes/HatchingScene.js', 'performRerollRegeneration').bind(f.scene);
        perform('common', { totalRerolls: 1, rerollHistory: [] }, state);
        expect(f.scene.saveCreatureGenetics).toHaveBeenCalledTimes(1);
        expect(window.rerollSystem.setRerolledCreature).not.toHaveBeenCalled();
        expect(f.delayed.some(timer => timer.delay === 1000)).toBe(false);
        expect(f.scene.showFinalKeepButton).not.toHaveBeenCalled();
        f.tweens.find(tween => tween.duration === 1000)?.onComplete();
        expect(window.AudioManager.playLevelUp).not.toHaveBeenCalled();
    });

    test('duplicate reveal requests cannot duplicate the identity handoff or classification', () => {
        f.scene.showCreature(); f.scene.showCreature();
        expect(f.delayed).toHaveLength(1);
        f.delayed[0].callback();
        f.scene.showCreature();
        expect(f.scene.saveCreatureGenetics).toHaveBeenCalledTimes(1);
        expect(f.delayed.filter(timer => timer.delay === 650)).toHaveLength(1);
    });

    test('shutdown cancels the delay, removes its loading screen and ignores an already-dispatched callback', () => {
        f.scene.showCreature();
        const timer = f.delayed[0];
        f.scene.shutdown();
        expect(timer.remove).toHaveBeenCalledWith(false);
        expect(document.getElementById('loading-overlay').classList.contains('hidden')).toBe(true);
        timer.callback();
        expect(f.scene.createUniqueCreature).not.toHaveBeenCalled();
        expect(f.scene.saveCreatureGenetics).not.toHaveBeenCalled();
    });

    test('old hatch cleanup cannot hide a later scene\'s loader', () => {
        f.scene.showCreature();
        const timer = f.delayed[0], nextOwner = {};
        f.ux.showLoading('Entering the next scene...', nextOwner);
        f.scene.shutdown(); timer.callback();
        const overlay = document.getElementById('loading-overlay');
        expect(overlay.classList.contains('hidden')).toBe(false);
        expect(overlay.querySelector('.loading-text').textContent).toBe('Entering the next scene...');
        expect(f.scene.saveCreatureGenetics).not.toHaveBeenCalled();
    });

    test('optional loading UI setup failure does not block the local reveal', () => {
        jest.spyOn(f.ux, 'showLoading').mockImplementation(() => { throw Error('synthetic UI failure'); });
        expect(reveal).not.toThrow();
        expect(f.scene.saveCreatureGenetics).toHaveBeenCalledTimes(1);
        expect(f.scene.showCriticalError).not.toHaveBeenCalled();
    });

    test('optional loading UI cleanup failure does not turn a successful reveal into a critical error', () => {
        jest.spyOn(f.ux, 'hideLoading').mockImplementation(() => { throw Error('synthetic cleanup failure'); });
        expect(reveal).not.toThrow();
        expect(f.scene.saveCreatureGenetics).toHaveBeenCalledTimes(1);
        expect(f.scene.showCriticalError).not.toHaveBeenCalled();
    });

    test('a missing texture still fails honestly and releases the loading screen', () => {
        f.scene.textures.exists.mockReturnValue(false);
        reveal();
        expect(f.scene.showCriticalError).toHaveBeenCalledWith('Creature texture generation failed');
        expect(f.scene.saveCreatureGenetics).not.toHaveBeenCalled();
        expect(document.getElementById('loading-overlay').classList.contains('hidden')).toBe(true);
    });

    test('late media rejection cannot attach to a newer hatch attempt', async () => {
        let reject;
        window.LivingPortraitService = { prewarm: () => new Promise((_resolve, fail) => { reject = fail; }) };
        reveal();
        f.scene.portraitPromise = null;
        f.scene.portraitError = null;
        reject(Error('synthetic old job failed'));
        await Promise.resolve();
        expect(f.scene.portraitError).toBeNull();
    });

    test('a retired reveal cannot show classification or start celebration audio', () => {
        window.AudioManager = { playBabyCoo: jest.fn(), playAchievement: jest.fn() };
        reveal();
        const fade = f.tweens[0], classification = f.delayed.find(timer => timer.delay === 650);
        f.scene.shutdown();
        fade.onComplete(); classification.callback();
        expect(f.scene.createBirthCelebration).not.toHaveBeenCalled();
        expect(f.scene.showRarityReveal).not.toHaveBeenCalled();
        expect(window.AudioManager.playBabyCoo).not.toHaveBeenCalled();
        expect(window.AudioManager.playAchievement).not.toHaveBeenCalled();
    });

    test('celebration already queued before shutdown cannot play afterwards', () => {
        window.AudioManager = { playBabyCoo: jest.fn(), playAchievement: jest.fn() };
        reveal(); f.tweens[0].onComplete();
        expect(window.AudioManager.playBabyCoo).toHaveBeenCalledTimes(1);
        const sound = f.delayed.find(timer => timer.delay === 300);
        f.scene.shutdown(); sound.callback();
        expect(window.AudioManager.playAchievement).not.toHaveBeenCalled();
    });

    test('a newer creature cannot inherit classification from an earlier display', () => {
        reveal();
        f.scene.creature = { active: true };
        f.delayed.find(timer => timer.delay === 650).callback();
        expect(f.scene.showRarityReveal).not.toHaveBeenCalled();
        expect(f.scene.showRerollOptions).not.toHaveBeenCalled();
    });

    test('critical error copy wraps inside phone and desktop bounds', () => {
        const show = method('scenes/HatchingScene.js', 'showCriticalError');
        for (const width of [320, 390, 1280]) {
            let style;
            const element = { setOrigin: () => element, setDepth: jest.fn() };
            show.call({ scale: { width, height: 720 }, finishCreatureDisplayLoading: jest.fn(),
                add: { text: (_x, _y, _text, options) => { style = options; return element; } }
            }, 'Synthetic creature display error');
            expect(style.wordWrap.width).toBeLessThanOrEqual(width - 32);
            expect(style.wordWrap.width).toBeLessThanOrEqual(560);
        }
    });
});

describe('naming reveal optional media containment', () => {
    afterEach(() => { delete window.LivingPortraitService; delete window.GameState; });
    const scene = () => ({ creature: { texture: 'synthetic-baby' },
        portraitCreatureData: { genes: { id: 'synthetic-hatch' }, stage: 'baby' },
        portraitPromise: null, portraitError: null, portraitReferenceImage: null });
    const prewarm = method('scenes/SoulRevealScene.js', 'beginLivingPortraitPrewarm', { devLog() {} });

    test('local capture failure cannot interrupt naming or clear the creature', () => {
        const current = scene(), creature = current.creature;
        window.LivingPortraitService = {
            captureReference: () => { throw Error('synthetic capture failure'); },
            prewarm: jest.fn(() => null)
        };
        expect(() => prewarm.call(current)).not.toThrow();
        expect(current.creature).toBe(creature);
        expect(current.portraitReferenceImage).toBeNull();
    });

    test('portrait startup failure retains the local reference and does not interrupt naming', () => {
        const current = scene(), error = Error('synthetic startup failure');
        window.LivingPortraitService = {
            captureReference: () => 'data:image/png;base64,c3ludGhldGlj',
            prewarm: () => { throw error; }
        };
        expect(() => prewarm.call(current)).not.toThrow();
        expect(current.portraitReferenceImage).toBe('data:image/png;base64,c3ludGhldGlj');
        expect(current.portraitError).toBe(error);
    });

    test('old rejection cannot change a newer naming job', async () => {
        const current = scene(); let reject;
        window.LivingPortraitService = { prewarm: () => new Promise((_resolve, fail) => { reject = fail; }) };
        prewarm.call(current);
        current.portraitPromise = Promise.resolve({ imageUrl: 'blob:synthetic-current' });
        reject(Error('synthetic retired job failed'));
        await Promise.resolve();
        expect(current.portraitError).toBeNull();
    });

    test('a saved-portrait resolver failure still reaches the living-form handoff', () => {
        const { livingHandoffFixture } = require('./support/livingHandoffFixture.cjs');
        localStorage.clear();
        const f = livingHandoffFixture({ resume: true }), callbacks = [], error = Error('synthetic resolver failure');
        f.scene.time = { delayedCall: (_delay, callback) => callbacks.push(callback) };
        f.scene.showLivingPortraitHandoff = jest.fn();
        jest.spyOn(f.state, 'getCreaturePortrait').mockReturnValue({ assetRef: 'portrait-job-v1:synthetic' });
        window.LivingPortraitService = { resolve: () => { throw error; } };
        try {
            expect(() => f.scene.resumeLivingFormHandoff(390, 844)).not.toThrow();
            callbacks[0]();
            expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledWith('Fictional Glow');
            expect(f.scene.portraitError).toBe(error);
        } finally { f.close(); jest.restoreAllMocks(); localStorage.clear(); }
    });
});
