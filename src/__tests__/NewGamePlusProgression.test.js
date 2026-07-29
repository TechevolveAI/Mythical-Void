const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadVictoryScene(sceneWindow) {
    const filePath = path.join(__dirname, '../scenes/VictoryScene.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/^import .*$/gm, '')
        .replace('export default class VictoryScene', 'class VictoryScene')
        .concat('\nmodule.exports = VictoryScene;\n');

    class PhaserScene {
        constructor(config) {
            this.scene = {
                key: config?.key,
                start: jest.fn()
            };
        }
    }

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Phaser: { Scene: PhaserScene },
        devLog: jest.fn(),
        SceneTransitionHelper: {},
        Date,
        Math,
        Object,
        Array,
        Number,
        String,
        Boolean,
        Set
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState(initialState) {
    const state = JSON.parse(JSON.stringify(initialState));
    const get = jest.fn((propertyPath) => {
        return propertyPath.split('.').reduce((value, key) => value?.[key], state);
    });
    const set = jest.fn((propertyPath, value) => {
        const keys = propertyPath.split('.');
        const finalKey = keys.pop();
        const target = keys.reduce((current, key) => {
            current[key] = current[key] || {};
            return current[key];
        }, state);
        target[finalKey] = value;
    });

    return {
        state,
        get,
        set,
        save: jest.fn()
    };
}

describe('New Game+ campaign progression', () => {
    test('starts a fresh campaign while preserving durable Project Beacon equipment', () => {
        const fieldKit = {
            recovered: true,
            recoveredAt: '2026-07-27T12:00:00.000Z',
            katana: {
                id: 'earth_field_katana',
                installedUpgrades: ['crystal_edge', 'aurora_guard']
            }
        };
        const gameState = createGameState({
            game: { newGamePlusCount: 1 },
            stats: { levelsCompleted: 6 },
            combat: { bossesDefeated: 6 },
            story: {
                projectBeacon: {
                    missionLogSeen: true,
                    currentMission: 'field_sequence_complete',
                    fieldKit,
                    firstExpeditionPromptSeen: true,
                    firstExpeditionDrill: {
                        completed: true,
                        completedAt: '2026-07-27T11:55:00.000Z'
                    },
                    pendingDebriefs: [{ id: 'beacon_debrief_5' }],
                    debriefsSeen: [
                        'beacon_debrief_1',
                        'beacon_debrief_2',
                        'beacon_debrief_3',
                        'beacon_debrief_4'
                    ],
                    endingChoice: 'void',
                    endingChoiceDate: '2026-07-27T13:00:00.000Z',
                    endingEpilogueSeen: true,
                    endingEpilogueCompletedAt: '2026-07-27T13:05:00.000Z',
                    lastRouteUnlocked: {
                        gateId: 'aurora_depths'
                    }
                }
            },
            hubWorld: {
                mapsOwned: ['stellar_reef'],
                shipCompletionCutsceneShown: true,
                shipParts: {
                    collected: [
                        'crystal_core',
                        'dimensional_drive',
                        'forest_core',
                        'hull_plating',
                        'aurora_reactor',
                        'command_module'
                    ],
                    finalBossUnlocked: true
                },
                gates: {
                    mythical_forest: { unlocked: true },
                    crystal_caves: { unlocked: true },
                    stellar_reef: { unlocked: true },
                    void_peaks: { unlocked: true },
                    aurora_depths: { unlocked: true },
                    final_void: { unlocked: true }
                }
            }
        });
        const sceneWindow = { GameState: gameState };
        const VictoryScene = loadVictoryScene(sceneWindow);
        const scene = new VictoryScene();
        scene.cameras = {
            main: {
                fadeOut: jest.fn()
            }
        };
        scene.time = {
            delayedCall: jest.fn((delay, callback) => callback())
        };

        scene.startNewGamePlus();

        expect(gameState.get('game.newGamePlusCount')).toBe(2);
        expect(gameState.get('stats.levelsCompleted')).toBe(0);
        expect(gameState.get('combat.bossesDefeated')).toBe(0);
        expect(gameState.get('hubWorld.shipParts.collected')).toEqual([]);
        expect(gameState.get('hubWorld.shipParts.finalBossUnlocked')).toBe(false);
        expect(gameState.get('hubWorld.shipCompletionCutsceneShown')).toBe(false);
        expect(gameState.get('hubWorld.gates.mythical_forest.unlocked')).toBe(true);
        expect(gameState.get('hubWorld.gates.crystal_caves.unlocked')).toBe(false);
        expect(gameState.get('hubWorld.gates.stellar_reef.unlocked')).toBe(true);
        expect(gameState.get('hubWorld.gates.void_peaks.unlocked')).toBe(false);
        expect(gameState.get('hubWorld.gates.final_void.unlocked')).toBe(false);
        expect(gameState.get('hubWorld.mapsOwned')).toEqual(['stellar_reef']);
        expect(Object.values(gameState.get('levels'))).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entered: false,
                    completed: false
                })
            ])
        );
        expect(gameState.get('story.projectBeacon')).toEqual(expect.objectContaining({
            missionLogSeen: true,
            currentMission: 'field_sequence_complete',
            fieldKit,
            firstExpeditionPromptSeen: false,
            firstExpeditionDrill: {
                completed: true,
                completedAt: '2026-07-27T11:55:00.000Z'
            },
            pendingDebriefs: [],
            debriefsSeen: [],
            endingChoice: null,
            endingChoiceDate: null,
            endingEpilogueSeen: false,
            endingEpilogueCompletedAt: null,
            lastRouteUnlocked: null
        }));
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(scene.scene.start).toHaveBeenCalledWith('HubWorldScene');
    });
});
