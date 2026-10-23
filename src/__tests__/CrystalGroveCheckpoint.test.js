const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

function method(file, name, dependencies = {}) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const ast = parse(source, { sourceType: 'module' }).program.body;
    const declaration = ast.find(node => node.type === 'ClassDeclaration') ||
        ast.find(node => node.type === 'ExportDefaultDeclaration').declaration;
    const node = declaration.body.body.find(item => item.key?.name === name);
    return new Function(...Object.keys(dependencies),
        `return ({${source.slice(node.start, node.end)}}).${name};`)(...Object.values(dependencies));
}

function fixture(checkpoint, clearance = 108) {
    const graphic = {};
    for (const name of ['setPosition', 'setDepth', 'lineStyle', 'strokeEllipse']) {
        graphic[name] = jest.fn(() => graphic);
    }
    const label = { setText: jest.fn(() => label), setColor: jest.fn(() => label) };
    const scene = {
        checkpointPosition: checkpoint,
        woundedCrystalGrove: { x: 2730, groundY: 750, visual: {}, label, zone: { destroy: jest.fn() } },
        getCompanionName: () => 'Test Fern', refreshCrystalCoreHint: jest.fn(),
        drawWoundedCrystalGrove: jest.fn(), showFloatingText: jest.fn(),
        refreshPersistedExpeditionRouteState: jest.fn(),
        player: { y: 500, body: { bottom: 500 + clearance } },
        getTraversalSupport: jest.fn(id => id === 'caves-grove-rejoin'
            ? { body: { left: 2470, right: 3160, top: 720 } } : null),
        add: { graphics: () => graphic }, time: { delayedCall: jest.fn() },
        tweens: { add: jest.fn() },
        setCheckpoint: jest.fn(function (x, y) { this.checkpointPosition = { x, y }; })
    };
    scene.getTraversalSupportCheckpoint = method('../scenes/PlatformerLevelScene.js',
        'getTraversalSupportCheckpoint', { Phaser: { Math: { Clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)) } } });
    scene.tendWoundedCrystalGrove = method('../scenes/levels/CrystalCavesLevel.js', 'tendWoundedCrystalGrove', {
        window: { GameState: {} },
        buildCreaturePowerProfile: () => ({ affinityPower: { id: 'synthetic', name: 'Restore' }, color: 0x78D9BC }),
        recordCreaturePowerEvent: jest.fn()
    });
    return scene;
}

describe('Caves grove checkpoint ownership', () => {
    test.each([0, 1, 2])('healing after beacon %i preserves its coordinates and identity', index => {
        const checkpoint = { x: 2700, y: 466, id: `caves_anchor_${index + 1}`, index };
        const scene = fixture(checkpoint);
        scene.tendWoundedCrystalGrove();
        expect(scene.checkpointPosition).toBe(checkpoint);
        expect(scene.setCheckpoint).not.toHaveBeenCalled();
        expect(scene.crystalWoundTended).toBe(true);
        expect(scene.refreshPersistedExpeditionRouteState).toHaveBeenCalledTimes(1);
    });

    test.each([48, 108, 160])('a grove reached first places a creature with %i clearance above real ground', clearance => {
        const scene = fixture({ x: 120, y: 600 }, clearance);
        scene.tendWoundedCrystalGrove();
        expect(scene.checkpointPosition).toEqual({ x: 2730, y: 720 - clearance - 1 });
        expect(scene.checkpointPosition.y + clearance).toBe(719);
        scene.tendWoundedCrystalGrove();
        expect(scene.setCheckpoint).toHaveBeenCalledTimes(1);
    });
});
