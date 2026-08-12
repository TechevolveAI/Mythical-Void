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
            breedingShrine: {
                reconciliationQueue: [{
                    operationId: 'fusion_pending_23',
                    status: 'pending'
                }],
                consent: {
                    schemaVersion: 1,
                    records: [{
                        operationId: 'fusion_pending_23'
                    }]
                }
            },
            creature: {
                identityArchive: {
                    schemaVersion: 1,
                    creatureId: 'creature_nova_23',
                    reviewedChapterIds: [
                        'identity',
                        'living_form',
                        'shared_journey',
                        'inheritance'
                    ],
                    firstReviewedAt: '2026-07-30T23:23:00.000Z',
                    completedAt: '2026-07-31T00:23:00.000Z',
                    history: []
                }
            },
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
                    highPowerReveals: [{
                        decisionId: 'high_power:nova:run_1:final_void_1',
                        powerId: 'skyfold_event',
                        earthVisibility: 'city_scale_detectable'
                    }],
                    endingChoice: 'void',
                    endingChoiceDate: '2026-07-27T13:00:00.000Z',
                    endingEpilogueSeen: true,
                    endingEpilogueCompletedAt: '2026-07-27T13:05:00.000Z',
                    finale: {
                        schemaVersion: 1,
                        sharedOutcome: {
                            coordinatesProtected: true,
                            uplinkMode: 'held',
                            departureStatus: 'deferred',
                            currentCommitment: 'remain_and_defend'
                        },
                        priority: 'prepare_homecoming',
                        prioritySelectedAt: '2026-07-27T13:00:00.000Z',
                        epilogueSeen: true,
                        epilogueCompletedAt: '2026-07-27T13:05:00.000Z'
                    },
                    sensei: {
                        schemaVersion: 2,
                        relationship: 'pre_mission_friend_and_training_partner',
                        memoryLedger: {
                            schemaVersion: 1,
                            recalledMemoryIds: [
                                'begin_with_your_footing',
                                'trust_begins_with_how_you_enter'
                            ],
                            lesson: {
                                id: 'centering_stance',
                                status: 'practiced',
                                practiceCount: 3,
                                firstPracticedAt: '2026-07-27T12:23:00.000Z',
                                lastPracticedAt: '2026-07-27T12:53:00.000Z'
                            },
                            history: []
                        },
                        encryptedContact: {
                            channelId: 'DOJO-23-77',
                            status: 'route_recovered',
                            contactAttempted: false,
                            contactEstablished: false,
                            recoveredAt: '2026-07-27T13:00:00.000Z'
                        }
                    },
                    shipCapabilities: {
                        schemaVersion: 1,
                        stealthDescent: 'damaged',
                        secureReturnVector: 'sealed',
                        manualLanding: 'available',
                        blackBoxProof: 'recovered',
                        passengerCapacity: 1,
                        creatureLifeSupport: 'prototype_required',
                        longRangeUplink: 'held_exposure_risk'
                    },
                    companionConsent: {
                        schemaVersion: 1,
                        travelStatus: 'not_yet_asked',
                        disclosureStatus: 'withheld',
                        informedRisks: false,
                        willingPassenger: null,
                        vetoRecognized: true,
                        recordedAt: '2026-07-27T13:00:00.000Z'
                    },
                    legacyCapsule: {
                        schemaVersion: 2,
                        intent: 'prepare_homecoming'
                    },
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
            },
            world: {
                fendCommunity: {
                    schemaVersion: 1,
                    builtProjectIds: [
                        'trailhead_shelter',
                        'current_well',
                        'wayfinder_relay'
                    ],
                    contributionHistory: [{
                        operationId: 'community:wayfinder_relay'
                    }]
                },
                fendResidents: {
                    schemaVersion: 1,
                    metResidentIds: ['kiri', 'mara', 'tovan'],
                    activeRequestId: 'relay_three_signals',
                    activeRequestBaseline: {
                        observedSignals: 2
                    },
                    completedRequestIds: [
                        'shelter_calibration',
                        'well_return_flow'
                    ],
                    history: [{
                        operationId: 'resident:tovan:accept',
                        type: 'request_accepted',
                        residentId: 'tovan',
                        requestId: 'relay_three_signals'
                    }]
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
            highPowerReveals: [],
            endingChoice: null,
            endingChoiceDate: null,
            endingEpilogueSeen: false,
            endingEpilogueCompletedAt: null,
            lastRouteUnlocked: null
        }));
        expect(gameState.get('story.projectBeacon.finale.priority')).toBeNull();
        expect(
            gameState.get(
                'story.projectBeacon.sensei.encryptedContact.status'
            )
        ).toBe('fragmented');
        expect(
            gameState.get(
                'story.projectBeacon.sensei.memoryLedger'
            )
        ).toEqual(expect.objectContaining({
            recalledMemoryIds: [
                'begin_with_your_footing',
                'trust_begins_with_how_you_enter'
            ],
            lesson: expect.objectContaining({
                id: 'centering_stance',
                status: 'practiced',
                practiceCount: 3
            })
        }));
        expect(
            gameState.get('story.projectBeacon.shipCapabilities')
        ).toEqual(expect.objectContaining({
            secureReturnVector: 'unavailable',
            passengerCapacity: 0,
            longRangeUplink: 'offline'
        }));
        expect(
            gameState.get('story.projectBeacon.shipArchive')
        ).toEqual({
            schemaVersion: 1,
            reviewedSectionIds: [],
            firstReviewedAt: null,
            completedAt: null,
            history: []
        });
        expect(
            gameState.get(
                'story.projectBeacon.protectedReturnProtocol'
            )
        ).toEqual({
            schemaVersion: 1,
            completedStepIds: [],
            packetStatus: 'not_prepared',
            transmissionStatus: 'not_sent',
            firstAppliedAt: null,
            completedAt: null,
            history: []
        });
        expect(
            gameState.get('world.currentVeilMission')
        ).toEqual({
            schemaVersion: 1,
            status: 'not_started',
            stabilizedAnchorIds: [],
            maskStatus: 'inactive',
            transmissionStatus: 'not_sent',
            startedAt: null,
            completedAt: null,
            history: []
        });
        expect(
            gameState.get('story.projectBeacon.companionConsent')
        ).toEqual({
            schemaVersion: 2,
            activeCompanionId: null,
            records: []
        });
        expect(gameState.get('creature.identityArchive')).toEqual(
            expect.objectContaining({
                creatureId: 'creature_nova_23',
                reviewedChapterIds: [
                    'identity',
                    'living_form',
                    'shared_journey',
                    'inheritance'
                ],
                completedAt: '2026-07-31T00:23:00.000Z'
            })
        );
        expect(gameState.get('story.projectBeacon.legacyCapsule')).toEqual({
            schemaVersion: 2,
            intent: 'prepare_homecoming'
        });
        expect(gameState.get('world.fendCommunity.builtProjectIds')).toEqual([
            'trailhead_shelter',
            'current_well',
            'wayfinder_relay'
        ]);
        expect(gameState.get('world.fendResidents')).toEqual(expect.objectContaining({
            metResidentIds: ['kiri', 'mara', 'tovan'],
            activeRequestId: 'relay_three_signals',
            completedRequestIds: [
                'shelter_calibration',
                'well_return_flow'
            ]
        }));
        expect(gameState.get('breedingShrine.reconciliationQueue')).toEqual([
            {
                operationId: 'fusion_pending_23',
                status: 'pending'
            }
        ]);
        expect(gameState.get('breedingShrine.consent.records')).toEqual([
            {
                operationId: 'fusion_pending_23'
            }
        ]);
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(scene.scene.start).toHaveBeenCalledWith('HubWorldScene');
    });
});
