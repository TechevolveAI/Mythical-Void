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

    test('local saves use the current schema version', () => {
        expect(manager.hasPersistedSave()).toBe(false);

        manager.save();

        const saved = JSON.parse(localStorage.getItem(manager.saveKey));
        expect(saved.version).toBe(manager.gameVersion);
        expect(saved.session).toBeUndefined();
        expect(saved.savedAt).toEqual(expect.any(Number));
        expect(manager.hasPersistedSave()).toBe(true);
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
        expect(saved.session).toBeUndefined();
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

    test('route maps unlock once and persist as permanent progression', () => {
        expect(manager.addMapToCollection('stellar_reef')).toBe(true);
        expect(manager.get('hubWorld.mapsOwned')).toEqual(['stellar_reef']);
        expect(manager.get('hubWorld.gates.stellar_reef.unlocked')).toBe(true);

        const saved = JSON.parse(localStorage.getItem(manager.saveKey));
        expect(saved.hubWorld.mapsOwned).toEqual(['stellar_reef']);
        expect(saved.hubWorld.gates.stellar_reef.unlocked).toBe(true);

        expect(manager.addMapToCollection('stellar_reef')).toBe(false);
        expect(manager.get('hubWorld.mapsOwned')).toEqual(['stellar_reef']);
        expect(manager.addMapToCollection('unknown_route')).toBe(false);
    });

    test('initial state includes every playable level progression record', () => {
        expect(manager.get('stats.levelsCompleted')).toBe(0);
        expect(manager.get('combat.bossesDefeated')).toBe(0);
        expect(manager.get('story.projectBeacon')).toEqual({
            missionLogSeen: false,
            currentMission: null,
            fieldKit: {
                id: 'wanderer_7_field_kit',
                name: 'Wanderer-7 Field Kit',
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
            endingEpilogueCompletedAt: null
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
                id: 'beacon_debrief_1',
                shipPartId: 'crystal_core',
                levelId: 'crystalCaves'
            }),
            expect.objectContaining({
                id: 'beacon_debrief_2',
                shipPartId: 'dimensional_drive',
                levelId: 'cosmicReef'
            })
        ]);
        expect(oldSave.story.projectBeacon.debriefsSeen).toEqual([]);
        expect(oldSave.hubWorld.gates.crystal_caves.unlocked).toBe(true);
        expect(oldSave.hubWorld.gates.stellar_reef.unlocked).toBe(true);
        expect(oldSave.hubWorld.gates.void_peaks.unlocked).toBe(false);
        expect(oldSave.hubWorld.shipParts.finalBossUnlocked).toBe(true);
        expect(oldSave.hubWorld.gates.final_void.unlocked).toBe(true);
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
                    legacyUpgrade,
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
