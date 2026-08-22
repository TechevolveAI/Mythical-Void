const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSanctuaryZones() {
    const filePath = path.join(
        __dirname,
        '../systems/world/SanctuaryZones.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace('export default SanctuaryZones;', 'module.exports = SanctuaryZones;');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Math,
        Number,
        Object
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Sanctuary navigation safety', () => {
    const SanctuaryZones = loadSanctuaryZones();

    test('recovers a top-right perimeter save to the Target Range entrance', () => {
        const zones = new SanctuaryZones(2400, 1800);
        const recovered = zones.getSafeSpawnPosition({ x: 2395, y: 35 });
        const range = zones.zones.trainingGrounds;

        expect(recovered.x).toBe(range.center.x);
        expect(recovered.y).toBeGreaterThan(range.center.y + 100);
        expect(recovered.y).toBeLessThan(range.bounds.y + range.bounds.height);
        expect(recovered.x).toBeGreaterThan(range.bounds.x);
        expect(recovered.x).toBeLessThan(range.bounds.x + range.bounds.width);
    });

    test('preserves an already safe Sanctuary position', () => {
        const zones = new SanctuaryZones(2400, 1800);

        expect(zones.getSafeSpawnPosition({ x: 1200, y: 900 }))
            .toEqual({ x: 1200, y: 900 });
    });

    test.each([
        'crashedShip',
        'cosmicShop',
        'hubPortal',
        'voidPortal'
    ])('recovers a saved position inside the %s blocker', landmarkId => {
        const zones = new SanctuaryZones(2400, 1800);
        const position = zones.landmarks[landmarkId].position;

        expect(zones.getSafeSpawnPosition(position))
            .toEqual(zones.getSpawnPosition());
    });

    test('recovers positions where procedural colliders may be regenerated', () => {
        const zones = new SanctuaryZones(2400, 1800);
        const unreservedPosition = { x: 600, y: 600 };

        expect(zones.getZoneAt(unreservedPosition.x, unreservedPosition.y))
            .toBeNull();
        expect(zones.getSafeSpawnPosition(unreservedPosition))
            .toEqual(zones.getSpawnPosition());
    });

    test('keeps the fallback and Void exit clear of known blockers', () => {
        const zones = new SanctuaryZones(2400, 1800);
        const fallback = zones.getSpawnPosition();
        const voidExit = zones.getVoidExitPosition();

        expect(zones.isInsideSpawnBlocker(fallback.x, fallback.y)).toBe(false);
        expect(zones.isInsideColliderFreeZone(fallback.x, fallback.y)).toBe(true);
        expect(zones.isInsideSpawnBlocker(voidExit.x, voidExit.y)).toBe(false);
        expect(zones.isInsideColliderFreeZone(voidExit.x, voidExit.y)).toBe(true);
    });

    test('uses the central spawn for malformed or unrelated unsafe saves', () => {
        const zones = new SanctuaryZones(2400, 1800);

        expect(zones.getSafeSpawnPosition({ x: 'bad', y: null }))
            .toEqual(zones.getSpawnPosition());
        expect(zones.getSafeSpawnPosition({ x: 20, y: 1700 }))
            .toEqual(zones.getSpawnPosition());
    });

    test('keeps collidable scenery out of zones and opens the range gate', () => {
        const worldSource = fs.readFileSync(
            path.join(__dirname, '../systems/world/WorldBuilder.js'),
            'utf8'
        );

        expect(worldSource).toContain('findEnvironmentPosition(150, 72)');
        expect(worldSource).toContain('findEnvironmentPosition(100, 58)');
        expect(worldSource).toContain('isReservedSanctuaryPosition');
        expect(worldSource).toContain('const gateHalfWidth = 42');
        expect(worldSource).not.toContain(
            'boundaryGraphics.strokeRect(centerX - 140, centerY - 100, 280, 200)'
        );
    });

    test('applies safe-position recovery before creating the player body', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );
        const recoveryIndex = gameSource.indexOf(
            'this.sanctuaryZones?.getSafeSpawnPosition'
        );
        const playerIndex = gameSource.indexOf(
            'this.player = this.physics.add.sprite(startX, startY'
        );

        expect(recoveryIndex).toBeGreaterThan(0);
        expect(recoveryIndex).toBeLessThan(playerIndex);
        expect(gameSource).toContain(
            'Recovered player from unsafe Sanctuary perimeter'
        );
    });

    test('routes Sanctuary flower care through the shared nearest-action resolver', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );

        expect(gameSource).toContain("id: 'flower'");
        expect(gameSource).toContain("message: 'Press SPACE · Smell the flower'");
        expect(gameSource).toContain('action: () => this.smellNearbyFlower()');
        expect(gameSource).toContain("this.withdrawSanctuaryInteraction('flower')");
        expect(gameSource).toContain('priority: 8');
    });
});
