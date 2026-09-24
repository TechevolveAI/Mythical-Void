const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { parse } = require('@babel/parser');
const source = fs.readFileSync(path.join(__dirname, '../scenes/GameScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'GameScene');

function fixture() {
    const camera = new EventEmitter();
    camera.fadeOut = jest.fn(); camera.fadeIn = jest.fn(); camera.resetFX = jest.fn();
    const scene = {
        player: { x: 100, y: 200 }, hubPortal: {},
        cameras: { main: camera }, time: { delayedCall: jest.fn() },
        sceneRouter: { playSound: jest.fn(), showLoading: jest.fn(), startScene: jest.fn(async () => true) },
        getInteractionDistance: () => ({ enter: 170 }), isPlayerAtInteractionDistance: () => true,
        showInteractionHint: jest.fn(), cancelCompletionHandoffs: jest.fn()
    };
    const state = { get: jest.fn(), set: jest.fn() };
    const globals = { window: { UXEnhancements: { hideLoading: jest.fn() } },
        console: { log() {}, warn() {} }, getGameState: () => state,
        FEND_COMMONS_PRIORITIES: [], GUARDIAN_RESIDENT_DEFINITIONS: [], setTimeout, clearTimeout };
    for (const name of ['init', 'enterHubWorld', 'cancelHubEntryTransition']) {
        const node = declaration.body.body.find(m => m.key?.name === name);
        if (node) scene[name] = vm.runInNewContext(`({${source.slice(node.start, node.end)}}).${name}`, globals);
    }
    return { scene, camera };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('three visits can enter the gate without relying on the departed scene clock', async () => {
    const { scene, camera } = fixture();
    for (let visit = 0; visit < 3; visit++) {
        scene.init({});
        scene.enterHubWorld();
        camera.emit('camerafadeoutcomplete');
        await Promise.resolve();
        // Phaser removes scene-clock timers on departure, before the old 1s cooldown.
    }
    expect(scene.sceneRouter.startScene).toHaveBeenCalledTimes(3);
    scene.cancelHubEntryTransition?.();
});

test('a missed fade completion still enters once and ignores repeated taps', async () => {
    const { scene, camera } = fixture();
    scene.init({}); scene.enterHubWorld(); scene.enterHubWorld();
    await jest.advanceTimersByTimeAsync(1500);
    expect(scene.sceneRouter.startScene).toHaveBeenCalledTimes(1);
    camera.emit('camerafadeoutcomplete');
    expect(scene.sceneRouter.startScene).toHaveBeenCalledTimes(1);
    scene.cancelHubEntryTransition?.();
});

test('failed scene loading restores the camera and allows another attempt', async () => {
    const { scene, camera } = fixture();
    scene.sceneRouter.startScene.mockResolvedValueOnce(false);
    scene.init({}); scene.enterHubWorld(); camera.emit('camerafadeoutcomplete');
    await jest.advanceTimersByTimeAsync(0);
    expect(scene.hubEntryCooldown).toBe(false);
    expect(camera.fadeIn).toHaveBeenCalled();
    scene.enterHubWorld(); camera.emit('camerafadeoutcomplete');
    expect(scene.sceneRouter.startScene).toHaveBeenCalledTimes(2);
    scene.cancelHubEntryTransition?.();
});

test('a cancelled transition cannot launch from its old fade or watchdog', async () => {
    const { scene, camera } = fixture();
    scene.init({}); scene.enterHubWorld();
    scene.cancelHubEntryTransition?.();
    camera.emit('camerafadeoutcomplete');
    await jest.advanceTimersByTimeAsync(1500);
    expect(scene.sceneRouter.startScene).not.toHaveBeenCalled();
    expect(scene.hubEntryCooldown).toBe(false);
});
