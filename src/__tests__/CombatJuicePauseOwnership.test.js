const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../systems/CombatJuice.js'), 'utf8');
const CombatJuice = vm.runInNewContext(source.replace('export default class CombatJuice', 'class CombatJuice') + '\nCombatJuice;');

function setup() {
    let complete;
    const world = { isPaused: false, pause: jest.fn(), resume: jest.fn() };
    const scene = {
        physics: { world },
        scene: { isActive: () => true },
        time: { delayedCall: jest.fn((_duration, callback) => { complete = callback; }) }
    };
    const juice = new CombatJuice(scene);
    return { scene, world, juice, finish: () => complete() };
}

test('ordinary impact resumes its own pause once', () => {
    const { juice, world, finish } = setup();
    juice.hitStop(40);
    juice.hitStop(40);
    expect(world.pause).toHaveBeenCalledTimes(1);
    finish();
    expect(world.resume).toHaveBeenCalledTimes(1);
    expect(juice.hitStopActive).toBe(false);
});

test.each(['levelCompletionActive', 'pauseMenuActive', '_isShuttingDown'])('impact cannot resume a later %s state', flag => {
    const { juice, scene, world, finish } = setup();
    juice.hitStop(40);
    scene[flag] = true;
    finish();
    expect(world.resume).not.toHaveBeenCalled();
    expect(juice.hitStopActive).toBe(false);
});

test('impact does not claim a pre-existing pause', () => {
    const { juice, scene, world } = setup();
    world.isPaused = true;
    juice.hitStop();
    expect(world.pause).not.toHaveBeenCalled();
    expect(scene.time.delayedCall).not.toHaveBeenCalled();
});

test.each(['inactive', 'replaced', 'destroyed'])('impact cannot resume a %s world', state => {
    const { juice, scene, world, finish } = setup();
    juice.hitStop();
    if (state === 'inactive') scene.scene.isActive = () => false;
    if (state === 'replaced') scene.physics.world = {};
    if (state === 'destroyed') juice.scene = null;
    finish();
    expect(world.resume).not.toHaveBeenCalled();
});
