const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');

function fixture(reducedMotion = false) {
    const file = path.join(__dirname, '../systems/world/DecorativeFlags.js');
    const context = { module: { exports: {} }, matchMedia: () => ({ matches: reducedMotion }) };
    vm.runInNewContext(fs.readFileSync(file, 'utf8').replace(/export /g, '') +
        '\nmodule.exports = { drawFlagFabric, createDecorativeFlag, syncRescueWelcomeFlag, PALESTINIAN_FLAG_COLORS };', context);
    const scene = { events: new EventEmitter(), add: {} };
    scene.add.graphics = jest.fn(() => {
        const graphic = new EventEmitter();
        graphic.scene = scene; graphic.active = true; graphic.visible = true; graphic.alpha = 1;
        for (const method of ['setPosition', 'setDepth', 'setScrollFactor', 'setData', 'clear', 'fillStyle', 'fillPoints', 'lineStyle', 'lineBetween']) {
            graphic[method] = jest.fn(() => graphic);
        }
        graphic.destroy = jest.fn(() => { graphic.emit('destroy'); graphic.scene = null; graphic.active = false; });
        return graphic;
    });
    return { ...context.module.exports, scene };
}

describe('decorative flag Easter eggs', () => {
    test('keeps black, white, green bands and the red triangle at the hoist', () => {
        const { scene, drawFlagFabric, PALESTINIAN_FLAG_COLORS: colors } = fixture();
        const graphic = scene.add.graphics();
        drawFlagFabric(graphic, 32, 16);
        expect(graphic.fillStyle.mock.calls.map(call => call[0])).toEqual([colors.black, colors.white, colors.green, colors.red]);
        const triangle = graphic.fillPoints.mock.calls.at(-1)[0];
        expect(triangle[0]).toEqual({ x: 0, y: 0 });
        expect(triangle.at(-1)).toEqual({ x: 0, y: 16 });
        expect(Math.max(...triangle.map(point => point.x))).toBeCloseTo(14.4);
        expect(graphic.fillPoints).toHaveBeenCalledTimes(25);
    });

    test('flutter keeps the hoist fixed, with finite connected fabric at every phase', () => {
        const { scene, drawFlagFabric } = fixture();
        const graphic = scene.add.graphics();
        for (const phase of [0, 1, 2, 4, 8]) drawFlagFabric(graphic, 34, 17, phase);
        for (const [points] of graphic.fillPoints.mock.calls) {
            expect(points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
            expect(points.every(point => point.x >= 0 && point.x <= 34)).toBe(true);
        }
    });

    test('uses one non-interactive graphic, throttles redraws and ignores hidden decorations', () => {
        const { scene, createDecorativeFlag } = fixture();
        const flag = createDecorativeFlag(scene, { x: 10, y: 20 });
        expect(scene.add.graphics).toHaveBeenCalledTimes(1);
        expect(flag.input).toBeUndefined();
        expect(flag.body).toBeUndefined();
        scene.events.emit('update', 100);
        scene.events.emit('update', 150);
        expect(flag.clear).toHaveBeenCalledTimes(2);
        flag.alpha = 0;
        scene.events.emit('update', 300);
        expect(flag.clear).toHaveBeenCalledTimes(2);
    });

    test.each(['owner', 'scene', 'graphic'])('%s cleanup detaches every animation listener', trigger => {
        const { scene, createDecorativeFlag } = fixture();
        const owner = new EventEmitter();
        const flag = createDecorativeFlag(scene, { x: 10, y: 20, owner });
        if (trigger === 'owner') owner.emit('destroy');
        else if (trigger === 'scene') scene.events.emit('shutdown');
        else flag.destroy();
        expect(scene.events.listenerCount('update')).toBe(0);
        expect(scene.events.listenerCount('shutdown')).toBe(0);
        expect(owner.listenerCount('destroy')).toBe(0);
        scene.events.emit('shutdown');
        expect(flag.destroy).toHaveBeenCalledTimes(1);
    });

    test('respects reduced motion without adding an update listener', () => {
        const { scene, createDecorativeFlag } = fixture(true);
        createDecorativeFlag(scene, { x: 10, y: 20 });
        expect(scene.events.listenerCount('update')).toBe(0);
        expect(scene.events.listenerCount('shutdown')).toBe(1);
    });

    test('welcome decoration follows the existing rescue count without a new save field or duplicates', () => {
        const { scene, syncRescueWelcomeFlag } = fixture();
        const garden = { zone: Object.assign(new EventEmitter(), { x: 100, y: 200 }) };
        syncRescueWelcomeFlag(scene, garden, 0);
        expect(scene.add.graphics).not.toHaveBeenCalled();
        syncRescueWelcomeFlag(scene, garden, 1);
        const flag = garden.welcomeFlag;
        syncRescueWelcomeFlag(scene, garden, 6);
        expect(garden.welcomeFlag).toBe(flag);
        expect(scene.add.graphics).toHaveBeenCalledTimes(1);
        syncRescueWelcomeFlag(scene, garden, 0);
        expect(garden.welcomeFlag).toBeNull();
        expect(scene.events.listenerCount('update')).toBe(0);
    });
});
