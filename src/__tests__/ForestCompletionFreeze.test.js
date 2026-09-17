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
        cameras: { main: { width: 390, height: 844, stopFollow: jest.fn(), centerOn: jest.fn() } },
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
    expect(scene.time.delayedCall).toHaveBeenCalled();
    expect(restoration.call(scene)).toBe(false);
});
