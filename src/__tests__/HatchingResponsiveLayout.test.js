const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

function item(width = 100, height = 150) {
    const object = Object.assign(new EventEmitter(), { active: true, width, height, x: 0, y: 0 });
    object.setPosition = (x, y) => { Object.assign(object, { x, y }); return object; };
    object.setScale = scale => { object.scale = scale; return object; };
    object.setSize = object.setDisplaySize = (width, height) => {
        Object.assign(object, { width, height, inputWidth: width, inputHeight: height }); return object;
    };
    object.setFontSize = size => { object.fontSize = size; return object; };
    object.setWordWrapWidth = width => { object.wrapWidth = width; return object; };
    for (const method of ['setVisible', 'clear', 'fillStyle', 'fillRoundedRect', 'lineStyle',
        'strokeRoundedRect', 'setBlendMode', 'clearMask']) object[method] = () => object;
    return object;
}

function fixture() {
    const source = fs.readFileSync(path.join(__dirname, '../scenes/HatchingScene.js'), 'utf8');
    const context = { module: { exports: {} }, window: { FXLibrary: { stardustBurst: jest.fn() } }, Phaser: { Scene: class {},
        Math: { Clamp: (n, min, max) => Math.max(min, Math.min(max, n)) }, BlendModes: { SCREEN: 3 } } };
    vm.runInNewContext(source.slice(source.indexOf('class HatchingScene extends'))
        .replace('export default HatchingScene;', 'module.exports = HatchingScene;'), context);
    const scene = new context.module.exports();
    scene.scale = { width: 390, height: 844 };
    scene.tweens = { killTweensOf: jest.fn(), add: jest.fn(), getTweensOf: jest.fn(() => []) };
    scene.egg = item();
    scene.eggHatchFallback = { disabled: true, style: {} };
    scene.eggHatchReadyAt = 456;
    scene.projectBeaconBackground = item(1024, 1024);
    scene.projectBeaconBackgroundFallback = item();
    scene.projectBeaconContrastVeil = item();
    for (const name of ['hatchTitleText', 'hatchSubtitleText', 'instructionText',
        'tapToHatchText', 'progressText', 'tutorialHintText']) scene[name] = item();
    scene.generateCreatureGenetics = jest.fn();
    scene.saveCreatureGenetics = jest.fn();
    scene.startHatching = jest.fn();
    scene.creatureDNA = { id: 'synthetic-egg', bodyArchetype: 'star' };
    scene.hatchingTimer = { paused: false };
    return scene;
}

const sizes = [[320, 568], [390, 844], [568, 320], [844, 390], [1280, 720]];

describe('hatching layout preserves the active journey through rotation', () => {
    test.each(sizes)('egg, touch target and prompts fit %s by %s', (width, height) => {
        const scene = fixture();
        Object.assign(scene.scale, { width, height });
        const button = scene.eggHatchFallback;
        scene.resizeHatchingLayout();
        expect(scene.eggHatchFallback).toBe(button);
        expect(button.disabled).toBe(true);
        expect(scene.eggHatchReadyAt).toBe(456);
        expect(parseFloat(button.style.left) / 100 * width).toBeCloseTo(scene.egg.x);
        expect(parseFloat(button.style.top) / 100 * height).toBeCloseTo(scene.egg.y);
        const halfButton = parseFloat(button.style.width) / 2;
        expect(scene.egg.x - halfButton).toBeGreaterThan(0);
        expect(scene.egg.x + halfButton).toBeLessThan(width);
        expect(scene.egg.y - halfButton).toBeGreaterThan(0);
        expect(scene.egg.y + halfButton).toBeLessThan(height);
        expect(scene.hatchSubtitleText.y - scene.hatchTitleText.y).toBeGreaterThan(25);
        expect(scene.instructionText.y - scene.hatchSubtitleText.y).toBeGreaterThan(35);
        expect(scene.tapToHatchText.y).toBeLessThan(height - 20);
        expect(scene.projectBeaconBackground.width * scene.projectBeaconBackground.scale).toBeGreaterThanOrEqual(width);
        expect(scene.projectBeaconBackground.height * scene.projectBeaconBackground.scale).toBeGreaterThanOrEqual(height);
        expect(scene.projectBeaconContrastVeil).toMatchObject({ width, height, x: width / 2, y: height / 2 });
    });

    test('rotation during a hatch retains its identity, progress and timer', () => {
        const scene = fixture(), dna = scene.creatureDNA, timer = scene.hatchingTimer;
        scene.hatchingStarted = true;
        scene.isHatching = true;
        scene.hatchingProgress = 42;
        for (const [width, height] of sizes) {
            Object.assign(scene.scale, { width, height });
            scene.resizeHatchingLayout();
        }
        expect(scene.creatureDNA).toBe(dna);
        expect(scene.hatchingTimer).toBe(timer);
        expect(scene.hatchingProgress).toBe(42);
        expect(scene.generateCreatureGenetics).not.toHaveBeenCalled();
        expect(scene.saveCreatureGenetics).not.toHaveBeenCalled();
        expect(scene.startHatching).not.toHaveBeenCalled();
    });

    test('rotation cannot cancel the egg completion fade', () => {
        const scene = fixture();
        scene.hatchingStarted = true;
        scene.isHatching = false;
        scene.resizeHatchingLayout();
        expect(scene.tweens.killTweensOf).not.toHaveBeenCalledWith(scene.egg);
    });

    test.each([false, true])('reveal controls and hit areas reflow without a rescan (can rescan: %s)', canReroll => {
        const scene = fixture();
        scene.creatureAppeared = true;
        scene.creature = item(128, 128);
        scene.keepUI = { keepBg: item(), keepText: item(), keepZone: item() };
        const confirm = jest.fn(), rescan = jest.fn();
        scene.keepUI.keepZone.on('pointerdown', confirm);
        if (canReroll) {
            scene.rerollUI = { rerollBg: item(), rerollText: item(), rerollZone: item() };
            scene.rerollUI.rerollZone.on('pointerdown', rescan);
        }
        const creature = scene.creature, button = scene.keepUI.keepZone;
        for (const [width, height] of sizes) {
            Object.assign(scene.scale, { width, height });
            scene.resizeHatchingLayout();
            const layout = scene.getFirstContactLayout(canReroll);
            expect(scene.creature).toBe(creature);
            expect(scene.keepUI.keepZone).toBe(button);
            for (const zone of [button, scene.rerollUI?.rerollZone].filter(Boolean)) {
                expect(zone.x).toBeGreaterThanOrEqual(0);
                expect(zone.y + zone.height).toBeLessThan(height);
                expect(zone.x + zone.width).toBeLessThan(width);
                expect(zone.width).toBeGreaterThanOrEqual(44);
                expect(zone.height).toBeGreaterThanOrEqual(44);
                expect(zone.inputWidth).toBe(zone.width);
                expect(zone.inputHeight).toBe(zone.height);
            }
            expect(layout.guidanceY).toBeLessThan(layout.buttonY);
            expect(layout.creatureY + 80 * layout.creatureScale).toBeLessThan(height);
        }
        expect(confirm).not.toHaveBeenCalled();
        expect(rescan).not.toHaveBeenCalled();
        button.emit('pointerdown');
        expect(confirm).toHaveBeenCalledTimes(1);
        expect(scene.generateCreatureGenetics).not.toHaveBeenCalled();
    });

    test('a late resize cannot mutate a retired scene', () => {
        const scene = fixture();
        scene.hatchSceneRetired = true;
        scene.resizeHatchingLayout();
        expect(scene.tweens.killTweensOf).not.toHaveBeenCalled();
        expect(scene.eggHatchFallback.style).toEqual({});
    });

    test('repeated reveal rotations replace idle motion without stacking timers or restoring an old scale', () => {
        const scene = fixture();
        scene.creatureAppeared = true;
        scene.creature = item(128, 128);
        scene.tweens.add.mockImplementation(config => ({ config, remove: jest.fn() }));
        scene.time = { addEvent: jest.fn(config => ({ config, remove: jest.fn() })) };
        scene.addCuteIdleAnimations(scene.creature, 3);
        for (const [width, height] of sizes) {
            const oldTweens = scene.creatureIdleTweens;
            const bounce = scene.creatureIdleBounceTimer;
            const sparkle = scene.creatureIdleSparkleTimer;
            bounce.config.callback();
            const squash = scene.creatureIdleReactionTween;
            squash.config.onComplete();
            const rebound = scene.creatureIdleReactionTween;
            Object.assign(scene.scale, { width, height });
            scene.resizeHatchingLayout();
            oldTweens.forEach(tween => expect(tween.remove).toHaveBeenCalledTimes(1));
            expect(bounce.remove).toHaveBeenCalledTimes(1);
            expect(sparkle.remove).toHaveBeenCalledTimes(1);
            expect(rebound.remove).toHaveBeenCalledTimes(1);
            expect(scene.creatureIdleReactionTween).toBeNull();
            expect(scene.creature.scale).toBe(scene.getFirstContactLayout(false).creatureScale);
            expect(scene.creatureIdleTweens).toHaveLength(2);
        }
    });

    test('an energetic creature cannot bounce back to its pre-rotation position', () => {
        const scene = fixture();
        scene.creatureAppeared = true;
        scene.creature = item(128, 128);
        scene.creatureGenetics = { personality: { core: 'energetic' } };
        scene.tweens.add.mockImplementation(config => ({ config, remove: jest.fn() }));
        scene.resizeHatchingLayout();
        const portraitBounce = scene.creaturePersonalityTween;
        Object.assign(scene.scale, { width: 844, height: 390 });
        scene.resizeHatchingLayout();
        expect(portraitBounce.remove).toHaveBeenCalledTimes(1);
        expect(scene.creaturePersonalityTween.config.y).toBe(scene.getFirstContactLayout(false).creatureY - 5);
        expect(scene.creaturePersonalityTween.config.y).not.toBe(portraitBounce.config.y);
    });
});
