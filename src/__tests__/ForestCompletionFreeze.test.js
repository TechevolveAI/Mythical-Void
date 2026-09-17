const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

function loadMethod(file, name, dependencies = {}) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const nodes = parse(source, { sourceType: 'module' }).program.body;
    const declaration = nodes.find(node => node.type === 'ClassDeclaration') ||
        nodes.find(node => node.type === 'ExportDefaultDeclaration').declaration;
    const method = declaration.body.body.find(node => node.key?.name === name);
    return new Function(...Object.keys(dependencies), `return ({${source.slice(method.start, method.end)}}).${name};`)(...Object.values(dependencies));
}

test('Forest restoration enters the shared physics/input freeze while its story clock continues', () => {
    const drawable = new Proxy({}, { get: () => () => drawable });
    const scene = {
        player: { active: true, scaleX: 1, scaleY: 1, setPosition: jest.fn(), setVelocity: jest.fn(), body: { updateFromGameObject: jest.fn() } },
        cameras: { main: { width: 390, height: 844, stopFollow: jest.fn(), centerOn: jest.fn(),
            shakeEffect: { isRunning: true, reset: jest.fn(function () { this.isRunning = false; }) } } },
        levelHeight: 900, isMobile: true, forestRestorationElements: [], forestRestorationTimers: [],
        add: { graphics: () => drawable, text: () => drawable, ellipse: () => drawable },
        tweens: { add: jest.fn() },
        time: { paused: false, delayedCall: jest.fn(() => ({ remove: jest.fn() })) },
        resetJoystick: jest.fn(), clearVirtualJumpInput: jest.fn(), hidePlatformerMobileControls: jest.fn(),
        syncCampaignObjectiveDisplay: jest.fn(), clearForestStoryBubble: jest.fn(),
        physics: { world: { isPaused: false }, pause: jest.fn(function () { this.world.isPaused = true; }) }
    };
    scene.enterLevelCompletionState = loadMethod('../scenes/PlatformerLevelScene.js', 'enterLevelCompletionState');
    const restoration = loadMethod('../scenes/levels/MythicalForestLevel.js', 'showForestRestorationSequence', {
        Phaser: { Math: { Clamp: (value, min, max) => Math.min(max, Math.max(min, value)) } }
    });
    expect(restoration.call(scene)).toBe(true);
    expect(scene.levelCompletionActive).toBe(true);
    expect(scene.physics.world.isPaused).toBe(true);
    expect(scene.player.setVelocity).toHaveBeenCalledWith(0, 0);
    expect(scene.virtualJoystickX).toBe(0);
    expect(scene.virtualJoystickY).toBe(0);
    expect(scene.time.paused).toBe(false);
    expect(scene.cameras.main.shakeEffect.reset).toHaveBeenCalledTimes(1);
    expect(scene.cameras.main.shakeEffect.isRunning).toBe(false);
    expect(scene.time.delayedCall).toHaveBeenCalled();
    expect(restoration.call(scene)).toBe(false);
});

test.each(['fighting', 'defeated', 'completing', 'destroyed'])('Elder entrance completion respects the %s state', state => {
    const sprite = { active: true, width: 200, height: 200 };
    for (const name of ['setCollideWorldBounds', 'setBounce', 'setDepth', 'setScale', 'setAlpha']) {
        sprite[name] = jest.fn(() => sprite);
    }
    sprite.body = { setSize: jest.fn(), setOffset: jest.fn(), setAllowGravity: jest.fn(), setImmovable: jest.fn() };
    const feedback = { cameraShake: jest.fn() };
    const audio = { playError: jest.fn() };
    const scene = {
        createElderTreantTexture: () => 'elder', cameras: { main: { width: 390, height: 844 } },
        levelHeight: 900, bossMaxHealth: 20, createBossHealthBar: jest.fn(),
        createBossAmbientEffects: jest.fn(), startBossAI: jest.fn(),
        physics: { add: { sprite: () => sprite } }, tweens: { add: jest.fn() }
    };
    const spawn = loadMethod('../scenes/levels/MythicalForestLevel.js', 'spawnElderTreant', {
        ELDER_TREANT_DISPLAY_HEIGHT: 300, window: { FeedbackManager: feedback, AudioManager: audio }
    });
    spawn.call(scene);
    if (state === 'defeated') scene.bossDefeated = true;
    if (state === 'completing') scene.levelCompletionActive = true;
    if (state === 'destroyed') sprite.active = false;
    scene.tweens.add.mock.calls[0][0].onComplete();
    const expected = state === 'fighting' ? 1 : 0;
    expect(scene.startBossAI).toHaveBeenCalledTimes(expected);
    expect(feedback.cameraShake).toHaveBeenCalledTimes(expected);
    expect(audio.playError).toHaveBeenCalledTimes(expected);
});
