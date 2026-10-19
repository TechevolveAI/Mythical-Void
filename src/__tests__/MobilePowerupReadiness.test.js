const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const names = ['drawEnergyRing', 'updateEnergyRings', 'updateEnergyDisplay', 'createPlatformerButton',
    'applyPowerupEffect', 'performSpecialAttack', 'destroyPlatformerMobileControls'];
const methods = Object.fromEntries(names.map(name => {
    const node = declaration.body.body.find(node => node.key?.name === name);
    return [name, new Function('window', 'console', `return ({${source.slice(node.start, node.end)}}).${name};`)(
        {}, { log() {}, warn() {} }
    )];
}));

// Actual view/action methods with fake drawing and pointer dispatch. This is
// not a browser gesture, rendered phone proof, audio session or booted game.
function fixture() {
    const objects = [];
    function display(fields = {}) {
        const object = Object.assign(new EventEmitter(), { active: true, visible: true, alpha: 1, commands: [], ...fields });
        for (const method of ['setScrollFactor', 'setDepth', 'setInteractive']) object[method] = () => object;
        object.setOrigin = () => object;
        object.setVisible = value => { object.visible = value; return object; };
        object.setAlpha = value => { object.alpha = value; return object; };
        object.setText = value => { object.text = value; return object; };
        object.setColor = value => { object.color = value; return object; };
        object.setPosition = (x, y) => { Object.assign(object, { x, y }); return object; };
        object.clear = () => { object.commands = []; return object; };
        for (const method of ['lineStyle', 'beginPath', 'arc', 'strokePath', 'fillStyle', 'fillCircle', 'fillTriangle']) {
            object[method] = (...args) => { object.commands.push({ method, args }); return object; };
        }
        object.destroy = jest.fn(() => { object.active = false; object.removeAllListeners(); });
        objects.push(object); return object;
    }
    const scene = { ...methods, crystalEnergy: 0, maxCrystalEnergy: 5, freeSpecialAttackCharges: 0,
        player: { x: 100, y: 200 }, time: { now: 1000 },
        mobileControlElements: [], platformerControlsVisible: true,
        actionButtonPointers: new Set(), actionButtonReleases: new Map(),
        energyDisplay: { children: [], removeAll: jest.fn(function() { this.children = []; }),
            add(value) { this.children.push(...(Array.isArray(value) ? value : [value])); } },
        detectMobile: () => true, getBossCombatTarget: () => null,
        showFloatingText: jest.fn(), tweens: { add: jest.fn() },
        drawPlatformerButton: jest.fn(), drawJumpButton: jest.fn(), drawJumpArrow: jest.fn(),
        releaseAllPlatformerActionButtons: jest.fn(), cleanupPlatformerInputHandlers: jest.fn(),
        clearMobileControlCoach: jest.fn(), clearVirtualJumpInput: jest.fn(),
        add: { graphics: () => display(), text: (x, y, text, style) => display({ x, y, text, style }),
            zone: (x, y, width, height) => display({ x, y, width, height }) }
    };
    const createButton = () => scene.createPlatformerButton({ id: 'special', x: 250, y: 700, size: 54,
        label: 'synthetic-blast', color: 0x9B59B6, energyCost: 3, action: () => scene.performSpecialAttack() });
    const ring = () => scene.energyRingButtons.special.ring;
    const ready = () => ring().commands.some(command => command.method === 'lineStyle' &&
        command.args[0] === 4 && [0x00FFFF, 0xFFD166].includes(command.args[1]));
    return { scene, objects, display, createButton, ring, ready };
}

describe('mobile Super Blast feedback follows actual usable charges', () => {
    test.each([0, 1, 2, 3, 4, 5].flatMap(energy => [0, 1, 2].map(charges => [energy, charges])))(
        'energy %i / free charges %i agrees with the actual mobile action and refreshes after use', (energy, charges) => {
            const f = fixture();
            f.scene.crystalEnergy = energy; f.scene.freeSpecialAttackCharges = charges;
            const button = f.createButton(), eligible = energy >= 3 || charges > 0;
            expect(f.ready()).toBe(eligible);
            button.zone.emit('pointerdown', { id: 7 });
            expect(f.scene.tweens.add.mock.calls.some(([config]) => config.duration === 500)).toBe(eligible);
            expect(f.scene.freeSpecialAttackCharges).toBe(eligible && charges > 0 ? charges - 1 : charges);
            expect(f.scene.crystalEnergy).toBe(eligible && charges === 0 ? energy - 3 : energy);
            expect(f.ready()).toBe(f.scene.crystalEnergy >= 3 || f.scene.freeSpecialAttackCharges > 0);
        }
    );

    test('energy pickups and a packed free blast refresh the existing ring immediately', () => {
        const f = fixture(); f.createButton();
        expect(f.ready()).toBe(false);
        expect(f.scene.applyPowerupEffect({ crystalEnergy: 3 }).success).toBe(true);
        expect(f.ready()).toBe(true);
        f.scene.crystalEnergy = 0; f.scene.updateEnergyDisplay();
        expect(f.ready()).toBe(false);
        expect(f.scene.applyPowerupEffect({ freeSpecialAttack: 1 }).success).toBe(true);
        expect(f.ready()).toBe(true);
        expect(f.ring().commands.some(command => command.method === 'fillTriangle')).toBe(true);
    });

    test('400 redraws reuse one cost label and hide it whenever a charge is usable', () => {
        const f = fixture(); f.createButton();
        const low = f.objects.filter(object => object.text === '3\u26a1');
        expect(low).toHaveLength(1);
        const references = f.scene.mobileControlElements.length;
        for (let index = 0; index < 400; index++) {
            f.scene.crystalEnergy = index % 4; f.scene.updateEnergyRings();
        }
        expect(f.objects.filter(object => object.text === '3\u26a1').length).toBe(1);
        expect(f.scene.mobileControlElements.length).toBe(references);
        expect(low[0].visible).toBe(false);
        f.scene.crystalEnergy = 0; f.scene.updateEnergyRings();
        expect(low[0].visible).toBe(true);
        expect(low[0].active).toBe(true);
    });

    test('a ready ring does not allocate a cost label; hidden controls keep later labels hidden', () => {
        const f = fixture(); f.scene.crystalEnergy = 5; f.createButton();
        expect(f.objects.filter(object => object.text === '3\u26a1')).toHaveLength(0);
        f.scene.platformerControlsVisible = false;
        f.scene.crystalEnergy = 0; f.scene.updateEnergyDisplay();
        const label = f.objects.find(object => object.text === '3\u26a1');
        expect(label).toBeDefined(); expect(label.alpha).toBe(0);
    });

    test('teardown releases ring/label references and a later HUD update cannot redraw destroyed graphics', () => {
        const f = fixture(); f.createButton();
        const old = f.ring();
        old.clear = jest.fn(() => { throw Error('DESTROYED_RING'); });
        f.scene.destroyPlatformerMobileControls();
        expect(Object.keys(f.scene.energyRingButtons || {}).length).toBe(0);
        expect(Object.keys(f.scene.energyCostLabels || {}).length).toBe(0);
        expect(() => f.scene.updateEnergyDisplay()).not.toThrow();
        expect(old.clear).not.toHaveBeenCalled();
    });

    test('a free blast never marks another energy-cost action as ready', () => {
        const f = fixture(); f.scene.freeSpecialAttackCharges = 1;
        const graphics = f.display();
        f.scene.drawEnergyRing(graphics, 100, 100, 33, 2, 'synthetic-other-action');
        expect(graphics.commands.some(command => command.method === 'lineStyle' && command.args[1] === 0x00FFFF)).toBe(false);
    });

    test('teardown unpublishes ring references before object destruction can re-enter the HUD', () => {
        const f = fixture(); f.createButton();
        const old = f.ring(), errors = [];
        old.destroy.mockImplementation(() => {
            old.clear = () => { throw Error('RING_ALREADY_DISPOSED'); };
            try { f.scene.updateEnergyDisplay(); } catch (error) { errors.push(error.message); }
            old.active = false;
        });
        f.scene.destroyPlatformerMobileControls();
        expect(errors).toEqual([]);
        expect(f.scene.mobileControlElements).toEqual([]);
    });

    test('the free-charge cue adds no display object and fits the existing ring-glow bounds', () => {
        const f = fixture(); f.scene.crystalEnergy = 5; f.createButton();
        const count = f.objects.length;
        f.scene.freeSpecialAttackCharges = 1; f.scene.updateEnergyRings();
        expect(f.objects.length).toBe(count);
        const { x, y, radius } = f.scene.energyRingButtons.special;
        const triangles = f.ring().commands.filter(command => command.method === 'fillTriangle');
        expect(triangles).toHaveLength(2);
        for (const triangle of triangles) for (let index = 0; index < triangle.args.length; index += 2) {
            expect(Math.abs(triangle.args[index] - x)).toBeLessThanOrEqual(radius + 4);
            expect(Math.abs(triangle.args[index + 1] - y)).toBeLessThanOrEqual(radius + 4);
        }
    });
});
