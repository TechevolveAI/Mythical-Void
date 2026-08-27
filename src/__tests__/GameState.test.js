const GameStateManager = require('../systems/GameState.js');

describe('GameStateManager', () => {
    let manager;

    beforeEach(() => {
        localStorage.clear();
        manager = new GameStateManager();
    });

    afterEach(() => {
        manager.stopAutoSave();
    });

    test('reset restores default creature state and clears persistence', () => {
        manager.set('creature.hatched', true);
        manager.set('creature.name', 'Testy');
        manager.set('player.name', 'Player1');
        localStorage.setItem(manager.saveKey, JSON.stringify({ creature: { hatched: true } }));

        manager.reset();

        expect(manager.get('creature.hatched')).toBe(false);
        expect(manager.get('creature.name')).toBe('Your Creature');
        expect(manager.get('player.name')).toBe('');
        expect(localStorage.getItem(manager.saveKey)).toBeNull();
        expect(manager.initialized).toBe(false);
    });

    test('reset after init returns session to defaults', () => {
        manager.init();
        manager.set('session.gameStarted', true);
        manager.set('session.currentScene', 'GameScene');

        manager.reset();

        expect(manager.get('session.gameStarted')).toBe(false);
        expect(manager.get('session.currentScene')).toBe('HatchingScene');
        expect(manager.initialized).toBe(false);
    });

    test('refuses to mark a creature hatched before its identity is durable', () => {
        expect(manager.completeHatching()).toBe(false);
        expect(manager.get('creature.hatched')).toBe(false);

        manager.set('creature.genes', { id: 'stable-hatch-23' });
        expect(manager.completeHatching()).toBe(true);
        expect(manager.get('creature.hatched')).toBe(true);
        expect(manager.get('creature.hatchTime')).toEqual(expect.any(Number));
    });

    test('initial state includes a versioned portable Current ecology record', () => {
        expect(manager.get('world.currentEcology')).toEqual({
            schemaVersion: 3,
            observedSignalIds: [],
            restoredRegionIds: [],
            arrivalConsequences: {},
            regions: {},
            history: []
        });
    });

    test('normalizes ability slots for partial companion bond records', () => {
        manager.set('creature.bond', {
            level: 2,
            experience: 10
        });

        expect(manager.getBondStatus()).toEqual(expect.objectContaining({
            level: 2,
            experience: 10,
            abilitySlots: {
                slot1: true,
                slot2: false,
                slot3: false
            },
            equippedAbilities: {
                slot1: null,
                slot2: null,
                slot3: null
            }
        }));
    });

    test('resolves and acknowledges one committed Shared Fusion reveal', () => {
        const invitationId =
            '824363b2-d374-4b44-bf7f-1d7a177fa074';
        const creature = {
            id: 'creature_shared_23',
            name: 'Aster',
            lineage: {
                origin: 'shared_fusion',
                sharedInvitationId: invitationId
            }
        };
        manager.set('creatures', [creature]);
        manager.set(
            'breedingShrine.sharedFusion.pendingReveal',
            {
                invitationId,
                operationId: 'fusion_shared_23',
                creatureId: creature.id,
                receivedAt: 23
            }
        );

        expect(manager.getPendingSharedFusionReveal()).toEqual({
            invitationId,
            operationId: 'fusion_shared_23',
            creatureId: creature.id,
            receivedAt: 23,
            creature
        });
        expect(
            manager.acknowledgeSharedFusionReveal(invitationId)
        ).toBe(true);
        expect(
            manager.get('breedingShrine.sharedFusion.pendingReveal')
        ).toBeNull();
        expect(
            manager.acknowledgeSharedFusionReveal(invitationId)
        ).toBe(false);
    });

    test('local saves use the current schema version', () => {
        expect(manager.hasPersistedSave()).toBe(false);

        manager.set('session.gameStarted', true);
        manager.save();

        const saved = JSON.parse(localStorage.getItem(manager.saveKey));
        expect(saved.version).toBe(manager.gameVersion);
        expect(saved.session).toEqual({ gameStarted: true });
        expect(saved.savedAt).toEqual(expect.any(Number));
        expect(manager.hasPersistedSave()).toBe(true);
    });

    test('restores a durable journey start without restoring a transient scene', () => {
        manager.set('session.gameStarted', true);
        manager.set('session.currentScene', 'ShopScene');
        manager.set('creature.hatched', true);
        manager.set('creature.name', 'Nova');
        expect(manager.save()).toBe(true);

        const restored = new GameStateManager();
        expect(restored.load()).toBe(true);

        expect(restored.get('session.gameStarted')).toBe(true);
        expect(restored.get('session.currentScene')).toBe('HatchingScene');
        restored.stopAutoSave();
    });

    test('infers a started journey for legacy saves with a hatched companion', () => {
        localStorage.setItem(manager.saveKey, JSON.stringify({
            version: manager.gameVersion,
            savedAt: Date.now(),
            creature: { hatched: true, name: 'Nova' }
        }));

        expect(manager.load()).toBe(true);
        expect(manager.get('session.gameStarted')).toBe(true);
    });

    test('external saves are migrated, persisted locally, and preserve the active session', () => {
        manager.set('session.currentScene', 'HubWorldScene');
        const restored = manager.applyExternalSave({
            version: manager.gameVersion,
            savedAt: 5000,
            creature: {
                hatched: true,
                name: 'Comet'
            }
        }, {
            source: 'cloud',
            persist: true
        });

        expect(restored).toBe(true);
        expect(manager.get('creature.name')).toBe('Comet');
        expect(manager.get('session.currentScene')).toBe('HubWorldScene');

        const saved = JSON.parse(localStorage.getItem(manager.saveKey));
        expect(saved.creature.name).toBe('Comet');
        expect(saved.session).toEqual({ gameStarted: true });
        expect(manager.hasPersistedSave()).toBe(true);
    });

    test('listener cleanup via disposer and off()', () => {
        const spy = jest.fn();
        const disposer = manager.on('event/sample', spy);

        manager.emit('event/sample', { foo: 'bar' });
        expect(spy).toHaveBeenCalledTimes(1);

        disposer();
        manager.emit('event/sample', { foo: 'baz' });
        expect(spy).toHaveBeenCalledTimes(1);

        const anotherSpy = jest.fn();
        manager.on('event/sample', anotherSpy);
        manager.off('event/sample', anotherSpy);
        manager.emit('event/sample');
        expect(anotherSpy).not.toHaveBeenCalled();
    });

    test('once() listeners are invoked a single time', () => {
        const spy = jest.fn();
        manager.once('levelUp', spy);

        manager.emit('levelUp', { level: 2 });
        manager.emit('levelUp', { level: 3 });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith({ level: 2 });
    });

    test('performCareAction applies override happiness bonus', () => {
        manager.set('creature.hatched', true);
        manager.set('creature.stats.happiness', 40);

        const eventSpy = jest.fn();
        manager.once('careActionPerformed', eventSpy);

        const success = manager.performCareAction('feed', 25);

        expect(success).toBe(true);
        expect(manager.get('creature.stats.happiness')).toBe(65);
        expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
            action: 'feed',
            happinessBonus: 25,
            happinessOverride: true
        }));
    });

    test('supports calm contact for new and older care saves', () => {
        manager.set('creature.hatched', true);
        manager.set('creature.stats.happiness', 40);
        manager.set('creature.care.dailyCare.petCount', undefined);

        expect(manager.performCareAction('pet', 8)).toBe(true);
        expect(manager.get('creature.stats.happiness')).toBe(48);
        expect(manager.get('creature.care.dailyCare.petCount')).toBe(1);
        expect(manager.getCareStatus()).toEqual(expect.objectContaining({
            canPet: true,
            dailyCare: expect.objectContaining({ petCount: 1, petLimit: -1 })
        }));
    });

    test('restores energy offline without reducing happiness for absence', () => {
        const now = 1786397723000;
        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
        manager.set('creature.hatched', true);
        manager.set('creature.stats.energy', 20);
        manager.set('creature.stats.happiness', 40);
        manager.set(
            'creature.care.lastCareTime',
            now - (8 * 60 * 60 * 1000)
        );
        manager.set('creature.care.lastOfflineRecoveryTime', null);
        const recoverySpy = jest.fn();
        manager.once('creatureOfflineRecoveryApplied', recoverySpy);

        manager.updateHappinessFromTime();

        expect(manager.get('creature.stats.energy')).toBe(68);
        expect(manager.get('creature.stats.happiness')).toBe(42);
        expect(manager.get('creature.care.lastOfflineRecoveryTime')).toBe(now);
        expect(recoverySpy).toHaveBeenCalledWith(expect.objectContaining({
            energyBefore: 20,
            energyAfter: 68,
            happinessBefore: 40,
            happinessAfter: 42
        }));

        manager.set('creature.stats.happiness', 87);
        manager.set(
            'creature.care.lastOfflineRecoveryTime',
            now - (8 * 60 * 60 * 1000)
        );
        manager.updateHappinessFromTime();
        expect(manager.get('creature.stats.happiness')).toBe(87);
        dateSpy.mockRestore();
    });

    test('route maps persist discovery without skipping campaign prerequisites', () => {
        expect(manager.addMapToCollection('stellar_reef')).toBe(true);
        expect(manager.get('hubWorld.mapsOwned')).toEqual(['stellar_reef']);
        expect(manager.get('hubWorld.gates.stellar_reef.unlocked')).toBe(false);

        const saved = JSON.parse(localStorage.getItem(manager.saveKey));
        expect(saved.hubWorld.mapsOwned).toEqual(['stellar_reef']);
        expect(saved.hubWorld.gates.stellar_reef.unlocked).toBe(false);

        expect(manager.addMapToCollection('stellar_reef')).toBe(false);
        expect(manager.get('hubWorld.mapsOwned')).toEqual(['stellar_reef']);
        expect(manager.addMapToCollection('unknown_route')).toBe(false);
    });

    test('gate unlock and entry reject discovered routes until all earlier levels are complete', () => {
        manager.set('player.cosmicCoins', 5000);
        manager.addMapToCollection('aurora_depths');
        manager.set('hubWorld.gates.aurora_depths.unlocked', true);

        expect(manager.unlockGate('aurora_depths', true)).toEqual(
            expect.objectContaining({
                success: false,
                code: 'campaign_prerequisite',
                requiredRoute: expect.objectContaining({
                    levelStateId: 'mythicalForest'
                })
            })
        );
        expect(manager.enterGate('aurora_depths')).toEqual(
            expect.objectContaining({
                success: false,
                code: 'campaign_prerequisite'
            })
        );
        expect(manager.get('player.cosmicCoins')).toBe(5000);
        expect(manager.get('hubWorld.gates.aurora_depths.visits')).toBe(0);
    });

    test('campaign synchronization recovers an out-of-order save as gaps are completed', () => {
        manager.set('levels.crystalCaves.completed', true);
        manager.set('levels.auroraDepths.completed', true);
        manager.set('hubWorld.gates.aurora_depths.unlocked', true);

        expect(manager.syncCanonicalCampaignGates({ emitEvents: false })).toContain(
            'aurora_depths'
        );
        expect(manager.get('hubWorld.gates.crystal_caves.unlocked')).toBe(false);
        expect(manager.get('hubWorld.gates.stellar_reef.unlocked')).toBe(false);

        manager.set('levels.mythicalForest.completed', true);
        manager.syncCanonicalCampaignGates({ emitEvents: false });

        expect(manager.get('hubWorld.gates.crystal_caves.unlocked')).toBe(true);
        expect(manager.get('hubWorld.gates.stellar_reef.unlocked')).toBe(true);
        expect(manager.get('hubWorld.gates.void_peaks.unlocked')).toBe(false);
    });

    test('initial state includes every playable level progression record', () => {
        expect(manager.get('stats.levelsCompleted')).toBe(0);
        expect(manager.get('combat.bossesDefeated')).toBe(0);
        expect(manager.get('story.projectBeacon')).toEqual({
            missionLogSeen: false,
            currentMission: null,
            fieldKit: {
                id: 'wanderer_7_field_kit',
                name: 'Wanderer-77 Field Kit',
                recovered: false,
                recoveredAt: null,
                katana: {
                    id: 'earth_field_katana',
                    name: 'Earth-forged Field Katana',
                    material: 'Titanium-ceramic laminate',
                    configuration: 'secured_in_case',
                    upgradeSlots: 2,
                    installedUpgrades: []
                }
            },
            pendingDebriefs: [],
            debriefsSeen: [],
            highPowerReveals: [],
            firstExpeditionPromptSeen: false,
            firstExpeditionDrill: {
                completed: false,
                completedAt: null
            },
            expeditionCheckpoint: null,
            uplinkRestored: false,
            uplinkRestoredAt: null,
            endingChoice: null,
            endingChoiceDate: null,
            endingEpilogueSeen: false,
            endingEpilogueCompletedAt: null,
            finale: {
                schemaVersion: 1,
                sharedOutcome: null,
                priority: null,
                prioritySelectedAt: null,
                epilogueSeen: false,
                epilogueCompletedAt: null
            },
            remainAndDefend: {
                schemaVersion: 1,
                status: 'not_started',
                completedAt: null,
                completionOperationId: null,
                priorityAtCompletion: null,
                history: []
            },
            sensei: {
                schemaVersion: 2,
                relationship: 'pre_mission_friend_and_training_partner',
                memories: [
                    'begin_with_your_footing',
                    'trust_begins_with_how_you_enter',
                    'power_is_knowing_what_not_to_take'
                ],
                memoryLedger: {
                    schemaVersion: 1,
                    recalledMemoryIds: [],
                    lesson: {
                        id: 'centering_stance',
                        status: 'locked',
                        practiceCount: 0,
                        firstPracticedAt: null,
                        lastPracticedAt: null
                    },
                    history: []
                },
                encryptedContact: {
                    channelId: 'DOJO-23-77',
                    status: 'fragmented',
                    contactAttempted: false,
                    contactEstablished: false,
                    recoveredAt: null
                }
            },
            shipCapabilities: {
                schemaVersion: 1,
                stealthDescent: 'damaged',
                secureReturnVector: 'unavailable',
                manualLanding: 'unavailable',
                blackBoxProof: 'missing',
                passengerCapacity: 0,
                creatureLifeSupport: 'not_assessed',
                longRangeUplink: 'offline'
            },
            shipReconstruction: {
                schemaVersion: 1,
                completedStepIds: [],
                firstInstalledAt: null,
                completedAt: null,
                history: []
            },
            shipFieldSupport: {
                schemaVersion: 1,
                lastServicedLevel: 0,
                serviceCount: 0,
                lastServicedAt: null,
                history: []
            },
            shipArchive: {
                schemaVersion: 1,
                reviewedSectionIds: [],
                firstReviewedAt: null,
                completedAt: null,
                history: []
            },
            protectedReturnProtocol: {
                schemaVersion: 1,
                completedStepIds: [],
                packetStatus: 'not_prepared',
                transmissionStatus: 'not_sent',
                firstAppliedAt: null,
                completedAt: null,
                history: []
            },
            companionConsent: {
                schemaVersion: 2,
                activeCompanionId: null,
                records: []
            },
            companionEarthMemory: {
                schemaVersion: 1,
                activeCompanionId: null,
                records: []
            },
            legacyCapsule: null
        });
        expect(manager.get('levels')).toEqual(expect.objectContaining({
            crystalCaves: expect.objectContaining({ completed: false }),
            cosmicReef: expect.objectContaining({ completed: false }),
            mythicalForest: expect.objectContaining({ completed: false }),
            voidPeaks: expect.objectContaining({ completed: false }),
            auroraDepths: expect.objectContaining({ completed: false }),
            finalVoid: expect.objectContaining({ completed: false })
        }));
    });

    test('initial state includes save-backed Signal Garden progression', () => {
        expect(manager.get('world.signalGarden')).toEqual({
            stage: 'seed',
            tendCount: 0,
            lastTendedDay: null,
            lastTendedAt: null,
            plantedAt: null,
            bloomedAt: null
        });
    });

    test('initial state includes a private Quiet Current mission record', () => {
        expect(manager.get('world.currentVeilMission')).toEqual({
            schemaVersion: 1,
            status: 'not_started',
            stabilizedAnchorIds: [],
            maskStatus: 'inactive',
            transmissionStatus: 'not_sent',
            startedAt: null,
            completedAt: null,
            history: []
        });
    });

    test('initial state includes save-backed Living Signal observations', () => {
        expect(manager.get('world.livingSignals')).toEqual({
            observedIds: [],
            lastObservedId: null,
            lastObservedAt: null
        });
    });

    test('records unique exploration areas and persists gate visits', () => {
        const areaVisited = jest.fn();
        manager.on('areaVisited', areaVisited);

        expect(manager.visitArea('Sanctuary:LivingArea')).toBe(true);
        expect(manager.visitArea('sanctuary:livingarea')).toBe(false);
        expect(manager.visitArea('not valid!')).toBe(false);
        expect(manager.get('world.visitedAreas')).toEqual([
            'sanctuary:livingarea'
        ]);
        expect(areaVisited).toHaveBeenCalledWith({
            areaId: 'sanctuary:livingarea',
            totalVisited: 1
        });

        expect(manager.enterGate('mythical_forest').success).toBe(true);
        expect(manager.get('world.visitedAreas')).toEqual([
            'sanctuary:livingarea',
            'realm:mythical_forest'
        ]);

        const saved = JSON.parse(localStorage.getItem(manager.saveKey));
        expect(saved.world.visitedAreas).toEqual([
            'sanctuary:livingarea',
            'realm:mythical_forest'
        ]);
        expect(saved.hubWorld.gates.mythical_forest.visits).toBe(1);
    });

    test('campaign migration backfills completion totals and final gate state', () => {
        const oldSave = {
            levels: {
                crystalCaves: { completed: true },
                cosmicReef: { completed: true }
            },
            hubWorld: {
                shipCompletionCutsceneShown: true,
                shipParts: {
                    collected: [
                        'crystal_core',
                        'dimensional_drive',
                        'forest_core',
                        'hull_plating',
                        'aurora_reactor'
                    ],
                    totalRequired: 5,
                    finalBossUnlocked: false
                },
                gates: {
                    crystal_caves: { unlocked: false },
                    stellar_reef: { unlocked: false },
                    void_peaks: { unlocked: false },
                    aurora_depths: { unlocked: false },
                    final_void: { unlocked: false }
                }
            }
        };

        manager.migrateCampaignProgress(oldSave);

        expect(oldSave.stats.levelsCompleted).toBe(2);
        expect(oldSave.story.projectBeacon.pendingDebriefs).toEqual([
            expect.objectContaining({
                id: 'beacon_debrief_2',
                shipPartId: 'crystal_core',
                levelId: 'crystalCaves'
            }),
            expect.objectContaining({
                id: 'beacon_debrief_3',
                shipPartId: 'dimensional_drive',
                levelId: 'cosmicReef'
            })
        ]);
        expect(oldSave.story.projectBeacon.debriefsSeen).toEqual([]);
        expect(oldSave.hubWorld.gates.crystal_caves.unlocked).toBe(false);
        expect(oldSave.hubWorld.gates.stellar_reef.unlocked).toBe(false);
        expect(oldSave.hubWorld.gates.void_peaks.unlocked).toBe(false);
        expect(oldSave.hubWorld.shipParts.finalBossUnlocked).toBe(false);
        expect(oldSave.hubWorld.gates.final_void.unlocked).toBe(false);
    });

    test('campaign migration preserves out-of-order completion and map discovery but relocks skipped gates', () => {
        const save = {
            stats: { levelsCompleted: 1 },
            levels: {
                mythicalForest: { completed: false },
                auroraDepths: {
                    completed: true,
                    completedAt: '2026-08-01T12:00:00.000Z'
                }
            },
            hubWorld: {
                mapsOwned: ['aurora_depths'],
                shipParts: {
                    collected: ['aurora_reactor'],
                    totalRequired: 5,
                    finalBossUnlocked: false
                },
                gates: {
                    mythical_forest: { unlocked: true },
                    crystal_caves: { unlocked: false },
                    stellar_reef: { unlocked: false },
                    void_peaks: { unlocked: false },
                    aurora_depths: { unlocked: true },
                    final_void: { unlocked: false }
                }
            }
        };

        manager.migrateCampaignProgress(save);

        expect(save.levels.auroraDepths.completed).toBe(true);
        expect(save.stats.levelsCompleted).toBe(1);
        expect(save.hubWorld.mapsOwned).toEqual(['aurora_depths']);
        expect(save.hubWorld.gates.aurora_depths.unlocked).toBe(false);
        expect(save.story.projectBeacon.pendingDebriefs).toEqual([
            {
                id: 'beacon_debrief_5',
                levelId: 'auroraDepths',
                shipPartId: 'aurora_reactor',
                completedAt: '2026-08-01T12:00:00.000Z'
            }
        ]);
    });

    test('campaign migration converts a count-only legacy save into canonical level IDs', () => {
        const save = {
            stats: { levelsCompleted: 3 },
            hubWorld: {
                shipParts: {
                    collected: ['forest_core', 'crystal_core', 'dimensional_drive'],
                    totalRequired: 5,
                    finalBossUnlocked: false
                },
                gates: {
                    mythical_forest: { unlocked: true },
                    crystal_caves: { unlocked: false },
                    stellar_reef: { unlocked: false },
                    void_peaks: { unlocked: false },
                    aurora_depths: { unlocked: false },
                    final_void: { unlocked: false }
                }
            }
        };

        manager.migrateCampaignProgress(save);

        expect(save.levels).toEqual(expect.objectContaining({
            mythicalForest: expect.objectContaining({ completed: true }),
            crystalCaves: expect.objectContaining({ completed: true }),
            cosmicReef: expect.objectContaining({ completed: true })
        }));
        expect(save.hubWorld.gates.crystal_caves.unlocked).toBe(true);
        expect(save.hubWorld.gates.stellar_reef.unlocked).toBe(true);
        expect(save.hubWorld.gates.void_peaks.unlocked).toBe(true);
        expect(save.story.projectBeacon.pendingDebriefs.map(entry => entry.id)).toEqual([
            'beacon_debrief_1',
            'beacon_debrief_2',
            'beacon_debrief_3'
        ]);
    });

    test('campaign migration preserves existing debrief history', () => {
        const saveWithDebriefs = {
            stats: { levelsCompleted: 2 },
            story: {
                projectBeacon: {
                    pendingDebriefs: [],
                    debriefsSeen: ['beacon_debrief_1', 'beacon_debrief_2']
                }
            },
            levels: {
                mythicalForest: { completed: true },
                crystalCaves: { completed: true }
            },
            hubWorld: {
                shipParts: {
                    collected: ['forest_core', 'crystal_core'],
                    totalRequired: 5
                },
                gates: {
                    final_void: { unlocked: false }
                }
            }
        };

        manager.migrateCampaignProgress(saveWithDebriefs);

        expect(saveWithDebriefs.story.projectBeacon.pendingDebriefs).toEqual([]);
        expect(saveWithDebriefs.story.projectBeacon.debriefsSeen).toEqual([
            'beacon_debrief_1',
            'beacon_debrief_2'
        ]);
    });

    test.each([
        ['earth', 'prepare_homecoming'],
        ['void', 'remain_and_defend']
    ])(
        'campaign migration converts legacy %s ending into %s priority',
        (endingChoice, expectedPriority) => {
            const oldSave = {
                stats: { levelsCompleted: 6 },
                levels: {},
                story: {
                    projectBeacon: {
                        endingChoice,
                        endingChoiceDate: '2026-07-27T13:00:00.000Z',
                        endingEpilogueSeen: true,
                        endingEpilogueCompletedAt:
                            '2026-07-27T13:05:00.000Z'
                    }
                }
            };

            manager.migrateCampaignProgress(oldSave);

            expect(oldSave.story.projectBeacon.finale).toEqual(
                expect.objectContaining({
                    priority: expectedPriority,
                    prioritySelectedAt: '2026-07-27T13:00:00.000Z',
                    epilogueSeen: true,
                    sharedOutcome: expect.objectContaining({
                        coordinatesProtected: true,
                        uplinkMode: 'held',
                        departureStatus: 'deferred',
                        currentCommitment: 'remain_and_defend'
                    })
                })
            );
            expect(
                oldSave.story.projectBeacon.sensei.encryptedContact
                    .contactEstablished
            ).toBe(false);
            expect(
                oldSave.story.projectBeacon.sensei.memoryLedger
            ).toEqual({
                schemaVersion: 1,
                recalledMemoryIds: [],
                lesson: {
                    id: 'centering_stance',
                    status: 'locked',
                    practiceCount: 0,
                    firstPracticedAt: null,
                    lastPracticedAt: null
                },
                history: []
            });
            expect(
                oldSave.story.projectBeacon.companionConsent
            ).toEqual(expect.objectContaining({
                schemaVersion: 2,
                activeCompanionId: 'active_companion',
                records: [
                    expect.objectContaining({
                        companionId: 'active_companion',
                        travelStatus: 'not_yet_asked',
                        disclosureStatus: 'withheld',
                        willingPassenger: null,
                        vetoRecognized: true
                    })
                ]
            }));
            expect(
                oldSave.story.projectBeacon.remainAndDefend
            ).toEqual({
                schemaVersion: 1,
                status: 'not_started',
                completedAt: null,
                completionOperationId: null,
                priorityAtCompletion: null,
                history: []
            });
            expect(
                oldSave.story.projectBeacon.shipReconstruction
                    .completedStepIds
            ).toEqual([
                'living_power_lattice',
                'propulsion_control',
                'sealed_return_vector',
                'resonance_hull',
                'uplink_hold',
                'black_box_recovery'
            ]);
        }
    );

    test('campaign migration bounds a completed recovery chapter receipt', () => {
        const save = {
            story: {
                projectBeacon: {
                    remainAndDefend: {
                        status: 'complete',
                        completedAt: '2026-07-31T03:00:00.000Z',
                        priorityAtCompletion: 'prepare_homecoming',
                        exactLandingSite: 'private',
                        history: [{
                            operationId: 'COMMONS COUNCIL',
                            priority: 'prepare_homecoming',
                            occurredAt: '2026-07-31T03:00:00.000Z',
                            playerNote: 'private'
                        }]
                    }
                }
            }
        };

        manager.migrateFranchiseHandoff(save);

        expect(save.story.projectBeacon.remainAndDefend).toEqual({
            schemaVersion: 1,
            status: 'complete',
            completedAt: '2026-07-31T03:00:00.000Z',
            completionOperationId: 'commons_council',
            priorityAtCompletion: 'prepare_homecoming',
            history: [{
                operationId: 'commons_council',
                type: 'chapter_completed',
                priority: 'prepare_homecoming',
                occurredAt: '2026-07-31T03:00:00.000Z'
            }]
        });
        expect(
            JSON.stringify(save.story.projectBeacon.remainAndDefend)
        ).not.toContain('exactLandingSite');
    });

    test('campaign migration backfills earned katana upgrades without replacing legacy data', () => {
        const legacyUpgrade = {
            id: 'legacy_resonance',
            installedAt: '2026-01-01T00:00:00.000Z'
        };
        const oldSave = {
            story: {
                projectBeacon: {
                    fieldKit: {
                        recovered: true,
                        katana: {
                            upgradeSlots: 3,
                            configuration: 'earth_forged',
                            installedUpgrades: [legacyUpgrade]
                        }
                    }
                }
            },
            levels: {
                crystalCaves: { completed: true },
                auroraDepths: { completed: true }
            },
            hubWorld: {
                shipParts: { collected: [], totalRequired: 5 },
                gates: { final_void: { unlocked: false } }
            }
        };

        manager.migrateCampaignProgress(oldSave);

        expect(oldSave.story.projectBeacon.fieldKit.katana).toEqual(
            expect.objectContaining({
                configuration: 'creature_tech_adapted',
                installedUpgrades: [
                    expect.objectContaining({
                        ...legacyUpgrade,
                        witnessCompanionId: 'active_companion'
                    }),
                    expect.objectContaining({
                        id: 'crystal_edge',
                        migrated: true
                    }),
                    expect.objectContaining({
                        id: 'aurora_guard',
                        migrated: true
                    })
                ]
            })
        );

        manager.migrateCampaignProgress(oldSave);
        expect(
            oldSave.story.projectBeacon.fieldKit.katana.installedUpgrades
        ).toHaveLength(3);
    });

    test('campaign migration repairs stale finite completion counters', () => {
        const saveWithStaleCounter = {
            stats: { levelsCompleted: 0 },
            levels: {
                mythicalForest: { completed: true },
                crystalCaves: { completed: true },
                cosmicReef: { completed: true }
            },
            hubWorld: {
                shipParts: {
                    collected: ['forest_core', 'crystal_core', 'dimensional_drive'],
                    totalRequired: 5
                },
                gates: {
                    crystal_caves: { unlocked: false },
                    stellar_reef: { unlocked: false },
                    void_peaks: { unlocked: false },
                    aurora_depths: { unlocked: false },
                    final_void: { unlocked: false }
                }
            }
        };

        manager.migrateCampaignProgress(saveWithStaleCounter);

        expect(saveWithStaleCounter.stats.levelsCompleted).toBe(3);
        expect(saveWithStaleCounter.hubWorld.gates.crystal_caves.unlocked).toBe(true);
        expect(saveWithStaleCounter.hubWorld.gates.stellar_reef.unlocked).toBe(true);
        expect(saveWithStaleCounter.hubWorld.gates.void_peaks.unlocked).toBe(true);
        expect(saveWithStaleCounter.hubWorld.gates.aurora_depths.unlocked).toBe(false);
    });

    test('campaign migration updates the legacy Wanderer field-kit display name', () => {
        const oldSave = {
            levels: {},
            stats: {},
            story: {
                projectBeacon: {
                    fieldKit: {
                        id: 'wanderer_7_field_kit',
                        name: 'Wanderer-7 Field Kit',
                        recovered: false
                    }
                }
            }
        };

        manager.migrateCampaignProgress(oldSave);

        expect(oldSave.story.projectBeacon.fieldKit.id).toBe('wanderer_7_field_kit');
        expect(oldSave.story.projectBeacon.fieldKit.name).toBe('Wanderer-77 Field Kit');
    });

    test('campaign migration repairs a legacy six-part final-gate requirement', () => {
        const saveWithImpossibleRequirement = {
            stats: { levelsCompleted: 5 },
            levels: {
                mythicalForest: { completed: true },
                crystalCaves: { completed: true },
                cosmicReef: { completed: true },
                voidPeaks: { completed: true },
                auroraDepths: { completed: true }
            },
            hubWorld: {
                shipCompletionCutsceneShown: true,
                shipParts: {
                    collected: [
                        'forest_core',
                        'crystal_core',
                        'dimensional_drive',
                        'hull_plating',
                        'aurora_reactor'
                    ],
                    totalRequired: 6,
                    finalBossUnlocked: false
                },
                gates: {
                    final_void: { unlocked: false }
                }
            },
            story: {
                projectBeacon: {
                    pendingDebriefs: [],
                    debriefsSeen: []
                }
            }
        };

        manager.migrateCampaignProgress(saveWithImpossibleRequirement);

        expect(saveWithImpossibleRequirement.hubWorld.shipParts.totalRequired).toBe(5);
        expect(saveWithImpossibleRequirement.hubWorld.shipParts.finalBossUnlocked).toBe(true);
        expect(saveWithImpossibleRequirement.hubWorld.gates.final_void.unlocked).toBe(true);
    });

    test('hub migration clears stale Void Peaks development flags', () => {
        const oldSave = {
            hubWorld: {
                gates: {
                    void_peaks: {
                        unlocked: false,
                        inDevelopment: true
                    }
                }
            }
        };

        manager.migrateHubWorldGates(oldSave);

        expect(oldSave.hubWorld.gates.void_peaks.inDevelopment).toBe(false);
    });
});
