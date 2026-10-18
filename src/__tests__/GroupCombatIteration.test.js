const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
// Group's unused bulk-action and Sprite-factory imports pull browser device
// probes into jsdom. Fail closed if this fixture ever tries to use either.
jest.mock('phaser/src/actions/', () => new Proxy({}, { get() { throw Error('GROUP_BULK_ACTION_FORBIDDEN'); } }));
jest.mock('phaser/src/gameobjects/sprite/Sprite', () => function ForbiddenSprite() {
    throw Error('GROUP_SPRITE_FACTORY_FORBIDDEN');
});
const Group = require('phaser/src/gameobjects/group/Group');
const GameObject = require('phaser/src/gameobjects/GameObject');

const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const methods = Object.fromEntries(['performAttack', 'performSpecialAttack', 'damageEnemy', 'defeatEnemy'].map(name => {
    const node = cls.body.body.find(node => node.key?.name === name);
    return [name, new Function('window', 'Phaser', 'console', `return ({${source.slice(node.start, node.end)}}).${name};`)(
        {}, { Math: { Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) } } }, { log() {} }
    )];
}));

// Installed Phaser Group and GameObject destroy/remove events, with fake
// drawing/services. No Game/Scene, browser, audio, backend or saves are opened.
function fixture() {
    const updates = [];
    const scene = { ...methods, sys: { queueDepthSort() {}, updateList: { remove: jest.fn() } },
        player: { x: 100, y: 200, facingRight: true }, time: { now: 1000, delayedCall: jest.fn() },
        crystalEnergy: 5, maxCrystalEnergy: 5, freeSpecialAttackCharges: 0,
        katanaCombatProfile: { meleeDamage: 2, enemyMeleeRange: 70, bossMeleeRange: 80 },
        drawEnemyCombatCue: jest.fn(), disposeEnemyRuntime: jest.fn(), showEnemyCombatBlock: jest.fn(),
        showFloatingText: jest.fn(), onFreeSpecialAttackConsumed: jest.fn(),
        getBossCombatTarget: () => null, resolveBossHit: jest.fn(() => true),
        updateEnergyDisplay: jest.fn(() => updates.push(scene.crystalEnergy)),
        tweens: { add: jest.fn() }, add: { graphics() {
            const graphic = { destroy: jest.fn() };
            for (const name of ['fillStyle', 'fillCircle', 'setPosition', 'setDepth', 'lineStyle',
                'beginPath', 'arc', 'strokePath']) graphic[name] = () => graphic;
            return graphic;
        } }
    };
    scene.enemies = new Group(scene);
    const objects = [];
    function enemy({ x = 150, y = 200, health = 2, ...fields } = {}) {
        const object = new GameObject(scene, 'SyntheticEnemy');
        Object.assign(object, { x, y, health, setTint: jest.fn(), clearTint: jest.fn(), ...fields });
        scene.enemies.add(object); objects.push(object); return object;
    }
    return { scene, enemy, updates,
        attack(kind) { scene[kind === 'melee' ? 'performAttack' : 'performSpecialAttack'](); },
        close() { for (const object of objects) object.destroy(); scene.enemies.destroy(); } };
}

describe.each(['melee', 'blast'])('%s attacks use the group present at the start of the strike', kind => {
    test.each([2, 3, 6])('all %i nearby enemies are hit even as defeat removes them from the real Group', count => {
        const f = fixture();
        try {
            const enemies = Array.from({ length: count }, (_, index) => f.enemy({ x: 145 + index }));
            const live = f.scene.enemies.getChildren();
            f.attack(kind);
            expect(f.scene.enemies.getChildren()).toBe(live);
            expect(live).toHaveLength(0);
            expect(enemies.every(enemy => !enemy.active)).toBe(true);
            expect(f.scene.disposeEnemyRuntime).toHaveBeenCalledTimes(count);
            if (kind === 'blast') expect(f.updates[0]).toBe(2);
        } finally { f.close(); }
    });

    test('range, immunity and one Guardian hit retain their existing rules', () => {
        const f = fixture();
        try {
            const first = f.enemy(), immune = f.enemy({ combatImmune: true }), third = f.enemy();
            const distant = f.enemy({ x: 600 });
            f.scene.getBossCombatTarget = () => ({ x: 150, y: 200, active: true });
            f.attack(kind);
            expect(first.active).toBe(false); expect(third.active).toBe(false);
            expect(immune.active).toBe(true); expect(immune.health).toBe(2);
            expect(distant.active).toBe(true); expect(distant.health).toBe(2);
            expect(f.scene.showEnemyCombatBlock).toHaveBeenCalledTimes(1);
            expect(f.scene.resolveBossHit).toHaveBeenCalledTimes(1);
            expect(f.scene.resolveBossHit).toHaveBeenCalledWith(kind === 'melee' ? 2 : 3,
                { source: kind === 'melee' ? 'katana' : 'super_blast' });
        } finally { f.close(); }
    });

    test('a defeat callback cannot add a new target to the already-started attack', () => {
        const f = fixture();
        try {
            let spawned;
            const first = f.enemy({ onCombatDefeat: () => { first.destroy(); spawned = f.enemy(); } });
            const second = f.enemy(), third = f.enemy();
            f.attack(kind);
            expect([first, second, third].every(enemy => !enemy.active)).toBe(true);
            expect(spawned.active).toBe(true); expect(spawned.health).toBe(2);
            expect(f.scene.enemies.getChildren()).toEqual([spawned]);
        } finally { f.close(); }
    });

    test('a cascading defeat does not award the already-destroyed neighbour twice', () => {
        const f = fixture();
        try {
            const first = f.enemy({ onCombatDefeat: () => { first.destroy(); second.destroy(); } });
            const second = f.enemy(), third = f.enemy();
            f.attack(kind);
            expect([first, second, third].every(enemy => !enemy.active)).toBe(true);
            expect(f.scene.disposeEnemyRuntime).toHaveBeenCalledTimes(2);
        } finally { f.close(); }
    });
});

test('non-lethal melee still damages each target only once', () => {
    const f = fixture();
    try {
        const enemies = Array.from({ length: 4 }, () => f.enemy({ health: 5 }));
        f.attack('melee');
        expect(enemies.map(enemy => enemy.health)).toEqual([3, 3, 3, 3]);
        expect(f.scene.disposeEnemyRuntime).not.toHaveBeenCalled();
    } finally { f.close(); }
});

test('a free blast charge is spent once and normal energy is only replenished by defeats', () => {
    const f = fixture();
    try {
        f.scene.freeSpecialAttackCharges = 1; f.scene.crystalEnergy = 0;
        for (let index = 0; index < 4; index++) f.enemy();
        f.attack('blast');
        expect(f.scene.enemies.getChildren()).toHaveLength(0);
        expect(f.scene.freeSpecialAttackCharges).toBe(0);
        expect(f.scene.onFreeSpecialAttackConsumed).toHaveBeenCalledTimes(1);
        expect(f.updates).toEqual([0, 1, 2, 3, 4]);
        expect(f.scene.crystalEnergy).toBe(4);
    } finally { f.close(); }
});
