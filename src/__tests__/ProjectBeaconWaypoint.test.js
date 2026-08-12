const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadWaypointHelpers() {
    const filePath = path.join(__dirname, '../systems/ui/ProjectBeaconWaypoint.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            'export function resolveProjectBeaconWaypointTarget',
            'function resolveProjectBeaconWaypointTarget'
        )
        .replace(
            'export function getWaypointScreenPosition',
            'function getWaypointScreenPosition'
        )
        .replace('export default class ProjectBeaconWaypoint', 'class ProjectBeaconWaypoint')
        .concat(
            '\nmodule.exports = {' +
            ' ProjectBeaconWaypoint, resolveProjectBeaconWaypointTarget, getWaypointScreenPosition };'
        );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        window: {},
        Math,
        Number,
        Array,
        Object
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function loadGameScene(sceneWindow) {
    const filePath = path.join(__dirname, '../scenes/GameScene.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/^import[\s\S]*?;\n/gm, '')
        .replace(/import\.meta\.env\.DEV/g, 'false')
        .replace(/export default GameScene;/, 'module.exports = GameScene;');
    class PhaserScene {
        constructor() {}
    }
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Phaser: { Scene: PhaserScene },
        Math,
        Date,
        Object,
        Array,
        Number,
        String,
        Boolean,
        RegExp,
        Promise
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Project Beacon waypoint', () => {
    test('maps only active spatial story missions to their world targets', () => {
        const { resolveProjectBeaconWaypointTarget } = loadWaypointHelpers();
        const scene = {
            crashedShip: { x: 100, y: 200, active: true },
            hubPortal: { x: 900, y: 700, active: true },
            collectibles: []
        };

        expect(resolveProjectBeaconWaypointTarget(scene, {
            id: 'beacon_field_kit',
            type: 'story',
            completed: false
        }, { x: 0, y: 0 })).toEqual(expect.objectContaining({
            label: 'FIELD KIT',
            target: scene.crashedShip
        }));

        expect(resolveProjectBeaconWaypointTarget(scene, {
            id: 'beacon_world_gate',
            type: 'story',
            completed: false
        }, { x: 0, y: 0 })).toEqual(expect.objectContaining({
            label: 'WORLD GATE',
            target: scene.hubPortal
        }));

        expect(resolveProjectBeaconWaypointTarget(scene, {
            id: 'beacon_first_contact',
            type: 'story',
            completed: false
        }, { x: 0, y: 0 })).toBeNull();
        expect(resolveProjectBeaconWaypointTarget(scene, {
            id: 'beacon_field_kit',
            type: 'story',
            completed: true
        }, { x: 0, y: 0 })).toBeNull();
    });

    test('points the signal survey at the nearest unobserved authored signal', () => {
        const { resolveProjectBeaconWaypointTarget } = loadWaypointHelpers();
        const observed = { x: 12, y: 10, active: true, observed: true };
        const nearest = { x: 40, y: 10, active: true, observed: false };
        const farther = { x: 150, y: 10, active: true, observed: false };
        const scene = {
            collectibles: [{ x: 11, y: 10, active: true, collected: false }],
            livingSignals: [observed, farther, nearest]
        };

        const result = resolveProjectBeaconWaypointTarget(scene, {
            id: 'beacon_living_signals',
            type: 'story',
            completed: false,
            progress: 1,
            objective: { target: 3 }
        }, { x: 10, y: 10 });

        expect(result.label).toBe('LIVING SIGNAL 1/3');
        expect(result.target).toBe(nearest);
    });

    test('clamps off-screen objectives while leaving visible objectives in world space', () => {
        const { getWaypointScreenPosition } = loadWaypointHelpers();

        expect(getWaypointScreenPosition({
            targetX: 500,
            targetY: 300,
            width: 1280,
            height: 720
        })).toEqual(expect.objectContaining({
            x: 500,
            y: 300,
            isVisible: true
        }));

        expect(getWaypointScreenPosition({
            targetX: 1800,
            targetY: 1000,
            width: 1280,
            height: 720
        })).toEqual(expect.objectContaining({
            x: 1222,
            y: 630,
            isVisible: false
        }));

        expect(getWaypointScreenPosition({
            targetX: 900,
            targetY: 20,
            width: 390,
            height: 844,
            horizontalMargin: 52,
            topMargin: 215,
            bottomMargin: 145
        })).toEqual(expect.objectContaining({
            x: 338,
            y: 215,
            isVisible: false
        }));
    });

    test('uses the controlled player position for collectible collection', () => {
        const checkProximityCollection = jest.fn();
        class PhaserScene {
            constructor() {}
        }
        const sceneWindow = {
            Phaser: { Scene: PhaserScene },
            CollectibleManager: { checkProximityCollection }
        };
        const GameScene = loadGameScene(sceneWindow);
        const context = {
            player: { x: 321, y: 654 }
        };

        GameScene.prototype.checkCollectibleProximity.call(context);

        expect(checkProximityCollection).toHaveBeenCalledWith(context, 321, 654, 60);
    });

    test('is integrated after collectible spawning and cleaned up with the scene', () => {
        const source = fs.readFileSync(path.join(__dirname, '../scenes/GameScene.js'), 'utf8');
        const spawnIndex = source.indexOf('this.spawnWorldCollectibles();');
        const waypointIndex = source.indexOf(
            'this.projectBeaconWaypoint = new ProjectBeaconWaypoint(this);'
        );

        expect(spawnIndex).toBeGreaterThan(-1);
        expect(waypointIndex).toBeGreaterThan(spawnIndex);
        expect(source).toContain('this.projectBeaconWaypoint?.update');
        expect(source).toContain('this.projectBeaconWaypoint?.destroy');

        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        expect(gameSource).toContain("['fieldKit', 'signals'].includes(testWaypoint)");
        expect(gameSource).toContain("{ waypointPreview: testWaypoint }");
    });
});
