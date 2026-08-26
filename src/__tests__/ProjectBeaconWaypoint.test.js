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
        .replace(
            'export function resolveSanctuaryCurrentTarget',
            'function resolveSanctuaryCurrentTarget'
        )
        .replace('export default class ProjectBeaconWaypoint', 'class ProjectBeaconWaypoint')
        .concat(
            '\nmodule.exports = {' +
            ' ProjectBeaconWaypoint, resolveProjectBeaconWaypointTarget,' +
            ' resolveSanctuaryCurrentTarget, getWaypointScreenPosition };'
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

        expect(getWaypointScreenPosition({
            targetX: 900,
            targetY: 286,
            width: 390,
            height: 844,
            horizontalMargin: 96,
            topMargin: 215,
            bottomMargin: 145
        })).toEqual(expect.objectContaining({
            x: 294,
            isVisible: false
        }));
    });

    test('continues Sanctuary guidance from survival into community and expeditions', () => {
        const { resolveSanctuaryCurrentTarget } = loadWaypointHelpers();
        const crashedShip = { x: 100, y: 200, active: true };
        const villageZone = { x: 460, y: 1300, active: true };
        const hubPortal = { x: 800, y: 1800, active: true };
        const values = new Map([
            ['story.projectBeacon.fieldKit.recovered', false]
        ]);
        const gameState = { get: path => values.get(path) };
        const scene = {
            currentBiome: 'nebula',
            crashedShip,
            hubPortal,
            villageHeartLandmark: {
                zone: villageZone,
                snapshot: {
                    unlock: { unlocked: true },
                    state: { guidanceSeen: false },
                    worldState: { nextAction: { type: 'build' } }
                }
            }
        };

        expect(resolveSanctuaryCurrentTarget(scene, { gameState }))
            .toEqual(expect.objectContaining({
                missionId: 'sanctuary_field_kit',
                label: 'RECOVER FIELD KIT',
                target: crashedShip
            }));

        values.set('story.projectBeacon.fieldKit.recovered', true);
        expect(resolveSanctuaryCurrentTarget(scene, { gameState }))
            .toEqual(expect.objectContaining({
                missionId: 'sanctuary_village_arrival',
                label: 'MEET VILLAGE HEART',
                target: villageZone
            }));

        scene.villageHeartLandmark.snapshot.state.guidanceSeen = true;
        scene.villageHeartLandmark.snapshot.worldState.nextAction = {
            type: 'decision'
        };
        expect(resolveSanctuaryCurrentTarget(scene, { gameState }))
            .toEqual(expect.objectContaining({
                missionId: 'sanctuary_heart_choice',
                label: 'HEART CHOICE READY',
                target: villageZone
            }));

        scene.villageHeartLandmark.snapshot.worldState.nextAction = {
            type: 'review'
        };
        expect(resolveSanctuaryCurrentTarget(scene, {
            gameState,
            campaignStep: {
                status: 'ready',
                label: 'Mythical Forest'
            }
        })).toEqual(expect.objectContaining({
            missionId: 'sanctuary_ready_expedition',
            label: 'NEXT · MYTHICAL FOREST',
            target: hubPortal
        }));
    });

    test('does not override an active non-spatial story moment with fallback guidance', () => {
        const { ProjectBeaconWaypoint } = loadWaypointHelpers();
        const director = new ProjectBeaconWaypoint({
            currentBiome: 'nebula',
            player: { x: 20, y: 20 },
            hubPortal: { x: 900, y: 700, active: true }
        }, {
            questProvider: () => ({
                id: 'beacon_first_contact',
                type: 'story',
                completed: false,
                claimed: false
            }),
            campaignStepProvider: () => ({
                status: 'ready',
                label: 'Mythical Forest'
            })
        });

        director.refreshTarget();

        expect(director.currentTarget).toBeNull();
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
            'this.projectBeaconWaypoint = new ProjectBeaconWaypoint(this, {'
        );

        expect(spawnIndex).toBeGreaterThan(-1);
        expect(waypointIndex).toBeGreaterThan(spawnIndex);
        expect(source).toContain('this.projectBeaconWaypoint?.update');
        expect(source).toContain('this.projectBeaconWaypoint?.destroy');
        expect(source).toContain(
            'campaignStepProvider: () => getCampaignJourneyStep(window.GameState)'
        );

        const waypointSource = fs.readFileSync(
            path.join(__dirname, '../systems/ui/ProjectBeaconWaypoint.js'),
            'utf8'
        );
        expect(waypointSource).toContain("'player_current_trail_v1'");
        expect(waypointSource).toContain("'living_current_edge_ribbon_v2'");
        expect(waypointSource).toContain("'living_current_threshold_v1'");
        expect(waypointSource).toContain('this.scene.sanctuaryFocusModeActive ||');
        expect(waypointSource).toContain('interactionOwnsAttention');
        expect(waypointSource).not.toContain("backgroundColor: 'rgba(5, 12, 18, 0.88)'");

        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        expect(gameSource).toContain(
            "['fieldKit', 'signals', 'village', 'expedition'].includes(testWaypoint)"
        );
        expect(gameSource).toContain("{ waypointPreview: testWaypoint }");
    });
});
