const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');
const GameObject = require('phaser/src/gameobjects/GameObject');
const source = fs.readFileSync(path.join(__dirname, '../../scenes/levels/MythicalForestLevel.js'), 'utf8');
const ast = parse(source, { sourceType: 'module' }).program.body;
const cls = ast.find(node => node.type === 'ClassDeclaration');
const constants = ast.filter(node => node.type === 'VariableDeclaration' &&
    ['FOREST_GUARDIAN_ATTACK_WINDOWS', 'FOREST_GUARDIAN_ATTACK_CUES', 'FOREST_GUARDIAN_ATTACK_PACING']
        .includes(node.declarations[0]?.id?.name)).map(node => source.slice(node.start, node.end)).join('\n');
const names = ['executeBossAttack', 'bossAITick', 'showForestBossRecovery', 'createForestBossTelegraph',
    'showBossAttackInstruction', 'bossRootSlam', 'bossVineWhip', 'bossSporeCloud', 'bossNatureFury',
    'addForestBossHazard', 'updateForestBossHazards', 'damageBoss', 'destroyForestBossTelegraph', 'clearForestBossPacing'];
const methods = cls.body.body.filter(node => names.includes(node.key?.name))
    .map(node => source.slice(node.start, node.end)).join(',\n');
const timingPath = path.join(__dirname, '../../scenes/controllers/ForestCombatTime.js');
let ForestCombatTime;
if (fs.existsSync(timingPath)) {
    const timingSource = fs.readFileSync(timingPath, 'utf8');
    const timingClass = parse(timingSource, { sourceType: 'module' }).program.body
        .map(node => node.declaration || node).find(node => node.type === 'ClassDeclaration');
    ForestCombatTime = new Function(`return (${timingSource.slice(timingClass.start, timingClass.end)});`)();
}

// Installed bodies, native time, tweens and destruction. Graphics, optional
// services and damage delivery are inert; no Game, renderer or audio runs.
function fixture() {
    const scene = new Function('ForestCombatTime', 'window', `${constants}\nreturn ({${methods}});`)(ForestCombatTime, {});
    Object.assign(scene, { events: new EventEmitter(), scene: {},
        sys: { scale: { width: 8000, height: 1200 }, isActive: () => true, queueDepthSort() {} },
        cameras: { main: { width: 390, height: 844, worldView: { y: 260 } } }, levelHeight: 1200 });
    scene.sys.events = scene.events;
    const systems = scene.sys, events = scene.events;
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    const objects = [];
    const object = (x = 0, y = 0) => {
        const value = new GameObject(scene, 'SyntheticForestObject');
        Object.assign(value, { x, y, width: 40, height: 60, displayWidth: 40, displayHeight: 60,
            originX: 0.5, originY: 0.5, displayOriginX: 20, displayOriginY: 30,
            scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0 });
        value.setPosition = (px, py) => { value.x = px; value.y = py; return value; };
        value.getCenter = () => ({ x: value.x, y: value.y });
        for (const name of ['clear', 'lineStyle', 'strokeCircle', 'lineBetween', 'fillStyle', 'fillCircle',
            'fillTriangle', 'fillRoundedRect', 'fillRect', 'strokeRect', 'setDepth', 'setOrigin',
            'setScrollFactor', 'setTint', 'clearTint', 'setColor', 'setFlipX']) value[name] = jest.fn(() => value);
        value.setAlpha = alpha => { value.alpha = alpha; return value; };
        value.setScale = scale => { value.scaleX = value.scaleY = scale; return value; };
        value.setAngle = angle => { value.angle = angle; return value; };
        value.setText = text => { value.text = text; return value; };
        value.setVelocityX = xVelocity => { value.body.setVelocityX(xVelocity); return value; };
        objects.push(value);
        return value;
    };
    const actor = (x = 5700, y = 1070) => {
        const value = object(x, y); value.body = new Body(world, value); world.add(value.body); return value;
    };
    const clock = scene.time = new Clock(scene), tweens = scene.tweens = new TweenManager(scene);
    scene.physics = { world, pause: () => world.pause(), resume: () => world.resume() };
    scene.add = { graphics: () => object() };
    Object.assign(scene, { boss: actor(5800), player: actor(), bossFightActive: true,
        bossEntranceComplete: true, bossHealth: 18, bossMaxHealth: 18, bossPhase: 1,
        bossPhaseAttackCount: 1, forestBossNextHitAt: 0, forestRecoveryDamage: 0, forestBossHits: 0,
        forestBossAttackIndex: 0, bossHazards: new Set(), bossTelegraphs: new Set(),
        getForestArenaFloor: () => ({ top: 1100 }), bossInstructionText: object(),
        updateBossHealthBar: jest.fn(), requestForestBossPhase2: jest.fn(), onBossDefeated: jest.fn(),
        showPlatformerMobileControls: jest.fn(), handlePlayerDamage: jest.fn() });
    return { scene, clock, tweens, world, actor, objects,
        advance(delta) {
            clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate();
            tweens.getDelta = () => delta; tweens.step(true);
        },
        run(duration) {
            for (let remaining = duration; remaining > 0;) {
                const delta = Math.min(16, remaining); this.advance(delta); remaining -= delta;
            }
        },
        close() {
            scene.pauseMenuSession?.retire(); scene.sys = systems; scene.events = events;
            events.emit('shutdown'); scene.clearForestBossPacing({ includePhase: true });
            tweens.destroy(); clock.destroy(); objects.forEach(value => value.destroy()); world.shutdown();
        }
    };
}
module.exports = { fixture, ForestCombatTime };
