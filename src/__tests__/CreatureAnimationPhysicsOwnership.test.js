const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../systems/CreatureAnimationController.js'), 'utf8');
const scope = { module: { exports: {} }, window: {}, console: { log() {}, warn() {} } };
vm.runInNewContext(source.replace('export default CreatureAnimationController;', ''), scope);
const CreatureAnimationController = scope.module.exports;

function harness(physics = true) {
    const configs = [];
    const add = config => { configs.push(config); return { stop() {} }; };
    const scene = {
        tweens: { add, chain: add },
        time: { addEvent: () => ({ remove() {} }) }
    };
    const sprite = { x: 100, y: 200, scaleX: 1, scaleY: 1, angle: 0, body: physics ? {} : null };
    return { controller: new CreatureAnimationController(scene, sprite, {}), sprite, configs };
}

describe('real creature animations respect physics position ownership', () => {
    test.each([
        'yawn', 'excited_bounce', 'sad_droop', 'look_around', 'head_tilt',
        'bounce', 'spin', 'wiggle', 'slow_blink', 'stretch', 'shiver',
        'contemplate', 'nuzzle', 'sniff', 'slow_nod', 'tail_wag', 'sigh'
    ])('%s cannot move a physics-controlled creature or restore stale coordinates', behavior => {
        const { controller, sprite, configs } = harness();
        controller.triggerBehavior(behavior);
        expect(configs.length).toBeGreaterThan(1);
        for (const config of configs.flatMap(config => [config, ...(config.tweens || [])])) {
            expect(config).not.toHaveProperty('x');
            expect(config).not.toHaveProperty('y');
        }
        sprite.x = 1200;
        sprite.y = 1645;
        for (const config of configs) config.onComplete?.();
        expect({ x: sprite.x, y: sprite.y }).toEqual({ x: 1200, y: 1645 });
        controller.destroy();
    });

    test('a non-physics presentation sprite retains its positional bounce', () => {
        const { controller, configs } = harness(false);
        controller.triggerBehavior('bounce');
        expect(configs.at(-1).y).toBe(188);
        controller.destroy();
    });
});
