const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');
const Key = require('phaser/src/input/keyboard/keys/Key');
const EventEmitter = require('eventemitter3');

const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'PlatformerLevelScene');

function displayObject() {
    const object = new EventEmitter();
    object.input = { enabled: true };
    for (const name of [
        'setScrollFactor', 'setDepth', 'fillStyle', 'fillCircle', 'lineStyle',
        'strokeCircle', 'fillTriangle', 'setOrigin', 'setInteractive', 'fillRect',
        'lineBetween', 'setAlpha', 'clear'
    ]) object[name] = jest.fn(() => object);
    return object;
}

function fixture() {
    const Scene = vm.runInNewContext(`(${source.slice(declaration.start, declaration.end)})`, {
        Phaser: {
            Scene: class {},
            Math: { Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) } }
        },
        window: new EventTarget(),
        document: new EventTarget(),
        console: { log() {}, warn() {} },
        getMobileControlLayout: () => ({
            bottomInset: 0, dockHeight: 144, dockTop: 700, primarySize: 60,
            secondarySize: 48, edge: 10,
            joystick: { radius: 55, thumbRadius: 20, x: 70, y: 770, zoneWidth: 160, zoneHeight: 140 },
            actions: { leftX: 270, rightX: 350, topY: 730, bottomY: 800 },
            menu: { x: 30, y: 30 }
        })
    });
    const scene = new Scene({ key: 'MythicalForestLevel' });
    scene.input = new EventEmitter();
    const keyboard = { enabled: true, keys: [] };
    keyboard.resetKeys = jest.fn(() => keyboard.keys.forEach(key => key.reset()));
    scene.input.keyboard = keyboard;
    const key = code => {
        const result = new Key(keyboard, code);
        keyboard.keys.push(result);
        return result;
    };
    scene.cursors = { left: key(37), right: key(39), down: key(40), up: key(38) };
    scene.wasdKeys = { A: key(65), D: key(68), S: key(83), W: key(87) };
    scene.jumpKey = key(32);
    scene.player = {
        body: { enable: true, velocity: { x: 0, y: 0 } },
        setVelocity: jest.fn((x, y) => Object.assign(scene.player.body.velocity, { x, y })),
        setVelocityX: jest.fn(x => { scene.player.body.velocity.x = x; }),
        setPosition: jest.fn(), setAlpha: jest.fn(), setScale: jest.fn(), clearTint: jest.fn()
    };
    scene.checkpointPosition = { x: 1770, y: 1000 };
    scene.physics = {
        world: { isPaused: false },
        pause: jest.fn(() => { scene.physics.world.isPaused = true; }),
        resume: jest.fn(() => { scene.physics.world.isPaused = false; })
    };
    scene.time = { now: 1000, delayedCall: jest.fn() };
    scene.tweens = { pauseAll: jest.fn(), resumeAll: jest.fn() };
    for (const name of [
        'clearDeathScreen', 'showDeathScreen', 'updateHealthDisplay', 'updateEnergyDisplay',
        'startInvincibilityFlash', 'showFloatingText', 'createMenuButton'
    ]) scene[name] = jest.fn();
    scene.detectMobile = () => true;
    scene.getSafeAreaInsets = () => ({ left: 0, right: 0, top: 0, bottom: 0 });
    scene.scale = { width: 390, height: 844 };
    scene.game = { canvas: new EventTarget() };
    scene.game.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 });
    scene.add = { graphics: displayObject, zone: jest.fn(displayObject) };
    scene.createPlatformerButton = ({ id, x, y, size }) => ({ id, x, y, radius: size / 2, zone: displayObject() });
    scene.setupPlatformerMobileControls();
    scene.showPlatformerMobileControls();
    return { scene, keyboard, zone: scene.add.zone.mock.results[0].value };
}

const touch = (identifier = 7, clientX = 20, clientY = 770) => ({ identifier, clientX, clientY });
const touchEvent = candidate => ({ changedTouches: [candidate], touches: [candidate] });

describe('checkpoint input recovery using real platformer handlers', () => {
    test.each(['left', 'right', 'A', 'D'])('death and retry discard a held %s key', name => {
        const { scene, keyboard } = fixture();
        const held = scene.cursors[name] || scene.wasdKeys[name];
        held.onDown({ timeStamp: 10 });
        scene.handleMovement();
        expect(scene.player.body.velocity.x).not.toBe(0);
        scene.queueVirtualJumpInput();
        scene.jumpBufferPressed = true;
        scene.jumpBufferFramesRemaining = 3;

        scene.onPlayerDeath();
        expect(keyboard.enabled).toBe(false);
        // Phaser does not process keyup while its keyboard plugin is disabled.
        scene.retryFromCheckpoint();
        scene.time.now += 1000;
        scene.handleMovement();
        expect(scene.player.body.velocity.x).toBe(0);
        expect(held.isDown).toBe(false);
        expect(scene.virtualJumpQueued).toBe(false);
        expect(scene.jumpBufferPressed).toBe(false);
        expect(scene.jumpBufferFramesRemaining).toBe(0);

        held.onDown({ timeStamp: 2010 });
        scene.handleMovement();
        expect(scene.player.body.velocity.x).not.toBe(0);
    });

    test('clears keys before disabling them and clears again before checkpoint re-enables them', () => {
        const { scene, keyboard } = fixture();
        const enabledAtReset = [];
        keyboard.resetKeys.mockImplementation(() => {
            enabledAtReset.push(keyboard.enabled);
            keyboard.keys.forEach(key => key.reset());
        });
        scene.onPlayerDeath();
        scene.retryFromCheckpoint();
        expect(enabledAtReset).toEqual([true, false]);
    });

    test('non-lethal fall recovery also discards held keyboard and touch input', () => {
        const { scene } = fixture();
        scene.cursors.left.onDown({ timeStamp: 10 });
        scene.platformerTouchStartHandler(touchEvent(touch()));
        scene.queueVirtualJumpInput();
        scene.respawnAtCheckpoint();
        scene.time.now += 1000;
        scene.handleMovement();
        expect(scene.player.body.velocity.x).toBe(0);
        expect(scene.joystickActive).toBe(false);
        expect(scene.virtualJumpQueued).toBe(false);
    });

    test('hiding controls releases the touch owner even when no display elements remain', () => {
        const { scene } = fixture();
        scene.platformerTouchStartHandler(touchEvent(touch()));
        expect(scene.virtualJoystickX).toBeLessThan(-0.2);
        scene.mobileControlElements = [];
        scene.hidePlatformerMobileControls();
        expect(scene.joystickActive).toBe(false);
        expect(scene.joystickTouchIdentifier).toBeNull();
        expect(scene.virtualJoystickX).toBe(0);
        expect(scene.platformerControlsVisible).toBe(false);
    });

    test.each(['hidden', 'dead', 'respawning', 'paused', 'complete', 'physics paused'])(
        'neither native nor Phaser touches can start movement while %s', state => {
            const { scene, zone } = fixture();
            if (state === 'hidden') scene.hidePlatformerMobileControls();
            if (state === 'dead') scene.isPlayerDead = true;
            if (state === 'respawning') scene.isRespawning = true;
            if (state === 'paused') scene.pauseMenuActive = true;
            if (state === 'complete') scene.levelCompletionActive = true;
            if (state === 'physics paused') scene.physics.world.isPaused = true;
            scene.platformerTouchStartHandler(touchEvent(touch()));
            zone.emit('pointerdown', { id: 7, x: 20, y: 770 });
            zone.emit('pointermove', { id: 7, x: 20, y: 770 });
            expect(scene.joystickActive).toBe(false);
            expect(scene.virtualJoystickX).toBe(0);
            expect(scene.virtualJoystickY).toBe(0);
        }
    );

    test('retry ignores the previous drag and accepts a fresh touch without recentering during movement', () => {
        const { scene } = fixture();
        scene.platformerTouchStartHandler(touchEvent(touch()));
        scene.onPlayerDeath();
        scene.platformerTouchStartHandler(touchEvent(touch(8)));
        scene.retryFromCheckpoint();
        scene.platformerTouchMoveHandler(touchEvent(touch()));
        scene.platformerJoystickMoveHandler({ id: 7, x: 20, y: 770 });
        expect(scene.virtualJoystickX).toBe(0);

        scene.platformerTouchStartHandler(touchEvent(touch(9, 120)));
        expect(scene.virtualJoystickX).toBeGreaterThan(0.2);
        for (let index = 0; index < 30; index++) {
            scene.platformerTouchMoveHandler(touchEvent(touch(9, 120)));
            expect(scene.joystickActive).toBe(true);
            expect(scene.virtualJoystickX).toBeGreaterThan(0.2);
        }
        scene.platformerTouchEndHandler({ changedTouches: [touch(9, 120)], touches: [] });
        expect(scene.virtualJoystickX).toBe(0);
    });

    test('a second finger cannot steer or release the joystick owned by the first', () => {
        const { scene, zone } = fixture();
        zone.emit('pointerdown', { id: 7, x: 20, y: 770 });
        zone.emit('pointermove', { id: 7, x: 20, y: 770 });
        expect(scene.virtualJoystickX).toBeLessThan(-0.2);
        zone.emit('pointermove', { id: 8, x: 120, y: 770 });
        scene.platformerJoystickUpHandler({ id: 8 });
        expect(scene.virtualJoystickX).toBeLessThan(-0.2);
        expect(scene.joystickActive).toBe(true);
        zone.emit('pointerup', { id: 7 });
        expect(scene.virtualJoystickX).toBe(0);
    });
});
