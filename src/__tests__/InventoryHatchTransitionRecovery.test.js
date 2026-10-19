const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../scenes/InventoryScene.js'), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
    .replace('export default class InventoryScene', 'class InventoryScene') + '\nmodule.exports = InventoryScene;';

function fixture(width = 390, height = 844) {
    const elements = [], delayed = [], controls = [];
    const make = (kind, text = null) => {
        const element = { kind, text, active: true, handlers: {}, children: [],
            destroy: jest.fn(function () { this.active = false; this.children.forEach(child => child.destroy()); }),
            add(children) { this.children.push(...(Array.isArray(children) ? children : [children])); return this; },
            on(event, callback) { this.handlers[event] = callback; return this; }
        };
        for (const name of ['fillStyle', 'fillRect', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect',
            'setDepth', 'setOrigin', 'setInteractive', 'setAlpha', 'setScale', 'fillCircle', 'setPosition', 'clear']) {
            element[name] = jest.fn(() => element);
        }
        elements.push(element);
        return element;
    };
    const helper = { stopScene: jest.fn(), resumeScene: jest.fn() };
    const context = { module: { exports: {} }, window, console: { log() {}, warn() {}, error() {} },
        Phaser: { Scene: class {} }, SceneTransitionHelper: helper,
        setTimeout, clearTimeout };
    vm.runInNewContext(source, context);
    const scene = new context.module.exports();
    scene.dims = { width, height, isMobile: width < 600 };
    scene.add = { graphics: () => make('graphics'), sprite: () => make('sprite'),
        text: (_x, _y, text) => make('text', text), zone: () => make('zone'), container: () => make('container') };
    scene.time = { delayedCall: jest.fn((_delay, callback) => {
        const timer = { callback, remove: jest.fn() }; delayed.push(timer); return timer;
    }), removeAllEvents: jest.fn() };
    scene.tweens = { add: jest.fn(), killTweensOf: jest.fn() };
    scene.game = { scene: { start: jest.fn(), stop: jest.fn() } };
    const actualCreateButton = scene.createButton.bind(scene);
    scene.createButton = (...args) => {
        const control = actualCreateButton(...args);
        controls.push({ label: args[4], callback: args[6], ...control });
        return control;
    };
    let reservation = { schemaVersion: 1, status: 'reserved', eggType: 'stellar', spawnPosition: { x: 0, y: 30 } };
    window.GameState = { get: jest.fn(key => key === 'creature.hatchTransaction' ? reservation
        : key === 'creature.name' ? 'Fictional creature' : null), set: jest.fn(), save: jest.fn() };
    window.AudioManager = { playPet: jest.fn(), playButtonClick: jest.fn() };
    return { scene, elements, delayed, controls, helper, reservation,
        dropReservation() { reservation = null; } };
}

describe('inventory hatch presentation recovery', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.clearAllTimers(); jest.useRealTimers();
        delete window.GameState; delete window.AudioManager; delete window.InventoryScene;
    });
    test('launches once and retires its transition elements and timers', () => {
        const { scene, elements, delayed } = fixture();
        scene.showSanctuaryHatchTransition('cosmic');
        scene.showSanctuaryHatchTransition('cosmic');
        const transitionElements = [...elements];
        expect(scene.pendingTimeouts).toHaveLength(1);
        jest.advanceTimersByTime(3000);
        expect(scene.game.scene.start).toHaveBeenCalledTimes(1);
        expect(scene.game.scene.start).toHaveBeenCalledWith('HatchingScene', {
            isEggHatch: true, eggType: 'stellar', spawnPosition: { x: 0, y: 30 }
        });
        expect(scene.game.scene.stop).not.toHaveBeenCalled();
        expect(scene.hatchTransitionInProgress).toBe(false);
        expect(scene.pendingTimeouts).toEqual([]);
        expect(delayed[0].remove).toHaveBeenCalledWith(false);
        expect(transitionElements.every(element => element.destroy.mock.calls.length === 1)).toBe(true);
        expect(window.GameState.set).not.toHaveBeenCalled();
        expect(window.GameState.save).not.toHaveBeenCalled();
    });
    test.each([[390, 844], [1280, 720]])('a failed start at %ix%i clears the screen and offers a retry', (width, height) => {
        const { scene, elements, controls, reservation } = fixture(width, height);
        scene.game.scene.start.mockImplementationOnce(() => { throw Error('fictional launch failure'); });
        scene.showSanctuaryHatchTransition('cosmic');
        const transitionElements = [...elements];
        jest.advanceTimersByTime(3000);
        expect(transitionElements.every(element => !element.active)).toBe(true);
        expect(scene.hatchTransitionInProgress).toBe(false);
        expect(scene.hatchRecovery.active).toBe(true);
        expect(controls.map(control => control.label)).toEqual(['TRY AGAIN', 'BACK TO INVENTORY']);
        expect(scene.game.scene.stop).not.toHaveBeenCalled();
        expect(reservation.status).toBe('reserved');
        expect(window.GameState.set).not.toHaveBeenCalled();
        expect(window.GameState.save).not.toHaveBeenCalled();
    });
    test('retry uses the existing reservation and ignores a second tap on the retired control', () => {
        const { scene, controls } = fixture();
        scene.game.scene.start.mockImplementationOnce(() => { throw Error('fictional launch failure'); });
        scene.showSanctuaryHatchTransition('cosmic');
        jest.advanceTimersByTime(3000);
        const retry = controls.find(control => control.label === 'TRY AGAIN');
        retry.callback(); retry.callback();
        expect(scene.pendingTimeouts).toHaveLength(1);
        jest.advanceTimersByTime(3000);
        expect(scene.game.scene.start).toHaveBeenCalledTimes(2);
        expect(scene.hatchRecovery).toBe(null);
        expect(window.GameState.set).not.toHaveBeenCalled();
    });
    test('Back removes recovery, permits closing inventory and never launches later', () => {
        const { scene, controls, helper } = fixture();
        scene.game.scene.start.mockImplementation(() => { throw Error('fictional launch failure'); });
        scene.showSanctuaryHatchTransition('cosmic');
        jest.advanceTimersByTime(3000);
        controls.find(control => control.label === 'BACK TO INVENTORY').callback();
        scene.exitInventory();
        expect(scene.hatchRecovery).toBe(null);
        expect(helper.stopScene).toHaveBeenCalledWith(scene);
        expect(helper.resumeScene).toHaveBeenCalledWith(scene, 'GameScene');
        jest.advanceTimersByTime(30000);
        expect(scene.game.scene.start).toHaveBeenCalledTimes(1);
    });
    test('missing reservation offers Back without fabricating an egg or showing a dead retry', () => {
        const { scene, controls, dropReservation } = fixture();
        scene.showSanctuaryHatchTransition('cosmic');
        dropReservation();
        jest.advanceTimersByTime(3000);
        expect(scene.game.scene.start).not.toHaveBeenCalled();
        expect(controls.map(control => control.label)).toEqual(['BACK TO INVENTORY']);
        expect(scene.hatchTransitionInProgress).toBe(false);
        expect(window.GameState.set).not.toHaveBeenCalled();
    });
    test('an art exception falls back to starting the reserved hatch without a blocking leftover layer', () => {
        const { scene, elements } = fixture();
        scene.add.text = () => { throw Error('fictional art unavailable'); };
        scene.showSanctuaryHatchTransition('cosmic');
        expect(scene.game.scene.start).toHaveBeenCalledTimes(1);
        expect(elements.every(element => !element.active)).toBe(true);
        expect(scene.hatchTransitionInProgress).toBe(false);
    });
    test('shutdown cancels launch and makes already-dispatched scene callbacks harmless', () => {
        const { scene, elements, delayed } = fixture();
        scene.showSanctuaryHatchTransition('cosmic');
        scene.shutdown();
        const tweenCount = scene.tweens.add.mock.calls.length;
        delayed[0].callback();
        jest.advanceTimersByTime(30000);
        expect(scene.tweens.add).toHaveBeenCalledTimes(tweenCount);
        expect(scene.game.scene.start).not.toHaveBeenCalled();
        expect(scene.hatchTransitionInProgress).toBe(false);
        expect(elements.every(element => !element.active)).toBe(true);
    });
    test('late callbacks from a retired transition cannot affect a later attempt', () => {
        const { scene, delayed } = fixture();
        scene.showSanctuaryHatchTransition('cosmic');
        const oldCallback = delayed[0].callback;
        scene.clearHatchTransition();
        scene.showSanctuaryHatchTransition('cosmic');
        const tweenCount = scene.tweens.add.mock.calls.length;
        oldCallback();
        expect(scene.tweens.add).toHaveBeenCalledTimes(tweenCount);
        jest.advanceTimersByTime(3000);
        expect(scene.game.scene.start).toHaveBeenCalledTimes(1);
    });
});
