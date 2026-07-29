const fs = require('fs');
const path = require('path');
const vm = require('vm');
const projectBeacon = require('../config/project-beacon.json');

function loadStoryHelpers() {
    const filePath = path.join(__dirname, '../systems/ProjectBeaconStory.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import projectBeacon from '../config/project-beacon.json';",
            'const projectBeacon = PROJECT_BEACON;'
        )
        .replace(/export function /g, 'function ');
    const script = `${transformed}
        module.exports = {
            getProjectBeaconDebrief,
            queueProjectBeaconDebrief,
            unlockProjectBeaconMilestone,
            getNextProjectBeaconDebrief,
            acknowledgeProjectBeaconDebrief
        };`;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        PROJECT_BEACON: projectBeacon,
        Date,
        Array
    };

    vm.runInNewContext(script, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState() {
    const state = {
        story: {
            projectBeacon: {
                pendingDebriefs: [],
                debriefsSeen: []
            }
        },
        hubWorld: {
            gates: {
                crystal_caves: { unlocked: false, unlockCost: 500 },
                stellar_reef: { unlocked: false, unlockCost: 500 },
                void_peaks: { unlocked: false, unlockCost: 1000 },
                aurora_depths: { unlocked: false, unlockCost: 750 }
            }
        }
    };

    return {
        state,
        get(propertyPath) {
            return propertyPath.split('.').reduce((value, key) => value?.[key], state);
        },
        set(propertyPath, value) {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        },
        save: jest.fn()
    };
}

describe('Project Beacon campaign debrief state', () => {
    const {
        queueProjectBeaconDebrief,
        unlockProjectBeaconMilestone,
        getNextProjectBeaconDebrief,
        acknowledgeProjectBeaconDebrief
    } = loadStoryHelpers();

    test('queues revelations by unique completion number, independent of biome order', () => {
        const gameState = createGameState();

        const queued = queueProjectBeaconDebrief(gameState, {
            completionNumber: 1,
            levelId: 'voidPeaks',
            shipPartId: 'hull_plating',
            completedAt: '2026-07-26T20:00:00.000Z'
        });
        const duplicate = queueProjectBeaconDebrief(gameState, {
            completionNumber: 1,
            levelId: 'mythicalForest',
            shipPartId: 'forest_core'
        });

        expect(queued).toEqual({
            id: 'beacon_debrief_1',
            levelId: 'voidPeaks',
            shipPartId: 'hull_plating',
            completedAt: '2026-07-26T20:00:00.000Z'
        });
        expect(duplicate).toBeNull();
        expect(getNextProjectBeaconDebrief(gameState)).toEqual(expect.objectContaining({
            id: 'beacon_debrief_1',
            completionNumber: 1,
            levelId: 'voidPeaks',
            shipPartId: 'hull_plating'
        }));
    });

    test('acknowledges a debrief once and never queues it again', () => {
        const gameState = createGameState();
        queueProjectBeaconDebrief(gameState, {
            completionNumber: 2,
            levelId: 'cosmicReef',
            shipPartId: 'dimensional_drive'
        });

        expect(acknowledgeProjectBeaconDebrief(gameState, 'beacon_debrief_2')).toBe(true);
        expect(gameState.get('story.projectBeacon.pendingDebriefs')).toEqual([]);
        expect(gameState.get('story.projectBeacon.debriefsSeen')).toEqual([
            'beacon_debrief_2'
        ]);
        expect(gameState.save).toHaveBeenCalledTimes(1);

        expect(queueProjectBeaconDebrief(gameState, {
            completionNumber: 2,
            levelId: 'crystalCaves',
            shipPartId: 'crystal_core'
        })).toBeNull();
        expect(acknowledgeProjectBeaconDebrief(gameState, 'beacon_debrief_2')).toBe(false);
    });

    test('unlocks the next expedition at each approved campaign milestone', () => {
        const gameState = createGameState();

        const result = unlockProjectBeaconMilestone(gameState, 1);

        expect(result).toEqual({
            gateId: 'crystal_caves',
            label: 'Crystal Caves',
            newlyUnlocked: true
        });
        expect(gameState.get('hubWorld.gates.crystal_caves')).toEqual({
            unlocked: true,
            unlockCost: 500
        });
        expect(gameState.get('story.projectBeacon.lastRouteUnlocked')).toEqual(
            expect.objectContaining({
                gateId: 'crystal_caves',
                label: 'Crystal Caves',
                completionNumber: 1
            })
        );
    });

    test('preserves early map unlocks and ignores the final completion milestone', () => {
        const gameState = createGameState();
        gameState.set('hubWorld.gates.crystal_caves.unlocked', true);

        expect(unlockProjectBeaconMilestone(gameState, 1)).toEqual({
            gateId: 'crystal_caves',
            label: 'Crystal Caves',
            newlyUnlocked: false
        });
        expect(unlockProjectBeaconMilestone(gameState, 5)).toBeNull();
        expect(gameState.get('story.projectBeacon.lastRouteUnlocked')).toBeUndefined();
    });

    test('ignores completion numbers beyond the approved pre-final arc', () => {
        const gameState = createGameState();

        expect(queueProjectBeaconDebrief(gameState, {
            completionNumber: 6,
            levelId: 'finalVoid',
            shipPartId: 'command_module'
        })).toBeNull();
        expect(getNextProjectBeaconDebrief(gameState)).toBeNull();
    });

    test('skips an invalid queued entry without hiding later valid debriefs', () => {
        const gameState = createGameState();
        gameState.set('story.projectBeacon.pendingDebriefs', [
            { id: 'unknown_debrief' },
            {
                id: 'beacon_debrief_3',
                levelId: 'cosmicReef',
                shipPartId: 'dimensional_drive'
            }
        ]);

        expect(getNextProjectBeaconDebrief(gameState)).toEqual(expect.objectContaining({
            id: 'beacon_debrief_3',
            completionNumber: 3
        }));
    });

    test('keeps the local preview route isolated from save state', () => {
        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const hubSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HubWorldScene.js'),
            'utf8'
        );
        const previewBlock = gameSource.match(
            /if \(isLocalPreview && testDebrief >= 1[\s\S]*?\/\/ Handle page unload/
        )?.[0] || '';

        expect(previewBlock).toContain("game.scene.start('HubWorldScene')");
        expect(previewBlock).not.toContain('GameState.set');
        expect(hubSource).toContain('isPreview: true');
        expect(hubSource).toContain('if (!debrief.isPreview)');
        expect(hubSource).toContain('NEXT EXPEDITION:');
    });
});
