const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const GameStateManager = require('../../systems/GameState.js');
const CloudSaveManager = require('../../systems/CloudSaveManager.js');
const source = fs.readFileSync(path.join(__dirname, '../../scenes/HatchingScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const clone = value => JSON.parse(JSON.stringify(value));

function attach(scene, name) {
    const node = declaration.body.body.find(item => item.key?.name === name);
    if (!node) throw Error(`MISSING_START_METHOD:${name}`);
    scene[name] = vm.runInNewContext(`({${source.slice(node.start, node.end)}}).${name}`, {
        getGameState: () => window.GameState, window, document, console, Date, localStorage,
        cloneConfig: clone, MobileHelpers: { vibrate: jest.fn() },
        firstSessionFraming: require('../../config/project-beacon.json').firstSessionFraming,
        Phaser: { Scenes: { Events: { RESUME: 'resume', SHUTDOWN: 'shutdown' } } }
    }).bind(scene);
}

function fixture({ seed = () => {}, admissionGate = false, initialState } = {}) {
    const state = new GameStateManager(), clouds = [], states = [state];
    if (initialState) state.state = clone(initialState);
    else {
        seed(state);
        state.state = state.prepareSaveCandidate(state.createSaveSnapshot()).state;
    }
    expect(state.save()).toBe(true); window.GameState = state;
    const loading = { visible: false, shows: 0, hides: 0 };
    window.UXEnhancements = {
        showLoading: jest.fn(() => { loading.visible = true; loading.shows += 1; }),
        hideLoading: jest.fn(() => { loading.visible = false; loading.hides += 1; })
    };
    document.body.innerHTML = '<div id="game"></div>';
    const scene = {
        hatchSceneRetired: false, openingStartAttempt: null, isStartingGame: false, startFlowQueued: false,
        startButtonPressed: true, startButtonPressedAt: Date.now(), homeStartFallback: null,
        startButton: { active: false }, scale: { width: 390, height: 844 },
        sys: { isActive: () => !scene.hatchSceneRetired },
        scene: { restart: jest.fn(), start: jest.fn() },
        ensureHomeStartReady: jest.fn(), events: { off: jest.fn(), once: jest.fn() },
        finishCreatureDisplayLoading: jest.fn(), stopThemeMusic: jest.fn(),
        removeEggHatchFallback: jest.fn(), cleanupRerollUI: jest.fn(),
        time: { removeAllEvents: jest.fn() }, tweens: { add: jest.fn(), killAll: jest.fn() }
    };
    for (const name of ['captureHatchSaveOwner', 'canCommitHatch', 'onStartRelease', 'handleStartGame',
        'createOpeningStartDraft', 'recoverOpeningStart', 'performOpeningStartFeedback', 'animateStartRelease', 'createHomeStartFallback',
        'removeHomeStartFallback', 'clearHatchSaveRecovery', 'showHatchSaveRecovery', 'shutdown']) attach(scene, name);
    scene.captureHatchSaveOwner(); scene.createHomeStartFallback();
    let gate;
    if (admissionGate) {
        const gateSource = fs.readFileSync(path.join(__dirname, '../../ui/SaveRecoveryGate.js'), 'utf8');
        const exported = parse(gateSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ExportDefaultDeclaration');
        const SaveRecoveryGate = vm.runInNewContext(`(${gateSource.slice(exported.declaration.start, exported.declaration.end)})`, {
            window, document, console, Date, Promise
        });
        gate = new SaveRecoveryGate(state, { pause: jest.fn(), reload: jest.fn() });
    }
    const snapshot = () => ({ raw: localStorage.getItem(state.saveKey), memory: JSON.stringify(state.state),
        storage: { ...localStorage }, admission: state.getSaveAdmission(), lease: state.cloudWriteLease,
        manager: window.GameState, cloud: window.CloudSave });
    const f = { state, scene, loading, snapshot, gate,
        release: () => scene.onStartRelease(scene.startButton, 195, 422),
        cloud() {
            const cloud = new CloudSaveManager({ client: null, gameState: state, storage: localStorage, lockManager: null });
            clouds.push(cloud); window.CloudSave = cloud; scene.captureHatchSaveOwner(); return cloud;
        },
        replace(kind) {
            if (kind === 'new-game') expect(state.startFreshGame()).toBe(true);
            if (['saved-progress', 'unsaved-progress'].includes(kind)) {
                state.set('player.cosmicCoins', 77);
                if (kind === 'saved-progress') expect(state.save()).toBe(true);
            }
            if (kind === 'admission') state.holdSaveAdmission({ code: 'fictional_hold' }, 'fictional');
            if (kind === 'epoch') state.releaseSaveAdmission();
            if (kind === 'raw-successor') {
                const incoming = state.createSaveSnapshot(); incoming.player.cosmicCoins = 77;
                localStorage.setItem(state.saveKey, JSON.stringify(incoming));
            }
            if (kind === 'global-manager') {
                const next = new GameStateManager(); states.push(next);
                next.set('player.cosmicCoins', 77); expect(next.save()).toBe(true); window.GameState = next;
            }
            if (kind === 'cloud-manager') f.cloud();
            if (kind === 'scene') scene.shutdown();
        },
        close() {
            gate?.destroy(); scene.clearHatchSaveRecovery();
            for (const cloud of clouds) cloud.destroy();
            for (const owner of states) owner.stopAutoSave();
        }
    };
    return f;
}
module.exports = { fixture, attach, GameStateManager, clone };
