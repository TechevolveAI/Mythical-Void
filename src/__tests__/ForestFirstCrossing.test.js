const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const ArcadeWorld = require('phaser/src/physics/arcade/World');
const ArcadeBody = require('phaser/src/physics/arcade/Body');
const ArcadeStaticBody = require('phaser/src/physics/arcade/StaticBody');
const EventEmitter = require('eventemitter3');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');

const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'), 'utf8');
const baseSource = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const tree = parse(source, { sourceType: 'module' }).program.body;
const declaration = tree.find(node => node.type === 'ClassDeclaration');
const baseDeclaration = parse(baseSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const constants = {};
for (const statement of tree.filter(node => node.type === 'VariableDeclaration')) {
    for (const node of statement.declarations) {
        if (['ROOTWAKE_PLATFORM_CONFIGS', 'ROOTWAKE_RECOVERY_CONFIG', 'FOREST_ROOTWAKE_VERSION', 'FOREST_ROOTWAKE_STATE_PATH'].includes(node.id.name)) {
            constants[node.id.name] = new Function(`return ${source.slice(node.init.start, node.init.end)}`)();
        }
    }
}

function method(name, dependencies, base = false) {
    const node = (base ? baseDeclaration : declaration).body.body.find(n => n.key?.name === name);
    const text = base ? baseSource : source;
    return new Function(...Object.keys(dependencies), `return ({${text.slice(node.start, node.end)}}).${name};`)(...Object.values(dependencies));
}

function graphic(x = 0, y = 0) {
    const g = { x, y, alpha: 1, active: true, data: {} };
    for (const name of ['clear', 'setDepth', 'setVisible', 'setScale', 'fillStyle', 'lineStyle', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fillPath', 'strokePath', 'fillEllipse', 'fillTriangle', 'fillCircle', 'strokeCircle']) {
        g[name] = jest.fn(() => g);
    }
    g.setPosition = jest.fn((px, py) => { g.x = px; g.y = py; return g; });
    g.setAlpha = jest.fn(alpha => { g.alpha = alpha; return g; });
    g.setData = jest.fn((key, value) => { g.data[key] = value; return g; });
    g.destroy = jest.fn(() => { g.active = false; });
    return g;
}

function fixture({ saved = null, reduced = false, systemReduced = false, nativeTiming = false } = {}) {
    const savedValues = { [constants.FOREST_ROOTWAKE_STATE_PATH]: saved, 'settings.reducedMotion': reduced };
    const gameState = {
        get: jest.fn(key => savedValues[key]),
        set: jest.fn((key, value) => { savedValues[key] = value; }),
        save: jest.fn()
    };
    const profile = { color: 0x8FE3CF, affinityPower: { id: 'synthetic-power' } };
    const dependencies = {
        ...constants,
        window: {
            GameState: gameState,
            matchMedia: () => ({ matches: systemReduced }),
            AudioManager: { playAchievement: jest.fn() },
            AchievementSystem: { recordEvent: jest.fn() }
        },
        buildCreaturePowerProfile: jest.fn(() => profile),
        recordCreaturePowerEvent: jest.fn()
    };
    const timers = [];
    const tweens = [];
    const supports = [
        { traversalId: 'forest-ground-1', body: { enable: true, left: 0, right: 400, top: 1100, bottom: 1120, width: 400 } },
        { traversalId: 'forest-ground-2', body: { enable: true, left: 900, right: 1100, top: 1100, bottom: 1120, width: 200 } }
    ];
    const scene = {
        levelHeight: 1200, rootwakeSequenceActive: false, rootwakeElements: [], rootwakeGravityWeather: [],
        isGrounded: true, isInvincible: false, recoveryInputLockedUntil: 0, platformerControlsVisible: true,
        scene: { isActive: jest.fn(() => true) },
        children: { remove: jest.fn() },
        time: { now: 1000, delayedCall: jest.fn((delay, callback) => {
            const timer = { delay, callback, remove: jest.fn() }; timers.push(timer); return timer;
        }) },
        tweens: {
            add: jest.fn(config => { tweens.push(config); return config; }),
            killTweensOf: jest.fn()
        },
        physics: {
            world: { isPaused: false },
            add: {
                existing: jest.fn(zone => {
                    zone.body = { enable: true, left: zone.x - zone.width / 2, right: zone.x + zone.width / 2,
                        top: zone.y - zone.height / 2, bottom: zone.y + zone.height / 2, width: zone.width,
                        checkCollision: { up: true, down: true, left: true, right: true } };
                }), overlap: jest.fn()
            }
        },
        add: { graphics: () => graphic(), zone: (x, y, width, height) => Object.assign(graphic(x, y), { width, height }) },
        platforms: { add: zone => supports.push(zone) },
        getTraversalSupport: id => supports.find(support => support.traversalId === id),
        createObjectiveTriggerZone: () => graphic(),
        player: Object.assign(graphic(350, 1060), {
            body: { left: 334, right: 366, bottom: 1100, velocity: { x: 200, y: 0 }, blocked: { down: true } },
            setVelocityX: jest.fn(), setVelocityY: jest.fn(), setTint: jest.fn(), clearTint: jest.fn()
        }),
        cameras: { main: { pan: jest.fn(), shake: jest.fn(), setZoom: jest.fn(), stopFollow: jest.fn() } },
        hidePlatformerMobileControls: jest.fn(), showPlatformerMobileControls: jest.fn(),
        drawRootwakeWorldState: jest.fn(), startRootwakeGravityWeather: jest.fn(),
        syncCampaignObjectiveDisplay: jest.fn()
    };
    let clock, tweenManager;
    if (nativeTiming) {
        scene.sys = { events: new EventEmitter() };
        clock = scene.time = new Clock(scene);
        clock.now = 1000;
        const delayedCall = clock.delayedCall.bind(clock);
        clock.delayedCall = (delay, callback) => {
            const timer = delayedCall(delay, callback); timers.push(timer); return timer;
        };
        tweenManager = scene.tweens = new TweenManager(scene);
        const add = tweenManager.add.bind(tweenManager);
        tweenManager.add = config => { tweens.push(config); return add(config); };
    }
    for (const name of ['createRootwakeCrossing', 'createRootwakeRecoveryBranch', 'isRootwakeMotionReduced',
        'drawRootwakePlatform', 'configureForestClimbSupport', 'detachForestPhysicsSupport', 'awakenRootwakeCrossing',
        'showRootwakeContactTravel', 'clearRootwakeSequence', 'updateRootwakeCrossing']) {
        scene[name] = method(name, dependencies).bind(scene);
    }
    scene.isPlayerSettledOnTraversalSupport = method('isPlayerSettledOnTraversalSupport', dependencies, true).bind(scene);
    scene.createRootwakeCrossing();
    return { scene, crossing: scene.rootwakeCrossing, gameState, dependencies, timers, tweens, supports, clock, tweenManager };
}

// Actual installed Arcade integration/separation, with no Phaser Game or Scene.
// Drawing and human input remain doubles; native timing can be enabled separately.
function physicsFixture({ awakened = true, width = 32, height = 44, x = 350, bottom = 1099,
    reduced = true, nativeTiming = false } = {}) {
    const result = fixture({ saved: awakened ? { version: 1, awakened: true } : null, reduced, nativeTiming });
    const { scene, supports } = result;
    const world = new ArcadeWorld({ sys: { scale: { width: 8000, height: scene.levelHeight } } },
        { gravity: { y: 500 }, debug: false });
    for (const support of supports) {
        const geometry = support.body;
        const enabled = geometry.enable;
        Object.assign(support, { x: (geometry.left + geometry.right) / 2, y: (geometry.top + geometry.bottom) / 2,
            width: geometry.right - geometry.left, height: geometry.bottom - geometry.top,
            displayWidth: geometry.right - geometry.left, displayHeight: geometry.bottom - geometry.top,
            originX: 0.5, originY: 0.5 });
        const body = new ArcadeStaticBody(world, support);
        world.add(body);
        body.enable = enabled;
        support.body = body;
        if (support.platformType === 'one-way') scene.configureForestClimbSupport(support);
    }
    const player = scene.player;
    Object.assign(player, { x, y: bottom - height / 2, width, height, displayWidth: width, displayHeight: height,
        originX: 0.5, originY: 0.5, displayOriginX: width / 2, displayOriginY: height / 2,
        scaleX: 1, scaleY: 1, angle: 0, rotation: 0 });
    player.body = new ArcadeBody(world, player);
    player.body.setSize(width, height, false);
    player.body.setDrag(100, 0);
    world.add(player.body);
    player.setVelocityX.mockImplementation(value => { player.body.setVelocityX(value); return player; });
    player.setVelocityY.mockImplementation(value => { player.body.setVelocityY(value); return player; });
    scene.physics.world = world;
    scene.platforms.getChildren = () => supports;
    scene.isPassThroughPlatform = method('isPassThroughPlatform', result.dependencies, true).bind(scene);
    scene.shouldProcessPlatformCollision = method('shouldProcessPlatformCollision', result.dependencies, true).bind(scene);
    const contacts = [];
    world.addCollider(player, supports, (_player, support) => {
        if (player.body.touching.down) contacts.push({ id: support.traversalId, x: player.body.center.x,
            bottom: player.body.bottom, surfaceTop: support.body.top });
    }, scene.shouldProcessPlatformCollision, scene);
    let elapsed = 0;
    return { ...result, world, contacts,
        step(delta) {
            elapsed += delta;
            if (result.clock) {
                result.clock.preUpdate(); result.clock.update(1000 + elapsed, delta); result.clock.preUpdate();
            } else scene.time.now += delta;
            world.update(elapsed, delta);
            world.postUpdate();
            if (result.tweenManager) {
                result.tweenManager.getDelta = () => delta;
                result.tweenManager.step(true);
            }
            scene.isGrounded = player.body.blocked.down || player.body.touching.down;
        },
        close() { result.tweenManager?.destroy(); result.clock?.destroy(); world.shutdown(); }
    };
}

const CADENCES = [
    ['60fps', [1000 / 60]], ['30fps', [1000 / 30]], ['15fps', [1000 / 15]],
    ['intermittent-100ms-stall', [1000 / 60, 1000 / 60, 100]]
];

describe('normal first approach with installed Arcade, Clock and TweenManager', () => {
    test.each(CADENCES.flatMap(([name, deltas]) => [22, 32].map(width =>
        [`${name}:${width}px`, deltas, width])))(
        'walking into %s raises visible, collidable roots without calling the activation directly', (_name, deltas, width) => {
            const simulation = physicsFixture({ awakened: false, x: 275, width,
                height: width === 22 ? 30 : 44, reduced: false, nativeTiming: true });
            const { scene, crossing, gameState, dependencies } = simulation;
            let sawFormingSurface = false, sawSettledBeforeFinish = false;
            try {
                expect(crossing.state).toBe('dormant');
                for (let frame = 0; frame < 240 && !crossing.awakened; frame++) {
                    scene.player.setVelocityX(200);
                    simulation.step(deltas[frame % deltas.length]);
                    scene.updateRootwakeCrossing();
                    if (scene.player.x < 326) expect(crossing.state).toBe('dormant');
                    for (const platform of crossing.platforms) {
                        if (platform.visual.alpha > 0 && platform.visual.alpha < 1) {
                            sawFormingSurface = true;
                            expect(platform.zone.body.enable).toBe(false);
                        }
                        if (platform.zone.body.enable) {
                            expect(platform.visual.alpha).toBe(1);
                            expect(platform.visual.y - 10).toBeCloseTo(platform.zone.body.top, 6);
                            if (!crossing.awakened) sawSettledBeforeFinish = true;
                        }
                    }
                }
                expect(crossing.state).toBe('awake');
                expect(sawFormingSurface).toBe(true);
                expect(sawSettledBeforeFinish).toBe(true);
                expect(crossing.platforms.every(platform => platform.settled && platform.zone.body.enable)).toBe(true);
                expect(crossing.contactTrace.lineTo).toHaveBeenCalled();
                expect(scene.player.body.bottom).toBeLessThanOrEqual(crossing.recovery.top + 0.001);
                expect(scene.hidePlatformerMobileControls).not.toHaveBeenCalled();
                expect(scene.recoveryInputLockedUntil).toBe(0);
                expect(gameState.save).toHaveBeenCalledTimes(1);
                expect(dependencies.recordCreaturePowerEvent).toHaveBeenCalledTimes(1);
            } finally { simulation.close(); }
        }
    );

    test.each(CADENCES)('landing on the lower branch at %s still opens the route', (_name, deltas) => {
        const simulation = physicsFixture({ awakened: false, x: 650, bottom: 1100,
            reduced: false, nativeTiming: true });
        const { scene, crossing, gameState } = simulation;
        try {
            scene.player.setVelocityX(0);
            scene.isGrounded = false;
            for (let frame = 0; frame < 240 && !crossing.awakened; frame++) {
                simulation.step(deltas[frame % deltas.length]);
                scene.updateRootwakeCrossing();
            }
            expect(simulation.contacts.some(contact => contact.id === crossing.recovery.id)).toBe(true);
            expect(crossing.state).toBe('awake');
            expect(scene.player.body.bottom).toBeCloseTo(crossing.recovery.top, 6);
            expect(gameState.save).toHaveBeenCalledTimes(1);
        } finally { simulation.close(); }
    });

    test('the normal update waits for the field drill, then opens without another input', () => {
        const simulation = physicsFixture({ awakened: false, reduced: false, nativeTiming: true });
        const { scene, crossing, gameState } = simulation;
        try {
            scene.firstExpeditionDrill = { active: true };
            scene.player.setVelocityX(0);
            for (let frame = 0; frame < 60; frame++) {
                simulation.step(1000 / 60); scene.updateRootwakeCrossing();
            }
            expect(crossing.state).toBe('dormant');
            scene.firstExpeditionDrill.active = false;
            for (let frame = 0; frame < 120 && !crossing.awakened; frame++) {
                simulation.step(1000 / 60); scene.updateRootwakeCrossing();
            }
            expect(crossing.state).toBe('awake');
            expect(gameState.save).toHaveBeenCalledTimes(1);
        } finally { simulation.close(); }
    });
});

describe('first crossing with installed Arcade Physics', () => {
    test.each(CADENCES.flatMap(([name, deltas]) => [-1, 1].flatMap(direction => [22, 32].map(width =>
        [`${name}:${direction < 0 ? 'right-bank' : 'left-bank'}:${width}px`, deltas, direction, width]))))(
        'walking off %s lands and stays on the recovery branch', (_name, deltas, direction, width) => {
            const simulation = physicsFixture({ awakened: false, width, height: width === 22 ? 30 : 44,
                x: direction > 0 ? 350 : 950 });
            const { scene, crossing, contacts } = simulation;
            try {
                for (let frame = 0; frame < 240 && !contacts.some(contact => contact.id === crossing.recovery.id); frame++) {
                    scene.player.setVelocityX(direction * 200);
                    simulation.step(deltas[frame % deltas.length]);
                }
                const landing = contacts.find(contact => contact.id === crossing.recovery.id);
                expect(landing).toBeDefined();
                expect(landing.bottom).toBeCloseTo(crossing.recovery.top, 6);
                scene.player.setVelocityX(0);
                for (let frame = 0; frame < 60; frame++) simulation.step(deltas[frame % deltas.length]);
                expect(scene.player.body.bottom).toBeCloseTo(crossing.recovery.top, 6);
                expect(crossing.platforms.every(platform => platform.zone.body.enable === false)).toBe(true);
            } finally { simulation.close(); }
        }
    );

    test.each(CADENCES.flatMap(([name, deltas]) => [-1, 1].map(direction =>
        [`${name}:${direction < 0 ? 'left-bank' : 'right-bank'}`, deltas, direction])))(
        'a normal jump can leave recovery for %s', (_name, deltas, direction) => {
            const simulation = physicsFixture({ awakened: false, x: 650, bottom: 1136 });
            const { scene, contacts } = simulation;
            const targetId = direction < 0 ? 'forest-ground-1' : 'forest-ground-2';
            const targetX = direction < 0 ? 350 : 1000;
            try {
                scene.player.setVelocityY(-450);
                for (let frame = 0; frame < 300 && !contacts.some(contact => contact.id === targetId); frame++) {
                    const distance = targetX - scene.player.body.center.x;
                    scene.player.setVelocityX(Math.abs(distance) < 12 ? 0 : Math.sign(distance) * 200);
                    simulation.step(deltas[frame % deltas.length]);
                }
                expect(contacts.some(contact => contact.id === targetId && Math.abs(contact.bottom - 1100) < 0.001)).toBe(true);
            } finally { simulation.close(); }
        }
    );

    const route = [['forest-ground-1', 350], ['rootwake-step-1', 438], ['rootwake-step-2', 548],
        ['rootwake-step-3', 672], ['rootwake-step-4', 800], ['rootwake-step-5', 900], ['forest-ground-2', 1000]];
    test.each(CADENCES.flatMap(([name, deltas]) => [-1, 1].map(direction =>
        [`${name}:${direction < 0 ? 'return' : 'outward'}`, deltas, direction])))(
        'the settled upper route is physically traversable %s', (_name, deltas, direction) => {
            const ordered = direction > 0 ? route : [...route].reverse();
            for (let index = 1; index < ordered.length; index++) {
                const simulation = physicsFixture();
                const { scene, supports, contacts } = simulation;
                const from = supports.find(support => support.traversalId === ordered[index - 1][0]);
                const targetId = ordered[index][0], targetX = ordered[index][1];
                try {
                    scene.player.setPosition(ordered[index - 1][1], from.body.top - scene.player.body.height / 2);
                    scene.player.body.updateFromGameObject();
                    scene.player.setVelocityY(-450);
                    for (let frame = 0; frame < 300 && !contacts.some(contact => contact.id === targetId); frame++) {
                        const distance = targetX - scene.player.body.center.x;
                        scene.player.setVelocityX(Math.abs(distance) < 12 ? 0 : Math.sign(distance) * 200);
                        simulation.step(deltas[frame % deltas.length]);
                    }
                    expect({ from: ordered[index - 1][0], target: targetId, landed: contacts.some(contact => contact.id === targetId) })
                        .toEqual({ from: ordered[index - 1][0], target: targetId, landed: true });
                } finally { simulation.close(); }
            }
        }
    );
});

test('new crossing keeps every forming upper surface non-collidable and invisible', () => {
    const { crossing } = fixture();
    expect(crossing.state).toBe('dormant');
    expect(crossing.platforms).toHaveLength(5);
    for (const platform of crossing.platforms) {
        expect(platform.zone.body.enable).toBe(false);
        expect(platform.visual.alpha).toBe(0);
        expect(platform.settled).toBe(false);
    }
});

test('lower branch covers the full first gap, overlaps both banks and cannot drop through', () => {
    const { crossing } = fixture();
    const { zone, visual, top, width } = crossing.recovery;
    expect(zone.body.enable).toBe(true);
    expect(zone.platformType).toBe('solid');
    expect(zone.body.checkCollision).toEqual({ up: true, down: true, left: true, right: true });
    expect(zone.body.left).toBeLessThanOrEqual(400 - 16);
    expect(zone.body.right).toBeGreaterThanOrEqual(900 + 16);
    expect(top).toBe(1136);
    expect(visual.y - 10).toBe(zone.body.top);
    expect(visual.moveTo).toHaveBeenCalledWith(-width / 2, -10);
    expect(visual.lineTo).toHaveBeenCalledWith(width / 2, -10);
    expect(zone.traversalLinks).toEqual(['forest-ground-1', 'rootwake-step-1', 'forest-ground-2']);
});

test('holding down cannot disable the recovery branch collision', () => {
    const { scene, crossing, dependencies } = fixture();
    scene.isPassThroughPlatform = method('isPassThroughPlatform', dependencies, true).bind(scene);
    scene.platformDropThroughUntil = 2000;
    scene.platformDropSource = null;
    const process = method('shouldProcessPlatformCollision', dependencies, true).bind(scene);
    expect(process(scene.player, crossing.platforms[0].zone)).toBe(false);
    expect(process(scene.player, crossing.recovery.zone)).toBe(true);
});

test('authored movement can leave the lower branch at either bank and traverse the upper route both ways', () => {
    const text = fs.readFileSync(path.join(__dirname, '../systems/TraversalTopology.js'), 'utf8');
    const moduleBody = parse(text, { sourceType: 'module' }).program.body
        .filter(node => !node.type.startsWith('Export')).map(node => text.slice(node.start, node.end)).join('\n');
    const { calculateJumpEnvelope, canTraverseSupport } = new Function(`${moduleBody}\nreturn { calculateJumpEnvelope, canTraverseSupport };`)();
    const ctor = declaration.body.body.find(node => node.kind === 'constructor');
    const superCall = ctor.body.body.find(node => node.expression?.callee?.type === 'Super').expression;
    const config = new Function(`return ${source.slice(superCall.arguments[0].start, superCall.arguments[0].end)}`)();
    const envelope = calculateJumpEnvelope({ gravityY: 500, ...config.movement });
    const { supports, crossing } = fixture();
    const geometry = supports.map(support => ({
        ...support.body, id: support.traversalId, type: support.platformType || 'solid'
    }));
    const recovery = geometry.find(support => support.id === crossing.recovery.id);
    const upper = ['forest-ground-1', ...crossing.platforms.map(platform => platform.id), 'forest-ground-2']
        .map(id => geometry.find(support => support.id === id));
    for (const bank of [upper[0], upper[upper.length - 1]]) {
        expect(canTraverseSupport(recovery, bank, envelope, { obstacles: geometry })).toBe(true);
    }
    // Enter recovery by walking off either bank, not by jumping through the
    // upper steps. The flight solver above models full jumps, not walk-offs.
    const fallTime = Math.sqrt(2 * (recovery.top - upper[0].top) / envelope.gravity);
    const drift = config.movement.playerSpeed * fallTime;
    for (const landingX of [upper[0].right + 18 + drift, upper[upper.length - 1].left - 18 - drift]) {
        expect(landingX - 18).toBeGreaterThan(recovery.left);
        expect(landingX + 18).toBeLessThan(recovery.right);
    }
    for (let index = 1; index < upper.length; index += 1) {
        expect(canTraverseSupport(upper[index - 1], upper[index], envelope, { obstacles: geometry })).toBe(true);
        expect(canTraverseSupport(upper[index], upper[index - 1], envelope, { obstacles: geometry })).toBe(true);
    }
});

test.each(['airborne', 'jumping', 'wrong-height', 'outside-area', 'dead', 'paused', 'inactive', 'complete'])('does not begin from %s', condition => {
    const { scene, crossing } = fixture();
    if (condition === 'airborne') { scene.isGrounded = false; scene.player.body.blocked.down = false; }
    if (condition === 'jumping') scene.player.body.velocity.y = -450;
    if (condition === 'wrong-height') scene.player.body.bottom = 750;
    if (condition === 'outside-area') scene.player.x = 180;
    if (condition === 'dead') scene.isPlayerDead = true;
    if (condition === 'paused') scene.physics.world.isPaused = true;
    if (condition === 'inactive') scene.scene.isActive.mockReturnValue(false);
    if (condition === 'complete') scene.levelCompletionActive = true;
    expect(scene.awakenRootwakeCrossing()).toBe(false);
    expect(crossing.state).toBe('dormant');
    expect(crossing.trigger.active).toBe(true);
});

test('an approach uses the current creature and does not take over movement, camera or protection', () => {
    const { scene, crossing, dependencies } = fixture();
    dependencies.buildCreaturePowerProfile.mockReturnValue({ color: 0xEEAA22, affinityPower: { id: 'switched-creature' } });
    expect(scene.awakenRootwakeCrossing()).toBe(true);
    expect(crossing.color).toBe(0xEEAA22);
    expect(crossing.state).toBe('awakening');
    expect(scene.awakenRootwakeCrossing()).toBe(false);
    expect(scene.player.setVelocityX).not.toHaveBeenCalled();
    expect(scene.player.setVelocityY).not.toHaveBeenCalled();
    expect(scene.player.setTint).not.toHaveBeenCalled();
    expect(scene.recoveryInputLockedUntil).toBe(0);
    expect(scene.isInvincible).toBe(false);
    expect(scene.hidePlatformerMobileControls).not.toHaveBeenCalled();
    for (const action of Object.values(scene.cameras.main)) expect(action).not.toHaveBeenCalled();
});

test('walking along recovery after missing the approach still opens the crossing', () => {
    const { scene, crossing } = fixture();
    Object.assign(scene.player, { x: 650, y: 1096 });
    Object.assign(scene.player.body, { left: 634, right: 666, bottom: 1136 });
    expect(scene.updateRootwakeCrossing()).toBe(true);
    expect(crossing.state).toBe('awakening');
});

test('contact travels from the actual creature feet into successive landing branches', () => {
    const { scene, crossing, tweens } = fixture();
    scene.awakenRootwakeCrossing();
    const travel = tweens.find(tween => tween.targets === crossing.contactProgress);
    crossing.contactProgress.edge = 2;
    travel.onUpdate();
    expect(crossing.contactTrace.moveTo).toHaveBeenLastCalledWith(350, 1100);
    expect(crossing.contactTrace.lineTo.mock.calls).toEqual([[382, 1100], [438, crossing.platforms[0].targetY + 8]]);
});

test('upper collision is enabled only once its matching visible top is settled', () => {
    const { scene, crossing, tweens } = fixture();
    scene.awakenRootwakeCrossing();
    const first = crossing.platforms[0];
    const animation = tweens.find(tween => tween.targets === first.visual);
    expect(first.zone.body.enable).toBe(false);
    animation.onComplete();
    expect(first.zone.body.enable).toBe(true);
    expect(first.settled).toBe(true);
    expect(first.visual.alpha).toBe(1);
    expect(first.visual.y - 10).toBe(first.zone.body.top);
    expect(crossing.platforms[1].zone.body.enable).toBe(false);
});

test.each([{ reduced: true }, { systemReduced: true }])('reduced motion is immediately playable without animation: %j', settings => {
    const { scene, crossing, tweens, timers, gameState, dependencies } = fixture(settings);
    expect(scene.awakenRootwakeCrossing()).toBe(true);
    expect(crossing.state).toBe('awake');
    expect(crossing.platforms.every(platform => platform.zone.body.enable && platform.settled)).toBe(true);
    expect(tweens).toHaveLength(0);
    expect(timers).toHaveLength(0);
    expect(gameState.save).toHaveBeenCalledTimes(1);
    expect(method('startRootwakeGravityWeather', dependencies).call(scene)).toBe(false);
});

test('clock fallback finishes cancelled tweens, saves once and keeps old storage contract', () => {
    const { scene, crossing, timers, tweens, gameState, dependencies } = fixture();
    scene.awakenRootwakeCrossing();
    const complete = crossing.completeAwakening;
    const firstTween = tweens.find(tween => tween.targets === crossing.platforms[0].visual);
    scene.time.now = 2749;
    expect(scene.updateRootwakeCrossing()).toBe(false);
    scene.time.now = 2750;
    expect(scene.updateRootwakeCrossing()).toBe(true);
    expect(crossing.state).toBe('awake');
    for (const platform of crossing.platforms) {
        expect(platform.zone.body.enable).toBe(true);
        expect(platform.visual.y - 10).toBe(platform.zone.body.top);
        expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(platform.visual);
    }
    expect(timers[0].remove).toHaveBeenCalled();
    expect(complete()).toBe(false);
    firstTween.onComplete();
    expect(gameState.save).toHaveBeenCalledTimes(1);
    expect(gameState.set).toHaveBeenCalledWith('story.projectBeacon.forestRootwakeCrossing', {
        version: 1, awakened: true, awakenedAt: expect.any(String),
        action: 'creature_resonance_slam', phenomenon: 'gravity_seed_rain_rises', worldChange: 'five_layer_crossing_raised'
    });
    expect(dependencies.recordCreaturePowerEvent).toHaveBeenCalledTimes(1);
});

test('pause cannot complete a crossing; resuming finishes safely once', () => {
    const { scene, crossing, gameState } = fixture();
    scene.awakenRootwakeCrossing();
    scene.time.now = 4000;
    scene.physics.world.isPaused = true;
    expect(crossing.completeAwakening()).toBe(false);
    expect(scene.updateRootwakeCrossing()).toBe(false);
    expect(gameState.save).not.toHaveBeenCalled();
    scene.physics.world.isPaused = false;
    expect(scene.updateRootwakeCrossing()).toBe(true);
    expect(gameState.save).toHaveBeenCalledTimes(1);
});

test('cleanup and scene replacement reject every stale completion callback', () => {
    const { scene, crossing, timers, tweens, gameState } = fixture();
    scene.awakenRootwakeCrossing();
    const complete = crossing.completeAwakening;
    const platformTween = tweens.find(tween => tween.targets === crossing.platforms[0].visual);
    scene.clearRootwakeSequence();
    expect(complete()).toBe(false);
    scene.rootwakeSequenceActive = true;
    scene.rootwakeCrossing = { state: 'awakening' };
    platformTween.onComplete();
    expect(complete()).toBe(false);
    expect(crossing.platforms[0].zone.body.enable).toBe(false);
    expect(gameState.save).not.toHaveBeenCalled();
    expect(timers[0].remove).toHaveBeenCalled();
    expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(crossing.contactProgress);
});

test('an existing awakened save restores every branch without replay or another write', () => {
    const { scene, crossing, gameState, timers } = fixture({ saved: { version: 1, awakened: true } });
    expect(crossing.state).toBe('awake');
    expect(crossing.platforms.every(platform => platform.settled && platform.zone.body.enable)).toBe(true);
    expect(crossing.recovery.zone.body.enable).toBe(true);
    expect(scene.awakenRootwakeCrossing()).toBe(false);
    expect(timers).toHaveLength(0);
    expect(gameState.save).not.toHaveBeenCalled();
});

test('private non-persisting proof leaves saved progression alone', () => {
    const { scene, crossing, gameState, dependencies } = fixture();
    scene.awakenRootwakeCrossing({ persist: false });
    crossing.completeAwakening();
    expect(gameState.set).not.toHaveBeenCalled();
    expect(gameState.save).not.toHaveBeenCalled();
    expect(dependencies.recordCreaturePowerEvent).not.toHaveBeenCalled();
});
